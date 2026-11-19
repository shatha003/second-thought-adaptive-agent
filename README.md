# Second Thought

**An agent that notices when reality changed, and safely changes its mind, with a receipt for every revision.**

Most agents either never notice that the world moved under their plan, or re-plan on a timer and break things that were fine. Second Thought tracks what each step of its plan *depends on*, and revises only when a signal contradicts one of those assumptions. Every revision passes a safety gate and leaves a plain-language trace: *"I changed my mind because hotel-feed (95%) contradicted 'Hotel Alfama still has our room'."*

- **Live demo:** LIVE_URL
- **Architecture:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Failure test (adaptation goes wrong, and is contained):** [docs/FAILURE-TEST.md](docs/FAILURE-TEST.md)
- **Two-year thesis:** [docs/THESIS.md](docs/THESIS.md)
- **AI tools, key decisions, out of scope:** [docs/NOTES.md](docs/NOTES.md)

## What to look at in the demo

Open the app and press **Run**. Two agents work the same simulated world, which changes on a schedule they cannot see.

| Scenario | What happens | Baseline (no monitoring) | Adaptive (guarded) |
|---|---|---|---|
| **Travel logistics**: get a keynote speaker to Lisbon | Flight cancelled, then the hotel overbooks | All 6 steps green, **mission failed** (silent failure) | Re-plans twice, mission achieved, €720 of €1,200 |
| **Supply chain**: 500 units by Friday | Supplier stock drops, port strike, a customs delay | 0 of 500 units delivered, silent failure | Tops up from a second supplier, re-routes via Antwerp, absorbs the customs delay |
| **Failure containment** | A rumour, a flapping feed, then a real failure | Unguarded agent **breaches the budget** (€1,790 of €1,200) | Guarded agent verifies, refuses the contract-breaking fix, escalates to a human |

Use **Inject an event** to push your own change into the world mid-run. It is queued in persisted state and consumed on the next tick, like any other event source. When the guarded agent escalates, you get an **Approve** button, and overriding the gate is logged.

## How it works (one paragraph)

`Mission → plan steps → the assumptions each step depends on → the signals that could falsify them.` A signal only matters if it touches a live assumption (so "rain in Lisbon" is ignored). Weak contradictions are held until corroborated or verified against an authoritative source. When an assumption is violated, the agent picks the cheapest sufficient response (ignore, verify, patch, re-plan, escalate), dry-runs the candidate plan, and adopts it only if it passes five gates. Details in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

There is **no timer-based re-prompting**. The loop runs on a simulated clock, and a revision happens only when a signal contradicts an assumption.

## Run it locally

Requires Node 22 or later.

```bash
git clone https://github.com/shatha003/second-thought-adaptive-agent.git
cd second-thought-adaptive-agent
npm install
npm run dev          # http://localhost:3000
```

No database or API keys are needed: without `DATABASE_URL` it uses an in-memory store, and the planner defaults to the deterministic mode.

Other commands:

```bash
npm test                      # 24 tests covering the engine, scenarios and store
npm run typecheck && npm run lint
npm run simulate lisbon       # headless run, prints the decisions (also: fulfilment, phantom; add -v for every tick)
npm run build && npm start
```

## Configuration (all optional)

| Variable | Purpose |
|---|---|
| `DATABASE_URL` (or `POSTGRES_URL`) | Neon Postgres connection string. Tables are created on first use. Needed in production so runs survive across serverless instances |
| `AI_GATEWAY_API_KEY` (or Vercel OIDC) | Enables the optional language-model planner, which ranks the same grounded options. Falls back to deterministic on any error |
| `AI_MODEL` | Gateway model id for the LLM planner (default `anthropic/claude-sonnet-4.5`) |

See `.env.example`. `GET /api/health` reports which store and planner are active.

## API

| Route | Purpose |
|---|---|
| `POST /api/runs` | Create a run `{ scenarioId, planner }` |
| `GET /api/runs/:id` | Current state and full event log |
| `GET /api/runs/:id/stream?ms=800` | Server-Sent Events driver. Opening resumes from persisted state; closing pauses |
| `POST /api/runs/:id/inject` | Queue an event `{ presetId }` |
| `POST /api/runs/:id/approve` | Human approval of an escalated option `{ lane }` |
| `GET /api/health` | Store and planner status |

## Repo layout

```
app/                Next.js App Router: UI page and API routes
components/         Mission-control UI (plan, assumptions, journal, reality, event log)
lib/domain/         Types
lib/engine/         beliefs, plan evaluation, safety gate, trace, the loop
lib/planner/        deterministic ranking, optional LLM ranking
lib/scenarios/      the three scenarios (data, not code paths)
lib/store/          Neon + in-memory persistence
scripts/simulate.ts headless runner
tests/              vitest suite
docs/               architecture, failure test, thesis, notes, original plan
```

## Stack

Next.js 16 (App Router), TypeScript, Tailwind 4, Motion, Neon Postgres, Vercel AI SDK 7, zod, vitest. Deployed on Vercel.
