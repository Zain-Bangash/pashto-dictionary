# Pashto Dialect Revival Dictionary — Build Plan
**Stack: React + Tailwind · Node.js + Express · MongoDB**

---

## Project Overview

A community-driven dictionary platform for preserving Pashto regional dialects. Users submit entries, moderators review them, admins approve and publish. Every technical decision should serve this purpose.

**Core features:**
- Browse and search dictionary entries by word or region
- User submission form with validation
- Moderation queue (pending → approved → rejected → published)
- Role-based access: Guest · User · Moderator · Admin
- Admin dashboard for oversight

---

## Repository Structure

```
pashto-dictionary/
├── client/                  # React + Tailwind frontend
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/
│   │   ├── services/        # API call functions
│   │   └── utils/
│   └── package.json
├── server/                  # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── middleware/
│   │   └── utils/
│   └── package.json
├── .gitignore
├── README.md
└── CLAUDE.md
```

---

## Git Commit Convention

Use **Conventional Commits** throughout. Every commit must follow this format:

```
<type>(<scope>): <short description>

Types:
  feat      — new feature
  fix       — bug fix
  refactor  — restructure without behaviour change
  test      — adding or updating tests
  docs      — README, comments, CLAUDE.md
  chore     — config, deps, tooling
  style     — formatting only (no logic change)

Examples:
  feat(auth): add JWT middleware for protected routes
  feat(entries): implement moderation state machine
  fix(search): handle empty query string edge case
  docs(readme): add architecture diagram section
  chore(deps): install mongoose and express-validator
```

**Rules:**
- Commit after each logical unit of work — not at end of day
- Never commit broken code to main
- Use `dev` branch for active work, merge to `main` when a phase is complete
- Keep commits atomic — one concern per commit

---

## Build Phases

### How to run a phase (TDD order)

For each phase, run the agents in this order:

**Step 1 — tester first (writes failing tests from the spec):**
```
Spawn the tester agent:
"Read Phase N from BuildPlan.md. Write failing tests for everything the spec
requires. Run them to confirm they are red. Report and stop."
```

**Step 2 — coder second (implements until tests are green):**
```
Spawn the coder agent:
"Read Phase N from BuildPlan.md. The tester has already written failing tests.
Build the phase, run the existing tests, fix failures, and report completion."
```

---

### Phase 1 — Project Initialisation

**Goal:** Clean repo, both apps running, connected to MongoDB.

**Steps:**
1. Create GitHub repo: `pashto-dictionary`
2. Clone locally, create `dev` branch immediately
3. Initialise `server/` with Express + dotenv + mongoose
4. Initialise `client/` with Vite + React + Tailwind
5. Add `.gitignore` (node_modules, .env, dist)
6. Add placeholder `README.md` and `CLAUDE.md` (copy from template)
7. Confirm: `GET /api/health` returns `{ status: "ok" }`, React renders, MongoDB connects

**Commits this phase:**
```
chore(server): initialise Express + mongoose project structure
chore(client): initialise Vite + React + Tailwind
chore: add .gitignore and root README placeholder
feat(server): add /api/health check endpoint
```

**Done when:** repo initialised, both apps running, `/api/health` returns 200, `npm test` passes, no `.env` committed

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 1 from BuildPlan.md. Write failing tests for the /api/health
endpoint and basic server/client startup. Run them to confirm they are red.
Report and stop."
```

---

### Phase 2 — Data Models

**Goal:** Define the core MongoDB schemas before writing any route logic.

**Schemas to build:**

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

**Commits this phase:**
```
feat(models): add Entry schema with moderation status fields
feat(models): add User schema with role enum
feat(models): add ModerationLog schema for audit trail
```

**Done when:** all three schemas exist, indexes defined, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 2 from BuildPlan.md. Write failing tests for all three Mongoose
schemas — required fields, enums, defaults, and unique constraints. Run them
to confirm they are red. Report and stop."
```

---

### Phase 3 — Authentication

> **Note:** From this phase onwards, every endpoint must use `express-validator`
> for input validation and return the API response envelope
> `{ success, data/error, meta }` on every response — success and error alike.
> Phase 10 adds rate limiting and indexes, but validation and the envelope are
> required from day one per CLAUDE.md.

**Goal:** Register, login, JWT issuance, protected route middleware.

**Build order:**
1. `POST /api/auth/register` — hash password with bcrypt, return JWT
2. `POST /api/auth/login` — validate credentials, return JWT
3. `GET /api/auth/me` — return current user from token
4. `authMiddleware` — verify JWT, attach `req.user`
5. `requireRole(role)` — middleware factory for role-gated routes

**Commits this phase:**
```
feat(auth): add register and login endpoints with bcrypt + JWT
feat(auth): add authMiddleware for protected routes
feat(auth): add requireRole middleware for RBAC
feat(auth): add /api/auth/me endpoint
```

**Done when:** register, login, and /me work, protected routes reject unauthenticated requests, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 3 from BuildPlan.md. Write failing tests for register, login, /me,
authMiddleware, and requireRole. Cover auth boundaries, validation rules (per
CLAUDE.md all endpoints use express-validator and the response envelope from
this phase onwards), and JWT behaviour. Run them to confirm they are red.
Report and stop."
```

---

### Phase 4 — Entry API (Core CRUD)

**Goal:** Public browsing + authenticated submission.

**Endpoints:**
```
GET    /api/entries              — list published entries (paginated, filterable)
GET    /api/entries/:id          — get single published entry
GET    /api/entries/search?q=    — search by pashto word or definition
POST   /api/entries              — submit new entry (auth required)
```

**Pagination:** always use cursor or page+limit from the start. Retrofitting pagination later is painful.

**Commits this phase:**
```
feat(entries): add GET /api/entries with pagination
feat(entries): add GET /api/entries/:id endpoint
feat(entries): add full-text search endpoint
feat(entries): add POST /api/entries for authenticated submissions
```

**Done when:** all four endpoints work, pagination returns correct meta, unauthenticated submission returns 401, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 4 from BuildPlan.md. Write failing tests for all four entry
endpoints — pagination meta, unauthenticated submission returning 401,
search returning correct results, and response envelope shape on every
response. Run them to confirm they are red. Report and stop."
```

---

### Phase 5 — Moderation Workflow

**Goal:** The state machine that makes this project technically interesting.

**State transitions:**
```
[submitted] → pending
[pending]   → approved   (moderator action)
[pending]   → rejected   (moderator action, note required)
[approved]  → published  (admin action)
[rejected]  → pending    (user resubmits after edit)
```

**Endpoints:**
```
GET    /api/moderation/queue          — list pending entries (moderator+)
PATCH  /api/moderation/:id/approve   — approve entry (moderator+)
PATCH  /api/moderation/:id/reject    — reject with note (moderator+)
PATCH  /api/moderation/:id/publish   — publish entry (admin only)
GET    /api/moderation/log           — audit log (admin only)
```

**Every state change must write a ModerationLog record.**

**Commits this phase:**
```
feat(moderation): add moderation queue endpoint for moderators
feat(moderation): implement approve and reject actions with state validation
feat(moderation): add publish endpoint for admin role
feat(moderation): write ModerationLog on every state transition
```

**Done when:** all state transitions enforced, invalid transitions return 400, every transition writes a ModerationLog, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 5 from BuildPlan.md. Write failing tests for every state machine
transition — every valid path and every invalid transition returning 400.
Verify ModerationLog is written on every transition. Cover role boundaries
(moderator vs admin). Run them to confirm they are red. Report and stop."
```

---

### Phase 6 — Frontend Core

**Goal:** Browsable, searchable dictionary. No auth UI yet.

**Pages:**
```
/                  — landing: search bar + recent entries
/entries           — browse all published entries with filters
/entries/:id       — single entry detail page
```

**Components to build:**
- `SearchBar` — controlled input, debounced query
- `EntryCard` — word, phonetic, short definition
- `EntryDetail` — full entry view
- `Pagination` — reusable

**Commits this phase:**
```
feat(client): add landing page with search bar
feat(client): add reusable Pagination component
feat(client): add entries browse page
feat(client): add entry detail page
```

**Done when:** all three pages render, search navigates correctly, loading/error states present, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 6 from BuildPlan.md. Write failing Vitest + RTL tests for the
landing page, entries browse page, and entry detail page. Cover loading states,
error states, and search navigation. Run them to confirm they are red.
Report and stop."
```

---

### Phase 7 — Frontend Auth + Submission

**Goal:** Users can register, log in, and submit entries.

**Pages:**
```
/login             — login form
/register          — register form
/submit            — entry submission form (auth required)
/my-submissions    — user's own submissions with status
```

**Commits this phase:**
```
feat(client): add login and register pages with form validation
feat(client): add protected route wrapper
feat(client): add entry submission form POS fields
feat(client): add my-submissions page with status indicators
```

**Done when:** auth flow works, protected routes redirect, submission form validates, my-submissions shows status badges, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 7 from BuildPlan.md. Write failing tests for login, register,
protected route redirect, submission form validation, and my-submissions
status display. Run them to confirm they are red. Report and stop."
```

---

### Phase 8 — Admin Dashboard

**Goal:** Moderators and admins can manage entries from a dedicated UI.

**Pages:**
```
/dashboard              — summary stats
/dashboard/queue        — moderation queue with approve/reject actions
/dashboard/entries      — all entries with status filter
/dashboard/users        — user list (admin only)
/dashboard/log          — moderation audit log (admin only)
```

**Commits this phase:**
```
feat(client): add dashboard layout with role-based nav
feat(client): add moderation queue with inline approve/reject
feat(client): add audit log view for admin role
```

**Done when:** role-based nav works, queue approve/reject function correctly, non-moderator users cannot reach dashboard, `npm test` passes

**Tester agent (run before coder):**
```
Spawn the tester agent:
"Read Phase 8 from BuildPlan.md. Write failing tests for role-based nav,
queue approve/reject actions, and non-moderator redirect. Run them to confirm
they are red. Report and stop."
```

---

### Phase 9 — Frontend Design & Navigation

**Goal:** Apply Cyber-Traditional design system, global navbar, auth interceptors, and post-login redirect.

- [x] Design token infrastructure — Tailwind v4 `@theme {}` tokens, Google Fonts, keyframes, utility classes
- [x] API interceptors — Bearer token on every request, 401 → auto-logout
- [x] App restructure — `AppRoutes` wrapper so interceptor can access `useAuth`
- [x] Navbar — sticky, context-aware (Browse; Login/Register when logged out; Submit/dropdown when logged in)
- [x] Auth flow fix — `state.from` redirect on Login and Register
- [x] Home page — bento grid with WOTD hero, search tile, stats tile, word tiles, CTA tile
- [x] Remaining pages — Entries, EntryDetail, Submit, MySubmissions, all dashboard pages

**Commits this phase:**
```
style(client): apply cyber-traditional design system and navbar
```

---

### Phase 10 — Polish & Production Readiness

**Goal:** The things that separate a portfolio project from a toy.

- [ ] Input validation on all POST/PATCH endpoints (express-validator)
- [ ] Rate limiting on auth endpoints (express-rate-limit)
- [ ] Error handling middleware (consistent error shape across API)
- [ ] Environment-based config (dev/prod)
- [ ] API response envelope: `{ success, data, error, meta }`
- [ ] MongoDB indexes on `status`, `pashto` (text index for search)
- [ ] Loading and error states on all frontend data fetches
- [ ] 404 page on client

**Commits this phase:**
```
feat(server): add express-validator to all mutation endpoints
feat(server): add rate limiting to auth routes
refactor(server): add global error handling middleware
feat(server): add MongoDB indexes for search and filter performance
chore(client): add loading and error states to all data fetches
```

**Done when:** all validation, rate limiting, error handling, and indexes in place, `npm test` passes across both server and client

---

### Phase 11 — TypeScript Migration (Server)

**Goal:** Convert the backend from CommonJS JavaScript to TypeScript. Client stays JSX/JS.

**Steps:**
1. Install `typescript`, `ts-node`, `ts-jest`, and `@types/*` packages
2. Add `server/tsconfig.json` (strict mode, CommonJS, outDir: `dist/`)
3. Update `jest.config.js` to use `ts-jest` preset
4. Rename files one layer at a time: `utils/` → `middleware/` → `models/` → `controllers/` → `routes/` → `index.ts`
5. Add `IUser`, `IConcept`, `IVariant`, `IModerationLog` interfaces to models
6. Update `package.json` scripts: `dev` → `ts-node`, `start` → `node dist/`, add `build` → `tsc`

**Commits this phase:**
```
chore(server): add tsconfig and ts-jest, install TypeScript deps
refactor(server): migrate utils and middleware to TypeScript
refactor(models): add TypeScript interfaces to all Mongoose schemas
refactor(controllers): convert controllers to TypeScript
refactor(routes): convert routes and index to TypeScript
```

**Done when:** `npx tsc --noEmit` passes with zero errors, `npm test` still passes

> Full details in `MigrationPlan.md` — Phase 11

---

### Phase 12 — AWS Deployment (Amplify + Lambda)

**Goal:** Host the React frontend on AWS Amplify and the Express backend on AWS Lambda + API Gateway. Zero code changes to business logic.

**Steps:**
1. Extract Express `app` into `server/src/app.ts` (separate from `index.ts`)
2. Add `server/src/lambda.ts` entry point using `serverless-http`
3. Create `amplify.yml` build config at project root
4. Connect GitHub repo to AWS Amplify for automatic frontend deploys
5. Deploy Lambda + API Gateway, set environment variables
6. Update `client/.env` `VITE_API_URL` to the API Gateway URL

**Commits this phase:**
```
refactor(server): extract app from index for serverless compatibility
feat(server): add Lambda entry point with serverless-http
chore: add amplify.yml build config
chore(client): update VITE_API_URL to API Gateway endpoint
```

**Done when:** frontend live on Amplify URL, API calls reach Lambda, all tests still pass locally

> Full details in `MigrationPlan.md` — Phase 12

---

### Phase 13 — AWS Cognito Migration

**Goal:** Replace JWT/bcrypt auth with AWS Cognito. This is the highest-effort phase — treat it as a full TDD cycle.

**Steps:**
1. Create Cognito User Pool with email + password sign-in
2. Replace `authController.ts` register/login logic with Cognito SDK calls
3. Rewrite `auth.ts` middleware to verify Cognito tokens via `aws-jwt-verify`
4. Remove `User.passwordHash`; add `User.cognitoSub`
5. Replace frontend `AuthContext` axios calls with `@aws-amplify/auth` SDK
6. Rewrite auth tests to mock Cognito; update E2E global setup for Cognito tokens

**Commits this phase:**
```
feat(auth): create Cognito User Pool and configure client
feat(auth): replace register/login with Cognito signUp/initiateAuth
feat(middleware): verify Cognito JWTs with aws-jwt-verify
refactor(models): remove passwordHash, add cognitoSub to User
feat(client): migrate AuthContext to Amplify Auth SDK
test(auth): rewrite auth tests for Cognito mocks
test(e2e): add Cognito token helper to global setup
```

**Done when:** register, login, /me work via Cognito, protected routes reject invalid tokens, all tests pass

> Full details in `MigrationPlan.md` — Phase 13

---

## Professional Practices Checklist

### Before every coding session
- [ ] Pull latest from `dev` branch
- [ ] Check if any schema or API contract changed

### Before every commit
- [ ] No console.log left in server code
- [ ] No hardcoded values that should be in .env
- [ ] Commit message follows conventional commits format

### Before merging a phase to `main`
- [ ] All endpoints tested manually (use Thunder Client or Postman)
- [ ] Frontend renders without console errors
- [ ] .env.example updated if new variables added
- [ ] README section for the phase filled out

### Never commit
- `.env` files
- `node_modules/`
- Any real user data

---

## README Sections to Fill As You Build

Your README should grow with the project. Fill each section when the corresponding phase is done:

```
## Overview
## Architecture
## Data Model
## Moderation Workflow (include state diagram)
## API Reference
## Local Setup
## Environment Variables
## What I'd do differently
```
