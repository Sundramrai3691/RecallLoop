# RecallLoop

RecallLoop is an adaptive **active-recall** system. You study a topic, the app extracts concepts, then it immediately forces retrieval. Answers are scored with a **knowledge-point rubric**, not an arbitrary 1–10 AI grade. A **deterministic scheduler** (not FSRS yet) sets the next review. The dashboard shows what is due.

The product optimizes for **demonstrated retrieval**, not time spent studying. Learners can now create an identity, define goals and skills, generate a deterministic daily plan, and inspect the learner signals that shape remediation.

## Setup

Requires Node.js 20+ and MongoDB.

```bash
cp .env.example .env
docker compose up -d
npm install
npm run dev
```

- UI: http://localhost:5173
- API: http://localhost:3001/api/health

## Environment variables

See `.env.example`:

| Variable        | Purpose                      |
| --------------- | ---------------------------- |
| `MONGODB_URI`   | MongoDB connection string    |
| `PORT`          | API port (default `3001`)    |
| `CLIENT_ORIGIN` | CORS origin for the Vite app |
| `LLM_PROVIDER`  | `mock` (default) or `openai` |
| `LLM_API_KEY`   | Empty → mock mode            |
| `LLM_MODEL`     | Chat model id                |
| `LLM_BASE_URL`  | OpenAI-compatible base URL   |

## Run commands

```bash
npm run dev          # API + Vite together
npm run test         # server unit + integration tests
npm run build        # compile server and client
```

## Architecture summary

React (Vite) talks only to the Express REST API. Controllers stay thin. Domain logic lives in `server/src/services/`. MongoDB stores sessions, concepts, recall attempts, and isolated `ReviewState` documents. The LLM is used only for concept extraction, question wording (via templates in mock mode), and rubric evaluation. Scheduling is a separate module and never calls the LLM.

Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## MVP flow

1. `/study/new` — topic + optional notes
2. Concepts extracted and stored
3. Mark session complete
4. Immediate **explain** recall per concept
5. Submit answer + confidence
6. Rubric evaluation stored
7. Mastery updated; next review scheduled
8. `/dashboard` shows due / upcoming / mastery

## Mock LLM mode

If `LLM_API_KEY` is empty or `LLM_PROVIDER=mock`, concept extraction splits notes deterministically, and evaluation uses token overlap against required knowledge points. The full study → recall → schedule loop works without a vendor account.

## Tests

```bash
npm test
```

## Goal-aware foundation

Register or sign in at `/register` or `/login`, then use `/goals` to create a learning goal. Generate a plan from a goal to combine learning and recall work, and open `/learner` to inspect deterministic mastery and weakness summaries. The API uses JWT bearer tokens for these new user-scoped routes.

Covers session completion, concept creation, immediate recall, rubric JSON parsing, scheduler intervals, and duplicate-submit rejection.

## Docs

- [docs/PROJECT_AUDIT.md](docs/PROJECT_AUDIT.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/IMPLEMENTATION_REPORT.md](docs/IMPLEMENTATION_REPORT.md)
