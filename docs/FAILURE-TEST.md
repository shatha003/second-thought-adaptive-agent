# Failure test: adaptation that goes wrong, and its containment

Scenario id: `phantom` ("Failure containment" tab). Run it with `npm run simulate phantom`, or in the UI.

## The failure

An over-eager agent acts on a rumour and on a glitchy feed. It breaks a plan that was fine, burns budget on it, and then has no room left when the real problem arrives. Without the guards it also has no way to say no to the one fix that breaks the contract.

| Tick | Reality (hidden) | What the agents see |
|---|---|---|
| t3 | Nothing changes. LH1234 is operating normally | A social post, reliability 0.4, says LH1234 is cancelled |
| t6-9 | Nothing changes. The transfer service is running | A glitchy aggregator reports the transfer service down, up, down, up |
| t10 | Hotel Alfama really is overbooked | Authoritative hotel feed |
| t12 | Hotel Baixa really is sold out too. Only a €900 luxury hotel is left | Authoritative hotel feed |

### Unguarded lane (every safeguard off)

1. **t3**: treats the 0.4-reliability rumour as fact and swaps the working flight for TP505. The refund for the cancelled flight is settled against reality, where the flight was fine, so the refund is 0. It paid for a second flight for nothing.
2. **t6**: treats a single aggregator glitch as fact and switches to a pre-booked taxi.
3. **t10**: the real hotel failure arrives with the budget already eroded. With no contract gate it moves to the Rooftop Palace.

**Result: breached. The mission is delivered, but net spend is €1,790 against a €1,200 budget.**

### Guarded lane

| Moment | Guard | What it did |
|---|---|---|
| t3 | Corroboration, then probe | Held the rumour as unconfirmed, verified against the authoritative airline feed, which said on time. Belief restored, no revision |
| t6-9 | Probe, flap guard | Verified each aggregator claim against an authoritative source, and flagged the feed as flapping. No revision |
| t10 | Safety gate | Rejected Rooftop Palace (spend €1,380 of €1,200, and no better than staying). Adopted Hotel Baixa instead (revision 1) |
| t12 | Gate, then safe-hold | Baixa sells out. The only option left again fails the contract, so it escalated to a human and paused the steps that depend on the broken assumption |

**Result: contained. Net spend €780, contract intact, held for a human.** The UI offers an Approve button on the escalation. If a person approves the over-budget option, the run ends as breached, and that human override is logged (covered by a test).

## Why this is the right failure to show

The dangerous agent is not the one that fails to adapt. It is the one that adapts confidently on a false alarm. The unguarded agent turns a recoverable situation into a contract breach, while the guarded agent loses on one criterion (accommodation) but keeps the contract and asks a human.

## Containment layers (defence in depth)

1. **Source reliability and corroboration** stop weak evidence from becoming belief.
2. **Probes** replace doubt with a direct check where one exists.
3. **Flap guard** stops a noisy feed from causing repeated re-plans.
4. **Gate** blocks any plan that fails evidence, contract, dry-run, or better-than-staying.
5. **Revision budget and cooldown** bound how often the agent can change its mind.
6. **Transactional adoption** means a rejected candidate never touches the live plan.
7. **Escalation** hands irreversible or contract-breaking choices to a human.

## What containment does not do

The guarded lane does not solve the mission here. There is no valid hotel left inside the budget, and it says so rather than pretending otherwise. Containment means a bad situation stays bounded and visible, not that every scenario has a happy ending.

## Tests

`tests/scenarios.test.ts` and `tests/beliefs.test.ts` assert each of the above, including the unguarded breach figure, rumour dismissal by probe, flap-guard trip, gate rejection with fallback, escalation ending `contained`, and human approval ending `breached`.
