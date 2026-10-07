# Pashto Dialect Revival Dictionary

![CI](https://github.com/Zain-Bangash/pashto-dictionary/actions/workflows/ci.yml/badge.svg)

## Overview

A community-driven dictionary platform for preserving Pashto regional dialects. Users submit entries, moderators review them, admins publish them. The system is designed around data integrity — every submission goes through an explicit moderation state machine, and every decision is logged to an audit trail.

The project combines full-stack software engineering with real linguistic work: words are sourced from native speakers and elders, cross-referenced against linguistic research, and verified before publication.

---

## Motivation

My local dialect of Pashto is gradually declining as native vocabulary is replaced by foreign loanwords. A key factor is the absence of an accessible, structured, community-driven digital dictionary. This project is an attempt to solve that with software.

---

## Project Evolution

- **Initial version:** Spring Boot backend, basic CRUD
- **Second iteration:** MERN stack rebuild
- **Current version:** Full redesign with AI-assisted workflows, TypeScript backend, AWS deployment, and a production-grade moderation system

---

## Architecture

```
Browser
  │
  ├── React app ──────────────► AWS Amplify Hosting
  │                              (auto-deploys on push to main)
  └── API calls ──────────────► AWS API Gateway
                                      │
                                      ▼
                               AWS Lambda (Node.js 22)
                               Express + serverless-http
                                      │
                                      ├── MongoDB Atlas M0
                                      └── AWS Cognito (auth)
```

Backend infrastructure is declared in `template.yaml` (AWS SAM) and owned by the CloudFormation stack `pashto-dictionary`.

**Further reading**
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — why: the Concept/Variant data model, ranked search, normalisation and duplicate detection, the moderation state machine
- [docs/BuildHistory.md](docs/BuildHistory.md) — how: the original phase-by-phase plan and what actually happened
- [docs/USER-FLOWS.md](docs/USER-FLOWS.md) — what each role can do
- [docs/DESIGN-SYSTEM.md](docs/DESIGN-SYSTEM.md) — the visual language

---

## Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, Tailwind CSS v4 |
| Backend | Node.js 22, Express, TypeScript |
| Database | MongoDB Atlas via Mongoose |
| Auth | AWS Cognito (server-side SDK + `aws-jwt-verify`); roles stored in MongoDB |
| Hosting | AWS Amplify (frontend) · AWS Lambda + API Gateway, managed by AWS SAM (backend) |
| CI/CD | GitHub Actions — test gate on PRs, auto-deploy on merge to `main` |
| Testing | Vitest + RTL (client) · Jest + MongoMemoryServer (server) · Playwright (E2E) |

---

## Data Model

```
Concept  — the meaning anchor (English gloss, part of speech, moderation status)
    └── Variant(s) — the regional word (Pashto script, phonetic, region, definition)
```

Each Concept and each Variant has its own independent moderation lifecycle. A single bad variant does not block other valid regional forms of the same concept.

---

## Moderation Workflow

```
submitted → pending    (automatic on POST)
pending   → approved   (moderator or admin)
pending   → rejected   (moderator or admin, note required)
approved  → published  (admin only)
rejected  → pending    (user edits and resubmits)
```

Every transition on Concept or Variant writes a record to `ModerationLog` with the actor, action, timestamp, and optional note. Invalid transitions return 400. Moderators cannot approve their own submissions.

---

## API Reference

All responses use the envelope `{ success, data, meta }` or `{ success, error }`. All list endpoints are paginated.

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/health` | — | Health check |
| POST | `/api/auth/register` | — | Register user |
| POST | `/api/auth/login` | — | Login, returns Cognito access token |
| GET | `/api/auth/me` | Token | Current user |
| GET | `/api/concepts` | — | List published concepts (paginated) |
| GET | `/api/concepts/search?q=` | — | Ranked search (gloss + phonetic) |
| GET | `/api/concepts/wotd` | — | Word of the Day (deterministic, date-seeded) |
| GET | `/api/concepts/:id` | — | Concept + its published variants |
| POST | `/api/concepts` | Token | Submit new concept |
| POST | `/api/variants` | Token | Submit variant for a concept |
| GET | `/api/moderation/concepts/queue` | Moderator+ | Pending concepts |
| GET | `/api/moderation/variants/queue` | Moderator+ | Pending variants |
| PATCH | `/api/concepts/:id/status` | Moderator+ | Approve / reject / publish |
| PATCH | `/api/variants/:id/status` | Moderator+ | Approve / reject / publish |
| GET | `/api/moderation/log` | Admin | Audit log |

---

## Local Setup

```bash
# Clone and install
git clone https://github.com/Zain-Bangash/pashto-dictionary.git
cd pashto-dictionary

# Server
cd server && npm install
cp .env.example .env   # fill in MONGODB_URI and the COGNITO_* values
npm run dev            # ts-node src/index.ts on :5000

# Client (separate terminal)
cd client && npm install
cp .env.example .env   # VITE_API_URL=http://localhost:5000
npm run dev            # Vite on :5173
```

---

## Environment Variables

```
# server/.env
PORT=5000
MONGODB_URI=mongodb+srv://<user>:<password>@cluster0.oq0rk.mongodb.net/pashto
COGNITO_USER_POOL_ID=ap-southeast-1_xxxxxxx
COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxx
COGNITO_CLIENT_SECRET=xxxxxxxxxxxxxxxxxxxx
AWS_REGION=ap-southeast-1
NODE_ENV=development

# client/.env
VITE_API_URL=http://localhost:5000
```

---

## CI/CD

Every pull request to `main` triggers the test suite (server + client). Every merge to `main` runs `sam build && sam deploy` to update the Lambda backend. The Amplify frontend deploys on every push to the connected branch.

To run tests locally:
```bash
cd server && npm test       # 325 Jest tests (TypeScript, MongoMemoryServer)
cd client && npm test       # 206 Vitest + RTL tests
cd e2e && npx playwright test  # Playwright E2E
```

---

## What I'd Do Differently

- **Start with TypeScript** — migrating an existing JS codebase to TypeScript is straightforward but tedious. Starting typed from day one costs nothing and saves refactor time later.
- **Design the data model earlier** — the shift from a flat Entry model to Concept/Variant was the right call, but it required rewriting routes, controllers, and a significant portion of the tests. Having that two-collection design from the start would have been cleaner.
- **Infrastructure-as-code from the start** — the Lambda and API Gateway were first set up manually through the AWS Console and only moved to a SAM template in Phase 14. Starting with SAM would have avoided the Console-only state entirely.
