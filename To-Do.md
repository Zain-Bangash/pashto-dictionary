# To-Do

## Active — Phase 14: SAM Infrastructure as Code

- [x] Write `template.yaml` — Lambda + HTTP API (esbuild bundler)
- [x] Write `samconfig.toml` — stack name, region, resolve_s3
- [x] Update `deploy.yml` to use `sam build && sam deploy`
- [ ] Add GitHub Secrets: `MONGODB_URI`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `COGNITO_CLIENT_SECRET`
- [ ] Expand IAM user permissions — cloudformation:*, s3:*, iam:PassRole, apigateway:*
- [ ] Push to main → first SAM deploy creates CloudFormation stack `pashto-dictionary`
- [ ] Update Amplify `VITE_API_URL` to the new API Gateway URL from CloudFormation outputs
- [ ] Trigger fresh Amplify build to bake in the new URL

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
