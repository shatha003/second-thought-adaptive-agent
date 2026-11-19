# Second Thought — The Adaptive Agent: Implementation Plan

> **Status:** this is the original planning document, kept for context. The implementation differs in three places: persistence uses raw SQL on Neon instead of Drizzle; "rollback" is implemented as transactional adoption plus versioned plans rather than an undo button; and there is no Loom (optional in the brief). See `docs/ARCHITECTURE.md` and `docs/NOTES.md` for the as-built description.

> Working title: **Second Thought**. An agent that runs a multi-step mission, watches the world for evidence that its assumptions are wrong, and safely changes its mind, with a receipt for every revision.

---

## 1. The core idea (what makes this "mission-driven", not "re-prompt on a timer")

The grader's top criterion (25 pts) is that adaptation is **mission-driven**. Everything is built on one chain:

```
Mission  →  Plan steps  →  Assumptions each step depends on  →  Signals that can falsify them
```

- **Mission contract**: goal, success criteria, hard constraints (budget, deadline), never-violate invariants.
- **Plan**: a DAG of steps. Each step declares `dependsOnAssumptions[]`, whether it is reversible, and its compensation action.
- **World model = Assumption Ledger**: each assumption has a statement, a signal key, a machine-checkable predicate, confidence, criticality and a staleness TTL. Its state is `holding | weakened | violated | stale`.
- **A signal only matters if it touches an assumption that a live step depends on.** That relevance graph is what makes this change detection and not a timer. The agent never wakes up on a clock to ask "should I re-plan?". It wakes up when an observation breaks a predicate.

### Triage ladder (cheapest sufficient response wins)

| Level | Trigger | Response |
|---|---|---|
| 0 Ignore | Signal touches no live assumption | Log as noise, with the reason |
| 1 Verify | Assumption weakened, or only one source says so | Cheap probe or second source before acting |
| 2 Patch | Violated assumption affects 1–2 downstream steps | Local repair of the affected subtree only |
| 3 Re-plan | Success criteria are now unreachable on the current plan | Re-plan the remaining DAG. Completed steps are frozen |
| 4 Escalate | Irreversible action, low confidence, revision budget spent, or gate rejection | Pause in safe-hold and ask a human |

Principle of **minimal change**: completed work is never silently discarded. Committed side effects get explicit compensation steps (cancel, refund, notify).

### Safety gate on every revision (the "without making things worse" half)
Every proposed revision passes a deterministic gate before it is adopted:
1. **Contract validator**: new plan satisfies constraints and invariants (budget, deadline, forbidden actions).
2. **Dry-run**: simulate the new plan against the current world model.
3. **Change-vs-stay score**: expected value of revising must beat expected value of staying, with a margin (hysteresis).
4. **Corroboration rule**: irreversible changes need ≥2 independent sources, or a verify probe.
5. **Revision budget and cooldown**: max N revisions per window. This stops thrash.
6. **Rollback**: the last-known-good plan version is always restorable.
7. **Human approval** for irreversible, high-blast-radius actions.

---

## 2. Scope: scenarios

All worlds are **deterministic simulations with timed event feeds**. Demos are reproducible and free to run, and the "reality changed" moments are scripted. Judges can also inject their own signals live.

### Scenario A — "Keynote to Lisbon" (travel logistics)
Mission: get a keynote speaker to Lisbon by Thursday 09:00 under €1,200, with a hotel and a transfer.
- Assumptions: flight LH1234 on time; hotel has availability; visa not required; airport transfer available.
- **Silent-failure moment**: the flight is cancelled mid-plan. The baseline's remaining steps (hotel check-in, transfer pickup) all still "succeed", so every step is green, but the speaker never arrives.
- Adaptive: flags A1 violated → Level 3 → rebooks via rail + alternate flight, shifts the hotel check-in, re-times the transfer, cancels the old transfer (compensation), and writes the trace.

### Scenario B — "500 units by Friday" (supply-chain fulfilment)
Mission: fulfil an order of 500 units by Friday under €40k.
- Assumptions: supplier S1 has stock; port lead time ≤ 3 days; unit price ≤ €70.
- **Silent-failure moment**: S1 reports partial stock (320 units) and a port strike is announced. The baseline ships what it can and reports "order placed ✔", short by 180 units and late.
- Adaptive: Level 2 patch (split-source 180 units from S2) + Level 3 re-route (air vs sea) chosen by a cost/deadline trade-off, with the trade-off shown in the trace.

Two different domains show the loop is domain-agnostic: only tools and the world simulator change.

### Scenario F — Failure test: "Phantom Alarm" (adaptation goes wrong, contained)
A flaky feed reports the flight cancelled, then un-cancelled, then cancelled again (flapping), while an LLM revision proposes something plausible but over budget.
- **Uncontained**: the agent thrashes, rebooks irreversibly on a false alarm, and burns budget.
- **Contained**: Level 1 verify, corroboration rule, hysteresis, cooldown, validator rejecting the over-budget proposal, rollback to the last-known-good plan, and escalation to a human when the revision budget is hit.
- Also show a second failure class: **LLM proposes an invalid plan** → validator rejects → deterministic fallback (safe-hold) → escalate. This is the "failure thinking" 15 pts.

### Baseline (bonus signal)
A non-adaptive agent runs the **same** event timeline in a side-by-side split view. At the end a scorecard shows `all steps green, mission FAILED (silent)` vs `mission achieved after 2 revisions`.

---

## 3. Tech stack

| Concern | Choice | Why |
|---|---|---|
| App | **Next.js (App Router) + TypeScript** | One repo, live demo on Vercel, SSE-friendly |
| Hosting | **Vercel** (Fluid Compute, default Node runtime) | Live URL is required. SSE works without Edge |
| Persistence | **Neon Postgres** (via Vercel Marketplace) + **Drizzle ORM** | Real persisted state (technical depth, 20+ pts). Event-sourced, replayable |
| LLM | **AI SDK** via **Vercel AI Gateway** (plain `"provider/model"` strings), `generateObject` with Zod schemas | Structured plans and revisions. No provider lock-in |
| Streaming | **Server-Sent Events** from a route handler, replay from DB on reconnect | Event-driven inputs (bonus signal) |
| UI | Tailwind + shadcn/ui, Framer Motion, a small graph/DAG lib (e.g. React Flow) | Plan diff must be visually obvious in 90s |
| Tests | **Vitest**, scenario golden tests, GitHub Actions CI | "Clean clone runs" and proof the failure test holds |

**Runs without keys:** a `MODE=recorded` setting replays cached LLM revisions (stored fixtures) so a clean clone and the live demo never depend on an API key or budget. `MODE=live` calls the Gateway. The live demo ships with recorded mode as the default and a "Live LLM" toggle, rate-limited.

---

## 4. Architecture

```
          ┌──────────────┐  timed / injected signals   ┌─────────────────┐
          │ World Sim    │ ───────────────────────────▶│  Signal Bus     │
          │ (scenarios)  │                             │  (event-driven) │
          └──────▲───────┘                             └────────┬────────┘
                 │ tool effects                                 │ observation
          ┌──────┴───────┐        ┌───────────────────┐   ┌─────▼───────────┐
          │  Executor    │◀───────│  Plan (DAG +      │◀──│ Assumption      │
          │  (tools,     │ next   │  versions)        │   │ Monitors        │
          │  compensate) │ step   └─────────▲─────────┘   │ (predicates)    │
          └──────────────┘                  │ adopt        └─────┬───────────┘
                                    ┌───────┴───────┐            │ violated/weakened
                                    │ Safety Gate   │◀───────────┤
                                    │ (validate,    │     ┌──────▼───────┐
                                    │ dry-run,      │◀────│ Triage +     │
                                    │ hysteresis,   │     │ Planner (LLM │
                                    │ rollback)     │     │ + fallback)  │
                                    └───────┬───────┘     └──────────────┘
                                            ▼
                         Append-only Event Log (Postgres) ──▶ SSE ──▶ UI
                                            └─▶ "I changed my mind because…" trace
```

**Loop**: `plan → execute step → observe → re-evaluate assumptions → (triage → propose revision → gate → adopt | reject | escalate) → continue`.

The loop is **event-driven**: execution advances on virtual-clock ticks, and re-evaluation fires on observations that touch live assumptions. There is no "every N seconds re-prompt".

### Repo layout
```
/app
  /page.tsx                     mission-control UI
  /api/runs/route.ts            create run
  /api/runs/[id]/stream/route.ts  SSE (replays from DB, then live)
  /api/runs/[id]/inject/route.ts  judge-injected signal
  /api/runs/[id]/approve/route.ts human approval
/lib
  /domain      mission.ts, plan.ts, assumption.ts, signal.ts, revision.ts   (Zod schemas, pure types)
  /engine      loop.ts, monitor.ts, triage.ts, gate.ts, trace.ts
  /planner     llm.ts (AI SDK), fallback.ts (deterministic), prompts.ts
  /executor    tools.ts, compensate.ts
  /baseline    naive-agent.ts
  /scenarios   lisbon.ts, fulfilment.ts, phantom-alarm.ts (world + timeline + mission)
  /store       schema.ts (Drizzle), events.ts, replay.ts
/tests         monitor.test.ts, triage.test.ts, gate.test.ts, scenarios.test.ts
/docs          ARCHITECTURE.md, FAILURE-TEST.md, THESIS.md, LOOM-SCRIPT.md, NOTES.md
/fixtures      recorded LLM revisions (for MODE=recorded)
```

### Data model (event-sourced)
- `runs` (id, scenario, mode, status, created_at)
- `events` (run_id, seq, ts, type, payload jsonb): append-only; the source of truth
- Derived or materialized: `plan_versions`, `steps`, `assumptions`, `observations`, `revisions`
- A `revisions` row stores: trigger observation id, assumption violated, belief before and after, evidence, alternatives considered, chosen option, plan diff (kept/dropped/added), gate verdicts, risk, decision (adopted/rejected/escalated).
- Replay = fold events → state. This gives crash-safety, reconnect, and "time-travel scrubber" in the UI.

### The trace ("I changed my mind because…")
Generated from the structured `revisions` row, not free text, so it can't hallucinate:

> **Revision 1 · t=14:20** — I changed my mind because **flight LH1234 was cancelled** (airline feed, then confirmed by 2nd source).
> I had assumed *the speaker arrives by air at 08:10*. That is now false, and 3 later steps depended on it.
> I considered: (a) wait for rebooking ✗ misses deadline, (b) alternate flight + rail ✓ €310, arrives 08:40, (c) cancel mission ✗.
> **Kept** 4 done steps · **Dropped** transfer pickup 08:30 (cancelled, compensation issued) · **Added** rail leg, new pickup 09:10.
> Gates: contract ✓ · dry-run ✓ · budget €1,070/€1,200 ✓ · reversible ✓.

---

## 5. UI / demo design (the 90-second "before/after")

Single "mission control" page, dark control-room aesthetic with one accent colour for "mind changed" moments.

- **Top bar**: scenario picker, Run / Pause / speed, "Inject signal" menu, Adaptive⇄Baseline⇄Side-by-side toggle.
- **Left**: mission contract + **plan DAG**. Steps are coloured by state. On a revision the DAG animates a diff: dropped steps strike through, added steps glow in.
- **Centre**: **Assumption board**, a set of health lights (holding / weakened / violated). The signal that flips a light draws a line to the steps it endangers. This is the "relevance graph" made visible.
- **Right**: **"Mind changes" feed**: the trace cards above, with a collapsed "alternatives considered".
- **Bottom**: raw event stream and a time scrubber (replay from DB).
- **End state**: side-by-side **scorecard**: baseline `✔✔✔✔ all steps green · ✖ mission failed (silent)` vs adaptive `✔ mission achieved · 2 revisions · €1,070`.
- **Failure scenario view**: shows "uncontained" vs "contained" with the gate verdicts lit up.

Start from `design-taste-frontend` / `high-end-visual-design` skills for polish once the engine works.

---

## 6. Build phases (≈5 working days; compress or stretch as needed)

**Phase 0 — Setup (½ day)**
- Scaffold Next.js + TS + Tailwind + shadcn, git init, GitHub repo, CI skeleton.
- Install Vercel CLI, link project, provision Neon via Marketplace, enable AI Gateway.
- Write Zod domain schemas (mission, plan, assumption, signal, revision).

**Phase 1 — Deterministic core (1 day)**
- World simulator + timed event feeds + virtual clock for Scenario A.
- Executor with tools and compensations.
- **Baseline naive agent** running the same timeline. Confirm it fails silently. This is your "problem exists" proof.
- Assumption monitors (predicate evaluation, states, staleness).

**Phase 2 — The adaptive loop (1 day)**
- Relevance graph and triage ladder (Levels 0–4).
- Planner interface with two implementations: deterministic fallback and LLM (AI SDK `generateObject`, schema-constrained, given mission + current plan + violated assumption + frozen steps).
- Safety gate (validator, dry-run, change-vs-stay, corroboration, hysteresis, revision budget, rollback).
- Revision record + trace renderer. Scenario A passes end to end in tests.

**Phase 3 — Persistence, streaming, UI (1 day)**
- Event-sourced store, replay, SSE route with reconnect.
- Mission-control UI: plan DAG with diff animation, assumption board, mind-changes feed, side-by-side baseline.
- Inject-signal endpoint and button.

**Phase 4 — Scenario B, failure test, hardening (1 day)**
- Scenario B (fulfilment). Prove the engine is domain-agnostic: no engine code changes, only scenario files.
- Scenario F (Phantom Alarm): uncontained vs contained, rollback, escalation and human-approval flow.
- Golden scenario tests + failure containment tests in CI. Record LLM fixtures for `MODE=recorded`.

**Phase 5 — Ship (½–1 day)**
- Deploy to Vercel (recorded mode default), smoke-test from a clean browser and a clean clone.
- README, ARCHITECTURE.md, FAILURE-TEST.md, THESIS.md, NOTES.md.
- Record the Loom. Submit.

**Cut order if time is short** (protect the scored parts): drop Scenario B polish → drop time scrubber → drop live-LLM toggle. Never drop the baseline comparison, the trace, persistence, or the failure test.

---

## 7. How this maps to the scoring rubric

| Criterion (weight) | Where it is satisfied |
|---|---|
| Conceptual clarity (25) | Mission → assumptions → signals relevance graph; triage ladder; revisions are structured records, never "re-prompt" |
| Technical depth (25) | Real plan/observe/revise loop; event-sourced Postgres state; replay; gate with validator, dry-run, hysteresis, rollback; tests |
| Demo quality (20) | Side-by-side with baseline; DAG diff animation; scorecard `green steps / failed mission`; reproducible in 90 s |
| Failure thinking (15) | Phantom Alarm scenario, invalid-LLM-plan scenario, containment mechanisms, FAILURE-TEST.md |
| Future thesis (15) | THESIS.md (draft below) |
| Bonus | Baseline comparison ✔, event-driven streaming + live signal injection ✔ |
| Disqualifiers avoided | No timer-based re-prompting; no hidden logic (every decision is in the event log); live URL + clean-clone README |

---

## 8. Your to-do list (things only you can do)

**Accounts and setup**
- [ ] Create a **public GitHub repo** (e.g. `second-thought-adaptive-agent`).
- [ ] Install the Vercel CLI: `npm i -g vercel`, then `vercel login`.
- [ ] Create/confirm a Vercel account, then link the project (`vercel link`).
- [ ] Provision **Neon Postgres** from the Vercel Marketplace (free tier is fine).
- [ ] Enable **Vercel AI Gateway** (for live-LLM mode). Recorded mode needs no key.
- [ ] Node 22+ locally.

**Decisions I need from you** (defaults are in bold; say nothing and I'll use them)
- Scenario domains: **Lisbon travel + order fulfilment**, or swap in your own?
- LLM default in the live demo: **recorded mode on, live toggle available**.
- Visual style: **dark mission-control**.
- Deadline? (it sets whether I use the 5-day plan or the cut-order version).

**Deliverables to finish**
- [ ] Deploy and verify the **live URL** opens in an incognito window.
- [ ] Verify a **clean clone** runs (`git clone` → `npm i` → `npm run dev`) on a second machine or folder.
- [ ] **Record the 90-second Loom** (script below).
- [ ] Review and personalise THESIS.md (it's your voice and your name on it).
- [ ] Fill the submission form: repo URL, demo URL, Loom URL, notes (AI tools used: Claude Code + AI SDK; key decisions; out of scope).

---

## 9. 90-second Loom script

| Time | Screen | Say |
|---|---|---|
| 0:00–0:10 | Mission-control, side-by-side | "Most agents commit to a plan and execute it blindly. Here's the same mission, same world, two agents." |
| 0:10–0:25 | Run Scenario A. Both agents book flight, hotel | "Both start identically. The mission: get a keynote speaker to Lisbon by 9am." |
| 0:25–0:40 | Flight cancelled, assumption light turns red on the adaptive side only | "Reality changes. Adaptive agent's assumption 'flight on time' is violated, and it knows exactly which 3 steps depend on it." |
| 0:40–0:60 | Plan DAG diff animates, trace card appears | "It doesn't restart. It keeps completed work, drops what's dead, adds a rail leg, and writes why: 'I changed my mind because…'" |
| 0:60–0:72 | Scorecard | "Baseline: every step green, mission failed, and nothing told you. Adaptive: mission achieved." |
| 0:72–0:85 | Phantom Alarm, gates lit | "Adaptation can fail too. A flapping feed. Verification, hysteresis and a revision budget contain it, and it escalates to a human." |
| 0:85–0:90 | Live URL on screen | "Everything's event-sourced and replayable. Link below." |

---

## 10. Draft two-year thesis (~250 words, edit in your own voice)

**Adaptive planning in production agents, 2028.**

Today's agents are written as scripts with a language model inside. In two years that framing will look like running a production service as a shell script. The unit of reliability will no longer be the *plan* but the *assumption ledger*: an explicit, inspectable record of what the agent believes about the world, why, and what would falsify it.

Three shifts follow. First, **change detection becomes infrastructure**. Agents will subscribe to signals tied to the assumptions their plans depend on, the way services subscribe to health checks, rather than polling or re-prompting. Re-planning on a timer is the agent equivalent of restarting a server every hour: it works until the day it makes things worse.

Second, **revision becomes a governed operation**, like a deploy. Every change of mind will carry a diff, a rationale, a risk assessment, and a rollback, and will pass gates (validators, dry-runs, hysteresis, approval for irreversible actions). The failure that matters is not the agent that doesn't adapt but the one that adapts *confidently on a false alarm*.

Third, **trust will be earned through traces, not demos**. Buyers will ask "show me the last ten times it changed its mind and why", and event-sourced, replayable histories will be a procurement requirement and a compliance artifact.

The agents that win won't be the ones that plan best. They'll be the ones that know most precisely when their plan has stopped being true, and prove it.

---

## 11. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Looks like scripted theatre | Real predicates and relevance graph; judge-injected signals; scenario files are the only domain code |
| LLM flakiness / cost / no key | Recorded mode default, schema-constrained output, deterministic fallback planner |
| Over-scoping | Cut order in §6; engine is one loop, scenarios are data |
| Vercel function timeout | Virtual clock + persisted events + SSE reconnect/replay; no long single call is required |
| Demo not obvious in 90s | Side-by-side + scorecard; rehearse Loom against the script |

## 12. Notes for the submission form
- **AI tools used**: Claude Code (implementation), Vercel AI SDK + AI Gateway (planner), Cursor/none otherwise. Edit to match reality.
- **Key decisions**: assumption ledger as world model; deterministic change detection with LLM only proposing revisions; gate between proposal and adoption; event sourcing.
- **Out of scope**: real third-party APIs, multi-agent negotiation, learning across runs, auth/multi-tenant.
