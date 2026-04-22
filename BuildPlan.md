# Pashto Dialect Revival Dictionary — Build Plan
**Stack: React + Tailwind · Node.js + Express · MongoDB**

---

## Project Overview

A community-driven dictionary platform for preserving Pashto regional dialects. Users submit entries, moderators review them, admins approve and publish. Every technical decision should serve this purpose.

**Core features:**
- Browse and search dictionary entries by word, meaning
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
  refactor(models): normalise dialect field to enum
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

---

### Phase 1 — Project Initialisation

**Goal:** Clean repo, both apps running, connected to MongoDB.

**Steps:**
1. Create GitHub repo: `pashto-dictionary`
2. Clone locally, create `dev` branch immediately
3. Initialise `server/` with Express + dotenv + mongoose
4. Initialise `client/` with Vite + React + Tailwind
5. Add `.gitignore` (node_modules, .env, dist)
6. Confirm: `GET /api/health` returns `{ status: "ok" }`, React renders, MongoDB connects

**Commits this phase:**
```
chore(server): initialise Express + mongoose project structure
chore(client): initialise Vite + React + Tailwind
chore: add .gitignore and root README placeholder
feat(server): add /api/health check endpoint
```

---

### Phase 2 — Data Models

**Goal:** Define the core MongoDB schemas before writing any route logic.

**Schemas to build:**

```
Entry {
  word: String (required)
  english: String
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
feat(entries): add GET /api/entries with pagination and dialect filter
feat(entries): add GET /api/entries/:id endpoint
feat(entries): add full-text search endpoint
feat(entries): add POST /api/entries for authenticated submissions
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
- `EntryCard` — word, phonetic, dialect tag, short definition
- `EntryDetail` — full entry view
- `DialectFilter` — filter pills
- `Pagination` — reusable

**Commits this phase:**
```
feat(client): add landing page with search bar
feat(client): add entries browse page with dialect filters
feat(client): add entry detail page
feat(client): add reusable Pagination component
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
feat(client): add entry submission form with dialect and POS fields
feat(client): add my-submissions page with status indicators
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

---

### Phase 9 — Polish & Production Readiness

**Goal:** The things that separate a portfolio project from a toy.

- [ ] Input validation on all POST/PATCH endpoints (express-validator)
- [ ] Rate limiting on auth endpoints (express-rate-limit)
- [ ] Error handling middleware (consistent error shape across API)
- [ ] Environment-based config (dev/prod)
- [ ] API response envelope: `{ success, data, error, meta }`
- [ ] MongoDB indexes on `status`, `dialect`, `pashto` (text index for search)
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

---

## Sub-Agent Prompts

Use these prompts to kick off each phase with Claude. Paste them directly into Claude Code.

---

### Prompt 1 — Project Setup

```
Set up a new MERN project called pashto-dictionary with the following structure:
- server/ — Node.js + Express, with mongoose, dotenv, cors, express-validator, bcryptjs, jsonwebtoken installed
- client/ — Vite + React + Tailwind CSS

In server/:
- Entry point: src/index.js
- Create folder structure: src/controllers, src/models, src/routes, src/middleware, src/utils
- Add a GET /api/health route that returns { status: "ok", timestamp: new Date() }
- Add a .env.example with: PORT, MONGODB_URI, JWT_SECRET
- Connect to MongoDB using mongoose with a connection success/failure log

In client/:
- Configure Tailwind with a simple custom font and neutral colour palette
- Add a placeholder App.jsx that renders "Pashto Dictionary" centered on screen

Use conventional commits. Do not add any features beyond what is listed here.
```

---

### Prompt 2 — Data Models

```
In the server/src/models/ directory of the pashto-dictionary project, create three Mongoose schemas:

1. Entry.js
   - pashto: String, required
   - phonetic: String
   - dialect: enum ['kandahari', 'peshawar', 'quetta', 'wardak', 'other'], required
   - region: String
   - partOfSpeech: enum ['noun', 'verb', 'adjective', 'adverb', 'phrase', 'other']
   - definitions: array of { text: String (required), example: String }
   - submittedBy: ObjectId ref User
   - status: enum ['pending', 'approved', 'rejected', 'published'], default 'pending'
   - moderatorNote: String
   - reviewedBy: ObjectId ref User
   - timestamps: true

2. User.js
   - username: String, required, unique, trimmed
   - email: String, required, unique, lowercase
   - passwordHash: String, required
   - role: enum ['user', 'moderator', 'admin'], default 'user'
   - timestamps: true

3. ModerationLog.js
   - entry: ObjectId ref Entry, required
   - action: enum ['submitted', 'approved', 'rejected', 'published'], required
   - performedBy: ObjectId ref User, required
   - note: String
   - timestamp: Date, default Date.now

Add a text index on Entry for the pashto field and a regular index on status and dialect fields.
Use conventional commit messages.
```

---

### Prompt 3 — Authentication

```
In the pashto-dictionary server, build the full authentication system:

Middleware:
- src/middleware/auth.js — verifyToken: extract Bearer token from Authorization header,
  verify with JWT_SECRET, attach decoded user to req.user. Return 401 if missing or invalid.
- src/middleware/requireRole.js — factory function requireRole(role) that checks
  req.user.role against the required role. Return 403 if insufficient.

Endpoints in src/routes/auth.js:
- POST /api/auth/register: validate email + username + password (min 8 chars),
  hash password with bcrypt (10 rounds), create User, return JWT + user object (no passwordHash)
- POST /api/auth/login: find user by email, compare password, return JWT + user object
- GET /api/auth/me: protected route, return current user from req.user

JWT payload should include: { id, username, role }
JWT expiry: 7 days

Use express-validator for input validation on register and login.
Return consistent error shape: { success: false, error: { message, field? } }
Use conventional commits.
```

---

### Prompt 4 — Entry API

```
In the pashto-dictionary server, build the dictionary entry API:

File: src/controllers/entryController.js + src/routes/entries.js

Endpoints:
- GET /api/entries
  Query params: page (default 1), limit (default 20, max 50), dialect, status (default 'published')
  Only return published entries to unauthenticated users.
  Return: { success, data: [entries], meta: { page, limit, total } }

- GET /api/entries/:id
  Return single entry if status is published. 404 if not found or not published.

- GET /api/entries/search?q=
  Full-text search on pashto field using MongoDB $text index.
  Only search published entries.
  Return same envelope as list endpoint.

- POST /api/entries (requires auth)
  Accept: pashto, phonetic, dialect, region, partOfSpeech, definitions array
  Set submittedBy from req.user.id, status defaults to 'pending'
  Create a ModerationLog entry with action 'submitted'
  Return 201 with created entry

Validate all inputs with express-validator.
Use conventional commits.
```

---

### Prompt 5 — Moderation Workflow

```
In the pashto-dictionary server, build the moderation system:

File: src/controllers/moderationController.js + src/routes/moderation.js
All routes require auth middleware. Role requirements noted per route.

Enforce this state machine — invalid transitions must return 400:
  pending → approved (moderator or admin)
  pending → rejected (moderator or admin, moderatorNote required)
  approved → published (admin only)
  rejected → pending (user resubmit — this is handled in entry PATCH, not here)

Endpoints:
- GET /api/moderation/queue (moderator+)
  Return all entries with status 'pending', newest first, paginated

- PATCH /api/moderation/:id/approve (moderator+)
  Set status to 'approved', set reviewedBy to req.user.id
  Write ModerationLog: action 'approved'

- PATCH /api/moderation/:id/reject (moderator+)
  Require moderatorNote in body (validate: not empty)
  Set status to 'rejected', set moderatorNote, set reviewedBy
  Write ModerationLog: action 'rejected', note from body

- PATCH /api/moderation/:id/publish (admin only)
  Entry must be in 'approved' state — reject with 400 if not
  Set status to 'published'
  Write ModerationLog: action 'published'

- GET /api/moderation/log (admin only)
  Return ModerationLog entries, populated with entry.pashto and performedBy.username
  Paginated, newest first

Use conventional commits.
```

---

### Prompt 6 — Frontend Core (Browse + Search)

```
In the pashto-dictionary client, build the public-facing dictionary UI using React + Tailwind:

API base URL should come from an environment variable VITE_API_URL.
Create src/services/api.js with a configured axios instance.

Pages:
1. src/pages/Home.jsx
   - Centered search bar with placeholder "Search Pashto words..."
   - Debounced input (300ms) that navigates to /entries?q= on submit
   - Display 6 most recent published entries below as EntryCard components

2. src/pages/Entries.jsx
   - Read query params: q (search), dialect (filter), page
   - Fetch from /api/entries/search or /api/entries based on whether q exists
   - Render EntryCard grid with dialect filter pills at top
   - Pagination controls at bottom

3. src/pages/EntryDetail.jsx
   - Fetch /api/entries/:id
   - Display: pashto word (large), phonetic, dialect badge, region, part of speech
   - List all definitions with examples
   - Submitted by username + date

Components to create:
- src/components/EntryCard.jsx — word, phonetic, dialect tag, first definition truncated
- src/components/DialectFilter.jsx — pill buttons for each dialect + "All"
- src/components/Pagination.jsx — prev/next with page number display

Use Tailwind only. No component library. Clean, readable, neutral design.
Use conventional commits.
```

---

### Prompt 7 — Auth UI + Submission

```
In the pashto-dictionary client, add user authentication and entry submission:

State management: React Context (src/context/AuthContext.jsx)
- Store: user object, JWT token (localStorage)
- Provide: login(token, user), logout(), isAuthenticated, user, role
- On app load, check localStorage and validate token presence

Pages:
1. src/pages/Login.jsx — email + password form, POST to /api/auth/login,
   store token on success, redirect to home
2. src/pages/Register.jsx — username + email + password form, POST to /api/auth/register
3. src/pages/Submit.jsx (protected) — entry submission form with fields:
   pashto, phonetic, dialect (select), region, partOfSpeech (select),
   and a dynamic definitions list (add/remove rows with text + example)
   POST to /api/entries, show success message with link to /my-submissions
4. src/pages/MySubmissions.jsx (protected) — GET /api/entries?submittedBy=me&status=all
   Show each submission with a status badge (colour-coded: pending/approved/rejected/published)

Add a ProtectedRoute wrapper component that redirects to /login if not authenticated.
Update the nav to show Login/Register when logged out, and username + Submit + My Submissions when logged in.
Use conventional commits.
```

---

### Prompt 8 — Admin Dashboard

```
In the pashto-dictionary client, build the moderation dashboard:

All dashboard routes require authentication. Moderator role sees queue + entries.
Admin role sees everything including users and audit log.

Layout: src/pages/dashboard/DashboardLayout.jsx
  - Sidebar nav with role-based links
  - Outlet for child pages

Pages:
1. /dashboard — summary cards: total entries, pending count, published count
2. /dashboard/queue (moderator+)
   - List entries from /api/moderation/queue
   - Each row: pashto word, dialect, submitted by, submitted date
   - Inline buttons: Approve (green) / Reject (red, opens note modal)
   - Rejection modal requires a non-empty note before confirming
3. /dashboard/entries (moderator+)
   - All entries with status filter tabs: All / Pending / Approved / Rejected / Published
   - Table view with status badges
4. /dashboard/log (admin only)
   - Audit log table: entry word, action, performed by, timestamp, note

Use Tailwind only. Keep the UI functional and clean — not decorative.
Use conventional commits.
```

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
