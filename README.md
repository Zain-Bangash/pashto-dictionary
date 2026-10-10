# Pashto Dialect Revival Dictionary

![CI](https://github.com/Zain-Bangash/pashto-dictionary/actions/workflows/ci.yml/badge.svg)

## Overview

A community-driven dictionary platform for preserving Pashto regional dialects. Users submit entries, moderators review them, admins publish them. The system is designed around data integrity — every submission goes through an explicit moderation state machine, and every decision is logged to an audit trail.

The project combines full-stack software engineering with real linguistic work: words are sourced from native speakers and elders, cross-referenced against linguistic research, and verified before publication.

---

## Motivation

My local dialect of Pashto is gradually declining as native vocabulary is replaced by foreign loanwords. A key factor is the absence of an accessible, structured, community-driven digital dictionary. This project is an attempt to solve that with software.

---

## Project Evolution

- **Initial version:** Spring Boot backend, basic CRUD
- **Second iteration:** MERN stack rebuild
- **Current version:** Full redesign with AI-assisted workflows, TypeScript backend, AWS deployment, and a production-grade moderation system

---

## Architecture

```
Browser
  │
  ├── React app ──────────────► AWS Amplify Hosting
  │                              (auto-deploys on push to main)
  └── API calls ──────────────► AWS API Gateway
                                      │
                                      ▼
                               AWS Lambda (Node.js 22)
                               Express + serverless-http
                                      │
                                      ├── MongoDB Atlas M0
                                      └── AWS Cognito (auth)
```

Backend infrastructure is declared in `template.yaml` (AWS SAM) and owned by the CloudFormation stack `pashto-dictionary`.

**Further reading**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — why: the Concept/Variant data model, ranked search, normalisation and duplicate detection, the moderation state machine
- [docs/BuildHistory.md](docs/BuildHistory.md) — how: the original phase-by-phase plan and what actually happened
- [docs/USER-FLOWS.md](docs/USER-FLOWS.md) — what each role can do
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) — the visual language

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Node.js 22, Express, TypeScript |
| Database | MongoDB Atlas via Mongoose |
| Auth | AWS Cognito (server-side SDK + `aws-jwt-verify`); roles stored in MongoDB |
| Hosting | AWS Amplify (frontend) · AWS Lambda + API Gateway, managed by AWS SAM (backend) |
| CI/CD | GitHub Actions — test gate on PRs, auto-deploy on merge to `main` |
| Testing | Vitest + RTL (client) · Jest + MongoMemoryServer (server) · Playwright (E2E) |

---

## Data Model

```
Concept  — the meaning anchor (English gloss, part of speech, moderation status)
    └── Variant(s) — the regional word (Pashto script, phonetic, region, definition)

Lookup   — admin-editable lists (region, part of speech): immutable key, editable label
FieldDefinition — admin-defined extra fields; values stored in Concept.extra / Variant.extra
VariantSuggestion — fill-only proposals for a user's own published variant
AudioClip — a pronunciation recording for one slot of a published variant (headword, example, a form); file in Cloudflare R2
```

Each Concept and each Variant has its own independent moderation lifecycle. A single bad variant does not block other valid regional forms of the same concept.

---

## Moderation Workflow

```
submitted → pending    (automatic on POST)
pending   → approved   (moderator or admin)
pending   → rejected   (moderator or admin, note required)
approved  → published  (admin only)
approved  → rejected   (admin only, note required)
published → rejected   (admin only, note required)
rejected  → pending    (user edits and resubmits)
```

Users can also propose missing details (phonetic, example, forms, optional extra fields) for their own published words. A suggestion is a separate record with the same review flow; the live word is untouched until an admin publishes it.

Any logged-in user can record a pronunciation for a published word. Clips follow the same review flow in their own `AudioClip` records, plus `withdrawn` (by the speaker, while pending) and `retired` (replaced by a newer clip, or the text it speaks was edited). Only published clips are ever played to the public.

Every transition on Concept or Variant writes a record to `ModerationLog` with the actor, action, timestamp, and optional note. Invalid transitions return 400. Moderators cannot approve their own submissions.

---

## API Reference

All responses use the envelope `{ success, data, meta }` or `{ success, error }`. All list endpoints are paginated.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, returns Cognito access token and sets the httpOnly refresh cookie. `401` on wrong email/password, `429` when rate-limited |
| POST | `/api/auth/refresh` | Cookie | New access token + user from the refresh cookie. `401` when the session is missing, expired or revoked; `403` without `X-Requested-With` or from an unknown origin |
| POST | `/api/auth/logout` | Cookie | Revokes the refresh token and clears the cookie. Always `200` |
| GET | `/api/auth/me` | Token | Current user |
| GET | `/api/concepts` | — | List published concepts (paginated) |
| GET | `/api/concepts/search?q=` | — | Ranked search (gloss, phonetic, Pashto headword and grammatical forms) |
| GET | `/api/concepts/wotd` | — | Word of the Day (deterministic, date-seeded) |
| GET | `/api/concepts/wanted?region=&q=` | — | Published concepts with no variant (any status) in the region; paginated, `meta.total` reflects the filters |
| GET | `/api/concepts/:id` | — | Concept + its published variants, each with `audio` (published clips by slot, signed URL and speaker), `audioOpen` (slots under review) and `audioSlots` (recordable slots with text and time limit) |
| POST | `/api/concepts` | Token | Submit new concept (optional `extra` values for custom fields) |
| POST | `/api/variants` | Token | Submit variant for a concept (optional `extra` values for custom fields; optional `forms` allowed by the concept's part of speech) |
| PATCH | `/api/variants/:id` | Token (submitter) | Edit and resubmit a rejected variant (rejected → pending), including `extra` and `forms`. `409` if the word was added meanwhile |
| GET | `/api/variants/my-submissions?needs=completion&missing=&region=` | Token | My variants with `missingFields`, `fillableFields` and `latestSuggestion`; `meta.needsCompletionCount` |
| POST | `/api/variants/:id/suggestions` | Token (submitter) | Propose values for blank fields of my published variant `{ phonetic?, example?, forms?, extra? }` — fill-only, one open per variant, rate-limited |
| PATCH | `/api/suggestions/:id` | Token (submitter) | Edit and resubmit a rejected suggestion (rejected → pending) |
| PATCH | `/api/suggestions/:id/edit` | Moderator+ | Staff edit of a suggestion (note required, still fill-only). Moderators: pending and not their own; admins: pending or approved |
| PATCH | `/api/suggestions/:id/status` | Moderator+ | Approve / reject / publish. Publish (admin) merges into the live word after re-checking fill-only; rejecting an approved suggestion is admin-only |
| POST | `/api/variants/:id/audio?slot=` | Token | Upload a pronunciation clip for a published word. Raw body (`audio/webm`, `audio/mp4`, `audio/ogg`, `audio/mpeg`), max 1 MB; `slot` is `headword`, `example` or `form:<slot>`. The server reads the real duration (limit per slot) and format from the bytes. `409` if a clip for that slot is already under review; rate-limited |
| DELETE | `/api/audio/:id` | Token (speaker) | Withdraw my pending clip (its file is deleted) |
| GET | `/api/audio/mine` | Token | My clips with status, note, word and a signed URL while pending/approved/published (paginated) |
| PATCH | `/api/audio/:id/status` | Moderator+ | Approve / reject (note) / publish (admin). Publishing a replacement retires the old clip; rejecting an approved or published clip is admin-only; moderators cannot review their own |
| GET | `/api/moderation/audio?status=` | Moderator+ | Clips under review with the word, the slot text and limit, signed URLs, and the current live clip for side-by-side review (admins may pass `status=approved`) |
| GET | `/api/moderation/concepts/queue` | Moderator+ | Pending concepts |
| GET | `/api/moderation/variants/queue` | Moderator+ | Pending variants |
| GET | `/api/moderation/queue?status=` | Moderator+ | Queue grouped by concept, with each concept's waiting variants nested (admins may pass `status=approved`) |
| GET | `/api/moderation/suggestions?status=&concept=` | Moderator+ | Suggestions with their live word and submitter (admins may pass `status=approved`; `concept=` lists open suggestions on one concept) |
| PATCH | `/api/concepts/:id/status` | Moderator+ | Approve / reject / publish. Rejecting an approved or published concept is admin-only. Rejecting a concept also rejects its pending, approved and published variants, each with a note naming the concept |
| PATCH | `/api/variants/:id/status` | Moderator+ | Approve / reject / publish. Approve needs an approved or published concept; publish needs a published concept; rejecting an approved or published variant is admin-only. Rejecting a variant also rejects its open suggestion |
| PATCH | `/api/concepts/:id/edit` | Moderator+ | Staff edit in place (note required). Published concepts are admin-only |
| PATCH | `/api/variants/:id/edit` | Moderator+ | Staff edit in place (note required), including `forms` (replaces the list). Published variants are admin-only. Fields an open suggestion proposes are locked (`409`). An edit that changes text with recordings returns `409` (`field: confirmAudioRetire`, `retiring: [...]`) until resent with `confirmAudioRetire: true` — same for concept edits that change the part of speech, merges and resubmits |
| GET | `/api/moderation/log` | Admin | Audit log (filter by `action`, `targetModel`, including `VariantSuggestion`, `AudioClip`, `suggestion_applied`, `audio_published`, `retired`, `withdrawn`) |
| GET | `/api/lookups?type=` | — | Region and part-of-speech list values, including inactive ones (`active: false`) |
| POST | `/api/lookups` | Admin | Add a list value `{ type, label }` — the key is the label at creation and never changes |
| PATCH | `/api/lookups/:id` | Admin | Rename the label and/or change the order. `key`, `type`, `isSystem`, `active` are rejected |
| PUT | `/api/lookups/order` | Admin | Reorder a whole list `{ type, ids }` |
| PATCH | `/api/lookups/:id/deactivate` | Admin | Hide an admin-added value from forms (built-in values cannot be deactivated) |
| PATCH | `/api/lookups/:id/reactivate` | Admin | Make a deactivated value selectable again |
| GET | `/api/fields?appliesTo=` | — | Active custom field definitions (each with all its options and their `active` flags) |
| GET | `/api/fields/all` | Admin | Every definition, including inactive ones |
| POST | `/api/fields` | Admin | Define a field `{ appliesTo, type, label, required?, options? }` — the key is generated by the server |
| PATCH | `/api/fields/:id` | Admin | Rename, toggle required, or change order. `key`, `appliesTo`, `type`, `active` are rejected |
| PUT | `/api/fields/order` | Admin | Reorder all fields for one entry type `{ appliesTo, ids }` |
| PATCH | `/api/fields/:id/deactivate` · `/reactivate` | Admin | Hide or restore a field (stored values are kept) |
| POST | `/api/fields/:id/options` | Admin | Add a dropdown option `{ label }` |
| PATCH | `/api/fields/:id/options/:optionId` | Admin | Rename an option |
| PATCH | `/api/fields/:id/options/:optionId/deactivate` · `/reactivate` | Admin | Hide or restore an option (a dropdown keeps at least one active option) |

---

## Local Setup

```bash
# Clone and install
git clone https://github.com/Zain-Bangash/pashto-dictionary.git
cd pashto-dictionary

# Server
cd server && npm install
cp .env.example .env   # fill in MONGODB_URI and the COGNITO_* values
npm run dev            # ts-node src/index.ts on :5000 (inserts any missing built-in list values on start)
npm run seed:lookups -- --dry-run   # optional: report which built-in list values are missing

# Client (separate terminal)
cd client && npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev            # Vite on :5173
```

---

## Environment Variables

```
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.oq0rk.mongodb.net/pashto
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-southeast-1
NODE_ENV=development
FRONTEND_ORIGIN=http://localhost:5173   # comma-separated; CORS + refresh/logout origin check
COOKIE_SAMESITE=strict                  # production only: strict | lax | none
STORAGE_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com   # pronunciation clips (any S3-compatible bucket)
STORAGE_REGION=auto
STORAGE_BUCKET=pashto-dictionary-audio-dev
STORAGE_ACCESS_KEY_ID=xxxxxxxx
STORAGE_SECRET_ACCESS_KEY=xxxxxxxx

# client/.env
VITE_API_URL=http://localhost:5000
```

---

## CI/CD

Every pull request to `main` triggers the test suite (server + client). Every merge to `main` runs `sam build && sam deploy` to update the Lambda backend. The Amplify frontend deploys on every push to the connected branch.

To run tests locally:
```bash
cd server && npm test       # 325 Jest tests (TypeScript, MongoMemoryServer)
cd client && npm test       # 206 Vitest + RTL tests
cd e2e && npx playwright test  # Playwright E2E
```

---

## What I'd Do Differently

- **Start with TypeScript** — migrating an existing JS codebase to TypeScript is straightforward but tedious. Starting typed from day one costs nothing and saves refactor time later.
- **Design the data model earlier** — the shift from a flat Entry model to Concept/Variant was the right call, but it required rewriting routes, controllers, and a significant portion of the tests. Having that two-collection design from the start would have been cleaner.
- **Infrastructure-as-code from the start** — the Lambda and API Gateway were first set up manually through the AWS Console and only moved to a SAM template in Phase 14. Starting with SAM would have avoided the Console-only state entirely.
