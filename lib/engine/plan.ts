import type {
  AssumptionRT,
  Belief,
  Evaluation,
  Facts,
  Lane,
  RepairOption,
  Scenario,
  Step,
  StepSeed,
} from "@/lib/domain/types";

export function factsOf(beliefs: Record<string, Belief>): Facts {
  const f: Facts = {};
  for (const [k, b] of Object.entries(beliefs)) f[k] = b.value;
  return f;
}

/** Commit steps that actually deliver mission value. "plan" mode includes pending steps (a projection). */
export function liveSteps(steps: Step[], mode: "plan" | "truth"): Step[] {
  return steps.filter(
    (s) => s.kind === "commit" && (s.status === "done" || (mode === "plan" && s.status === "pending")),
  );
}

export function netCost(scn: Scenario, facts: Facts, steps: Step[], mode: "plan" | "truth"): number {
  const spent = steps
    .filter((s) => s.status === "done" || s.status === "voided" || (mode === "plan" && s.status === "pending"))
    .reduce((a, s) => a + s.cost, 0);
  return Math.round(spent + (scn.costAdjust?.(facts, steps, mode) ?? 0));
}

/** Dry-run: what does this plan achieve, given these facts? Used for both beliefs ("plan") and reality ("truth"). */
export function evaluate(scn: Scenario, facts: Facts, steps: Step[], mode: "plan" | "truth"): Evaluation {
  const criteria = scn.outcome(facts, steps, mode);
  const cost = netCost(scn, facts, steps, mode);
  const { budget, currency } = scn.mission;
  criteria.push({
    id: "budget",
    label: `Spend within ${currency}${budget.toLocaleString("en-US")}`,
    ok: cost <= budget,
    hard: true,
    detail: `${currency}${cost.toLocaleString("en-US")} of ${currency}${budget.toLocaleString("en-US")}`,
  });
  const metCount = criteria.filter((c) => c.ok).length;
  return {
    criteria,
    netCost: cost,
    allMet: metCount === criteria.length,
    hardMet: criteria.filter((c) => c.hard).every((c) => c.ok),
    metCount,
  };
}

/** Pure: returns a new step list with the option applied (dropped/voided + added). */
export function applyOption(steps: Step[], opt: RepairOption, version: number): Step[] {
  const next = structuredClone(steps);
  for (const id of opt.dropStepIds) {
    const s = next.find((x) => x.id === id);
    if (s) s.status = s.status === "pending" ? "dropped" : "voided";
  }
  for (const seed of opt.addSteps as StepSeed[]) next.push({ ...structuredClone(seed), status: "pending", origin: version });
  return next;
}

export function dependentsOf(lane: Lane, a: AssumptionRT): Step[] {
  return lane.steps.filter((s) => (s.status === "pending" || s.status === "done") && s.assumptions.includes(a.id));
}

export function diffOf(before: Step[], opt: RepairOption): { kept: string[]; dropped: string[]; added: string[]; compensated: string[] } {
  const title = (id: string) => before.find((s) => s.id === id)?.title ?? id;
  const dropSet = new Set(opt.dropStepIds);
  return {
    kept: before.filter((s) => !dropSet.has(s.id) && (s.status === "done" || s.status === "pending")).map((s) => s.title),
    dropped: opt.dropStepIds.map(title),
    added: opt.addSteps.filter((s) => s.kind !== "cancel").map((s) => s.title),
    compensated: opt.addSteps.filter((s) => s.kind === "cancel").map((s) => s.title),
  };
}
