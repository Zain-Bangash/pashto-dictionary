# To-Do

Ready-to-paste prompts for each item are in [docs/PROMPTS.md](docs/PROMPTS.md) — IDs in brackets.

## Active

_No active phase._

---
## Rough Thoughts
1. 'Wanted Words' make it a drop down and show the variant thats present and have a 'Also spoken in Kohat' type button next to each variant (keep the Add your word button)
8. Others can add 'forms' or audio and there name will be displayed (these things are easy to verify)
2. limit mod 'rights' and increase admin rights
3. audio
4. make example sentence like 'pashto word' and add a pashto text for REGION, Definiton, Phonetic, in the variant 
5. admin should be promote users to mod or demote mods
6. Change mod functionality
  - mod can approve or reject with a note
  - anything else discuss with me
7. ~~why can't i open two tabs on differents pages without having to sign in in the other tab again.~~ Done: persistent sessions (see Completed)

## Backlog

### Frontend
- [ ] About page `[F2]`
- [ ] Extract `AmbientBackground` from `Home.jsx` into `components/` _(suggested)_ `[F3]`
- [ ] Split oversized components — `Home.jsx` (454), `Submit.jsx` (368), `MySubmissions.jsx` (347) _(suggested)_ `[F4]`

### Backend
- [ ] Improve search — fuzzy matching `[B1]`
- [ ] Type the Lambda handler (`event: any, context: any` in `lambda.ts`) _(suggested)_ `[B2]`

### Database
- [ ] Index audit — check every index against the queries that actually run _(suggested)_ `[D1]`
- [ ] Backup / export script — Atlas M0 has no automated backups _(suggested)_ `[D2]`

### Full stack
- [ ] Community page: top contributing users `[S1]`
- [ ] Region filter on the Concepts browse page _(suggested)_ `[S2]`
- [ ] Admin trash view — restore soft-deleted concepts/variants _(suggested)_ `[S3]`
- [ ] 
- [ ] Admin 

### Tests & docs
- [ ] E2E coverage gap check against `docs/USER-FLOWS.md` _(suggested)_ `[T1]`
- [ ] Fix agent docs that still claim Amplify on the client (`e2e-tester.md`, `coder.md`, `refactor.md`); remove unused `VITE_COGNITO_*` from `client/.env.example` _(suggested)_ `[T2]`
- [ ] Refresh test counts in README _(suggested)_ `[T3]`
- [ ] Restore `server/src/scripts/seedE2EAdmin.js`: E2E `global-setup.js` runs it but it does not exist, so the suite cannot start _(suggested)_

### Cloud / Infrastructure
- [ ] Gitflow / branch strategy `[O1]`
- [ ] Multi-region with Route 53 (future — design first) `[O2]`
- [ ] Amplify `/api/*` rewrite proxy, then `CookieSameSite=strict`: keeps Safari users logged in across reloads (steps in BuildHistory › Persistent Sessions) _(suggested)_

---

## CV notes
- Add AI section to CV: agents, LLM, code reviews, Claude Code skills
- Add data section to CV
- Emphasise React on CV

---

## Completed

- Phases 1–10: core app — models, auth, entries, moderation, frontend, design, polish
- Phase 11: TypeScript migration (server)
- Phase 12: AWS deployment — Amplify frontend, Lambda + API Gateway backend, GitHub Actions CI/CD
- Phase 13: AWS Cognito migration — server-side Cognito SDK + `aws-jwt-verify`; role resolved from MongoDB
- Phase 14: SAM infrastructure as code — `template.yaml` + `samconfig.toml`, stack `pashto-dictionary`
- Post-14 polish: usernames via `enrichActors` (shown on concept/variant detail, queue, audit log, My Submissions); audit log filters, diffs, timestamps
- GitHub Actions CI badge in README
- Grouped moderation queue: concept rows with waiting-variant dropdowns (`GET /api/moderation/queue`); variant approve now requires an approved/published concept; `DashboardQueue.jsx` split into `components/moderation/`
- Admin-editable preset lists `[S4a]`: `Lookup` collection for region and part of speech (immutable key, editable label, deactivate-not-delete); admin page at `/dashboard/lists`; `lookup_changed` audit action; built-in values seeded on server start
- Admin-defined custom fields `[S4b]`: `FieldDefinition` collection (text / long text / dropdown, server-generated keys, deactivate-not-delete); values in `Concept.extra` / `Variant.extra`; shown on Submit, moderation edit and resubmit forms, ConceptDetail and queue rows; admin page at `/dashboard/fields`; `field_changed` audit action; not searchable by design

- Persistent sessions: 30-day httpOnly refresh cookie, in-memory access token, `POST /api/auth/refresh` + `/logout` (Cognito `RevokeToken`), single-flight refresh-and-retry on 401, cross-tab logout via `BroadcastChannel`

Full history: [docs/BuildHistory.md](docs/BuildHistory.md)
