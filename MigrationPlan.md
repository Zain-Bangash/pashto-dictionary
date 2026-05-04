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

**Option A — AWS SAM / CloudFormation (infrastructure-as-code, recommended for CV)**
```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31
Resources:
  PashtoApi:
    Type: AWS::Serverless::Function
    Properties:
      Handler: dist/lambda.handler
      Runtime: nodejs20.x
      Events:
        Api:
          Type: Api
          Properties:
            Path: /{proxy+}
            Method: ANY
```

**Option B — AWS Console (manual, simpler to start)**
1. Lambda → Create function → Node.js 20 runtime
2. Upload `dist/` as zip
3. API Gateway → Create HTTP API → Lambda proxy integration

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
    req.user = { id: payload.sub, role: payload['custom:role'] ?? 'user' };
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

## Recommended Sequencing

```
Phase 10  ← current active phase
Phase 11  — TypeScript migration
Phase 12  — AWS deployment (Amplify + Lambda)
Phase 13  — AWS Cognito migration
```

Each phase merges to `main` independently. Cognito is last because it touches the most test files and is safest when the TypeScript compiler is already watching for type errors.
