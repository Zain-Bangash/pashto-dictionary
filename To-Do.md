# To-Do

Ready-to-paste prompts for each item are in [docs/PROMPTS.md](docs/PROMPTS.md) — IDs in brackets.

## Active

_No active phase._

---
## Rough Thoughts
1. ~~Change the smoothness of admin dashboard~~ — done: moderation queue grouped by concept with variant dropdowns (see Completed)
  

2. Add more things to a variant such as plural ete and other vital stuff
3. make example sentence like 'pashto word' and add a pashto text for REGION, Definiton, Phonetic, in the variant 
4. see if database is 3nf (admin can edit part of speech and region) (can admin edit the whole variant section to add or remove things from it)
5. Have an an alert tab for admin to see what a variant is missing, admin can either edit those words or make them highlighted in a tab for customers (have a 'attention' tab for customer,) (what should mod's job here be?)
6. admin should be promote users to mod or demote mods
7. mod should only be able to set am edit request  user's published concept or variant to the admin with a note ofc (admin press tick and edit is finalized), similarly make the merge as a request as well

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

### Cloud / Infrastructure
- [ ] Gitflow / branch strategy `[O1]`
- [ ] Multi-region with Route 53 (future — design first) `[O2]`

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

Full history: [docs/BuildHistory.md](docs/BuildHistory.md)
