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

Pashto is not uniform. Even within a single dialect, the same concept can have completely different words depending on which valley the speaker is from. "Sun" is *lmar* in Kohat, *nmar* in Tirah, and *merastarga* in Hangu. These are not synonyms — they are regionally distinct words that share a meaning.

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

---

## Duplicate Detection

When a user submits a new variant, the backend checks whether that exact Pashto word already exists as a variant anywhere in the system before inserting:

```js
const existing = await Variant.findOne({ pashto: req.body.pashto });
if (existing) return res.status(409).json({ ... });
```

For concept creation, the submit form calls a `GET /api/concepts/suggest?q=` endpoint as the user types their English gloss, returning up to five similar existing concepts. This nudges users to attach their variant to an existing concept rather than fragmenting the data with near-duplicate concepts.

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

## Stack Summary

| Layer | Technology | Notable choice |
|---|---|---|
| Frontend | React 18 + Vite + Tailwind CSS v4 | No component library |
| Backend | Node.js + Express | `express-async-errors` for clean async error handling |
| Database | MongoDB via Mongoose | Two-collection Concept/Variant model |
| Auth | JWT (jsonwebtoken + bcryptjs) | Role-based: user / moderator / admin |
| Validation | express-validator | All mutation endpoints validated before DB access |
| Testing | Vitest (client) + Jest + MongoMemoryServer (server) | In-memory DB for server integration tests |
