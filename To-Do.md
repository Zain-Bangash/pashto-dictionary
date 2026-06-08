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

### Cloud / Infrastructure
- SAM template (`template.yaml`) — describe Lambda + API Gateway as infrastructure-as-code (good CV signal, mentioned in MigrationPlan.md)
- Multi-region with Route 53 (future)
- Update Lambda runtime to `nodejs22.x` in AWS Console (currently `nodejs20.x` — upgrade for consistency with CI)

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
