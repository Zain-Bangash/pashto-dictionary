# Engineering Journey — Pashto Dialect Revival Dictionary

This document traces the key engineering decisions made during the development of this project, including the reasoning behind them, the problems they solved, and the tradeoffs that were considered. It is intended to give a sense of how the system evolved, not just what it looks like today.

For the phase-by-phase plan, setup steps and AWS/IAM configuration, see [BuildHistory.md](BuildHistory.md).

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

`Concept.partOfSpeech`, `Variant.region` and `User.region` store a **key** from the `Lookup` collection, not a free string and not a schema enum. See [Admin-editable lists](#admin-editable-lists).

Both Concept and Variant also carry an optional `extra` map of admin-defined field values (`{ plural: 'لمرونه', register: 'Formal' }`). See [Admin-defined custom fields](#admin-defined-custom-fields).

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
approved  → rejected   (admin only, note required)
published → rejected   (admin only, note required)
rejected  → pending    (user edits and resubmits)
```

Every transition on either a Concept or a Variant writes a record to `ModerationLog` with the target model, target ID, action, performer, and optional note. This creates a full audit trail that the admin dashboard exposes.

`published → rejected` lets an admin take down a live entry so its submitter can fix and resubmit it; it then goes through normal review again. `approved → rejected` lets an admin turn back an item a moderator approved instead of being forced to publish it. A moderator attempting either gets a 403; moderators never see approved items anyway.

Rejecting a concept (from any status) also rejects its live pending, approved and published variants: each is set to `rejected`, soft-deleted, and given the note `Concept "<gloss>" was rejected: <note>`, so its submitter sees the reason in My Submissions and can resubmit.

Invalid transitions (e.g. `published → pending`) are rejected with a 400 — the state machine is enforced at the controller level, not left to the client to honour.

A variant's transitions are also gated on its parent concept: approving a variant requires the concept to be `approved` or `published`, and publishing a variant requires the concept to be `published`. Both return a 400 otherwise. The moderation queue (`GET /api/moderation/queue`) reflects this by grouping waiting variants under their concept, so the concept is always reviewed first.

### Governance: Moderator Self-Approval Restriction

A moderator who is also an active contributor faces an inherent conflict of interest: they could submit an entry and then immediately approve it themselves, bypassing independent review entirely. To prevent this, the system enforces a submitter-separation rule at the controller level before any transition is applied.

If the acting user's role is `moderator` and their ID matches the `submittedBy` field on the target document, the request is rejected with a 403:

```ts
if (
  req.user!.role === 'moderator' &&
  (status === 'approved' || status === 'rejected') &&
  concept.submittedBy === req.user!.id
) {
  res.status(403).json({ success: false, error: { message: 'Moderators cannot approve or reject their own submissions' } });
}
```

Actor fields hold the Cognito `sub` as a plain string, so a direct `===` comparison is all that's needed.

Admins are exempt from this restriction. The rationale is that admins operate at a higher trust level and are accountable for overall system integrity in a way that moderators are not. This rule was chosen over more complex alternatives (e.g. blocking anyone who touched the document at any prior stage) because it is simple to reason about, auditable in the ModerationLog, and covers the primary conflict-of-interest case without introducing ambiguous edge cases.

The same self-separation rule extends to moderator edits (see *Moderator and Admin Edits* below). Moderators cannot edit their own submissions; admins can. The asymmetry is intentional for the same reason: admin is the final authority and must be able to correct their own mistakes without escalating to another admin.

---

## Moderator and Admin Edits

### Two separate edit paths

The system has two distinct mechanisms for changing a submission's content, and it is important that they remain separate:

**User resubmission** (`PATCH /api/variants/:id`) — available only when the variant's status is `rejected`. The submitter corrects their own entry and it re-enters the `pending` state. This is a user action and is logged as `resubmitted`.

**Moderator/admin edit** (`PATCH /api/concepts/:id/edit`, `PATCH /api/variants/:id/edit`) — available at any status, except that only admins may edit a `published` entry (moderators get a 403). A staff member corrects an entry in place without changing its moderation status. This is logged as `edited` with a full before/after diff.

Keeping these as two different routes with different semantics prevents ambiguity about who changed what and why. A `resubmitted` log entry always means the original submitter took action; an `edited` entry always means staff did.

### ModerationLog `changes` field

The `ModerationLog` schema includes an optional `changes` field (`Schema.Types.Mixed`) that stores a before/after diff for `edited` actions and a summary for `merged` actions:

```js
// edited
changes: { pashto: { from: 'old', to: 'new' }, region: { from: 'Kohat', to: 'Tirah' } }

// merged
changes: { mergedInto: '<targetId>', variantsMoved: ['<id1>'], variantsSkipped: ['<id2>'] }
```

```js
// lookup_changed (targetModel: 'Lookup')
changes: { op: 'updated', type: 'region', key: 'Kohat', label: { from: 'Kohat', to: 'Kohat District' } }
changes: { op: 'reordered', type: 'region', from: ['Kohat', 'Hangu'], to: ['Hangu', 'Kohat'] }   // no targetId

// field_changed (targetModel: 'FieldDefinition')
changes: { op: 'option_added', appliesTo: 'variant', key: 'register', option: { key: 'Poetic', label: 'Poetic' } }

// edited — custom field values appear alongside core fields
changes: { definition: { from: 'a', to: 'b' }, 'extra.plural': { from: 'لمرونه', to: '' } }

// edited — grammatical forms, one key per changed slot; null means the form was added or removed
changes: { 'forms.masculine.plural.direct': { from: null, to: { pashto: 'لمرونه', phonetic: 'lmaruna' } } }
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
deletedBy  String    (Cognito sub)
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
| `Variant.forms[].normalizedPashto` | `forms[].pashto` | `.trim().normalize('NFC')` (search only, never part of the duplicate check) |

The NFC normalization on `normalizedPashto` deserves specific attention. Arabic-script keyboards — particularly on Android and iOS — can produce different Unicode byte sequences for the same visual character. One keyboard may output a precomposed code point; another may output a base character with a combining diacritical mark. Both render identically on screen but are not equal as strings. Without NFC normalization, two users submitting the same Pashto word from different phones would both pass the duplicate check. `.normalize('NFC')` collapses all representations to their canonical composed form, making the comparison encoding-independent. It requires no external library — it is a native JavaScript method.

All duplicate checks use the normalized fields, not the raw input fields.

### Database-level constraints

To address the race condition, MongoDB unique indexes enforce the identity rules at the database layer:

- `Concept`: unique index on `normalizedGloss`
- `Variant`: compound unique index on `{ concept, normalizedPashto, region }`

These constraints mean that even if two concurrent requests both pass the application-level pre-check, the database will reject the second insert with an `E11000 duplicate key` error (MongoDB error code 11000). The server catches this error and returns a 409 Conflict rather than letting it surface as a 500. The result is race-condition safety that is guaranteed by the storage layer, not by the timing of application-level queries.

Both unique indexes are **partial on `isDeleted: false`**, and a rejected variant is soft-deleted at rejection. So a rejected variant does not hold its key: someone else can create the same word for the same concept and region, which is intended, because the rejected one may never come back. The clash surfaces when the rejected one is resubmitted, since resubmitting sets `isDeleted` back to `false`. The resubmit path therefore always re-runs the duplicate check (not only when the word or region changed) and also catches E11000, returning a 409 that explains someone may have added the word meanwhile. Staff edits catch E11000 the same way. No mutation path lets the index error surface as a 500.

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

Search now runs three parallel regex queries:

```js
const [glossMatches, phoneticVariants, pashtoVariants] = await Promise.all([
  Concept.find({ englishGloss: regex, status: 'published' }, '_id englishGloss').lean(),
  Variant.find({ phonetic: regex, status: 'published' }, 'concept phonetic').lean(),
  Variant.find({ $or: [{ normalizedPashto: pashtoRegex }, { 'forms.normalizedPashto': pashtoRegex }], status: 'published' }, ...).lean(),
]);
```

The Pashto query is NFC-normalized the same way as stored text, so it matches the headword and every grammatical form (searching لمرونه finds *sun* through its plural). The results are unified by concept ID into a score map, where each concept gets the highest of its scores:

| Condition | Score |
|---|---|
| Exact match (case-insensitive) | 3 |
| Starts with query | 2 |
| Contains query anywhere | 1 |

Searching "love" returns "Love / Affection" (score 3) before "Lovely" (score 2) before "Beloved" (score 1). Searching "mee" returns concepts whose variants have phonetics like "meena" — something the text index approach could never do.

A match on a grammatical form scores half a tier below the same match on the headword (2.5 / 1.5 / 0.5). Exact still beats prefix, and prefix still beats contains, while within a tier the headword ranks above a form. The older `GET /api/variants/search` endpoint (MongoDB `$text` on the headword, unused by the client) is unchanged: a collection can have only one text index, and changing it would need a manual index drop in Atlas.

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

## Admin-editable lists

Regions and parts of speech used to be hardcoded in about a dozen places: Mongoose enums, route validators, and client dropdowns. Adding a region meant a code change and a redeploy. They now live in one `Lookup` collection that admins edit from **Dashboard → Lists**.

```
Lookup { type: 'region' | 'partOfSpeech', key, label, order, active, isSystem }
```

### Why key and label are separate

`key` is what Concept, Variant and User store, and it is **immutable**: the schema marks it `immutable` and `PATCH /api/lookups/:id` rejects a `key` in the body with a 400. `label` is what people see, and admins can edit it freely. Because entries only hold the key, renaming "Kohat" to "Kohat District" updates every existing entry with no data rewrite and no migration. A new row's key is its label as typed at creation (trimmed, NFC). This matches the original keys and works for Pashto script, where a slug would come out empty.

The five original regions and six parts of speech are `isSystem: true` rows whose keys equal the strings already stored. Existing data therefore needed no migration.

### Why deactivate, not delete

Deleting a value would orphan every entry that uses it, and a dictionary of dialect history should never silently lose that. So there is no delete endpoint. An admin-added value can be **deactivated**: it disappears from every form, but entries that already use it keep their key and still display its label. System values cannot be deactivated at all. Each list is capped at 100 values, which keeps the public read bounded.

### Where validation lives

The schema enum is gone. `utils/lookups.ts` holds the single rule, `isAllowedLookup(type, value, currentValue)`:

- **Create** routes (`POST /concepts`, `POST /variants`, `POST /auth/register`) use the `activeLookup()` validator, so only active keys are accepted.
- **Edit** paths (resubmit, staff edit, profile update) load the document first. Keeping the stored value passes even if it is now inactive, so an old entry is still editable. Newly choosing an inactive or unknown key returns a 400 with `field`.

The check is deliberately not a schema validator. That would need a database read on every save, and it would block approve, publish, merge and cascade-reject on any entry whose value had since been deactivated.

### Seeding

`ensureSystemLookups()` inserts any missing system rows using `$setOnInsert`, so it never overwrites an edited label or order. It runs on server start (`index.ts`) and on Lambda cold start (`lambda.ts`); without the rows, every submission would fail validation. `npm run seed:lookups -- --dry-run` reports what it would insert. In Jest, a `setupFilesAfterEnv` hook re-runs it before every test, because test files wipe collections between tests.

### Client

`LookupsProvider` fetches `GET /api/lookups` once at the app root. That endpoint is public and returns inactive rows too, flagged `active: false`, so old entries can still show their label. `useLookups()` exposes `active(type)` for forms and `labelFor(type, key)` for display; `labelFor` falls back to the raw key. Every dropdown uses `LookupSelect`. It lists active values plus the entry's current value marked "(retired)" if that value is inactive. The Home card abbreviations (N., V., and so on) still use a fixed map for the six built-in parts of speech and show the full label for admin-added ones.

---

## Admin-defined custom fields

Admins can add extra fields to Concepts and Variants (for example a plural form, a register dropdown, or usage notes) from **Dashboard → Fields**, with no code change or redeploy.

```
FieldDefinition { appliesTo: 'concept' | 'variant', key, label, type: 'text' | 'textarea' | 'select',
                  options[{ key, label, active }], required, order, active }
Concept.extra / Variant.extra : Map<key, string>
```

Core fields (`englishGloss`, `partOfSpeech`, `pashto`, `phonetic`, `region`, `definition`, `example`) stay real schema fields. Custom fields can never replace or remove them, because search, duplicate detection and the moderation rules all depend on them.

### Why an `extra` map

Values live in one `extra` map per entry instead of new top-level schema paths. The schema stays fixed however many fields admins define, and a field's values can never collide with a core field name.

It is a Mongoose `Map` of `String`, not `Mixed`, for three reasons:

- All three field types store strings, so Mongoose checks and converts the type itself.
- Changes are tracked automatically; `Mixed` needs `markModified` on every write.
- Map keys may not contain `.` or start with `$`, which blocks database-operator injection at the schema layer.

That last rule is also why field keys are **generated by the server**: an ASCII slug of the label (`Plural form` → `plural_form`), with a `field` fallback for Pashto-only labels and `_2`, `_3` added for duplicates. The admin never types a key. Keys, `appliesTo` and `type` are immutable, because changing a type would invalidate stored values. Select **option** keys follow the S4a rule (key = label at creation), because they are stored as values, not as map keys.

### Validation

`utils/extraFields.ts` has one entry point, `validateExtra(appliesTo, input, mode, current)`, used by create, user resubmit, moderator edit and admin edit:

- Keys with no definition are rejected.
- Values must be strings: `text` up to 200 characters, `textarea` up to 2,000 (line breaks kept), other control characters stripped.
- A select value must be an active option key.
- A value equal to the stored one always passes, even if its field or option has since been deactivated (the same rule as S4a lookups). A new value for a deactivated field or option is rejected.
- `required` is enforced in `create` mode only. Existing entries, resubmits and staff edits never fail because a field became required later.
- Each entry type allows at most 20 definitions, and each select at most 50 options.

Edits **merge**: only keys that are sent and actually change are written, and an empty string clears a value. The changes go into the `edited` log entry as `extra.<key>` diffs.

### Why deactivate, not delete

Deleting a definition would destroy every value entered for it. A deactivated field disappears from the forms, the entry pages and the moderation queue, but its values stay in `extra` and come back if the field is reactivated. Options work the same way. A select must keep at least one active option, otherwise nobody could fill it in.

### Why custom values are not searchable

Values show on the concept detail page and in the moderation queue, but they are not part of search or duplicate detection. Making them searchable would mean a second search path and new indexes, and would mix admin-defined data into the ranked search, all for fields nobody has needed to search yet. An opt-in `searchable` flag can be added later without migrating any data.

### Client

`FieldsProvider` loads the active definitions once (`GET /api/fields`, which includes every option with its `active` flag). `ExtraFieldsInputs` renders the inputs on Submit, the moderation edit forms and the My Submissions resubmit forms; a stored retired option shows as "(retired)". `ExtraFieldsDisplay` renders values as plain text on ConceptDetail and in the queue rows. The admin page loads every definition, including inactive ones, from `GET /api/fields/all`.

---

## Variant grammatical forms

A variant can carry grammatical forms: nouns and adjectives get gender × number × case (8 slots), verbs get infinitive, past, present and imperative. Each form has its own Pashto text plus an optional phonetic and example sentence.

```
Variant.forms: [{ kind: 'noun' | 'verb', gender?, number?, case?, verbForm?, pashto, normalizedPashto, phonetic?, example? }]
```

### Why embedded subdocuments

Forms belong to exactly one variant and are reviewed with it as one unit, so they are an embedded array (`_id: false`), not a collection. A typed subschema, rather than `Mixed`, gives enum casting and automatic change tracking, and the server rejects unknown keys before they reach it. A form's slot (`masculine.plural.direct` or `past`) is unique within a variant, so it is the form's identity and no `_id` is needed. Audio can be added later as one more optional field on the subschema.

### Why fixed enums, not Lookups

Gender, number, case and verb form are grammar, not community-editable content. Validation, display labels, log diff keys and search ranking all depend on the exact set, so the values are fixed in code (`server/src/utils/variantForms.ts`, mirrored in `client/src/utils/forms.js`). Which kind of forms a concept allows is a code map keyed by the part-of-speech **Lookup key**, not its label: `noun` and `adjective` → noun forms, `verb` → verb forms, anything else (including admin-added parts of speech) → none. Perfective/imperfective verb forms are a later addition to the enum.

### Why the headword stays

Top-level `pashto`, `phonetic` and `example` remain the headword. Duplicate detection, the unique index, cross-concept warnings, the concept page grouping and every existing variant depend on them. Forms are additive and optional, so old variants need no backfill.

### Validation

`validateForms(input, partOfSpeech, current)` runs on create, user resubmit and staff edit, after the express-validator chains in `formsValidators`:

- At most 16 forms (nouns use up to 8 today, leaving room for later verb forms). Pashto is required and at most 100 characters; phonetic at most 100; example at most 500. Control characters are stripped and text is NFC-normalized.
- A noun form needs gender, number and case and no verb form; a verb form the reverse. Unknown keys, including a client-supplied `normalizedPashto`, are rejected.
- No slot may appear twice.
- The kind must match the concept's part of speech. A staff edit that reassigns the variant is checked against the target concept.
- A form identical to a stored one always passes — the same "unchanged stays valid" rule as S4a/S4b. A concept's part of speech can change, and a variant can be reassigned or merged, without destroying its forms; the edit form labels mismatched forms so staff can remove them.

When `forms` is sent it replaces the whole array (`[]` clears it); when it is omitted nothing changes. Forms are stored in canonical slot order. Staff edits log one `forms.<slot>` diff per changed form. The moderation state machine is unchanged.

### Client

`FormsEditor` (with `FormRow`) renders on Submit Step 2, the My Submissions resubmit form and the moderation edit form. Rows are added one free slot at a time, and each slot select offers only unused slots. `FormsDisplay` is a collapsed "Forms (n)" list on ConceptDetail (per selected region) and in queue rows, rendered as plain text with Pashto in `dir="rtl" font-pashto`.

---

## Filling gaps: Wanted Words, completion and suggestions

Three linked features help contributors fill holes in the dictionary without weakening review.

### Wanted Words

`GET /api/concepts/wanted?region=` lists published concepts with **no variant in that region**. Any variant hides the gap, whatever its status: pending, approved and published ones are live, and rejected ones are matched by status because rejection soft-deletes them. An abandoned rejection therefore keeps hiding its gap until its owner resubmits it or an admin deletes it. Admin-deleted variants (not rejected) do not hide it.

It runs as two queries rather than an aggregation: `Variant.distinct('concept', { region, … })`, then `Concept.find({ status: 'published', _id: { $nin: ids } })` with skip/limit and a count on the same filter. The `{ region: 1, concept: 1 }` index covers the distinct. At the dataset sizes this project expects, a `$nin` list is cheap and both queries are trivially testable; if it grows into tens of thousands of concepts this is the single place to switch to a `$lookup`.

### Blank fields — one definition

`server/src/utils/blankFields.ts` defines "blank" once, as aggregation stages that add three fields to a variant:

- `missingFields` — gaps, published variants only: `phonetic`, `example`, `forms` when the word has **no** forms and its part of speech allows them, and `extra.<key>` for active, **optional** variant fields. `pashto` and `definition` are required and never blank.
- `fillableFields` — the gaps plus `forms` when some, but not all, form slots are filled.
- `formsFilled` / `formsTotal` — for the "Forms 2/8" hint.

Only `missingFields` drives the **Needs completion** count, so the chip stays a short to-do list; a noun with two of eight forms is offered "Add details" quietly rather than flagged. The same stages back the My Submissions filters (`?needs=completion&missing=&region=`) and `getCompletion(id)`. The client never computes blankness itself; it renders what the server returns.

### Suggestions — a separate record

A user may propose values for the blank fields of their **own published** variant. The live word stays published and unchanged until an admin publishes the suggestion. Unpublished variants keep the existing Edit & Resubmit workflow.

```
VariantSuggestion { variant, proposed: { phonetic?, example?, forms?[], extra?: Map }, status,
                    submittedBy, reviewedBy, moderatorNote, timestamps }
```

**Why a separate collection.** Editing the variant in place would either unpublish it during review or put unreviewed text on the public page. An embedded "pending changes" block on the variant would mix two lifecycles in one document, complicate every read of a variant, and make "one open suggestion" an application rule instead of an index. A separate record keeps the variant's state machine untouched, gives the suggestion its own audit trail, and makes the live word's content provably unchanged until publish.

**State machine** (mirrors the variant's, with no `published → …`):

```
pending  → approved   (moderator or admin; not on your own suggestion)
pending  → rejected   (moderator or admin, note required)
approved → published  (admin only — merges into the live word)
approved → rejected   (admin only, note required)
rejected → pending    (owner edits and resubmits)
```

**One open suggestion per variant** is a partial unique index on `{ variant: 1 }` where `status ∈ { pending, approved }` (MongoDB 6.0+), with a pre-check for a clean 409.

**Fill-only, checked four times.** `validateProposal()` (in `utils/suggestions.ts`) runs on submit, resubmit, staff edit and approve, and again at publish. Every proposed value must go into a field that is blank on the live word *now*; otherwise the request fails with 400 and the field named (`phonetic`, `forms.masculine.plural.direct`, `extra.register`). Forms are fill-only **per slot**, so a suggestion can add the empty slots of a partly filled word. Forms are re-validated against the concept's current part of speech, and extra values with `validateExtra`. Core fields (`pashto`, `definition`, `region`, …) are rejected by the route validators.

**Preventing conflicts instead of resolving them.** While a suggestion is open, a staff edit to the word cannot change the fields it proposes (409 naming the field); other fields stay editable. The admin's published-word panel shows a "Suggestion pending" badge, disables those inputs and hides the proposed form slots. Staff fix a suggestion *inside* the review instead (`PATCH /api/suggestions/:id/edit`, note required, logged as `edited` with a diff). The remaining ways a publish can fail — a split-second race, the concept's part of speech changing, a custom field being deactivated — refuse the publish with the field named. The suggestion stays approved, and the admin edits or rejects it.

**Publish merge.** There are no transactions in this codebase (and Jest runs a standalone MongoDB), so publish uses conditional writes:

1. Claim: `findOneAndUpdate({ _id, status: 'approved' }, { status: 'published' })`; a double-click or a second admin gets a 400.
2. Re-check fill-only against the freshly read word.
3. Write with `Variant.updateOne({ _id, updatedAt: <read value> }, { $set })`, setting `normalizedPhonetic` and each form's `normalizedPashto` itself because `updateOne` skips the pre-save hook. Forms are merged with the existing ones and stored in canonical order.
4. If the word changed between read and write, retry once; on any failure, put the suggestion back to `approved`.

**Cascade.** When a word leaves the published state — rejected (directly or through its concept) or deleted — its open suggestions are rejected with a note naming the cause, and each gets a log entry.

**Audit log.** Suggestion transitions log under `targetModel: 'VariantSuggestion'` with the usual actions. Publishing also writes `suggestion_applied` on the **Variant**, with an `edited`-style diff and the suggestion id, so the word's own history shows when and how its content changed.

Create and resubmit share a rate limiter (30 requests per 15 minutes) built the same way as the auth limiter.

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

The `authMiddleware` (`server/src/middleware/auth.ts`) now uses `aws-jwt-verify`'s `CognitoJwtVerifier` instead of `jwt.verify()`. On the first request the verifier fetches the User Pool's JWKS endpoint; subsequent verifications use the cached public keys. The token's `sub` claim becomes `req.user.id`; the role is resolved by looking up the MongoDB `User` document by `cognitoSub` — Cognito Access Tokens do not carry custom user attributes, so reading `custom:role` from the token is not possible.

The `User` model dropped `passwordHash` and added `cognitoSub: { type: String, unique: true, sparse: true }`. The `sparse: true` allows multiple documents with no `cognitoSub` value on the unique index, which was needed during migration.

### Frontend

`AuthContext.jsx` calls the backend endpoints directly via axios — `POST /api/auth/register` and `POST /api/auth/login`. The backend performs all Cognito SDK calls and returns a Cognito access token in the response. The access token is held in memory only and attached as a `Bearer` header by the axios interceptor on every subsequent request; sessions survive reloads and new tabs through an httpOnly refresh cookie (see *Persistent sessions* below). No `@aws-amplify/auth` is used on the client; the Cognito surface is entirely server-side.

### Role model

Roles (`user`, `moderator`, `admin`) are stored in MongoDB `User.role`. The middleware resolves the role by looking up the User document via `cognitoSub` on every authenticated request. A `custom:role` attribute exists on Cognito user records for reference, but it cannot be read from Access Tokens (only from ID tokens), so MongoDB is the authoritative source for role decisions.

### Test strategy

Server tests mock both `aws-jwt-verify` (the JWKS verifier) and `@aws-sdk/client-cognito-identity-provider` (the SDK client). The mock for `aws-jwt-verify` returns a controlled `{ sub }` payload. Because role is resolved from MongoDB (not the token), each test's `makeToken` helper is async — it seeds a `User` document with the given `cognitoSub` and `role` before signing the JWT, ensuring the middleware's MongoDB lookup finds the correct role.

### Persistent sessions (refresh cookie)

The access token used to live in `sessionStorage`, which is per tab: a new tab started logged out, and the session ended when the token expired. Sessions now last up to 30 days and are shared by every tab.

**How it works**

- Login and register store Cognito's refresh token in an httpOnly cookie `pd_rt`. A second httpOnly cookie, `pd_ru`, holds the access token's `username` claim (see SECRET_HASH below). The refresh token never appears in a response body.
- `POST /api/auth/refresh` reads the cookies, calls `InitiateAuth` with `REFRESH_TOKEN_AUTH`, and returns `{ token, user }`, the same shape as login. If the cookie is missing, invalid, expired or revoked, or the user has no MongoDB profile, it returns 401 and clears both cookies.
- `POST /api/auth/logout` calls Cognito `RevokeToken` and clears the cookies. It always returns 200. A failed revoke is logged by error name only; tokens are never logged.
- The client keeps the access token in a module variable in `services/authSession.js`. On page load `AuthContext` calls refresh, and `initializing` stays true until it settles, so protected routes never flash a redirect.
- On a 401 from any non-auth route, the interceptor refreshes once and retries. Concurrent 401s share one in-flight refresh. The session ends (redirect to `/login`) only if refresh itself returns 401/403. A network error or 5xx keeps the user logged in.
- Logout is synced across tabs with `BroadcastChannel('pd-auth')` (`services/sessionSync.js`).

**Why an httpOnly cookie for the refresh token, and memory for the access token.** A 30-day credential must not be readable by JavaScript: an XSS bug could otherwise steal it and use it from anywhere for a month. The access token is short-lived (1 hour), so keeping it in memory limits what XSS can take to a token that soon expires. It also removes token persistence from web storage entirely. XSS running on the page can still call refresh while the user is on the site; that is a limit of every browser-session design, not something this one adds.

**SECRET_HASH.** The app client has a secret, so `REFRESH_TOKEN_AUTH` needs a SECRET_HASH computed from the Cognito *username*. The refresh response does not return it, and on a fresh tab there is no old access token to decode it from, so it is kept in `pd_ru`. The value is the access token's `username` claim (equal to the `sub` in this pool, which signs in by email). Tampering with it only produces a hash mismatch, which Cognito rejects.

**Cookie attributes** (`utils/sessionCookies.ts`): `HttpOnly`, `Path=/api/auth` (only sent to the auth endpoints), `Max-Age` 30 days, host-only. In production it is `Secure`, and `SameSite` comes from `COOKIE_SAMESITE`: `strict` by default, or `none` + `Partitioned`. In development it is always `Lax` and not Secure, because `localhost:5173` → `localhost:5000` is cross-origin but same-site (ports don't count) and runs over plain http.

**Cross-site trade-off.** Amplify (`*.amplifyapp.com`) and API Gateway (`*.execute-api.*.amazonaws.com`) are different sites, so a cookie set by the API is a third-party cookie.

- The template currently deploys `CookieSameSite=none` with `Partitioned` (CHIPS). This works in Chrome, Edge and Firefox, including when third-party cookies are blocked, because the cookie is partitioned under the Amplify top-level site.
- Safari's ITP blocks third-party cookies, so Safari users lose the session on reload or in a new tab. They do not lose it within a tab.
- The fix is to make the API same-origin: add an Amplify rewrite proxying `/api/<*>` to the API Gateway URL, point `VITE_API_URL` at the Amplify origin, and set `CookieSameSite=strict`. A custom domain (`app.` + `api.` under one registrable domain) achieves the same at the cost of a domain. No code change is needed for either.

**CSRF.** Refresh and logout authenticate by cookie, so `middleware/sessionGuard.ts` requires `X-Requested-With: XMLHttpRequest` and rejects any `Origin` not in `FRONTEND_ORIGIN` with a 403.

- HTML forms cannot set custom headers. A cross-origin request that sets one must pass a CORS preflight, which only allows the listed origins.
- A forged refresh could not read the response anyway. The guard mainly stops forced logouts. With `SameSite=Strict` it is defence in depth.

**CORS.** `app.ts` and the HTTP API `CorsConfiguration` both allow exactly the `FRONTEND_ORIGIN` list, with credentials. Once API Gateway has a CORS config it answers preflights itself and ignores the integration's CORS headers, so the template is authoritative in production and `app.ts` covers local dev. Axios sends `withCredentials` only on the four `/api/auth/*` session calls.

**Known limits**

- Cognito refresh tokens expire 30 days after login, not after last use. Sliding expiry would need Cognito refresh-token rotation, which uses `GetTokensFromRefreshToken` instead of `InitiateAuth`. Refresh already re-sets the cookie if Cognito ever returns a new refresh token.
- `RevokeToken` stops further refreshes, but access tokens already issued stay valid until they expire (at most 1 hour), because `aws-jwt-verify` checks them locally.
- Refresh and logout use their own limiter, `sessionLimiter` (100 per 15 minutes), because refresh runs on every page load in every tab.

---

## SAM Infrastructure as Code (Phase 14)

Phase 12 deployed Lambda code via `aws lambda update-function-code` — a direct API call that updated only the function's code bundle. The Lambda function itself, the API Gateway, the IAM execution role, and all environment variables existed only in the AWS Console. Phase 14 replaced this with AWS SAM.

### What SAM owns

All backend infrastructure is now declared in `template.yaml` at the project root and owned by a CloudFormation stack named `pashto-dictionary`:

- `AWS::Serverless::HttpApi` — HTTP API (API Gateway v2) with a catch-all `/{proxy+}` route
- `AWS::Serverless::Function` — Lambda function with the esbuild-bundled TypeScript source
- `AWS::IAM::Role` — Lambda execution role (created automatically by SAM with `CAPABILITY_IAM`)

### Build and deploy

SAM uses esbuild to bundle TypeScript directly from `server/src/lambda.ts` — no separate `tsc` step is needed. `esbuild` is listed in `dependencies` (not `devDependencies`) because SAM's npm install step runs `--omit=dev`.

The deploy pipeline (`deploy.yml`) is:
```
sam build → sam deploy --no-confirm-changeset --no-fail-on-empty-changeset
```

Environment variables (`MONGODB_URI`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`) are passed as CloudFormation parameters sourced from GitHub Secrets — never stored in the template.

### Lambda execution role — Cognito permissions

SAM creates the Lambda execution role automatically but only grants it basic Lambda permissions (CloudWatch Logs). The register and login handlers call Cognito admin APIs (`AdminConfirmSignUp`, `AdminDeleteUser`) which require explicit IAM grants on the execution role. These are declared in the `Policies` block of the `PashtoBackend` resource in `template.yaml`, scoped to the specific User Pool ARN via `!Sub`. Without this, registration returns a 403 from Cognito at the `AdminConfirmSignUp` step.

The full deploy-user IAM policy and the other SAM gotchas are recorded in [BuildHistory.md › Phase 14](BuildHistory.md#phase-14--sam-infrastructure-as-code).

### Why `--no-fail-on-empty-changeset`

Pushes that change only documentation or client code still trigger the deploy workflow. Without this flag, SAM exits with code 1 when there is nothing to update on the Lambda side, which would mark the Actions run as failed. The flag makes "nothing changed" a clean success.

---

## Post-Phase-14 Polish

### Username resolution — `enrichActors` utility

Actor fields (`submittedBy`, `reviewedBy`, `performedBy`, `deletedBy`) are stored as plain strings (the Cognito `sub` UUID). This is correct — storing them as `ObjectId` references would require passing `new mongoose.Types.ObjectId(req.user.id)` for a UUID string, which the schema intentionally avoids.

The consequence is that Mongoose's `.populate()` silently no-ops on String fields. Endpoints that called `.populate('submittedBy', 'username')` were returning the raw UUID string with no user data attached, making every "by username" display blank.

The fix is `server/src/utils/enrichActors.ts` — a batch lookup utility:

```ts
// After fetching docs, collect unique cognitoSubs and resolve them in one query
const users = await User.find({ cognitoSub: { $in: subs } }, projection).lean();
const byId  = Object.fromEntries(users.map(u => [u.cognitoSub, u]));
return docs.map(d => ({ ...d, [field]: byId[d[field]] ?? d[field] }));
```

This is called after the main query in any endpoint that needs to surface user details:
- `moderationController.ts` — `getConceptQueue`, `getVariantQueue`, `getLog`
- `conceptController.ts` — `getConcept` (concept + variants on the public detail page)

Usernames now appear in: the admin moderation queue, the audit log, public concept detail pages (concept submitter + per-variant submitter that updates when switching region tabs), and the My Submissions page header.

### Audit log improvements

The `GET /api/moderation/log` endpoint was extended with:

- **Target population**: after fetching log entries, concept and variant names are batch-loaded (`englishGloss` for concepts, `pashto + region` for variants) and attached as a `target` field. The frontend renders "CONCEPT · Mountain" or "VARIANT · لمر · Kohat" on each entry.
- **Filtering**: `?action=approved` and `?targetModel=Concept` query params narrow the result set; `meta.total` reflects the filtered count for correct pagination.
- **`changes` field surfaced**: `edited` actions display a field-by-field before/after diff; `merged` actions display how many variants moved and how many were skipped as duplicates.
- **Timestamps**: each entry shows an absolute date/time.
- **Action badge colours**: all 12 action types (`submitted`, `approved`, `rejected`, `published`, `resubmitted`, `deleted`, `edited`, `merged`, `profile_updated`, `lookup_changed`, `field_changed`, `suggestion_applied`) have distinct colours. Suggestion entries are labelled with the word they complete. `lookup_changed` and `field_changed` entries render from their `changes` payload. `extra.<key>` diffs in `edited` entries are shown under the field's label.

---

## Stack Summary

| Layer | Technology | Notable choice |
|---|---|---|
| Frontend | React 19 + Vite + Tailwind CSS v4 | No component library |
| Backend | Node.js 22 + Express + TypeScript (strict) | `express-async-errors` for clean async error handling |
| Database | MongoDB via Mongoose | Two-collection Concept/Variant model; unique indexes enforce data integrity |
| Auth | AWS Cognito + `aws-jwt-verify` (server-side only) | Managed passwords, auto-rotating JWKS, role resolved from MongoDB `User.role`; 30-day refresh token in an httpOnly cookie, access token in memory; no Amplify SDK on client |
| Hosting | AWS Amplify (frontend) · Lambda + API Gateway v2 (backend) | `serverless-http` wraps Express; all resources owned by CloudFormation stack `pashto-dictionary` |
| CI/CD | GitHub Actions + AWS SAM | Test gate on PRs; `sam build && sam deploy` on merge to `main` |
| Validation | express-validator | All mutation endpoints validated before DB access |
| Normalisation | Native JS `.normalize('NFC')` + string methods | No external library; set via Mongoose pre-save hooks |
| Testing | Vitest + RTL (client) · Jest + MongoMemoryServer (server) · Playwright (E2E) | In-memory DB for server integration tests |
