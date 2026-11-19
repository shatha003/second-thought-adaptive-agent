# Notes

## AI tools used

- **Claude Code (Claude Opus 5.5 and Claude Sonnet 5.5)** wrote most of this codebase in a pair-programming session with the author: the engine, scenarios, API, UI, tests and docs. The author set the brief, reviewed the design decisions, and owns the result.
- **Vercel AI SDK 7** powers the optional language-model planner (`lib/planner/llm.ts`), through the Vercel AI Gateway.
- The default path uses **no model at all**. The agent's reasoning is deterministic and inspectable, which is deliberate (see below).

## Key decisions

1. **Signals touch assumptions, not clocks.** Every revision is triggered by a signal that contradicts an assumption a live step depends on. There is no timer-based re-prompting anywhere.
2. **Hidden truth vs. visible signals.** The simulated world has a ground truth the agents never see. This is what makes "silent failure" demonstrable: the baseline's steps are all green while the mission fails.
3. **Deterministic core, optional LLM.** The model only ranks options that the scenario grounds; it cannot invent actions, and its pick still passes the safety gate. This keeps the demo reproducible and the failure analysis honest.
4. **A triage ladder.** The cheapest sufficient response wins: ignore, verify, patch, re-plan, escalate. Most signals should cost nothing.
5. **Revision is a governed operation.** Five gates, a budget, a cooldown, transactional adoption.
6. **A real failure test.** The unguarded lane is the same agent with the safeguards off, so the comparison isolates what the guards contribute.
7. **Persistence as an event log.** Snapshot + append-only events with optimistic concurrency. The SSE stream persists each tick before sending it, so a refresh or dropped connection resumes the run.
8. **Rollback = transactional adoption + versioned plans.** Rather than an undo button, a candidate plan is a separate copy that is adopted only after the gate passes, and superseded steps stay on record.
9. **Raw SQL over an ORM.** Two tables and a handful of statements did not justify a schema toolchain.

## Bonus items covered

- **Baseline comparison**: every scenario runs a no-monitoring baseline against the same reality.
- **Event-driven inputs**: injected events are queued in persisted state and consumed on the next tick; the stream is Server-Sent Events.

## Out of scope

- **Real external integrations.** Flights, hotels, ports and customs are simulated. The point is the adaptation loop, not API plumbing.
- **Learning across runs.** Source reliabilities and policies are fixed, not learned.
- **Multi-agent negotiation** and a multi-tenant, authenticated product.
- **Free-form LLM planning.** Deliberately excluded, see decision 3.
- **Long-horizon durability.** Runs take seconds, not days. A production version would move the loop onto a durable workflow runtime and use real event sources instead of a simulated timeline.
- **Learning the assumption ledger from the plan.** Assumptions are authored per scenario; extracting them automatically from a model-written plan is the obvious next step.
