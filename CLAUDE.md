---

## Project Purpose

A community-driven platform for preserving Pashto regional dialects. Users submit dictionary entries, moderators review them, admins publish them. Every technical decision should serve data integrity and content quality — not feature count.

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | Node.js, Express |
| Database | MongoDB via Mongoose |
| Auth | AWS Cognito (aws-jwt-verify on server · @aws-amplify/auth on client) |
| Validation | express-validator (server), native React state (client) |
| CI/CD | GitHub Actions (test gate on PRs + Lambda deploy on merge to main) |
| Hosting | AWS Amplify (frontend) · AWS Lambda + API Gateway (backend) |

---

## Repository Structure

```
pashto-dictionary/
├── .github/
│   └── workflows/
│       ├── ci.yml         # Test gate — runs on push to dev and PRs to main
│       └── deploy.yml     # Lambda deploy — runs on push to main
├── client/
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level page components
│       ├── hooks/         # Custom React hooks
│       ├── services/      # API call functions (axios)
│       ├── context/       # React Context providers
│       └── utils/         # Pure helper functions
├── e2e/                   # Playwright end-to-end tests
├── server/
│   └── src/
│       ├── controllers/   # Route handler logic (TypeScript)
│       ├── models/        # Mongoose schemas + interfaces (TypeScript)
│       ├── routes/        # Express router definitions (TypeScript)
│       ├── middleware/     # Auth, role, error handlers (TypeScript)
│       ├── utils/         # Server-side helpers (TypeScript)
│       ├── app.ts         # Express app (no listen call — shared by index + lambda)
│       ├── index.ts       # Local dev entry point (calls app.listen)
│       └── lambda.ts      # AWS Lambda entry point (serverless-http wrapper)
├── amplify.yml            # AWS Amplify frontend build config
├── CLAUDE.md
└── README.md
```

---

## Moderation State Machine

This is the core logic of the platform. Enforce it strictly — invalid transitions are errors, not silent no-ops.

```
submitted → pending    (automatic on POST /api/entries)
pending   → approved   (moderator or admin)
pending   → rejected   (moderator or admin, note required)
approved  → published  (admin only)
rejected  → pending    (user edits and resubmits)
```

Every state transition **must** write a record to the ModerationLog collection.

---

## API Response Envelope

All API responses must use this shape. Never return a raw object or array.

```json
// Success
{ "success": true, "data": {}, "meta": {} }

// Error
{ "success": false, "error": { "message": "string", "field": "optional" } }

// List
{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }
```

---

## Code Conventions

### General
- No `console.log` in committed server code — use a proper logger or remove before committing
- No hardcoded values that belong in `.env`
- No `any` implicit typing — be explicit with Mongoose schema types
- Keep controllers thin — business logic belongs in a service or utility function if it grows beyond ~20 lines

### Naming
- Files: `camelCase.ts` for server utilities and services, `PascalCase.jsx` for React components
- MongoDB models: PascalCase singular (`Entry`, `User`, `ModerationLog`)
- API routes: lowercase plural kebab (`/api/entries`, `/api/moderation`)
- React components: PascalCase, one component per file

### Frontend
- No inline styles — Tailwind classes only
- No component library — build UI from scratch to demonstrate the work
- All API calls go through `src/services/api.js` — never call `fetch` or `axios` directly from a component
- Loading and error states are required on every component that fetches data

### Backend
- Validate all inputs with `express-validator` before they touch the database
- Use `express-async-errors` or wrap async handlers — never let unhandled promise rejections crash the server
- Authentication middleware goes on routes, not inside controllers
- Role checks use `requireRole()` middleware, not `if (req.user.role === ...)` inside controllers
- **Role resolution**: `auth.ts` middleware looks up `role` from the MongoDB `User` doc (by `cognitoSub`) on every authenticated request — do NOT read role from the Cognito token, because Access Tokens never include custom user attributes
- **Actor fields** (`submittedBy`, `reviewedBy`, `deletedBy`, `performedBy`): stored as `String` (Cognito sub UUID), not `ObjectId` — never pass `new mongoose.Types.ObjectId(req.user.id)` for these fields

---

## Commit Convention

**Format:** `<type>(<scope>): <short description>`

```
feat      — new feature
fix       — bug fix
refactor  — restructure without behaviour change
test      — adding or updating tests
docs      — README, comments, CLAUDE.md updates
chore     — config, dependencies, tooling
style     — Tailwind or formatting only
```

**Scope examples:** `auth`, `entries`, `moderation`, `client`, `models`, `middleware`

**Examples:**
```
feat(auth): add JWT middleware for protected routes
feat(moderation): implement approve/reject state transitions
fix(entries): handle empty search query returning 500
refactor(models): add text index to Entry.pashto field
docs(readme): add moderation workflow diagram
chore(deps): add express-rate-limit to server
```

**Rules:**
- Commit after each logical unit, not at end of day
- Never commit broken code to `main`
- Work on `dev` branch, merge to `main` when a phase is complete and tested

---

## What Claude Should Do

- Follow the state machine exactly — reject invalid transitions with a 400 and a clear message
- Write ModerationLog entries on every status change, no exceptions
- Use the API response envelope on every response
- Apply `express-validator` before any database operation on mutation endpoints
- Keep components focused — if a component exceeds ~150 lines, flag it for splitting
- Use Tailwind utility classes; do not write custom CSS files
- Paginate all list endpoints from the start — never return unbounded arrays

## What Claude Should Not Do

- Do not add features not in the current phase prompt
- Do not install component libraries (Shadcn, MUI, Ant Design, etc.)
- Do not use `useEffect` for data that can be fetched with a custom hook or service
- Do not add a blog, comments, or social features — they are out of scope
- Do not skip input validation to "come back to it later"
- Do not commit `.env` files or real credentials under any circumstances
- Do not write multi-paragraph comments or docstrings — code should be self-explanatory

---

## Environment Variables

```
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.oq0rk.mongodb.net/
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-southeast-1
NODE_ENV=development

# client/.env
VITE_API_URL=http://localhost:5000
```

### Production (Lambda environment variables — managed by SAM template.yaml from Phase 14)
```
MONGODB_URI=mongodb+srv://...
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
NODE_ENV=production
```

### GitHub Actions secrets
```
AWS_ACCESS_KEY_ID     — IAM user with lambda:UpdateFunctionCode on pashto-backend
AWS_SECRET_ACCESS_KEY
AWS_REGION            — region where pashto-backend Lambda lives
```

Keep `.env.example` files updated whenever a new variable is added.

---

## Current Build Phase

> Update this line as you progress through the build plan.

**Active phase:** Post-phase-14 polish complete — project is feature-complete
**Branch:** dev

### Completed phases
- Phase 1–10: Core app (models, auth, entries, moderation, frontend, design, polish)
- Phase 11: TypeScript migration (server only — all `.js` → `.ts`, strict mode)
- Phase 12: AWS deployment (Amplify hosting, Lambda + API Gateway, GitHub Actions CI/CD)
- Phase 13: AWS Cognito migration (replaced bcrypt/JWT with Cognito; `aws-jwt-verify` middleware; `@aws-amplify/auth` on the client)
- Post-13 fixes: actor fields (`submittedBy` etc.) changed from ObjectId to String for Cognito sub compatibility; auth middleware now resolves role from MongoDB instead of token claims (Access Tokens don't carry custom attributes)
- Phase 14: SAM infrastructure as code — `template.yaml` + `samconfig.toml`; deploy pipeline uses `sam build && sam deploy`; all backend resources owned by CloudFormation stack `pashto-dictionary`
- Post-14 polish: fixed broken username resolution (`.populate()` silently no-ops on String fields; replaced with `enrichActors` batch-lookup utility); usernames now display in admin queue, audit log, concept detail page, variant cards, and My Submissions; removed legacy `ModerationLog.entry` field and dead `-passwordHash` projection in userController; audit log upgraded with target name population, inline diffs for edited/merged actions, absolute timestamps, action-type and model-type filters, and pagination