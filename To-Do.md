# To-Do

## Active — no active phase

---

## Completed
- Phase 14: SAM Infrastructure as Code ✓
  - `template.yaml` + `samconfig.toml` committed
  - `deploy.yml` uses `sam build && sam deploy`
  - CloudFormation stack `pashto-dictionary` owns Lambda + HTTP API
  - GitHub Secrets wired for env var injection on every deploy

> Full spec in `MigrationPlan.md` — Phase 14

---

## Backlog

### Cloud / Infrastructure
- Multi-region with Route 53 (future)

### App
- Show which user added a word on the concept/variant detail view
- Improve search — fuzzy matching
- Community page: top contributing users
- About page

### CV notes
- Add AI section to CV: agents, LLM, code reviews, Claude Code skills
- Add data section to CV
- Emphasise React on CV
- GitHub Actions badge in README

---

## Completed
- Phase 1–10: Core app (models, auth, entries, moderation, frontend, design, polish)
- Phase 11: TypeScript migration (server)
- Phase 12: AWS deployment — Amplify frontend, Lambda + API Gateway backend, GitHub Actions CI/CD
- Phase 13: AWS Cognito migration — replaced bcrypt/JWT with Cognito; `aws-jwt-verify` middleware; `@aws-amplify/auth` on the client; 330/330 tests passing
