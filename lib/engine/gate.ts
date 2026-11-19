import type { Belief, Evaluation, GateResult, Lane, Scenario } from "@/lib/domain/types";
import type { Candidate } from "@/lib/planner/rank";

/**
 * The safety gate. Every proposed revision is validated here *before* it is adopted. Adoption is
 * transactional: the candidate plan is a separate copy and only replaces the live plan if every
 * gate passes. Rejected proposals never touch state.
 */
export function runGates(args: {
  scn: Scenario;
  lane: Lane;
  belief: Belief | undefined;
  cand: Candidate;
  stay: Evaluation;
}): GateResult[] {
  const { lane, belief, cand, stay } = args;
  const ev = cand.evaluation;
  const gates: GateResult[] = [];

  // 1. Evidence: irreversible commitments need trustworthy evidence behind the belief that triggered them.
  const irreversible = cand.option.addSteps.filter((s) => s.kind === "commit" && !s.reversible);
  if (irreversible.length) {
    const ok = !!belief && (belief.reliability >= 0.8 || !!belief.corroborated);
    gates.push({
      name: "Evidence",
      pass: ok,
      detail: ok
        ? `irreversible step backed by ${Math.round((belief?.reliability ?? 0) * 100)}% evidence`
        : "irreversible step on weak, uncorroborated evidence",
    });
  } else {
    gates.push({ name: "Evidence", pass: true, detail: "only reversible steps added" });
  }

  // 2. Contract: hard constraints (budget, deadline) hold in the dry-run.
  const hardFail = ev.criteria.filter((c) => c.hard && !c.ok);
  gates.push({
    name: "Contract",
    pass: hardFail.length === 0,
    detail: hardFail.length ? hardFail.map((c) => `${c.label} ✗ (${c.detail})`).join("; ") : "budget and deadline hold",
  });

  // 3. Dry-run outcome: every success criterion is predicted to be met.
  const softFail = ev.criteria.filter((c) => !c.hard && !c.ok);
  gates.push({
    name: "Dry-run",
    pass: softFail.length === 0,
    detail: softFail.length ? softFail.map((c) => `${c.label} ✗`).join("; ") : `${ev.metCount}/${ev.criteria.length} criteria predicted met`,
  });

  // 4. Change-vs-stay: only revise if it is strictly better than doing nothing.
  const better = ev.metCount > stay.metCount || (ev.metCount === stay.metCount && ev.netCost < stay.netCost);
  gates.push({
    name: "Better than staying",
    pass: better,
    detail: `${ev.metCount}/${ev.criteria.length} met vs ${stay.metCount}/${stay.criteria.length} if we do nothing`,
  });

  // 5. Revision budget (anti-thrash).
  gates.push({
    name: "Revision budget",
    pass: lane.revisionsUsed < lane.policy.revisionBudget,
    detail: `${lane.revisionsUsed}/${lane.policy.revisionBudget} revisions used`,
  });

  return gates;
}
