# Engineering Journey — Pashto Dialect Revival Dictionary

This document traces the key engineering decisions made during the development of this project, including the reasoning behind them, the problems they solved, and the tradeoffs that were considered. It is intended to give a sense of how the system evolved, not just what it looks like today.

---

## The Starting Point

The initial design treated every dictionary entry as a single flat document:

```
Entry
├── pashto       (the word in Pashto script)
├── phonetic     (romanised pronunciation)
├── region       (one of: Kohat, Hangu, Tirah, Thal, Parachinar)
├── partOfSpeech
├── definitions  [{ text, example }]
└── status       (pending | approved | rejected | published)
```

This worked well for a prototype. A word was submitted, reviewed, and published as a single unit. The moderation workflow was simple and linear.

---

## The Problem the Flat Model Could Not Solve

Pashto is not uniform. Even within a single dialect, the same concept can have completely different words depending on which valley the speaker is from. For example "Sun" can *lmar* in Kohat, *nmar* in Tirah, and *merastarga* in Hangu. These are not synonyms — they are regionally distinct words that share a meaning.

The flat `Entry` model had no way to express this relationship. Each variant would become a separate, unlinked document. A user searching for "sun" would find three unrelated entries with no indication that they referred to the same thing. The dictionary would fragment the language rather than preserve its structure.

---

## The Decision: Concept + Variant

The model was redesigned around two collections:

**`Concept`** — the meaning anchor. Lightweight. Holds the English gloss (e.g. "Sun"), part of speech, and its own moderation status. The concept represents the idea, not the word.

**`Variant`** — the regional word. Each variant belongs to one concept and carries the Pashto script, phonetic romanisation, region, definition, example sentence, and its own independent moderation lifecycle.

```
Concept: "Sun"  (noun)
    └── Variant: لمر  | phonetic: lmar   | region: Kohat
    └── Variant: نمر  | phonetic: nmar   | region: Tirah
    └── Variant: ...  | phonetic: ...    | region: Hangu
```

### Why two separate moderation lifecycles?

A key design requirement was that variants must be moderated independently. A single bad variant (e.g. a misspelled phonetic) should not block the other valid regional forms. At the same time, the concept itself needs moderation — a malicious or incorrect English gloss could corrupt the anchor for all its variants.

This meant the state machine — `pending → approved → rejected → published` — needed to run on both models independently, with every transition logged to a `ModerationLog` collection.

### Why not embed variants inside the concept document?

Embedded arrays would mean a single document owns all variants. That sounds convenient until you consider moderation: `Variant.find({ status: 'pending' })` becomes an aggregation pipeline over embedded arrays rather than a simple collection query. The moderation dashboard — which any moderator or admin checks regularly — would become significantly more complex to query and paginate. Two collections keeps both queries simple.

---

## The Moderation State Machine

```
submitted → pending    (automatic on POST)
pending   → approved   (moderator or admin)
pending   → rejected   (moderator or admin, note required)
approved  → published  (admin only)
rejected  → pending    (user edits and resubmits)
```

Every transition on either a Concept or a Variant writes a record to `ModerationLog` with the target model, target ID, action, performer, and optional note. This creates a full audit trail that the admin dashboard exposes.

Invalid transitions (e.g. `published → pending`) are rejected with a 400 — the state machine is enforced at the controller level, not left to the client to honour.

### Governance: Moderator Self-Approval Restriction

A moderator who is also an active contributor faces an inherent conflict of interest: they could submit an entry and then immediately approve it themselves, bypassing independent review entirely. To prevent this, the system enforces a submitter-separation rule at the controller level before any transition is applied.

If the acting user's role is `moderator` and their ID matches the `submittedBy` field on the target document, the request is rejected with a 403:

```js
if (req.user.role === 'moderator' && entry.submittedBy.equals(req.user._id)) {
  return res.status(403).json({ success: false, error: { message: 'Moderators cannot approve their own submissions' } });
}
```

Admins are exempt from this restriction. The rationale is that admins operate at a higher trust level and are accountable for overall system integrity in a way that moderators are not. This rule was chosen over more complex alternatives (e.g. blocking anyone who touched the document at any prior stage) because it is simple to reason about, auditable in the ModerationLog, and covers the primary conflict-of-interest case without introducing ambiguous edge cases.

The same self-separation rule extends to moderator edits (see *Moderator and Admin Edits* below). Moderators cannot edit their own submissions; admins can. The asymmetry is intentional for the same reason: admin is the final authority and must be able to correct their own mistakes without escalating to another admin.

---

## Moderator and Admin Edits

### Two separate edit paths

The system has two distinct mechanisms for changing a submission's content, and it is important that they remain separate:

**User resubmission** (`PUT /api/variants/:id`) — available only when the variant's status is `rejected`. The submitter corrects their own entry and it re-enters the `pending` state. This is a user action and is logged as `resubmitted`.

**Moderator/admin edit** (`PATCH /api/concepts/:id/edit`, `PATCH /api/variants/:id/edit`) — available at any status. A staff member corrects an entry in place without changing its moderation status. This is logged as `edited` with a full before/after diff.

Keeping these as two different routes with different semantics prevents ambiguity about who changed what and why. A `resubmitted` log entry always means the original submitter took action; an `edited` entry always means staff did.

### ModerationLog `changes` field

The `ModerationLog` schema includes an optional `changes` field (`Schema.Types.Mixed`) that stores a before/after diff for `edited` actions and a summary for `merged` actions:

```js
// edited
changes: { pashto: { from: 'old', to: 'new' }, region: { from: 'Kohat', to: 'Tirah' } }

// merged
changes: { mergedInto: '<targetId>', variantsMoved: ['<id1>'], variantsSkipped: ['<id2>'] }
```

Only fields that actually changed appear in the diff — unchanged fields are omitted. This keeps the log readable and ensures the admin dashboard can show meaningful diffs without storing noise.

### Concept merge

The merge tool (`POST /api/concepts/:sourceId/merge`) addresses the near-duplicate problem: two concepts like "Love" and "Love / Affection" that a submitter treated as different but a moderator identifies as the same. The operation:

1. Moves all non-deleted variants from the source concept to the target concept, running the duplicate check per variant and skipping any that would conflict.
2. Soft-deletes the source concept.
3. Logs the entire operation on the source concept as a single `merged` entry.

The response surfaces any skipped variants so the moderator knows they need manual attention. The merge is available to both moderators and admins, and is accessible from the moderation queue (via the similar-concepts panel) and from the concepts list in the dashboard.

The similar-concepts panel calls the existing `GET /api/concepts/suggest` endpoint — no new query mechanism was needed. The panel filters out the current item from the results before rendering.

---

## Soft Deletes and Content Archival

Concepts and Variants support soft deletion rather than hard deletion. When an admin removes a document, three fields are written:

```
isDeleted  Boolean   default: false
deletedAt  Date
deletedBy  ObjectId  ref: User
```

All list endpoints, search queries, and the Word of the Day algorithm include `{ isDeleted: false }` as an implicit filter. From the perspective of any public-facing request, soft-deleted content does not exist.

The decision against hard deletes is deliberate. The `ModerationLog` collection holds transition records that reference documents by ID. A hard delete would leave those log entries pointing at documents that no longer exist, breaking the audit trail and making the moderation history uninterpretable. Soft deletion keeps the audit record intact while hiding the content from all normal queries.

There is a secondary benefit: incorrectly deleted content can be recovered by an admin without reconstructing it from logs. In a community-contributed system where moderation errors are possible, this recovery path has real practical value.

Soft deletion applies only to `Concept` and `Variant`. User account deletion is a different concern — it may carry data erasure obligations and is handled separately, not by this mechanism.

---

## Normalization and Duplicate Detection

### The problem with raw string comparison

The initial duplicate check compared raw user input directly against stored values:

```js
const existing = await Variant.findOne({ pashto: req.body.pashto });
if (existing) return res.status(409).json({ ... });
```

This approach has two significant failure modes. First, it is sensitive to superficial input differences: a trailing space, a different capitalisation of an English gloss, or a Pashto word encoded differently by two different mobile keyboards would all bypass the check and create duplicate entries that appear identical to a human reader. Second, it has a race condition: two concurrent requests can both pass the pre-check query, both proceed to insert, and both succeed — producing a duplicate that the application-level guard was never capable of preventing.

### Normalized fields

To address the first problem, three normalized fields are derived automatically before any document is saved. They are set in Mongoose pre-save hooks and are never writable by client input:

| Field | Source | Transformation |
|---|---|---|
| `Concept.normalizedGloss` | `englishGloss` | `.toLowerCase().trim()` |
| `Variant.normalizedPashto` | `pashto` | `.trim().normalize('NFC')` |
| `Variant.normalizedPhonetic` | `phonetic` | `.toLowerCase().trim()` |

The NFC normalization on `normalizedPashto` deserves specific attention. Arabic-script keyboards — particularly on Android and iOS — can produce different Unicode byte sequences for the same visual character. One keyboard may output a precomposed code point; another may output a base character with a combining diacritical mark. Both render identically on screen but are not equal as strings. Without NFC normalization, two users submitting the same Pashto word from different phones would both pass the duplicate check. `.normalize('NFC')` collapses all representations to their canonical composed form, making the comparison encoding-independent. It requires no external library — it is a native JavaScript method.

All duplicate checks use the normalized fields, not the raw input fields.

### Database-level constraints

To address the race condition, MongoDB unique indexes enforce the identity rules at the database layer:

- `Concept`: unique index on `normalizedGloss`
- `Variant`: compound unique index on `{ concept, normalizedPashto, region }`

These constraints mean that even if two concurrent requests both pass the application-level pre-check, the database will reject the second insert with an `E11000 duplicate key` error (MongoDB error code 11000). The server catches this error and returns a 409 Conflict rather than letting it surface as a 500. The result is race-condition safety that is guaranteed by the storage layer, not by the timing of application-level queries.

The identity rule for a variant is deliberately scoped to `concept + pashto + region` rather than globally unique across the entire collection. The same Pashto word can legitimately appear under two different concepts — a form of polysemy that is linguistically valid — and the compound index correctly permits this while still preventing exact duplicates within a single concept and region.

### Why phonetics is excluded from identity rules

`normalizedPhonetic` is stored and used for search ranking and display, but it is deliberately excluded from the duplicate identity model. The reasoning is that two contributors may transcribe the same Pashto word differently depending on transcription convention or dialect familiarity — one might write *lmar*, another *l'mar*. These are not two different words; they are two representations of the same word. Treating `phonetic` as part of the duplicate key would create false duplicates and fragment entries that genuinely belong together. The identity model is therefore: concept + pashto script + region. Phonetics is additional metadata, not an identifier.

### Cross-concept duplicate signalling

Permitting the same Pashto word under different concepts is linguistically correct, but it creates a silent failure mode: a user who mistakenly files مینه under "lover" (when it belongs to "love") gets no feedback, and the moderator reviewing the pending entry has no signal that the word already exists elsewhere.

A read-only `GET /api/variants/cross-concept-check?pashto=&conceptId=` endpoint addresses this. It normalises the input identically to the pre-save hook, then queries for variants sharing the same `normalizedPashto` but a different `concept`. Results are deduplicated by concept (multiple regions under the same other concept produce one warning entry, not several).

The check surfaces at two points:

- **Submission form (Step 2):** On blur of the Pashto input, an amber warning box lists the conflicting concepts. Submission is still allowed — a language-expert moderator may judge the cross-concept usage valid.
- **Moderation queue:** After the pending variant list loads, the check runs in parallel for every card. Cards with conflicts show a small amber badge: *⚠ Also under: Love (published).*

Same-concept occurrences (مینه under "love" in Kohat vs Hangu) are intentionally excluded — those are different regional variants of the same concept, which is the whole point of the data model.

---

## The Submit Flow

Submitting a word is a two-step process:

1. **Step 1 — Concept:** The user types an English meaning. The form calls `/suggest` in real time and shows matching existing concepts. The user either selects one ("my word is a regional variant of this concept") or creates a new concept.

2. **Step 2 — Variant:** The user fills in the Pashto script, phonetic, region, definition, and an example sentence. On submit, the variant is created with `status: pending` and linked to the chosen or newly created concept.

This flow separates the act of defining a concept from the act of recording a regional word for it, which mirrors how the linguistic data actually works.

---

## Search: From Text Indexes to Ranked Regex

### The problem with MongoDB text search

The initial search used MongoDB's `$text` operator against an index on `Concept.englishGloss`. This is efficient and supports full-text ranking, but it has a critical limitation for a dictionary: it does not support substring matching. Typing "mee" would never return a concept whose variant has the phonetic "meena". The search had to be rethought.

### The new approach

Search now runs two parallel regex queries against separate collections:

```js
const [glossMatches, phoneticVariants] = await Promise.all([
  Concept.find({ englishGloss: regex, status: 'published' }, '_id englishGloss').lean(),
  Variant.find({ phonetic: regex, status: 'published' }, 'concept phonetic').lean(),
]);
```

The results are unified by concept ID into a score map, where each concept gets the higher of its two scores:

| Condition | Score |
|---|---|
| Exact match (case-insensitive) | 3 |
| Starts with query | 2 |
| Contains query anywhere | 1 |

Searching "love" returns "Love / Affection" (score 3) before "Lovely" (score 2) before "Beloved" (score 1). Searching "mee" returns concepts whose variants have phonetics like "meena" — something the text index approach could never do.

The results are sorted in-memory by score before pagination, and the internal `_score` field is stripped before the response is returned to the client.

### Why regex over a proper search engine?

For the current dataset scale (hundreds to low thousands of entries), a case-insensitive regex across two small collections is fast and straightforward. A dedicated search engine (Elasticsearch, Atlas Search) would add significant infrastructure complexity for a dataset this size. The regex approach is revisable — if the collection grows, the `GET /api/concepts/search` endpoint is the single point of change.

---

## Word of the Day

The Word of the Day (WOTD) is deterministic — every user sees the same concept all day, and it changes at midnight without any cron job, cache, or scheduled task.

The algorithm seeds on today's date:

```js
const seed  = year * 10000 + (month + 1) * 100 + day;  // e.g. 20260428
const index = seed % totalPublishedConcepts;
const wotd  = await Concept.findOne({ status: 'published' }).skip(index).lean();
```

Any given date maps to a stable index into the published concepts list. Adding new concepts shifts future dates but never changes what a past date showed. No state is stored anywhere — the date itself is the state.

---

## API Design

All API responses use a consistent envelope regardless of success or failure:

```json
// Success (single)
{ "success": true, "data": {} }

// Success (list)
{ "success": true, "data": [], "meta": { "page": 1, "limit": 20, "total": 0 } }

// Error
{ "success": false, "error": { "message": "string", "field": "optional" } }
```

Every list endpoint is paginated from the start — no endpoint returns an unbounded array. This was a deliberate early constraint to prevent the frontend from accumulating technical debt around pagination later.

---

## Frontend Design Decisions

### Bento layout with progressive disclosure

The home page uses a bento grid layout: a large Word of the Day hero tile, a search bar, concept cards, and community stats. On mobile, the layout stacks vertically. The design intentionally leads with the search bar (primary action for most visitors) before the WOTD (discovery content).

### Search spotlight

Clicking the search bar triggers a focus effect: the rest of the page dims with a blurred overlay while the search card lifts to a higher z-index, giving the input a spotlight quality. This is purely CSS and a small amount of React state (`searchFocused`) — no animation library.

### No component library

All UI is built from scratch with Tailwind CSS utility classes. This was a deliberate choice to demonstrate UI/UX judgement rather than configuration skill.

---

## TypeScript Migration (Phase 11)

The server was migrated from CommonJS JavaScript to TypeScript strict mode. Every Mongoose model has an explicit document interface (`IUser`, `IConcept`, `IVariant`, `IModerationLog`). Migration was done one layer at a time — utils → middleware → models → controllers → routes → entrypoints — keeping the test suite green throughout. The client stayed JSX/JS.

---

## AWS Deployment (Phase 12)

The Express app was split across three entrypoints to support both local dev and Lambda without duplicating business logic:

- `app.ts` — Express app with all routes and middleware, no `listen` call
- `index.ts` — local dev entrypoint; imports `app` and calls `app.listen`
- `lambda.ts` — AWS Lambda entrypoint; wraps `app` with `serverless-http`

Frontend is hosted on **AWS Amplify** — every push to the connected branch triggers a rebuild via `amplify.yml`. Backend runs as **AWS Lambda** (`pashto-backend`) behind **API Gateway**. No route handler changes were needed.

A **GitHub Actions CI/CD pipeline** enforces quality and automates deployments:

- `ci.yml` — runs `tsc --noEmit` + full test suite on every PR to `main`; a failing test blocks the merge
- `deploy.yml` — on every merge to `main`, compiles TypeScript, packages `dist/` + production `node_modules`, and deploys via `aws lambda update-function-code`

---

## AWS Cognito Migration (Phase 13)

Authentication was migrated from a custom bcrypt + JWT stack to **AWS Cognito**.

### What changed and why

The previous auth implementation stored a `passwordHash` in MongoDB and signed tokens with a `JWT_SECRET` environment variable. This placed credential management, key rotation, and token lifecycle entirely on the application. Cognito delegates these responsibilities to a managed service: it handles password hashing, token signing with auto-rotated JWKS keys, and session expiry.

### Backend

The `authController.ts` register and login functions now call Cognito via `@aws-sdk/client-cognito-identity-provider`:

- **`register`**: `SignUpCommand` → `AdminConfirmSignUpCommand` (auto-confirm for dev) → `InitiateAuthCommand` to obtain an access token. The Cognito `UserSub` (a UUID) is stored in MongoDB as `User.cognitoSub` to link the Cognito identity to the profile.
- **`login`**: `InitiateAuthCommand` with `USER_PASSWORD_AUTH` flow. The `cognitoSub` is decoded from the returned access token's JWT payload (base64 decode only — Cognito just issued it, no re-verification needed), then used to look up the MongoDB User.

The `authMiddleware` (`server/src/middleware/auth.ts`) now uses `aws-jwt-verify`'s `CognitoJwtVerifier` instead of `jwt.verify()`. On the first request the verifier fetches the User Pool's JWKS endpoint; subsequent verifications use the cached public keys. The token's `sub` claim becomes `req.user.id`; the `custom:role` claim (a mutable user attribute in Cognito) becomes `req.user.role`.

The `User` model dropped `passwordHash` and added `cognitoSub: { type: String, unique: true, sparse: true }`. The `sparse: true` allows multiple documents with no `cognitoSub` value on the unique index, which was needed during migration.

### Frontend

`client/src/main.jsx` calls `Amplify.configure()` once at startup with `VITE_COGNITO_USER_POOL_ID` and `VITE_COGNITO_CLIENT_ID`. `AuthContext.jsx` calls `@aws-amplify/auth` functions (`signIn`, `signUp`, `signOut`, `getCurrentUser`) directly — no more manual `localStorage` token management. The Axios interceptor in `services/api.js` calls `fetchAuthSession()` to get a fresh access token on every request; Amplify auto-refreshes expired tokens transparently.

### Role model

Roles (`user`, `moderator`, `admin`) are stored as a `custom:role` attribute in the Cognito User Pool and read from the access token claim. MongoDB's `User.role` field is kept in sync but the token is now the authoritative source for middleware decisions.

### Test strategy

Server tests mock both `aws-jwt-verify` (the JWKS verifier) and `@aws-sdk/client-cognito-identity-provider` (the SDK client). The mock for `aws-jwt-verify` returns controlled `{ sub, 'custom:role' }` payloads, allowing all auth-boundary and role-check tests to run without a real User Pool. Legacy test files that create their own JWTs use a Buffer base64-decode shim in the mock factory to extract `sub` and `role` from the existing token format.

---

## Stack Summary

| Layer | Technology | Notable choice |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 | No component library |
| Backend | Node.js 22 + Express + TypeScript (strict) | `express-async-errors` for clean async error handling |
| Database | MongoDB via Mongoose | Two-collection Concept/Variant model; unique indexes enforce data integrity |
| Auth | AWS Cognito + `aws-jwt-verify` + `@aws-amplify/auth` | Managed passwords, auto-rotating JWKS, role stored as `custom:role` attribute |
| Hosting | AWS Amplify (frontend) · Lambda + API Gateway (backend) | `serverless-http` wraps Express with zero business logic changes |
| CI/CD | GitHub Actions | Test gate on PRs; auto-deploy Lambda on merge to `main` |
| Validation | express-validator | All mutation endpoints validated before DB access |
| Normalisation | Native JS `.normalize('NFC')` + string methods | No external library; set via Mongoose pre-save hooks |
| Testing | Vitest + RTL (client) · Jest + MongoMemoryServer (server) · Playwright (E2E) | In-memory DB for server integration tests |
