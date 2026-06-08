# To-Do

## Active — Phase 13: AWS Cognito Migration

Follow the TDD cycle: spawn tester agent first, then coder agent.

- [ ] Create Cognito User Pool (email + password sign-in, custom `role` attribute)
- [ ] Replace `authController.ts` register/login with Cognito SDK calls
- [ ] Rewrite `auth.ts` middleware to verify Cognito tokens via `aws-jwt-verify`
- [ ] Remove `User.passwordHash`; add `User.cognitoSub`
- [ ] Replace frontend `AuthContext` axios calls with `@aws-amplify/auth` SDK
- [ ] Rewrite auth tests to mock Cognito; update E2E global setup for Cognito tokens

> Full spec in `MigrationPlan.md` — Phase 13

---

## Backlog

### Phase 14 — SAM Infrastructure as Code (after Phase 13)
- [ ] Write `template.yaml` — Lambda + HTTP API + IAM role
- [ ] Run `sam deploy --guided` locally → generates `samconfig.toml`
- [ ] Update `deploy.yml` to use `sam build && sam deploy`
- [ ] Remove `LAMBDA_FUNCTION_NAME` GitHub secret
- [ ] Expand IAM user permissions (cloudformation, s3, iam:PassRole)

> Full spec in `MigrationPlan.md` — Phase 14

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
