# Prompts

Copy-paste prompts for working on this project with Claude Code. Section 2 has reusable templates by change type; section 3 has ready-filled prompts for each item in [To-Do.md](../To-Do.md).

---

## 1. Getting good output without burning tokens

| Situation | Use | Why |
|---|---|---|
| Small or medium change (most items) | **Plain prompt in the main session** | `CLAUDE.md` is already loaded. Naming the exact files means Claude doesn't have to search for them. This is the cheapest option. |
| Big feature (new model + endpoints + page) | **Plan first, then the `tester` → `coder` agents** | Each agent starts with no context, so you pay for that twice. Worth it only when strict test-first work matters. |
| E2E-only work | **`e2e-tester` agent** | It already knows the Playwright setup and auth helpers. |

Habits that save the most tokens:
- **One task per session.** Run `/clear` between unrelated items so earlier context isn't re-sent.
- **Name the files.** Every prompt below lists what to read; that replaces broad searching.
- **Plan before big changes.** Ask for a plan, approve it, then let Claude build. Fixing a wrong plan costs far less than fixing wrong code.
- **Run only the tests you need while working.** For example, `npx jest moderation` or `npx vitest run Submit`. Run the full suite once at the end.
- **Use a cheaper model for mechanical work** such as renames, docs or Tailwind tweaks (`/model sonnet`). Switch back for design or debugging.

---

## 2. Templates

Fill in the `[brackets]`. Every template makes Claude write tests and update docs as part of the change.

### Frontend change

```
Frontend change: [what and why].

Read only: [page/component files], docs/DESIGN-SYSTEM.md[, docs/USER-FLOWS.md if behaviour changes].
Scope: [files allowed to change]. Do not touch the server.

Requirements:
- Follow DESIGN-SYSTEM tokens and Pashto RTL rules; Tailwind only, no new CSS files.
- API calls only through src/services/api.js; loading + error states on anything that fetches.
- If a component goes over ~150 lines, tell me and propose a split. Don't split it unprompted.

Tests: add or update Vitest + RTL tests in client/src/__tests__/ for the new behaviour. Run only the affected test files, then `cd client && npm test` once at the end.
Docs: update docs/USER-FLOWS.md if user-visible behaviour changed, and docs/DESIGN-SYSTEM.md if you added a pattern or token.
Finish with: files changed, test results, and a suggested commit message (style/feat(client): …). Don't commit.
```

### Backend change

```
Backend change: [what and why].

Read only: [route, controller, model files], and docs/ARCHITECTURE.md › [section] if the change touches moderation, search, or duplicates.
Scope: server/ only.

Requirements:
- express-validator on every new or changed mutation input; response envelope on every response; paginate any list.
- Auth and role checks as route middleware (requireRole), not inside controllers.
- Actor fields are Cognito-sub Strings; use enrichActors for usernames.
- Any status change writes a ModerationLog entry.

Tests: add Jest tests in server/src/__tests__/ covering the happy path, validation failures, and role boundaries. Run `npx jest [file]` while working, then `npx tsc --noEmit` and `npm test` at the end.
Docs: update the README API table if endpoints changed, and docs/ARCHITECTURE.md if a design decision changed.
Finish with: files changed, test results, and a suggested commit message. Don't commit.
```

### Database / model change

```
Database change: [what and why].

Read only: server/src/models/[Model].ts, server/src/types/models.ts, and every controller that queries this model (grep for it first and list them before editing).
First, report:
- which existing documents are affected, and whether a migration or backfill script is needed
- index impact (new, dropped, or unique-constraint risk on existing data)
Then wait for my go-ahead.

After approval:
- Update the schema and interface. Keep actor fields as String.
- If a backfill is needed, write it as an idempotent script in server/scripts/ with a dry-run flag. Don't run it against the real DB.
Tests: extend server/src/__tests__/models.test.ts and any affected controller tests; `npm test` must pass.
Docs: update docs/ARCHITECTURE.md (data model / indexes) and CLAUDE.md if a convention changed.
```

### Full-stack feature

```
Full-stack feature: [what and why].

Step 1 — plan only. Read CLAUDE.md conventions, docs/USER-FLOWS.md, and the files you expect to change. Give me:
- endpoints (method, path, auth, request/response shape)
- model changes, if any
- pages/components and the route
- the user-flow sentences you'll add to docs/USER-FLOWS.md
- the test list (server Jest, client RTL, optional E2E)
Stop and wait for approval.

Step 2 — build backend first (tests green, `tsc --noEmit` clean), then frontend (tests green).
Step 3 — update docs/USER-FLOWS.md, the README API table, and To-Do.md (tick the item).
Finish with: a summary, test results, and suggested commits split by layer (feat(server) / feat(client) / docs). Don't commit.
```

### Docs-only change

```
Docs change: [what].
Check every claim against the code before writing it. CLAUDE.md is rules only; ARCHITECTURE is the why; BuildHistory is history; USER-FLOWS is behaviour; DESIGN-SYSTEM is visuals. Put each fact in exactly one place and link from the others.
Show me a diff summary. Don't commit.
```

---

## 3. Backlog prompts

### Frontend

**F1 — Pashto font: Noto Naskh Arabic**
```
Switch the Pashto display font from Noto Nastaliq Urdu to Noto Naskh Arabic.

Files: client/src/index.css (Google Fonts import line 1, --font-pashto on line 8, the .font-pashto line-height rule ~line 97, and the font-family ~line 178), client/index.html (fonts link line 10).
- Swap the font in both imports and both declarations. Drop Nastaliq from the imports entirely.
- Naskh has shorter descenders than Nastaliq, so the 1.7 line-height override exists only to stop Nastaliq clipping. Propose a new value, and check Home, ConceptDetail and DashboardQueue render without clipping.
- Keep the `font-pashto` token name so no component needs to change.
Tests: run `cd client && npm test`; nothing should break.
Docs: update docs/DESIGN-SYSTEM.md › Typography (font name, and the line-height rule if it changed).
Suggested commit: style(client): switch Pashto font to Noto Naskh Arabic
```

**F2 — About page**
```
Add an About page at /about.

Before writing anything, ask me for the content: project motivation, my background, how words are sourced and verified, and how to contribute. Use README.md › Overview / Motivation as a starting draft to show me.
Files: client/src/App.jsx (route), client/src/components/Navbar.jsx (link), new client/src/pages/About.jsx.
Follow the docs/DESIGN-SYSTEM.md "Applying to a New Page" checklist. Static content, no API call.
Tests: RTL test that the route renders and the navbar link navigates.
Docs: add a Guest line to docs/USER-FLOWS.md.
```

**F3 — Extract AmbientBackground**
```
Move the AmbientBackground component out of client/src/pages/Home.jsx into client/src/components/AmbientBackground.jsx. Pure move, no visual change.
Then check which pages render their own copy or none at all. List them, and ask before adding it to pages that don't have it.
Tests: existing Home tests must pass; add a small render test for the new component.
Docs: update docs/DESIGN-SYSTEM.md › Ambient Background to point to the new location.
Suggested commit: refactor(client): extract AmbientBackground component
```

**F4 — Split oversized components** (one file per session)
```
Use the refactor agent: split client/src/pages/dashboard/DashboardQueue.jsx (710 lines) into focused components under client/src/components/dashboard/. No behaviour or visual change.
Propose the split (component names, props, what moves where) and wait for approval before editing.
Existing DashboardQueue tests must pass unchanged. Only add tests for logic that becomes independently testable.
```
Then repeat for `Home.jsx`, `Submit.jsx`, `MySubmissions.jsx`.

### Backend

**B1 — Fuzzy search**
```
Improve concept search so misspellings and transliteration variants still match (e.g. "lmr" → "lmar", "luv" → "love").

Read: server/src/controllers/conceptController.ts (search handler around the escapeRegex usage), docs/ARCHITECTURE.md › Search.
Plan first. Compare these options for our scale (low thousands of docs, Atlas M0, Lambda):
 (a) Atlas Search fuzzy. Check whether it's available on M0 and what it needs in template.yaml or the Atlas config.
 (b) In-app scoring: regex prefilter, then Levenshtein/trigram re-rank in memory.
 (c) Precomputed phonetic keys stored on Variant.
Recommend one and stop for approval.
After approval: keep the existing exact > prefix > contains ranking above fuzzy matches. Keep the response shape and pagination unchanged.
Tests: extend the search tests with typo cases, and add a regression test that exact matches still rank first.
Docs: rewrite docs/ARCHITECTURE.md › Search with the new approach and why.
```

**B2 — Type the Lambda handler**
```
In server/src/lambda.ts, replace `event: any, context: any` with proper types (aws-lambda types for an API Gateway v2 / HTTP API event). Add @types/aws-lambda as a devDependency if needed.
No behaviour change. `npx tsc --noEmit` and `npm test` must pass.
Suggested commit: refactor(server): type Lambda handler
```

### Database

**D1 — Index audit**
```
Audit MongoDB indexes against real queries. Report only; don't change anything yet.

Read: server/src/models/Concept.ts, Variant.ts, User.ts, ModerationLog.ts, and grep every .find/.findOne/.countDocuments/.aggregate in server/src/controllers.
For each index: which query uses it, or "unused". For each frequent query: which index serves it, or "collection scan".
Known suspects: Variant { phonetic: 1 } (search uses case-insensitive unanchored regex, which can't use it); Variant { pashto: 'text' } (check variantController search ~line 334); ModerationLog has no index on timestamp/action/targetModel but the audit log sorts and filters on them.
Give me a table and a recommended change list. Then wait for approval.
```

**D2 — Backup / export script**
```
Atlas M0 has no automated backups. Add server/scripts/export.ts that writes every collection (Concept, Variant, User, ModerationLog) to timestamped JSON files in a git-ignored backups/ folder.
- Reads MONGODB_URI from server/.env. Read-only queries only.
- Add an `npm run export` script.
- Add backups/ to .gitignore.
Plan first: also tell me whether a restore script is worth adding, and the simplest way to run the export on a schedule (e.g. a GitHub Actions cron that uploads an artifact) and what it would cost.
Docs: add a "Backups" section to README › Local Setup.
```

### Full stack

**S1 — Community page: top contributors**
```
Full-stack feature: a public /community page showing top contributors.

Plan first (use the full-stack template in docs/PROMPTS.md). Answer:
- Ranking metric: published variants per user? Also concepts? All-time and/or this month?
- Endpoint: extend GET /api/stats or add GET /api/stats/contributors (paginated, public).
- Aggregate on submittedBy (a Cognito-sub String), then resolve usernames with enrichActors. Exclude soft-deleted docs.
- What to show per user: username, region, village, count, maybe their latest word.
- Privacy: should users be able to opt out? Ask me.
Then build backend → frontend → docs/USER-FLOWS.md (Guest section) → README API table.
```

**S2 — Region filter on browse**
```
Full-stack: add a region filter (Kohat, Hangu, Tirah, Thal, Parachinar) to the Concepts browse page.
Backend: GET /api/concepts accepts ?region=. It returns concepts that have at least one published, non-deleted variant in that region. Validate against the region enum. Pagination meta must reflect the filtered total.
Frontend: filter pills on client/src/pages/Concepts.jsx using the DESIGN-SYSTEM filter-pill pattern (mint = active). Keep the selection in the URL query string so it's shareable.
Tests: server (filter + validation + meta.total), client (pill toggles, URL sync).
Docs: docs/USER-FLOWS.md Guest section, README API table.
```

**S3 — Admin trash / restore**
```
Full-stack: admins can view and restore soft-deleted concepts and variants.

Plan first. Decide with me:
- Endpoints: GET /api/moderation/trash (admin, paginated, both models) and PATCH /api/{concepts|variants}/:id/restore (admin).
- Restoring writes ModerationLog action 'restored'. That's a new enum value, so update the model, the interface, and the audit-log badge colours.
- Restored status: keep the pre-delete status, or force 'pending'?
- Restoring a variant whose concept is still deleted → 400 with a clear message.
- Restoring a variant that now collides with the unique index → 409.
UI: /dashboard/trash (admin-only nav item).
Tests: server (role boundaries, log written, collision, orphan rule), client (list + restore action).
Docs: docs/USER-FLOWS.md Admin section, docs/ARCHITECTURE.md › Soft Deletes (the recovery path is now real).
```

### Tests & docs

**T1 — E2E coverage gaps**
```
Use the e2e-tester agent: compare every sentence in docs/USER-FLOWS.md against e2e/tests/*.spec.js. Output a table of flow → spec/test name, or "not covered". Don't write tests yet; I'll pick which gaps to fill.
```

**T2 — Fix agent drift**
```
The client does not use @aws-amplify/auth. It calls /api/auth/* via axios and stores the access token in sessionStorage (see client/src/services/api.js and client/src/context/AuthContext.jsx).
Fix every claim otherwise in .claude/agents/e2e-tester.md, coder.md, and refactor.md. In e2e-tester.md, check e2e/helpers/ and e2e/global-setup.js to describe how auth actually works for tests.
Also remove VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_CLIENT_ID from client/.env.example after confirming nothing in client/ reads them.
Suggested commit: docs(agents): correct client auth model
```

**T3 — Refresh README test counts**
```
Run `cd server && npm test` and `cd client && npm test`. Update the counts in README.md › CI/CD with the real numbers. If anything fails, stop and report instead.
```

### Cloud / Infrastructure

**O1 — Gitflow / branch strategy**
```
Help me adopt a branch strategy. Plan first, and keep it right-sized for a solo developer.
Current state: work on dev, merge to main; ci.yml runs on push to dev and PRs to main; deploy.yml runs on push to main.
Propose: branch naming (feature/*, fix/*), what merges where, whether to keep dev, the ci.yml trigger changes, and GitHub branch-protection settings for main (I'll apply those in the GitHub UI myself).
After approval: update .github/workflows/ci.yml and the Commit Convention rules in CLAUDE.md. Add a short "Contributing" section to README.
```

**O2 — Multi-region with Route 53** (design only)
```
Write a short design note for making the app multi-region. No code or infrastructure changes.
Cover: what actually goes multi-region (Amplify is already on CloudFront; Lambda + HTTP API per region via SAM; Atlas M0 is single-region, so what's the DB story?), Route 53 latency/failover routing, Cognito being regional, and the monthly cost compared with the current $0. Include an honest "is this worth it at our scale" verdict.
Save it as a new section at the end of docs/BuildHistory.md titled "Proposed: Multi-region".
```
