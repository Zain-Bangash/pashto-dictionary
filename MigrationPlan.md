# Migration Plan — TypeScript & AWS Infrastructure

## Overview

This document covers three future build phases that migrate the pashto-dictionary stack to TypeScript (backend) and AWS (hosting, auth). All services used are free-forever tier. Complete Phase 10 before starting any of these.

---

## Target Architecture

```
Browser
  │
  ├── React app ──────────────► AWS Amplify Hosting   (free forever)
  │
  └── API calls ──────────────► AWS API Gateway       (free: 1M req/month forever)
                                      │
                                      ▼
                               AWS Lambda              (free: 1M req/month forever)
                               (Express + serverless-http)
                                      │
                                      ├── MongoDB Atlas M0   (free forever, already AWS)
                                      │
                                      └── AWS Cognito        (free: 50,000 MAUs forever)
```

## Free Tier Summary

| Service | Free allowance | Expiry |
|---|---|---|
| AWS Amplify Hosting | 1,000 build mins/month, 5 GB bandwidth, 15 GB storage | Forever |
| AWS API Gateway | 1M API calls/month | Forever |
| AWS Lambda | 1M requests + 400,000 GB-seconds/month | Forever |
| AWS Cognito | 50,000 monthly active users | Forever |
| MongoDB Atlas M0 | 512 MB storage, shared cluster | Forever |

**Total monthly cost: $0.00**

> EC2 is excluded. Its free tier expires after 12 months. Lambda is free forever and requires only one package (`serverless-http`) to wrap the existing Express app. DocumentDB is also excluded — it is not on the free tier (~$200+/month). MongoDB Atlas M0 is already on AWS infrastructure; leave it where it is.

---

## Phase 11 — TypeScript Migration (Server Only)

**Do after:** Phase 10 (Polish & Production Readiness)

### Why TypeScript on the backend?

The backend is 100% CommonJS JavaScript today. TypeScript adds compile-time safety (wrong field names on Mongoose documents, missing required props in middleware), improves IDE autocomplete, and is a portfolio signal for technical reviewers. The client stays JSX/JS — React 19 + Vite works fine without TypeScript.

### New dependencies

```bash
# server/
npm install -D typescript ts-node ts-jest
npm install -D @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cors
```

### `server/tsconfig.json` (create new)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### `server/jest.config.js` update

```js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 30000,
  testMatch: ['**/__tests__/**/*.test.ts'],
};
```

### `server/package.json` scripts update

```json
{
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js",
    "dev": "ts-node src/index.ts",
    "test": "jest --runInBand --forceExit"
  }
}
```

### Migration order (rename `.js` → `.ts`, add types one layer at a time)

1. `src/utils/logger.js` → `logger.ts`
2. `src/middleware/auth.js` → `auth.ts`, `requireRole.js` → `requireRole.ts`
3. `src/models/User.js` → `User.ts` (add `IUser` interface), repeat for all models
4. `src/controllers/*.js` → `*.ts`
5. `src/routes/*.js` → `*.ts`
6. `src/index.js` → `index.ts`

### Model interface pattern

```ts
// Example: src/models/User.ts
import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  passwordHash: string;
  role: 'user' | 'moderator' | 'admin';
  createdAt: Date;
}

const userSchema = new Schema<IUser>({ ... });
export default model<IUser>('User', userSchema);
```

Repeat for `IConcept`, `IVariant`, `IModerationLog`.

### Impact on existing tests

| Test suite | Impact |
|---|---|
| `server/src/__tests__/*.test.js` → `.test.ts` | Rename files; test logic unchanged |
| `client/src/__tests__/` | No change |
| `e2e/tests/` | No change |

### Verification

```bash
npx tsc --noEmit   # must output zero errors
npm test           # must still pass
```

---

## Phase 12 — AWS Deployment (Amplify + Lambda)

**Do after:** Phase 11 (TypeScript)

### Backend: Lambda wrapper

Add one new file — `server/src/lambda.ts`. The existing Express app is unchanged.

```ts
// server/src/lambda.ts
import serverless from 'serverless-http';
import app from './app';   // extract app from index.ts into app.ts first

export const handler = serverless(app);
```

```bash
npm install serverless-http
npm install -D @types/serverless-http
```

Refactor: extract `app` creation from `index.ts` into `app.ts` (no listen call). `index.ts` calls `app.listen` for local dev. `lambda.ts` exports the handler for AWS.

### Frontend: AWS Amplify Hosting

1. Push repo to GitHub (already done)
2. In AWS Console → Amplify → New app → Connect GitHub repo
3. Select `main` branch; Amplify detects Vite automatically
4. Set environment variable: `VITE_API_URL` = API Gateway URL
5. Deploy

`amplify.yml` (create at project root):

```yaml
version: 1
frontend:
  phases:
    preBuild:
      commands:
        - cd client && npm ci
    build:
      commands:
        - npm run build
  artifacts:
    baseDirectory: client/dist
    files:
      - '**/*'
  cache:
    paths:
      - client/node_modules/**/*
```

### Backend: API Gateway + Lambda

Options (choose one):

**Option B (chosen) — AWS Console + GitHub Actions direct deploy**
1. Lambda → Create function → Node.js 22 runtime
2. API Gateway → Create HTTP API → Lambda proxy integration
3. GitHub Actions `deploy.yml` builds the TypeScript, zips `dist/` + prod `node_modules`, and calls `aws lambda update-function-code`

**Option A — AWS SAM / CloudFormation** — deferred to Phase 14. See Phase 14 section below.

### Environment variables

Add to Lambda environment (via Console or SAM):
```
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
NODE_ENV=production
```

### Impact on tests

All tests continue hitting the local Express server — no changes needed. For E2E against production, update `playwright.config.js` `baseURL`.

---

## Phase 13 — AWS Cognito Migration

**Do after:** Phase 12 (AWS Deployment)

This is the highest-effort phase. Treat it as a full build phase with its own tester → coder cycle.

### What Cognito replaces

| Removed | Replaced with |
|---|---|
| `bcryptjs` | Cognito User Pool (handles hashing) |
| `JWT_SECRET` | Cognito JWKS endpoint (public keys, auto-rotated) |
| `POST /api/auth/register` | Cognito `signUp()` API |
| `POST /api/auth/login` | Cognito `initiateAuth()` API |
| `GET /api/auth/me` | Decode Cognito token claims |
| `jwt.verify(token, secret)` in middleware | `aws-jwt-verify` JWKS verification |
| `User.passwordHash` field | `User.cognitoSub` (Cognito's unique user ID) |

### New dependencies

```bash
# server/
npm install aws-jwt-verify

# client/
npm install @aws-amplify/auth @aws-amplify/core
```

### New environment variables

```
# server/.env
COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
AWS_REGION=us-east-1

# client/.env
VITE_COGNITO_USER_POOL_ID=us-east-1_xxxxxxx
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
VITE_AWS_REGION=us-east-1
```

### `server/src/middleware/auth.ts` rewrite

```ts
import { CognitoJwtVerifier } from 'aws-jwt-verify';

const verifier = CognitoJwtVerifier.create({
  userPoolId: process.env.COGNITO_USER_POOL_ID!,
  tokenUse: 'access',
  clientId: process.env.COGNITO_CLIENT_ID!,
});

export async function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ success: false, error: { message: 'No token' } });
  try {
    const payload = await verifier.verify(token);
    // Role is resolved from MongoDB — Cognito Access Tokens do not include
    // custom user attributes (custom:role only appears in ID tokens).
    const user = await User.findOne({ cognitoSub: payload.sub }, 'role').lean();
    req.user = { id: payload.sub, role: user?.role ?? 'user' };
    next();
  } catch {
    res.status(401).json({ success: false, error: { message: 'Invalid token' } });
  }
}
```

### `client/src/context/AuthContext.jsx` rewrite (key parts)

```js
import { signIn, signUp, signOut, getCurrentUser, fetchAuthSession } from '@aws-amplify/auth';

// Replace login axios call:
const { isSignedIn } = await signIn({ username: email, password });

// Replace register axios call:
await signUp({ username: email, password, options: { userAttributes: { email, preferred_username: username } } });

// Get token for API calls:
const { tokens } = await fetchAuthSession();
const accessToken = tokens.accessToken.toString();
```

### Impact on tests

| File | Change |
|---|---|
| `server/src/__tests__/auth.test.ts` | Full rewrite — mock `aws-jwt-verify`'s `verify()` method |
| `client/src/__tests__/AuthContext.test.jsx` | Rewrite — `vi.mock('@aws-amplify/auth', ...)` |
| `client/src/__tests__/Login.test.jsx` | Update mock targets |
| `client/src/__tests__/Register.test.jsx` | Update mock targets |
| `e2e/tests/` | Add Cognito helper to get a real access token for test users |
| All other tests | Unaffected |

### E2E test strategy for Cognito

Create a test user in the Cognito User Pool (via AWS Console or CLI). In `e2e/global-setup.ts`, call `initiateAuth` directly against Cognito to get a token, then inject it into Playwright's `storageState`.

```ts
// e2e/global-setup.ts
import { CognitoIdentityProviderClient, InitiateAuthCommand } from '@aws-sdk/client-cognito-identity-provider';

const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION });
const { AuthenticationResult } = await client.send(new InitiateAuthCommand({
  AuthFlow: 'USER_PASSWORD_AUTH',
  ClientId: process.env.COGNITO_CLIENT_ID,
  AuthParameters: { USERNAME: process.env.E2E_EMAIL, PASSWORD: process.env.E2E_PASSWORD },
}));
// Save AuthenticationResult.AccessToken to storageState
```

---

---

## Phase 14 — SAM Infrastructure as Code

**Do after:** Phase 13 (Cognito)

### Why SAM after Cognito?

Phase 12 deployed the backend via a direct `aws lambda update-function-code` call. That updates the Lambda's *code* but the function itself, the API Gateway, IAM roles, and environment variables live only in the AWS Console. SAM describes all of those resources as code in `template.yaml`, owned by a CloudFormation stack. Deleting and redeploying from scratch requires one command instead of recreating everything manually.

Cognito comes first because it touches the most application code and tests. SAM is purely infrastructure — it has zero impact on application logic and is safe to do last.

### New files

**`template.yaml`** (project root):

```yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Globals:
  Function:
    Runtime: nodejs22.x
    Timeout: 30
    MemorySize: 256

Parameters:
  MongodbUri:
    Type: String
    NoEcho: true
  CognitoUserPoolId:
    Type: String
  CognitoClientId:
    Type: String
  CognitoClientSecret:
    Type: String
    NoEcho: true

Resources:
  PashtoApi:
    Type: AWS::Serverless::HttpApi
    Properties:
      Tags: {}   # empty tags prevent CloudFormation from calling apigateway:TagResource

  PashtoBackend:
    Type: AWS::Serverless::Function
    Properties:
      Handler: lambda.lambdaHandler
      CodeUri: server/
      Policies:
        - Statement:
            - Effect: Allow
              Action:
                - cognito-idp:SignUp
                - cognito-idp:AdminConfirmSignUp
                - cognito-idp:AdminDeleteUser
                - cognito-idp:InitiateAuth
              Resource: !Sub 'arn:aws:cognito-idp:${AWS::Region}:${AWS::AccountId}:userpool/${CognitoUserPoolId}'
      Environment:
        Variables:
          NODE_ENV: production
          MONGODB_URI: !Ref MongodbUri
          COGNITO_USER_POOL_ID: !Ref CognitoUserPoolId
          COGNITO_CLIENT_ID: !Ref CognitoClientId
          COGNITO_CLIENT_SECRET: !Ref CognitoClientSecret
      Events:
        Api:
          Type: HttpApi
          Properties:
            ApiId: !Ref PashtoApi
            Path: /{proxy+}
            Method: ANY
    Metadata:
      BuildMethod: esbuild
      BuildProperties:
        Minify: false
        Target: es2022
        EntryPoints:
          - src/lambda.ts

Outputs:
  ApiUrl:
    Description: API Gateway endpoint URL
    Value: !Sub 'https://${PashtoApi}.execute-api.${AWS::Region}.amazonaws.com'
```

**`samconfig.toml`** (project root — committed to repo):

```toml
version = 0.1

[default]
[default.global.parameters]
stack_name = "pashto-dictionary"

[default.build.parameters]
cached   = true
parallel = true

[default.deploy.parameters]
capabilities      = "CAPABILITY_IAM"
confirm_changeset = false
resolve_s3        = false
s3_bucket         = "pashto-dictionary-sam-artifacts"
region            = "ap-southeast-1"
```

> Note: `resolve_s3 = false` and an explicit `s3_bucket` are used because SAM's auto-managed S3 bucket (`resolve_s3 = true`) requires additional S3 permissions that triggered a `ROLLBACK_FAILED` on first deploy. Create the bucket manually in S3 Console once; SAM uses it from then on.

### Updated `deploy.yml` steps

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: 22

- uses: aws-actions/setup-sam@v2
  with:
    use-installer: true

- uses: aws-actions/configure-aws-credentials@v4
  with:
    aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
    aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
    aws-region: ${{ secrets.AWS_REGION }}

- run: sam build

- run: |
    sam deploy --no-confirm-changeset --no-fail-on-empty-changeset \
      --parameter-overrides \
        MongodbUri="${{ secrets.MONGODB_URI }}" \
        CognitoUserPoolId="${{ secrets.COGNITO_USER_POOL_ID }}" \
        CognitoClientId="${{ secrets.COGNITO_CLIENT_ID }}" \
        CognitoClientSecret="${{ secrets.COGNITO_CLIENT_SECRET }}"
```

> `--no-fail-on-empty-changeset` prevents the job from failing on docs-only pushes that don't change Lambda code or infrastructure.

### GitHub secrets needed

| Secret | Notes |
|---|---|
| `AWS_ACCESS_KEY_ID` | Keep |
| `AWS_SECRET_ACCESS_KEY` | Keep |
| `AWS_REGION` | Keep |
| `MONGODB_URI` | New — injected as CloudFormation parameter |
| `COGNITO_USER_POOL_ID` | New — injected as CloudFormation parameter |
| `COGNITO_CLIENT_ID` | New — injected as CloudFormation parameter |
| `COGNITO_CLIENT_SECRET` | New — injected as CloudFormation parameter |

### IAM user — permissions needed

Split into four statements to follow least-privilege on PassRole and S3:

```json
[
  {
    "Effect": "Allow",
    "Action": [
      "lambda:UpdateFunctionCode", "lambda:UpdateFunctionConfiguration",
      "lambda:GetFunction", "lambda:GetFunctionConfiguration",
      "lambda:CreateFunction", "lambda:DeleteFunction",
      "lambda:AddPermission", "lambda:RemovePermission", "lambda:TagResource",
      "cloudformation:CreateStack", "cloudformation:UpdateStack",
      "cloudformation:DescribeStacks", "cloudformation:DescribeStackEvents",
      "cloudformation:DescribeChangeSet", "cloudformation:CreateChangeSet",
      "cloudformation:ExecuteChangeSet", "cloudformation:DeleteChangeSet",
      "cloudformation:GetTemplateSummary", "cloudformation:ListStackResources",
      "iam:CreateRole", "iam:AttachRolePolicy", "iam:GetRole",
      "iam:DeleteRole", "iam:DetachRolePolicy", "iam:TagRole",
      "iam:PutRolePolicy", "iam:DeleteRolePolicy",
      "apigateway:*",
      "s3:CreateBucket", "s3:GetBucketLocation"
    ],
    "Resource": "*"
  },
  {
    "Effect": "Allow",
    "Action": "iam:PassRole",
    "Resource": "arn:aws:iam::<account-id>:role/*",
    "Condition": { "StringEquals": { "iam:PassedToService": "lambda.amazonaws.com" } }
  },
  {
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:GetObject", "s3:ListBucket", "s3:DeleteObject"],
    "Resource": [
      "arn:aws:s3:::pashto-dictionary-sam-artifacts",
      "arn:aws:s3:::pashto-dictionary-sam-artifacts/*"
    ]
  }
]
```

> `esbuild` must be in `dependencies` (not `devDependencies`) in `server/package.json` — SAM's NpmInstall step runs `--omit=dev`.

### Verification

```
AWS Console → CloudFormation → stack "pashto-dictionary" → status UPDATE_COMPLETE
GitHub Actions → Deploy workflow → green
GET /api/health → 200
```

---

## Recommended Sequencing

```
Phase 10  — Polish & production readiness        ✓ done
Phase 11  — TypeScript migration                 ✓ done
Phase 12  — AWS deployment (Amplify + Lambda)    ✓ done
Phase 13  — AWS Cognito migration                ✓ done
Phase 14  — SAM infrastructure as code          ← active
```

Each phase merges to `main` independently. SAM is last because it is purely infrastructure — it has no impact on application logic and is the safest phase to do after all auth and deployment concerns are settled.
