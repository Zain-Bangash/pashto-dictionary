# Pashto Dictionary — User Flows

Reference for UI design, routing decisions, and feature scope.
Each flow lists the screens involved, key actions, and what the backend does.

---

## Roles

| Role | Can Do |
|---|---|
| **Guest** | Browse, search, view published words |
| **User** | + Submit words, save words, edit own submissions |
| **Moderator** | + Approve / reject pending submissions |
| **Admin** | + Publish approved words, manage all entries, manage users |

---

## Flow 1 — Guest: Search & View a Word

```
Home (/)
  │
  ├─ Types in search bar → presses Enter or clicks filter pill
  │
  └─► Entries List (/entries?q=...)
        │  Shows paginated published entries matching query
        │  Can re-filter by POS (noun, verb, etc.) or A–Z
        │
        └─► Word Detail (/entries/:id)
              │  Full entry: Pashto calligraphy, phonetic, all definitions,
              │  example sentences, contributor, listen button
              │
              ├─ Guest sees "Sign in to save this word"
              └─ Guest sees "Contribute a Word" CTA → leads to Flow 2
```

**States to handle**: empty results, partial match suggestions, loading skeleton.

---

## Flow 2 — Registration

```
Home (/) or any page — clicks "Contribute a Word" or "Register"
  │
  └─► Register (/register)
        │  Form: username, email, password (+ confirm)
        │  Client validation before submit
        │
        ├─ Success → JWT issued → redirect to Home (/) as logged-in User
        └─ Error   → inline field errors (email taken, weak password, etc.)
```

---

## Flow 3 — Login

```
Any page — clicks "Sign In"
  │
  └─► Login (/login)
        │  Form: email, password
        │
        ├─ Success → JWT stored → redirect to previous page or Home
        ├─ Wrong credentials → "Invalid email or password" (never specify which)
        └─ Forgot password → out of scope for current phase
```

---

## Flow 4 — Authenticated User: Submit a Word

```
Home (/) — "Contribute a Word" button (requires login)
  │
  └─► Submit (/submit)
        │  Form fields:
        │    • Pashto word (required, RTL input)
        │    • Phonetic transliteration
        │    • Part of speech (dropdown)
        │    • Definition (required)
        │    • Example sentence
        │    • Audio upload (future)
        │
        ├─ Submit → POST /api/entries
        │            status: submitted → pending (automatic)
        │            ModerationLog entry written
        │
        ├─ Success → "Word submitted! It's pending review."
        │            redirect to /dashboard or Home
        └─ Validation error → inline field errors
```

---

## Flow 5 — Authenticated User: Dashboard

```
Nav → "Dashboard" or avatar menu
  │
  └─► Dashboard (/dashboard)
        │
        ├─ My Submissions tab
        │    Lists user's own entries with current status:
        │    submitted / pending / approved / published / rejected
        │
        ├─ Rejected entry → "Edit & Resubmit"
        │    └─► Edit form (/submit/:id) → re-submit
        │         status: rejected → pending (ModerationLog written)
        │
        └─ (Future) Saved Words tab
```

---

## Flow 6 — Moderator: Review Queue

```
Nav (moderator role) → "Review" link
  │
  └─► Moderation Queue (/moderation)
        │  Paginated list of entries with status = pending
        │  Each row shows: Pashto word, phonetic, submitter, submitted date
        │
        └─► Entry Detail (/moderation/:id)
              │
              ├─ "Approve" button
              │    PATCH /api/entries/:id/status  { status: 'approved' }
              │    ModerationLog written
              │    → back to queue
              │
              └─ "Reject" button
                   Opens note input (required)
                   PATCH /api/entries/:id/status  { status: 'rejected', note: '...' }
                   ModerationLog written
                   → back to queue
```

**State machine enforced**: pending → approved or pending → rejected only. Any other transition returns 400.

---

## Flow 7 — Admin: Publish a Word

```
Nav (admin role) → "Admin" panel
  │
  └─► Admin Dashboard (/admin)
        │
        ├─ Approved tab — entries awaiting publish
        │    └─► "Publish" button
        │          PATCH /api/entries/:id/status  { status: 'published' }
        │          ModerationLog written
        │          Word now visible to guests on Home and Entries pages
        │
        ├─ All Entries tab — full CRUD
        │    Edit / delete any entry regardless of status
        │
        └─ Users tab
             List all users, promote to moderator, ban account
```

---

## Flow 8 — Admin: Sign In (elevated)

```
Login (/login) — same form as Flow 3
  │  Backend checks role on JWT payload
  │
  └─ Admin JWT issued
       → redirect to /admin dashboard
       Nav shows: "Admin", "Review", full entry management
```

No separate admin login URL. Role determines what nav items and routes are accessible.
Route guards: frontend redirects non-admins away from `/admin`; backend `requireRole('admin')` middleware enforces it on every API call.

---

## State Machine Summary (for reference)

```
submitted ──auto──► pending
pending   ──mod──►  approved   (moderator or admin)
pending   ──mod──►  rejected   (moderator or admin, note required)
approved  ──admin►  published  (admin only)
rejected  ──user──► pending    (user edits and resubmits)
```

Every transition writes a `ModerationLog` record. Invalid transitions return `400`.

---

## Route Map

| Path | Component | Auth |
|---|---|---|
| `/` | `Home` | Guest |
| `/entries` | `Entries` | Guest |
| `/entries/:id` | `EntryDetail` | Guest |
| `/login` | `Login` | Guest only (redirect if logged in) |
| `/register` | `Register` | Guest only |
| `/submit` | `Submit` | User+ |
| `/submit/:id` | `Submit` (edit mode) | Owner or Admin |
| `/dashboard` | `Dashboard` | User+ |
| `/moderation` | `ModerationQueue` | Moderator+ |
| `/moderation/:id` | `ModerationDetail` | Moderator+ |
| `/admin` | `AdminDashboard` | Admin only |
