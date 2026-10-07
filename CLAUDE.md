# Pashto Dialect Revival Dictionary — Claude Instructions

## Project Purpose

A community-driven platform for preserving Pashto regional dialects. Users submit dictionary entries, moderators review them, admins publish them. Every technical decision should serve data integrity and content quality — not feature count.

---

## Project Docs — Read When Relevant

This file holds the rules. Read the docs below only when the task touches their area.

| Doc | Read it when… |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Changing data models, search, duplicate detection, moderation rules, auth, or anything where you need to know *why* it works the way it does |
| [docs/USER-FLOWS.md](docs/USER-FLOWS.md) | Changing behaviour a guest/user/moderator/admin sees, or writing E2E tests — don't break a flow listed here |
| [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) | Any UI work — colour tokens, typography, glass cards, Pashto RTL rules, animations |
| [docs/BuildHistory.md](docs/BuildHistory.md) | Planning a new phase, touching AWS/SAM/IAM/CI, or needing the history of a feature |
| [To-Do.md](To-Do.md) | Asked what's next — holds the backlog |
| [docs/PROMPTS.md](docs/PROMPTS.md) | Change templates per layer and ready prompts for each backlog item |
| `.claude/skills/frontend-design/` | Skill for building new UI — loaded automatically when relevant |
| `.claude/agents/` | `tester` → `coder` TDD loop per phase; `refactor` for scoped changes; `e2e-tester` for Playwright |

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Node.js 22, Express, TypeScript (strict) |
| Database | MongoDB via Mongoose |
| Auth | AWS Cognito — server-side only (Cognito SDK in authController · aws-jwt-verify in middleware). Client calls `/api/auth/*` via axios and keeps the access token in `sessionStorage`; no Amplify SDK on the client |
| Validation | express-validator (server), native React state (client) |
| CI/CD | GitHub Actions (test gate on PRs + `sam build && sam deploy` on merge to main) |
| Hosting | AWS Amplify (frontend) · AWS Lambda + API Gateway via SAM, stack `pashto-dictionary` (backend) |
| Testing | Vitest + RTL (client) · Jest + MongoMemoryServer (server) · Playwright (E2E) |

---

## Repository Structure

```
pashto-dictionary/
├── .github/
│   └── workflows/
│       ├── ci.yml         # Test gate — runs on push to dev and PRs to main
│       └── deploy.yml     # SAM deploy — runs on push to main
├── .claude/
│   ├── agents/            # tester, coder, refactor, e2e-tester
│   └── skills/            # frontend-design
├── client/
│   └── src/
│       ├── components/    # Reusable UI components
│       ├── pages/         # Route-level page components
│       ├── hooks/         # Custom React hooks
│       ├── services/      # API call functions (axios)
│       ├── context/       # React Context providers
│       └── utils/         # Pure helper functions
├── docs/                  # ARCHITECTURE, BuildHistory, USER-FLOWS, DESIGN-SYSTEM
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
├── template.yaml          # SAM — Lambda, HTTP API, IAM role
├── samconfig.toml         # SAM deploy config (no secrets)
├── CLAUDE.md
├── To-Do.md
└── README.md
```

---

## Moderation State Machine

This is the core logic of the platform. Enforce it strictly — invalid transitions are errors, not silent no-ops.

```
submitted → pending    (automatic on POST /api/concepts or /api/variants)
pending   → approved   (moderator or admin)
pending   → rejected   (moderator or admin, note required)
approved  → published  (admin only)
published → rejected   (admin only, note required)
rejected  → pending    (user edits and resubmits)
```

Every state transition **must** write a record to the ModerationLog collection. The state machine runs independently on both `Concept` and `Variant`. Further rules (moderator self-approval ban, cascade-reject, publish concept before its variants) are in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/USER-FLOWS.md](docs/USER-FLOWS.md).

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
- MongoDB models: PascalCase singular (`Concept`, `Variant`, `User`, `ModerationLog`)
- API routes: lowercase plural kebab (`/api/concepts`, `/api/moderation`)
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
- **Resolving actor usernames**: `.populate()` silently no-ops on String fields — use `utils/enrichActors.ts` (batch lookup by `cognitoSub`) instead

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

**Scope examples:** `auth`, `concepts`, `variants`, `moderation`, `client`, `models`, `middleware`, `infra`, `ci`

**Examples:**
```
feat(moderation): implement approve/reject state transitions
fix(concepts): handle empty search query returning 500
refactor(models): add unique index on Variant.normalizedPashto
docs(readme): add moderation workflow diagram
chore(deps): add express-rate-limit to server
```

**Rules:**
- Commit after each logical unit, not at end of day
- Never commit broken code to `main`
- Work on `dev` branch, merge to `main` when a phase is complete and tested
- Before merging to `main`: endpoints tested manually, frontend renders without console errors, `.env.example` and README updated if affected

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

Production values are not stored in files: they live in GitHub Secrets (`MONGODB_URI`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`, plus `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` for the deploy user). `deploy.yml` passes them to `template.yaml` as CloudFormation parameters. IAM details are in [docs/BuildHistory.md](docs/BuildHistory.md).

Keep `.env.example` files updated whenever a new variable is added.

---

## Current Build Phase

> Update this section as you progress.

**Active phase:** none — Phases 1–14 and post-14 polish are complete; the project is feature-complete. Backlog is in [To-Do.md](To-Do.md).
**Branch:** dev

New phases are specified in [docs/BuildHistory.md](docs/BuildHistory.md) and run with the `tester` → `coder` agents.
