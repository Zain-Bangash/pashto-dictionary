# To-Do

Ready-to-paste prompts for each item are in [docs/PROMPTS.md](docs/PROMPTS.md) — IDs in brackets.

## Active

_No active phase._

---

## Backlog

### Frontend
- [ ] Use Noto Naskh Arabic to display Pashto instead of Noto Nastaliq Urdu `[F1]`
- [ ] About page `[F2]`
- [ ] Extract `AmbientBackground` from `Home.jsx` into `components/` _(suggested)_ `[F3]`
- [ ] Split oversized components — `DashboardQueue.jsx` (710 lines), `Home.jsx` (454), `Submit.jsx` (368), `MySubmissions.jsx` (347) _(suggested)_ `[F4]`

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

Full history: [docs/BuildHistory.md](docs/BuildHistory.md)
