# Architecture snapshot

The question this project answers: can an agent recognise that reality changed, and change its mind safely?

The answer is a closed loop that is driven by **signals touching assumptions**, never by a clock.

```
                 hidden reality (truth)                    what the agent can see
 timeline + injected events ──mutate──▶ truth ──emit──▶  signals (source, value, reliability)
                                          ▲                          │
                                          │ authoritative probe      ▼
                                          └──────────────── 1. RECEIVE   corroboration, flap guard
                                                              │
                                                              ▼
                                                           2. RE-EVALUATE  beliefs ▶ assumption ledger
                                                              │            (holding / weakened / violated / stale)
                                                              ▼
                                                           3. TRIAGE       L0 ignore/absorb · L1 verify
                                                              │            L2 patch · L3 re-plan · L4 escalate
                                                              ▼
                                                           4. SAFETY GATE  evidence · contract · dry-run
                                                              │            better-than-staying · revision budget
                                                              ▼
                                                           5. ADOPT        transactional: candidate plan v(n+1)
                                                              │            + journal entry ("I changed my mind because...")
                                                              ▼
                                                           6. EXECUTE      steps run against truth; failures
                                                                           come back as tool-error signals
```

## The chain that makes it mission-driven

`Mission → plan steps → assumptions each step depends on → signals that could falsify them`

A signal only matters if it touches a live assumption. That is why "heavy rain in Lisbon" is ignored (nothing depends on it) while "LH1234 cancelled" is not. It is also why the agent can explain itself: every revision names the assumption, the evidence, and the steps that depended on it.

## Components

| Concern | Where | Notes |
|---|---|---|
| Domain types | `lib/domain/types.ts` | One source of truth for every record the UI shows |
| Beliefs | `lib/engine/beliefs.ts` | Source reliability, noisy-OR corroboration, flap guard, authoritative probes |
| Plan evaluation | `lib/engine/plan.ts` | Dry-runs a plan against beliefs (projection) or truth (scoring) |
| Safety gate | `lib/engine/gate.ts` | Five gates; any failure blocks adoption |
| Loop | `lib/engine/loop.ts` | `advance(run)` is a pure-ish async step: tick in, events out |
| Trace | `lib/engine/trace.ts` | Renders the structured revision record as plain language |
| Planners | `lib/planner/*` | Deterministic ranking (default), scripted over-eager proposer, optional LLM ranking |
| Scenarios | `lib/scenarios/*` | Data: truth, timeline, plan, assumptions, repair options, outcome |
| Persistence | `lib/store/*` | Versioned snapshot + append-only event log, optimistic concurrency |
| Delivery | `app/api/runs/*` | Create, stream (SSE), inject, approve |

## Lanes

Every scenario runs several agents against the **same reality**, each with its own world state.

| Lane | Policy |
|---|---|
| `baseline` | No monitoring. Executes its original plan to the end. |
| `adaptive` (guarded) | Corroboration, flap guard, probes, safety gate, hold-on-doubt, revision budget 4, cooldown 1 |
| `unguarded` | Same ability to revise, **every safeguard off**. Exists only to show the failure mode. |

## Safety gate

A candidate plan is adopted only if all of these hold:

1. **Evidence**: an irreversible step needs a belief with reliability >= 0.8, or a corroborated belief.
2. **Contract**: hard criteria (budget, deadline) hold in the dry-run.
3. **Dry-run**: every soft success criterion is predicted met.
4. **Better than staying**: strictly better than doing nothing.
5. **Revision budget**: the lane has revisions left.

Also: a one-tick cooldown, and **absorption** (if the current plan still meets every criterion under the new belief, no revision happens at all, as with the customs delay in the supply-chain scenario).

Adoption is transactional. The candidate is a separate copy of the plan; it replaces the live plan only after the gate passes. Superseded steps are kept (marked dropped or voided), so the previous plan version stays readable in the UI and the log. Done steps that must be undone become explicit compensation steps whose refunds are settled against reality when they execute.

## State and delivery

- State is one `RunState` snapshot (versioned) plus an append-only event log. Writes use optimistic concurrency on `version`; the loop retries on conflict.
- Production uses Neon Postgres via `@neondatabase/serverless` (raw SQL; tables bootstrap lazily). Without `DATABASE_URL` it falls back to an in-memory store, which is enough locally and for tests.
- `GET /api/runs/:id/stream` is a Server-Sent Events driver: opening it resumes the run from persisted state, each tick is saved **before** it is sent, closing it pauses. A reconnect continues exactly where it left off.
- **Event-driven input**: `POST /api/runs/:id/inject` queues a preset in persisted state; the next tick consumes it as if reality had produced it. Nothing polls.

## Planner modes

- **Deterministic** (default and fallback): enumerates repair options from the scenario, scores them against the criteria, prefers full success then lowest net spend.
- **Language model** (optional, needs AI Gateway credentials): ranks the same grounded options via the AI SDK with structured output. It cannot invent options and its choice still passes the gate. Any error or timeout falls back to deterministic.
- **Eager** (Phantom scenario only, labelled in the UI): a scripted over-eager proposer that always suggests the most aggressive option, to stress the guards.

## Known limits

See [NOTES.md](NOTES.md) for what is deliberately out of scope.
