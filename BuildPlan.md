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

### How to invoke the coder agent

Paste this once per phase into Claude Code (replace `N` with the phase number):

```
Spawn the coder agent with this instruction:
"Read Phase N from logs/PashtoDict-BuildPlan.md. Build it. Self-verify with
npm test. Fix any failures. Report completion and wait for my confirmation."
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

**Tester agent (optional, after Phase 1):**
```
Spawn the tester agent. Phase 1 (Project Initialisation) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
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

**Tester agent (optional, after Phase 2):**
```
Spawn the tester agent. Phase 2 (Data Models) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
```

---

### Phase 3 — Authentication

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

**Tester agent (optional, after Phase 3):**
```
Spawn the tester agent. Phase 3 (Authentication) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
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

**Tester agent (optional, after Phase 4):**
```
Spawn the tester agent. Phase 4 (Entry API) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
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

**Tester agent (optional, after Phase 5):**
```
Spawn the tester agent. Phase 5 (Moderation Workflow) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
Note: pay special attention to the state machine — every valid transition,
every invalid transition, and every ModerationLog write must be covered.
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

**Tester agent (optional, after Phase 6):**
```
Spawn the tester agent. Phase 6 (Frontend Core) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
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

**Tester agent (optional, after Phase 7):**
```
Spawn the tester agent. Phase 7 (Frontend Auth + Submission) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
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

**Tester agent (optional, after Phase 8):**
```
Spawn the tester agent. Phase 8 (Admin Dashboard) is complete.
Read what was built using git diff, derive test cases from the source files,
write test files to disk, run them, and report results.
```

---

### Phase 9 — Polish & Production Readiness

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
