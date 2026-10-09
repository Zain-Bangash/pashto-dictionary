# Build History — Pashto Dialect Revival Dictionary

This is the phase-by-phase build plan **as it was originally written**, kept to show how the project evolved. Where the build diverged from the plan, an **Outcome** note records what actually happened.

- **Why** decisions were made → [ARCHITECTURE.md](ARCHITECTURE.md)
- **Current** conventions and rules → [CLAUDE.md](../CLAUDE.md)
- Infrastructure source of truth → [`template.yaml`](../template.yaml), [`samconfig.toml`](../samconfig.toml), [`.github/workflows/`](../.github/workflows/)

---

## Timeline

| Phase | Title | Status |
|---|---|---|
| 1 | Project initialisation | ✓ |
| 2 | Data models | ✓ (later redesigned to Concept/Variant) |
| 3 | Authentication (JWT) | ✓ (replaced in Phase 13) |
| 4 | Entry API | ✓ (became Concept/Variant API) |
| 5 | Moderation workflow | ✓ |
| 6 | Frontend core | ✓ |
| 7 | Frontend auth + submission | ✓ |
| 8 | Admin dashboard | ✓ |
| 9 | Frontend design & navigation | ✓ |
| 10 | Polish & production readiness | ✓ |
| 11 | TypeScript migration (server) | ✓ |
| 12 | AWS deployment (Amplify + Lambda) | ✓ |
| 13 | AWS Cognito migration | ✓ |
| — | Post-13 fixes | ✓ |
| 14 | SAM infrastructure as code | ✓ |
| — | Post-14 polish | ✓ |

---

## How Each Phase Was Run (TDD)

Every phase followed a two-agent test-first loop (agent definitions live in `.claude/agents/`):

1. **tester** — reads the phase spec from this file, writes failing tests for every requirement, runs them to confirm they are red, then stops.
2. **coder** — reads the same phase spec, implements until the pre-written tests are green, reports completion, and waits for confirmation before the next phase.

Each phase merged from `dev` to `main` only once complete and tested.

---

## Phase 1 — Project Initialisation

**Goal:** Clean repo, both apps running, connected to MongoDB.

1. Create GitHub repo `pashto-dictionary`; create `dev` branch immediately
2. Initialise `server/` with Express + dotenv + mongoose
3. Initialise `client/` with Vite + React + Tailwind
4. Add `.gitignore` (node_modules, .env, dist), placeholder `README.md` and `CLAUDE.md`
5. Confirm `GET /api/health` returns `{ status: "ok" }`, React renders, MongoDB connects

**Done when:** both apps running, `/api/health` returns 200, `npm test` passes, no `.env` committed.

---

## Phase 2 — Data Models

**Goal:** Define the core MongoDB schemas before writing any route logic.

```
Entry {
  pashto: String (required)
  phonetic: String
  region: String
  partOfSpeech: Enum [noun, verb, adjective, adverb, phrase, other]
  definitions: [{ text: String, example: String }]
  submittedBy: ObjectId → User
  status: Enum [pending, approved, rejected, published] (default: pending)
  moderatorNote: String
  reviewedBy: ObjectId → User
  createdAt, updatedAt
}

User {
  username: String (unique)
  email: String (unique)
  passwordHash: String
  role: Enum [user, moderator, admin] (default: user)
  createdAt
}

ModerationLog {
  entry: ObjectId → Entry
  action: Enum [submitted, approved, rejected, published]
  performedBy: ObjectId → User
  note: String
  timestamp
}
```

**Done when:** all three schemas exist, indexes defined, `npm test` passes.

> **Outcome:** The flat `Entry` model could not express that one meaning has different words in different valleys. It was redesigned into two collections, `Concept` (meaning anchor) and `Variant` (regional word), each with its own moderation lifecycle — see ARCHITECTURE.md › *The Decision: Concept + Variant*. After Phase 13, actor fields (`submittedBy`, `reviewedBy`, `performedBy`, `deletedBy`) became `String` (Cognito sub) instead of `ObjectId`. `ModerationLog.entry` was replaced by `targetModel` (`Concept` | `Variant` | `User`) + `targetId`, a `changes` field was added, and the `action` enum grew to 9 values (adding `resubmitted`, `deleted`, `edited`, `merged`, `profile_updated`).

---

## Phase 3 — Authentication

> From this phase onwards every endpoint uses `express-validator` and returns the API response envelope on every response.

**Goal:** Register, login, JWT issuance, protected route middleware.

1. `POST /api/auth/register` — hash password with bcrypt, return JWT
2. `POST /api/auth/login` — validate credentials, return JWT
3. `GET /api/auth/me` — return current user from token
4. `authMiddleware` — verify JWT, attach `req.user`
5. `requireRole(role)` — middleware factory for role-gated routes

**Done when:** register, login and `/me` work; protected routes reject unauthenticated requests; `npm test` passes.

> **Outcome:** bcrypt + JWT was replaced entirely by AWS Cognito in Phase 13. `requireRole()` survived unchanged.

---

## Phase 4 — Entry API (Core CRUD)

**Goal:** Public browsing + authenticated submission.

```
GET    /api/entries              — list published entries (paginated, filterable)
GET    /api/entries/:id          — get single published entry
GET    /api/entries/search?q=    — search by pashto word or definition
POST   /api/entries              — submit new entry (auth required)
```

Pagination (page + limit) from the start — retrofitting it later is painful.

**Done when:** all four endpoints work, pagination returns correct meta, unauthenticated submission returns 401, `npm test` passes.

> **Outcome:** With the Concept/Variant redesign these became `/api/concepts` and `/api/variants`, plus `/suggest`, `/wotd`, `/my-submissions` and `/cross-concept-check`. Search moved from a MongoDB `$text` index to ranked regex across gloss and phonetic — see ARCHITECTURE.md › *Search*.

---

## Phase 5 — Moderation Workflow

**Goal:** The state machine that makes this project technically interesting. Every state change writes a `ModerationLog` record; invalid transitions return 400.

```
GET    /api/moderation/queue          — list pending entries (moderator+)
PATCH  /api/moderation/:id/approve    — approve entry (moderator+)
PATCH  /api/moderation/:id/reject     — reject with note (moderator+)
PATCH  /api/moderation/:id/publish    — publish entry (admin only)
GET    /api/moderation/log            — audit log (admin only)
```

**Done when:** all transitions enforced, invalid ones return 400, every transition logged, `npm test` passes.

> **Outcome:** Split into separate queues (`/api/moderation/concepts/queue`, `/api/moderation/variants/queue`) and a single status endpoint per model (`PATCH /api/concepts/:id/status`, `PATCH /api/variants/:id/status`). Later additions: moderator self-approval restriction, staff edit path (`/:id/edit`), concept merge, cascade-reject of variants when a concept is rejected, and a "concept must be published before its variants" rule.

---

## Phase 6 — Frontend Core

**Goal:** Browsable, searchable dictionary. No auth UI yet.

```
/                  — landing: search bar + recent entries
/entries           — browse all published entries with filters
/entries/:id       — single entry detail page
```

Components: `SearchBar` (debounced), `EntryCard`, `EntryDetail`, `Pagination`.

**Done when:** all three pages render, search navigates correctly, loading/error states present, `npm test` passes.

> **Outcome:** Routes became `/concepts` and `/concepts/:id`; `EntryCard` became `ConceptCard`. The detail page groups variants by Pashto word with a region tab strip.

---

## Phase 7 — Frontend Auth + Submission

**Goal:** Users can register, log in, and submit entries.

```
/login             — login form
/register          — register form
/submit            — entry submission form (auth required)
/my-submissions    — user's own submissions with status
```

**Done when:** auth flow works, protected routes redirect, submission form validates, my-submissions shows status badges, `npm test` passes.

> **Outcome:** Submit became a two-step flow (Step 1 concept with live autocomplete, Step 2 variant) to match the Concept/Variant model.

---

## Phase 8 — Admin Dashboard

**Goal:** Moderators and admins manage entries from a dedicated UI.

```
/dashboard              — summary stats
/dashboard/queue        — moderation queue with approve/reject actions
/dashboard/entries      — all entries with status filter
/dashboard/users        — user list (admin only)
/dashboard/log          — moderation audit log (admin only)
```

**Done when:** role-based nav works, queue approve/reject works, non-moderators cannot reach the dashboard, `npm test` passes.

> **Outcome:** `/dashboard/entries` became `/dashboard/concepts`.

---

## Phase 9 — Frontend Design & Navigation

**Goal:** Apply the Cyber-Traditional design system (see [DESIGN-SYSTEM.md](DESIGN-SYSTEM.md)), global navbar, auth interceptors and post-login redirect.

- [x] Design tokens — Tailwind v4 `@theme {}`, Google Fonts, keyframes, utility classes
- [x] API interceptors — Bearer token on every request, 401 → auto-logout
- [x] `AppRoutes` wrapper so the interceptor can access `useAuth`
- [x] Sticky, context-aware Navbar
- [x] `state.from` redirect on Login and Register
- [x] Home page bento grid — WOTD hero, search, stats, word tiles, CTA
- [x] All remaining pages restyled

---

## Phase 10 — Polish & Production Readiness

**Goal:** The things that separate a portfolio project from a toy.

- [x] express-validator on all POST/PATCH endpoints
- [x] Rate limiting on auth endpoints (express-rate-limit)
- [x] Global error-handling middleware
- [x] Environment-based config (dev/prod)
- [x] API response envelope on every response
- [x] MongoDB indexes on `status`, `pashto` (text index for search)
- [x] Loading and error states on all frontend data fetches
- [x] Client 404 page

> **Outcome:** The text index was superseded by ranked regex search; unique indexes on normalised fields were added for duplicate detection — see ARCHITECTURE.md › *Normalization and Duplicate Detection*.

---

## Phase 11 — TypeScript Migration (Server Only)

**Goal:** Convert the backend from CommonJS JavaScript to TypeScript strict mode for compile-time safety on Mongoose documents and middleware. The client stays JSX/JS.

1. `npm install -D typescript ts-node ts-jest @types/node @types/express @types/jsonwebtoken @types/bcryptjs @types/cors`
2. Add `server/tsconfig.json` — `target: ES2022`, `module: CommonJS`, `strict: true`, `outDir: dist`, `rootDir: src`
3. Switch `jest.config.js` to the `ts-jest` preset, `testMatch: ['**/__tests__/**/*.test.ts']`
4. Scripts: `build` → `tsc`, `start` → `node dist/index.js`, `dev` → `ts-node src/index.ts`
5. Rename one layer at a time, keeping tests green: utils → middleware → models → controllers → routes → `index.ts`
6. Add `IUser`, `IConcept`, `IVariant`, `IModerationLog` interfaces to the models

**Done when:** `npx tsc --noEmit` reports zero errors and `npm test` still passes.

---

## AWS Migration — Target Architecture & Cost (Phases 12–14)

All AWS services were chosen to be free-forever tier:

```
Browser
  ├── React app ──► AWS Amplify Hosting
  └── API calls ──► API Gateway ──► Lambda (Express + serverless-http)
                                       ├── MongoDB Atlas M0
                                       └── AWS Cognito
```

| Service | Free allowance | Expiry |
|---|---|---|
| AWS Amplify Hosting | 1,000 build mins/month, 5 GB bandwidth, 15 GB storage | Forever |
| AWS API Gateway | 1M API calls/month | Forever |
| AWS Lambda | 1M requests + 400,000 GB-seconds/month | Forever |
| AWS Cognito | 50,000 monthly active users | Forever |
| MongoDB Atlas M0 | 512 MB storage, shared cluster | Forever |

**Total monthly cost: $0.00.** EC2 was excluded (free tier expires after 12 months); DocumentDB was excluded (not free, ~$200+/month). Atlas M0 already runs on AWS, so it stayed where it was.

Sequencing: TypeScript → deployment → Cognito (most application/test impact) → SAM last (pure infrastructure, zero application impact).

---

## Phase 12 — AWS Deployment (Amplify + Lambda)

**Goal:** Host the frontend on Amplify and the Express backend on Lambda + API Gateway with zero business-logic changes.

1. Extract the Express app into `server/src/app.ts` (no `listen`); `index.ts` calls `app.listen` for local dev
2. Add `server/src/lambda.ts` exporting `serverless(app)` (`npm install serverless-http`)
3. Add `amplify.yml` at the project root (`cd client && npm ci` → `npm run build`, artifacts in `client/dist`)
4. Connect the GitHub repo to Amplify (`main` branch), set `VITE_API_URL` to the API Gateway URL
5. Backend — **Option B chosen:** create Lambda (Node.js 22) and an HTTP API in the Console; GitHub Actions `deploy.yml` zips `dist/` + prod `node_modules` and calls `aws lambda update-function-code`. (Option A, SAM, deferred to Phase 14.)
6. Add `ci.yml` — `tsc --noEmit` + full test suite as a gate on PRs to `main`
7. Lambda env vars: `MONGODB_URI`, `JWT_SECRET`, `NODE_ENV=production`

**Done when:** frontend live on the Amplify URL, API calls reach Lambda, all tests still pass locally.

---

## Phase 13 — AWS Cognito Migration

**Goal:** Replace bcrypt/JWT with Cognito. Treated as the highest-effort phase with a full tester → coder cycle.

| Removed | Replaced with |
|---|---|
| `bcryptjs` | Cognito User Pool (handles hashing) |
| `JWT_SECRET` | Cognito JWKS endpoint (public keys, auto-rotated) |
| register / login logic | Cognito `SignUp` / `InitiateAuth` |
| `jwt.verify(token, secret)` | `aws-jwt-verify` `CognitoJwtVerifier` |
| `User.passwordHash` | `User.cognitoSub` |

**Planned steps:**
1. Create a Cognito User Pool with email + password sign-in
2. Replace `authController.ts` register/login with Cognito SDK calls
3. Rewrite `auth.ts` middleware to verify Cognito tokens via `aws-jwt-verify`
4. Remove `User.passwordHash`, add `User.cognitoSub`
5. Replace the frontend `AuthContext` axios calls with the `@aws-amplify/auth` SDK
6. Rewrite auth tests to mock Cognito; E2E global setup calls `InitiateAuth` and injects the token into Playwright `storageState`

**Done when:** register, login and `/me` work via Cognito, protected routes reject invalid tokens, all tests pass.

> **Outcome:** Step 5 was not adopted. The client still calls `POST /api/auth/register` and `/login` via axios; the backend performs all Cognito SDK calls and returns the access token, which is kept in `sessionStorage`. No Amplify SDK is used on the client.

### Post-13 fixes

- Cognito Access Tokens do not carry custom attributes, so `custom:role` cannot be read from them. `auth.ts` now resolves `role` from the MongoDB `User` document (by `cognitoSub`) on every request.
- Actor fields changed from `ObjectId` to `String` so they can hold the Cognito sub UUID.

---

## Phase 14 — SAM Infrastructure as Code

**Goal:** Replace the direct `update-function-code` deploy with AWS SAM so the Lambda, HTTP API, IAM role and env vars are declared in `template.yaml` and owned by a CloudFormation stack — no Console-only state.

1. Install SAM CLI (`winget install Amazon.SAM-CLI`)
2. Write `template.yaml` — Lambda (esbuild-bundled from `src/lambda.ts`), HTTP API with `/{proxy+}`, execution role, env vars as `NoEcho` parameters
3. Run `sam deploy --guided` once locally to create stack `pashto-dictionary` and generate `samconfig.toml`
4. Update `deploy.yml` → `sam build` then `sam deploy --no-confirm-changeset --no-fail-on-empty-changeset --parameter-overrides …` from GitHub Secrets
5. Commit `samconfig.toml` (no secrets); remove the `LAMBDA_FUNCTION_NAME` secret
6. Expand the IAM deploy user's permissions (below)

**Done when:** `sam deploy` succeeds in the pipeline and `template.yaml` is the single source of truth for backend infrastructure.

### Gotchas hit during the build

- **`resolve_s3 = false`** with an explicit bucket (`pashto-dictionary-sam-artifacts`, created manually once): SAM's auto-managed bucket needed extra S3 permissions and caused a `ROLLBACK_FAILED` on first deploy.
- **`esbuild` in `dependencies`**, not `devDependencies` — SAM's NpmInstall step runs `--omit=dev`.
- **`Tags: {}` on the HttpApi** — prevents CloudFormation from calling `apigateway:TagResource`.
- **Cognito admin permissions on the execution role** — without the `Policies` block, registration fails with a 403 at `AdminConfirmSignUp`.

### GitHub Secrets

`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`, plus CloudFormation parameters `MONGODB_URI`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`.

### IAM deploy-user policy (`github-actions-deploy`)

Not stored anywhere else in the repo — kept here so the user can be recreated.

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

### Verification

CloudFormation stack `pashto-dictionary` → `UPDATE_COMPLETE`; GitHub Actions Deploy workflow green; `GET /api/health` → 200.

---

## Post-14 Polish

- `.populate()` silently no-ops on String actor fields, so usernames were blank everywhere. Replaced with the `enrichActors` batch-lookup utility.
- Removed the legacy `ModerationLog.entry` field and a dead `-passwordHash` projection.
- Audit log: target names, inline diffs for `edited`/`merged`, absolute timestamps, action-type and model-type filters, pagination.

Details in ARCHITECTURE.md › *Post-Phase-14 Polish*.

---

## Persistent Sessions (refresh cookie)

Users stay logged in across tabs and for 30 days instead of per tab until the access token expires.

- Server: `POST /api/auth/refresh` and `POST /api/auth/logout` (`sessionController.ts`); login/register set the httpOnly `pd_rt`/`pd_ru` cookies; `sessionGuard.ts` CSRF check; `sessionLimiter`; `cookie-parser` added.
- Client: access token in memory (`services/authSession.js`), single-flight refresh + retry on 401, session restore on load, `BroadcastChannel` logout sync (`services/sessionSync.js`).
- Infra: `FrontendOrigin` and `CookieSameSite` template parameters (defaults, no new secrets), HTTP API `CorsConfiguration` with credentials, `cognito-idp:RevokeToken` on the Lambda role.

Why and trade-offs: ARCHITECTURE.md › *Persistent sessions (refresh cookie)*.

### Manual step — Cognito app client

The User Pool is not in `template.yaml`, so set these in the Cognito console (User pool → App integration → app client → Edit):

- Access token expiration: **1 hour**
- Refresh token expiration: **30 days**
- **Enable token revocation**: on (required for `RevokeToken` on logout)
- Authentication flows: `ALLOW_USER_PASSWORD_AUTH` and `ALLOW_REFRESH_TOKEN_AUTH` enabled
- Leave refresh-token rotation **off**. With rotation on, `REFRESH_TOKEN_AUTH` via `InitiateAuth` is rejected.

### Manual step (optional, recommended) — same-origin API for Safari

Safari blocks the cross-site refresh cookie, so Safari users are logged out on reload. To fix:

1. Amplify console → Hosting → Rewrites and redirects: add source `/api/<*>`, target `https://<api-id>.execute-api.ap-southeast-1.amazonaws.com/api/<*>`, type **200 (Rewrite)**.
2. Set the Amplify env var `VITE_API_URL` to the Amplify origin and redeploy the frontend.
3. Change the `CookieSameSite` default in `template.yaml` to `strict` and deploy.
4. Check in a branch preview that `Set-Cookie` passes through the rewrite before relying on it.
