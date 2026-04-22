# Pashto Dialect Revival Dictionary — Build Plan
**Stack: React + Tailwind · Node.js + Express · MongoDB**

---

## Project Overview

A community-driven dictionary platform for preserving Pashto regional dialects. Users submit entries, moderators review them, admins approve and publish. Every technical decision should serve this purpose.

**Core features:**
- Browse and search dictionary entries by word, dialect, or region
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
6. Add placeholder `README.md` and `CLAUDE.md` (copy from template)
7. Confirm: `GET /api/health` returns `{ status: "ok" }`, React renders, MongoDB connects

**Commits this phase:**
```
chore(server): initialise Express + mongoose project structure
chore(client): initialise Vite + React + Tailwind
chore: add .gitignore and root README placeholder
feat(server): add /api/health check endpoint
```

**Tester prompt — run after Phase 1:**
```
You are a tester sub-agent for the pashto-dictionary project. The server runs on port 5000
and the client runs on port 5173. Your job is to verify Phase 1 is complete and correct.

Run the following checks using curl and by reading the source files. Report each check as
PASS or FAIL with a one-line reason. At the end, list any failures with what needs to be fixed.

Checks:
1. GET http://localhost:5000/api/health returns HTTP 200 with body { "status": "ok" }
2. Server logs show a successful MongoDB connection on startup (read server console output or logs)
3. server/src/index.js exists and imports mongoose, express, cors, dotenv
4. server/.env.example exists and contains PORT, MONGODB_URI, JWT_SECRET
5. server/src/controllers/, models/, routes/, middleware/, utils/ directories all exist
6. client/src/App.jsx exists and renders without import errors (check for obvious syntax issues)
7. client/tailwind.config.js exists and is configured
8. node_modules/ is NOT committed (check .gitignore contains node_modules)
9. .env is NOT committed (check .gitignore contains .env)
10. At least one commit exists with message matching conventional commits format

Do not fix anything. Report only. If a check cannot be run because the server is not
currently running, note that and verify the source files instead.
```

---

### Phase 2 — Data Models

**Goal:** Define the core MongoDB schemas before writing any route logic.

**Schemas to build:**

```
Entry {
  word: String (required)
  phonetic: String
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

**Tester prompt — run after Phase 2:**
```
You are a tester sub-agent for the pashto-dictionary project. Your job is to verify
Phase 2 (Data Models) is complete and correct. Do not fix anything — report only.

Read the files in server/src/models/ and verify each check. Report PASS or FAIL with reason.

Entry model checks:
1. Entry.js exists in server/src/models/
2. pashto field is required and type String
3. dialect field is an enum with exactly: kandahari, peshawar, quetta, wardak, other
4. status field is an enum with: pending, approved, rejected, published — default is 'pending'
5. definitions is an array of objects with text (required) and example fields
6. submittedBy and reviewedBy are ObjectId refs to User
7. timestamps: true is set
8. A MongoDB text index is defined on the pashto field
9. Indexes are defined on status and dialect fields

User model checks:
10. User.js exists in server/src/models/
11. username is required, unique, and trimmed
12. email is required, unique, and lowercased
13. passwordHash is required (NOT named "password")
14. role enum contains exactly: user, moderator, admin — default is 'user'

ModerationLog model checks:
15. ModerationLog.js exists in server/src/models/
16. entry field is ObjectId ref to Entry, required
17. action enum contains: submitted, approved, rejected, published
18. performedBy is ObjectId ref to User, required
19. note field exists as String
20. timestamp defaults to Date.now

At the end, list all FAILs and what specifically needs to be corrected.
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

**Tester prompt — run after Phase 3:**
```
You are a tester sub-agent for the pashto-dictionary project. The server runs on
port 5000 with MongoDB connected. Verify Phase 3 (Authentication) using curl commands.
Report each check as PASS or FAIL with a one-line reason. Do not fix anything.

Run these checks in order (some depend on earlier results):

Registration:
1. POST /api/auth/register with { "username": "testuser", "email": "test@test.com", "password": "password123" }
   → expect 201, body contains token and user object (no passwordHash field)
2. POST /api/auth/register with the same email again
   → expect 400, error message about duplicate email
3. POST /api/auth/register with password "abc" (too short)
   → expect 400, validation error on password field
4. POST /api/auth/register with missing username
   → expect 400, validation error

Login:
5. POST /api/auth/login with { "email": "test@test.com", "password": "password123" }
   → expect 200, body contains token
6. POST /api/auth/login with wrong password
   → expect 401
7. POST /api/auth/login with non-existent email
   → expect 401

Protected routes:
8. GET /api/auth/me with valid Bearer token from check 1 or 5
   → expect 200, user object returned, no passwordHash
9. GET /api/auth/me with no Authorization header
   → expect 401
10. GET /api/auth/me with "Bearer invalidtoken"
    → expect 401

Source checks (read files):
11. authMiddleware in server/src/middleware/auth.js does not contain the JWT_SECRET hardcoded
12. requireRole is a factory function (takes role as argument, returns middleware)
13. Passwords are hashed with bcrypt — no plain text storage in register controller

All responses must use the envelope: { success, data/error }. Check this on at least checks 1 and 6.
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

**Tester prompt — run after Phase 4:**
```
You are a tester sub-agent for the pashto-dictionary project. The server runs on port 5000.
You need a valid user token — first run:
  POST /api/auth/register { "username": "tester", "email": "tester@test.com", "password": "password123" }
Save the returned token as TOKEN. Then verify Phase 4 (Entry API) with these checks.
Report PASS or FAIL with reason. Do not fix anything.

Before testing, seed one published entry directly via the Mongoose model or a seed script
if no published entries exist yet, so GET /api/entries has data to return.

List endpoint:
1. GET /api/entries → 200, data is array, meta contains page/limit/total
2. GET /api/entries?page=1&limit=5 → meta.limit is 5
3. GET /api/entries?dialect=kandahari → all results have dialect=kandahari (or empty array, not error)
4. GET /api/entries with no auth → 200 (public endpoint, should not require auth)
5. GET /api/entries does NOT return entries with status=pending

Single entry:
6. GET /api/entries/:id with a valid published entry ID → 200, full entry returned
7. GET /api/entries/:id for a pending entry → 404
8. GET /api/entries/invalidid → 400 or 404, not a 500 crash

Search:
9. GET /api/entries/search?q=test → 200, array returned (may be empty)
10. GET /api/entries/search (no q param) → 400 or returns empty, NOT a 500

Submission:
11. POST /api/entries without auth → 401
12. POST /api/entries with TOKEN and valid body:
    { "pashto": "آب", "dialect": "kandahari", "partOfSpeech": "noun",
      "definitions": [{ "text": "water" }] }
    → 201, status is "pending", submittedBy matches tester user ID
13. POST /api/entries with missing pashto field → 400 validation error
14. POST /api/entries with invalid dialect value → 400 validation error

Check response envelope on all responses — must be { success, data/error }.
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

**Tester prompt — run after Phase 5:**
```
You are a tester sub-agent for the pashto-dictionary project. The server runs on port 5000.
This is the most critical phase — the moderation state machine must be airtight.

Setup: create three users via /api/auth/register and note their tokens:
  USER_TOKEN   — role: user (default)
  MOD_TOKEN    — manually set role to 'moderator' in MongoDB
  ADMIN_TOKEN  — manually set role to 'admin' in MongoDB

Then submit a test entry as USER_TOKEN and note its ID as ENTRY_ID.

Report each check as PASS or FAIL with reason. Do not fix anything.

Queue access:
1. GET /api/moderation/queue with no auth → 401
2. GET /api/moderation/queue with USER_TOKEN → 403
3. GET /api/moderation/queue with MOD_TOKEN → 200, ENTRY_ID appears in results
4. GET /api/moderation/queue with ADMIN_TOKEN → 200

Approve flow:
5. PATCH /api/moderation/ENTRY_ID/approve with MOD_TOKEN → 200, entry status is now 'approved'
6. GET /api/moderation/queue with MOD_TOKEN → ENTRY_ID no longer in pending queue
7. Check MongoDB: ModerationLog has a record with action='approved' for ENTRY_ID

Reject flow (submit a second entry first, note as ENTRY_ID_2):
8. PATCH /api/moderation/ENTRY_ID_2/reject with MOD_TOKEN and no note in body → 400
9. PATCH /api/moderation/ENTRY_ID_2/reject with MOD_TOKEN and { "note": "needs phonetic" } → 200, status='rejected'
10. Check MongoDB: ModerationLog has action='rejected' with the note for ENTRY_ID_2

Invalid transitions:
11. PATCH /api/moderation/ENTRY_ID/approve (already approved) → 400, cannot transition
12. PATCH /api/moderation/ENTRY_ID_2/publish with ADMIN_TOKEN (still rejected) → 400

Publish flow:
13. PATCH /api/moderation/ENTRY_ID/publish with MOD_TOKEN (not admin) → 403
14. PATCH /api/moderation/ENTRY_ID/publish with ADMIN_TOKEN → 200, status='published'
15. GET /api/entries/ENTRY_ID (public) → 200, entry is now visible
16. Check MongoDB: ModerationLog has action='published' for ENTRY_ID

Audit log:
17. GET /api/moderation/log with USER_TOKEN → 403
18. GET /api/moderation/log with ADMIN_TOKEN → 200, contains all 3 log entries for ENTRY_ID

Total ModerationLog records for ENTRY_ID should be: submitted + approved + published = 3 records.
Verify this count in the audit log response.
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
feat(client): add reusable Pagination component
feat(client): add entries browse page with dialect filters
feat(client): add entry detail page
```

**Tester prompt — run after Phase 6:**
```
You are a tester sub-agent for the pashto-dictionary project. The client runs on
port 5173. Your job is to verify Phase 6 (Frontend Core) by reading source files
and checking the running app. Do not fix anything — report PASS or FAIL with reason.

Source file checks:
1. src/services/api.js exists and creates an axios instance using VITE_API_URL env variable
2. All API calls in components/pages use this api.js service — no raw fetch() or direct axios calls
3. Home.jsx uses a debounced search input (check for debounce logic or a useDebounce hook)
4. Entries.jsx reads query params: q, dialect, page from the URL
5. DialectFilter renders a pill/button for each dialect value from the Entry enum
6. Pagination component accepts page, totalPages (or total+limit), and onPageChange props
7. EntryCard renders: pashto word, phonetic, dialect badge, truncated first definition
8. EntryDetail renders: pashto, phonetic, dialect, region, part of speech, all definitions with examples

Behaviour checks (with server running and at least 2 published entries seeded):
9. http://localhost:5173/ loads without console errors
10. Typing in the search bar on Home and pressing Enter navigates to /entries?q=<term>
11. http://localhost:5173/entries loads and displays entry cards
12. Clicking a dialect filter pill updates the URL with ?dialect= and filters the results
13. http://localhost:5173/entries/:validId loads the entry detail page
14. http://localhost:5173/entries/invalidid shows a not-found state, not a blank crash

Loading/error states:
15. Entries.jsx has a loading state shown while the API call is in flight
16. Entries.jsx has an error state shown if the API call fails
17. EntryDetail.jsx has both loading and error states
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

**Tester prompt — run after Phase 7:**
```
You are a tester sub-agent for the pashto-dictionary project. The client runs on
port 5173 and the server on port 5000. Verify Phase 7 (Auth UI + Submission).
Report PASS or FAIL with reason. Do not fix anything.

AuthContext checks (read src/context/AuthContext.jsx):
1. token is stored in and read from localStorage
2. On app load, token presence is checked to restore session
3. logout() clears the token from localStorage
4. AuthContext exposes: user, isAuthenticated, login, logout, role

Protected route checks:
5. Navigate to http://localhost:5173/submit without being logged in
   → should redirect to /login, not render the form
6. Navigate to http://localhost:5173/my-submissions without being logged in
   → should redirect to /login

Registration flow:
7. http://localhost:5173/register loads without errors
8. Submit with mismatched or short password → inline validation error shown, no API call made
9. Submit with valid data → redirected to home or login, success feedback shown

Login flow:
10. http://localhost:5173/login loads without errors
11. Submit with wrong password → error message shown (not a blank screen or uncaught error)
12. Submit with valid credentials → redirected, nav updates to show username

Submission form:
13. http://localhost:5173/submit renders all fields: pashto, phonetic, dialect (select),
    region, partOfSpeech (select), definitions list with add/remove rows
14. Submit with empty pashto field → validation error shown before API call
15. Submit valid entry → success message shown with link to /my-submissions
16. Submitted entry appears on /my-submissions with status badge 'pending'

My submissions:
17. /my-submissions shows only the current user's entries
18. Each entry shows a colour-coded status badge (pending/approved/rejected/published)
19. A rejected entry shows the moderator's note

Nav:
20. When logged out: Login and Register links visible, Submit link not visible
21. When logged in: username visible, Submit and My Submissions links visible, Logout works
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

**Tester prompt — run after Phase 8:**
```
You are a tester sub-agent for the pashto-dictionary project. The client runs on
port 5173. You need three browser sessions or separate tokens:
  - USER: regular user account
  - MOD: moderator role account
  - ADMIN: admin role account

Verify Phase 8 (Admin Dashboard). Report PASS or FAIL with reason. Do not fix anything.

Access control:
1. Navigate to /dashboard as USER → redirected away or shown access denied
2. Navigate to /dashboard as MOD → dashboard loads
3. Navigate to /dashboard as ADMIN → dashboard loads

Dashboard nav (as ADMIN):
4. Sidebar shows: Dashboard, Moderation Queue, Entries, Users, Audit Log
5. Sidebar as MOD shows: Dashboard, Moderation Queue, Entries — NOT Users or Audit Log

Moderation queue (as MOD, with at least one pending entry):
6. /dashboard/queue shows pending entries with: pashto word, dialect, submitted by, date
7. Approve button on a pending entry → entry disappears from queue, success feedback shown
8. Reject button opens a modal or inline input for a note
9. Clicking reject without entering a note → blocked, error shown
10. Clicking reject with a note → entry removed from queue, entry status updates to rejected

Entries view (as MOD):
11. /dashboard/entries shows all entries regardless of status
12. Status filter tabs work — clicking 'Pending' shows only pending entries
13. Status badges are colour-coded

Audit log (as ADMIN):
14. /dashboard/log shows actions with: entry word, action type, performed by username, timestamp
15. Rejected entries show the moderator note in the log

Users view (as ADMIN):
16. /dashboard/users shows registered users with their roles

Source check:
17. Dashboard routes are protected — read DashboardLayout.jsx or the router config and
    confirm unauthenticated users and users without sufficient role cannot reach any /dashboard/* route
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
