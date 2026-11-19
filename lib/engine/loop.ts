import type {
  AssumptionRT,
  Belief,
  Escalation,
  GateResult,
  Json,
  JournalEntry,
  Lane,
  LaneSpec,
  OptionVerdict,
  PlannerMode,
  RepairOption,
  Revision,
  RevisionTrigger,
  RunEvent,
  RunState,
  Scenario,
  Score,
  Signal,
  TimelineItem,
} from "@/lib/domain/types";
import { rankCandidates, type Candidate } from "@/lib/planner/rank";
import { getScenario } from "@/lib/scenarios";
import { evaluateAssumption, evidenceLine, ingest, pct } from "./beliefs";
import { runGates } from "./gate";
import { applyOption, dependentsOf, diffOf, evaluate, factsOf } from "./plan";
import { policyFor } from "./policy";
import { narrate } from "./trace";

type Emit = (lane: Lane["id"] | undefined, type: string, message: string, level?: RunEvent["level"]) => void;
interface Ctx {
  run: RunState;
  scn: Scenario;
  emit: Emit;
}

const STEPS_PER_TICK = 2;
const show = (v: Json | undefined) => (v === undefined ? "?" : String(v));

/* ───────────────────────────── creation ───────────────────────────── */

function makeLane(scn: Scenario, spec: LaneSpec): Lane {
  const policy = policyFor(spec.id);
  const beliefs: Record<string, Belief> = {};
  const monitored = spec.id !== "baseline";
  if (monitored) {
    for (const [k, v] of Object.entries(scn.knowledge)) {
      beliefs[k] = { value: v, source: "initial-survey", reliability: 0.9, tick: 0, reports: [] };
    }
  }
  return {
    id: spec.id,
    label: spec.label,
    blurb: spec.blurb,
    policy,
    steps: scn.plan.map((s) => ({ ...structuredClone(s), status: "pending" as const, origin: 1 })),
    assumptions: monitored ? scn.assumptions.map((a) => ({ ...a, state: "holding" as const, since: 0, handled: false })) : [],
    beliefs,
    journal: [],
    planVersion: 1,
    revisionsUsed: 0,
    lastRevisionTick: 0,
    status: "running",
  };
}

export function createRun(scenarioId: string, planner: PlannerMode = "heuristic", id: string = crypto.randomUUID()): RunState {
  const scn = getScenario(scenarioId);
  return {
    id,
    scenarioId,
    planner,
    version: 0,
    tick: 0,
    horizon: scn.horizon,
    status: "ready",
    truth: structuredClone(scn.truth),
    world: [],
    lanes: scn.lanes.map((l) => makeLane(scn, l)),
    pendingInjections: [],
    eventSeq: 0,
    createdAt: new Date().toISOString(),
  };
}

/* ───────────────────────────── tick ───────────────────────────── */

export async function advance(run: RunState): Promise<RunEvent[]> {
  const scn = getScenario(run.scenarioId);
  const events: RunEvent[] = [];
  if (run.status === "finished") return events;

  run.tick += 1;
  run.status = "running";
  const t = run.tick;
  const emit: Emit = (lane, type, message, level) =>
    events.push({ seq: ++run.eventSeq, tick: t, lane, type, message, level });
  const ctx: Ctx = { run, scn, emit };

  emit(undefined, "tick", `${scn.clock(t)}`);

  // 1. Reality moves (hidden from the agents, which only see the signals it emits).
  const items: (TimelineItem & { injected?: boolean })[] = scn.timeline.filter((i) => i.tick === t);
  for (const pid of run.pendingInjections.splice(0)) {
    const p = scn.presets.find((x) => x.id === pid);
    if (p) items.push({ tick: t, ...p.item, world: p.item.world, injected: true });
  }
  const signals: Signal[] = [];
  for (const item of items) {
    if (item.truth) Object.assign(run.truth, item.truth);
    run.world.push({ tick: t, text: item.world, injected: item.injected });
    emit(undefined, "world", `${item.injected ? "Injected: " : ""}${item.world}`);
    (item.signals ?? []).forEach((s, i) =>
      signals.push({ ...s, id: `sig-${t}-${signals.length + i}`, tick: t, injected: item.injected }),
    );
  }

  // 2. Each agent perceives, re-evaluates, revises, executes.
  for (const lane of run.lanes) await processLane(ctx, lane, signals);

  // 3. Horizon: judge every lane against ground truth.
  if (t >= run.horizon) {
    for (const lane of run.lanes) {
      lane.score = computeScore(scn, run, lane);
      if (lane.status === "running") lane.status = "done";
      emit(lane.id, "score", lane.score.headline);
    }
    run.status = "finished";
  }
  return events;
}

/* ───────────────────────────── lane processing ───────────────────────────── */

async function processLane(ctx: Ctx, lane: Lane, signals: Signal[]) {
  const { emit } = ctx;
  if (lane.id === "baseline") {
    if (signals.length) emit(lane.id, "signal", `Not monitoring: ${signals.length} incoming signal(s) go unseen (no world model)`);
  } else {
    for (const s of signals) receive(ctx, lane, s);
    reevaluate(ctx, lane);
    if (lane.policy.probe) verify(ctx, lane);
    for (let i = 0; i < 4; i++) {
      const a = lane.assumptions.find((x) => x.state === "violated" && !x.handled);
      if (!a) break;
      const handled = await resolveViolation(ctx, lane, a);
      reevaluate(ctx, lane);
      if (!handled) break;
    }
  }
  executeSteps(ctx, lane);
}

function journal(lane: Lane, tick: number, e: Omit<JournalEntry, "id" | "tick">): JournalEntry {
  const entry = { id: `j-${lane.id}-${lane.journal.length + 1}`, tick, ...e };
  lane.journal.push(entry);
  return entry;
}

/** Perceive: fold a signal into the lane's beliefs. Signals that touch nothing live are noise. */
function receive(ctx: Ctx, lane: Lane, s: Signal) {
  const { run, emit } = ctx;
  const touching = lane.assumptions.some((a) => a.state !== "retired" && a.key === s.key);
  const known = s.key in lane.beliefs;
  if (!touching && !known) {
    emit(lane.id, "noise", `Ignored ${s.key}=${show(s.value)} from ${s.source}: no live step depends on it`, 0);
    journal(lane, run.tick, {
      kind: "noise",
      level: 0,
      headline: `Ignored “${s.key} = ${show(s.value)}”`,
      detail: `Nothing in the plan or the assumption ledger depends on "${s.key}", so it cannot change what the agent should do.`,
    });
    return;
  }
  const { belief, result } = ingest(lane.beliefs[s.key], s, lane.policy, run.tick);
  lane.beliefs[s.key] = belief;
  emit(lane.id, "signal", `${s.source} (${pct(s.reliability)}): ${result.detail}`, result.kind === "pending" ? 1 : undefined);
  if (result.kind === "pending" && result.unstable) {
    journal(lane, run.tick, {
      kind: "guard",
      level: 1,
      headline: `Flapping feed: stopped trusting ${s.source} on “${s.key}”`,
      detail: "The value has flipped back and forth within a few ticks. A feed like that cannot change a belief on its own; it needs a direct probe.",
    });
  }
}

/** Re-evaluate every assumption against current beliefs. */
function reevaluate(ctx: Ctx, lane: Lane) {
  const { run, emit } = ctx;
  for (const a of lane.assumptions) {
    const next = evaluateAssumption(a, lane.beliefs[a.key], run.tick);
    if (next !== a.state) {
      emit(lane.id, "assumption", `“${a.statement}”: ${a.state} → ${next}`, next === "violated" ? 3 : undefined);
      a.state = next;
      a.since = run.tick;
      a.handled = false;
      a.absorbed = false;
    }
  }
}

/** Level 1: doubt is resolved by *looking*, not by re-planning. Probe an authoritative source. */
function verify(ctx: Ctx, lane: Lane) {
  const { run, emit } = ctx;
  const doubtful = lane.assumptions.filter((a) => a.state === "weakened" || a.state === "stale");
  for (const key of new Set(doubtful.map((a) => a.key))) {
    const a = doubtful.find((x) => x.key === key)!;
    const prior = lane.beliefs[key];
    const why = a.state === "stale" ? "assumption went stale" : prior?.unstable ? "feed is flapping" : "contradicting report is unconfirmed";
    const probe: Signal = { id: `probe-${run.tick}-${key}`, tick: run.tick, key, value: run.truth[key], source: "authoritative-probe", reliability: 1 };
    const pendingVal = prior?.pending?.value;
    const pendingSrc = prior?.pending?.reports.map((r) => r.source).join(" + ");
    emit(lane.id, "verify", `Verifying “${key}” (${why}) against an authoritative source`, 1);
    const { belief } = ingest(prior, probe, lane.policy, run.tick);
    lane.beliefs[key] = belief;
    const stillHolds = belief.value === prior?.value;
    journal(lane, run.tick, {
      kind: "verify",
      level: 1,
      headline: a.state === "stale"
        ? `Re-verified “${a.statement}”: still holds`
        : stillHolds
          ? `False alarm dismissed: ${key} is still ${show(belief.value)}`
          : `Report confirmed: ${key} really is ${show(belief.value)}`,
      detail: stillHolds
        ? a.state === "stale"
          ? `Observation was ${run.tick - (prior?.tick ?? 0)} ticks old. A direct probe returned ${show(belief.value)}. No change of plan.`
          : `${pendingSrc ?? "A source"} reported ${show(pendingVal)} (unconfirmed). A direct probe returned ${show(belief.value)}. Plan unchanged, and nothing was spent reacting to noise.`
        : `The doubt was real: the probe agrees with ${pendingSrc ?? "the report"}. Handing over to the revision pipeline.`,
    });
  }
  reevaluate(ctx, lane);
}

/* ───────────────────────────── revision pipeline ───────────────────────────── */

async function resolveViolation(ctx: Ctx, lane: Lane, a: AssumptionRT): Promise<boolean> {
  const { run, scn, emit } = ctx;
  const t = run.tick;
  const p = lane.policy;
  const belief = lane.beliefs[a.key];
  const facts = factsOf(lane.beliefs);
  const stay = evaluate(scn, facts, lane.steps, "plan");
  const dependents = dependentsOf(lane, a);
  const trigger: RevisionTrigger = {
    assumptionId: a.id,
    statement: a.statement,
    key: a.key,
    before: belief?.prev ?? scn.knowledge[a.key] ?? null,
    after: belief?.value ?? null,
    evidence: evidenceLine(belief),
    dependents: dependents.map((s) => s.title),
  };

  // Nothing alive depends on it → nothing to change.
  if (dependents.length === 0) {
    a.handled = true;
    journal(lane, t, { kind: "absorbed", level: 0, headline: `“${a.statement}” broke, but no live step depends on it`, detail: "Nothing to change." });
    return true;
  }

  // Mission-driven: does the broken assumption actually threaten the mission? If the plan still meets
  // every success criterion, changing it is pure risk.
  if (p.gate && stay.allMet) {
    a.handled = true;
    a.absorbed = true;
    emit(lane.id, "absorbed", `“${a.statement}” broke but the mission still holds, so no revision`, 0);
    journal(lane, t, {
      kind: "absorbed",
      level: 0,
      headline: `Absorbed: “${a.statement}” is false, but the mission is unaffected`,
      detail: `Dry-run of the current plan against the new belief (${trigger.key} = ${show(trigger.after)}) still meets ${stay.metCount}/${stay.criteria.length} criteria. Changing a working plan would be pure risk.`,
    });
    return true;
  }

  if (lane.revisionsUsed >= p.revisionBudget) {
    return escalate(ctx, lane, a, trigger, `Revision budget exhausted (${lane.revisionsUsed}/${p.revisionBudget}). Refusing to thrash.`, [], undefined, stay);
  }
  if (p.cooldown > 0 && lane.lastRevisionTick > 0 && t - lane.lastRevisionTick < p.cooldown) return false; // retry next tick

  const version = lane.planVersion + 1;
  const options = scn.repair({ tick: t, version, lane, trigger: a, facts, dependents });
  if (!options.length) {
    return escalate(ctx, lane, a, trigger, "No repair options exist for this failure.", [], undefined, stay);
  }
  const cands: Candidate[] = options.map((option) => {
    const steps = applyOption(lane.steps, option, version);
    return { option, steps, evaluation: evaluate(scn, facts, steps, "plan") };
  });
  const ranked = await rankCandidates({
    scn,
    mode: scn.proposer === "eager" ? "eager" : run.planner,
    trigger: a,
    evidence: trigger.evidence,
    candidates: cands,
  });

  const verdicts: OptionVerdict[] = ranked.ordered.map((c) => ({
    id: c.option.id,
    label: c.option.label,
    detail: c.option.detail,
    netCost: c.evaluation.netCost,
    met: c.evaluation.metCount,
    total: c.evaluation.criteria.length,
    failing: c.evaluation.criteria.filter((x) => !x.ok).map((x) => `${x.label} (${x.detail})`),
    verdict: "not-tried",
    reason: "ranked lower; not needed",
  }));

  let adopted: Candidate | undefined;
  let adoptedGates: GateResult[] = [];
  for (let i = 0; i < ranked.ordered.length; i++) {
    const c = ranked.ordered[i];
    const gates: GateResult[] = p.gate
      ? runGates({ scn, lane, belief, cand: c, stay })
      : [{ name: "Safety gate", pass: true, detail: "BYPASSED (guards off): adopted as proposed" }];
    const failed = gates.filter((g) => !g.pass);
    if (!failed.length) {
      adopted = c;
      adoptedGates = gates;
      verdicts[i].verdict = "chosen";
      verdicts[i].reason = p.gate ? "passed every gate" : "top proposal, adopted unchecked";
      break;
    }
    verdicts[i].verdict = "rejected";
    verdicts[i].reason = failed.map((g) => `${g.name}: ${g.detail}`).join("; ");
    emit(lane.id, "gate", `Safety gate rejected “${c.option.label}”: ${verdicts[i].reason}`, 1);
  }

  if (!adopted) {
    const best = [...ranked.ordered].sort((x, y) => y.evaluation.metCount - x.evaluation.metCount || x.evaluation.netCost - y.evaluation.netCost)[0];
    return escalate(ctx, lane, a, trigger, "No option satisfies the mission contract.", verdicts, best, stay, ranked);
  }

  adoptCandidate(ctx, lane, a, adopted, {
    trigger, verdicts, gates: adoptedGates, planner: ranked.planner, rationale: ranked.rationale, stay, decision: "adopted",
  });
  return true;
}

function adoptCandidate(
  ctx: Ctx,
  lane: Lane,
  a: AssumptionRT,
  cand: Candidate,
  m: {
    trigger: RevisionTrigger;
    verdicts: OptionVerdict[];
    gates: GateResult[];
    planner: string;
    rationale: string;
    stay: ReturnType<typeof evaluate>;
    decision: Revision["decision"];
  },
) {
  const { run, scn, emit } = ctx;
  const t = run.tick;
  const opt: RepairOption = cand.option;
  const diff = diffOf(lane.steps, opt);

  lane.planVersion += 1;
  lane.steps = applyOption(lane.steps, opt, lane.planVersion);
  for (const id of opt.retireAssumptionIds) {
    const x = lane.assumptions.find((y) => y.id === id);
    if (x) x.state = "retired";
  }
  for (const add of opt.addAssumptions) {
    if (!lane.assumptions.some((y) => y.id === add.id)) {
      lane.assumptions.push({ ...add, state: "holding", since: t, handled: false });
    } else {
      const ex = lane.assumptions.find((y) => y.id === add.id)!;
      if (ex.state === "retired") Object.assign(ex, { ...add, state: "holding", since: t, handled: false });
    }
    if (!(add.key in lane.beliefs) && add.key in scn.knowledge) {
      lane.beliefs[add.key] = { value: scn.knowledge[add.key], source: "initial-survey", reliability: 0.9, tick: 0, reports: [] };
    }
  }
  a.handled = true;
  if (m.decision === "adopted") {
    lane.revisionsUsed += 1;
    lane.lastRevisionTick = t;
  }

  const after = evaluate(scn, factsOf(lane.beliefs), lane.steps, "plan");
  const rev: Revision = {
    id: `rev-${lane.id}-${lane.journal.filter((j) => j.revision).length + 1}`,
    tick: t,
    level: opt.level,
    planVersion: lane.planVersion,
    trigger: m.trigger,
    options: m.verdicts,
    chosenId: opt.id,
    gates: m.gates,
    diff,
    decision: m.decision,
    planner: m.planner,
    rationale: m.rationale,
    before: { met: m.stay.metCount, total: m.stay.criteria.length, cost: m.stay.netCost },
    after: { met: after.metCount, total: after.criteria.length, cost: after.netCost },
  };
  const entry = journal(lane, t, {
    kind: "revision",
    level: opt.level,
    headline: `I changed my mind because ${m.trigger.evidence} contradicted “${m.trigger.statement}”`,
    detail: narrate(rev),
    revision: rev,
  });
  emit(lane.id, "revision", `${entry.headline} → ${opt.label} (plan v${lane.planVersion})`, opt.level);
  if (lane.status === "holding") {
    lane.status = "running";
    lane.escalation = undefined;
  }
}

function escalate(
  ctx: Ctx,
  lane: Lane,
  a: AssumptionRT,
  trigger: RevisionTrigger,
  reason: string,
  verdicts: OptionVerdict[],
  best: Candidate | undefined,
  stay: ReturnType<typeof evaluate>,
  ranked?: { planner: string; rationale: string },
): boolean {
  const { run, emit } = ctx;
  const t = run.tick;
  a.handled = true;
  lane.status = "holding";
  const esc: Escalation = {
    id: `esc-${lane.id}-${t}`,
    tick: t,
    reason,
    assumptionId: a.id,
    optionId: best?.option.id,
    optionLabel: best?.option.label,
  };
  lane.escalation = esc;
  const rev: Revision = {
    id: `rev-${lane.id}-${lane.journal.filter((j) => j.revision).length + 1}`,
    tick: t,
    level: 4,
    planVersion: lane.planVersion,
    trigger,
    options: verdicts,
    gates: [],
    diff: { kept: [], dropped: [], added: [], compensated: [] },
    decision: "escalated",
    planner: ranked?.planner ?? "n/a",
    rationale: ranked?.rationale ?? reason,
    before: { met: stay.metCount, total: stay.criteria.length, cost: stay.netCost },
  };
  journal(lane, t, {
    kind: "escalation",
    level: 4,
    headline: `Holding for a human: ${reason}`,
    detail: `${narrate(rev)}${best ? `\nBest effort if you override the contract: “${best.option.label}”.` : ""}`,
    revision: rev,
  });
  emit(lane.id, "escalation", `Safe hold: ${reason}`, 4);
  return true;
}

/** Human-in-the-loop: approve the suggested option of a held lane (bypasses the gate; logged as such). */
export function humanApprove(run: RunState, laneId: Lane["id"]): RunEvent[] {
  const scn = getScenario(run.scenarioId);
  const lane = run.lanes.find((l) => l.id === laneId);
  const events: RunEvent[] = [];
  if (run.status === "finished" || !lane?.escalation?.optionId) return events; // the decision window closes when the run ends
  const emit: Emit = (l, type, message, level) => events.push({ seq: ++run.eventSeq, tick: run.tick, lane: l, type, message, level });
  const a = lane.assumptions.find((x) => x.id === lane.escalation!.assumptionId);
  if (!a) return events;
  const facts = factsOf(lane.beliefs);
  const stay = evaluate(scn, facts, lane.steps, "plan");
  const dependents = dependentsOf(lane, a);
  const version = lane.planVersion + 1;
  const option = scn.repair({ tick: run.tick, version, lane, trigger: a, facts, dependents }).find((o) => o.id === lane.escalation!.optionId);
  if (!option) return events;
  const steps = applyOption(lane.steps, option, version);
  const belief = lane.beliefs[a.key];
  const trigger: RevisionTrigger = {
    assumptionId: a.id, statement: a.statement, key: a.key,
    before: belief?.prev ?? scn.knowledge[a.key] ?? null, after: belief?.value ?? null,
    evidence: evidenceLine(belief), dependents: dependents.map((s) => s.title),
  };
  const cand: Candidate = { option, steps, evaluation: evaluate(scn, facts, steps, "plan") };
  emit(lane.id, "approval", `Human approved “${option.label}”, overriding the contract`, 4);
  adoptCandidate({ run, scn, emit }, lane, a, cand, {
    trigger,
    verdicts: [{ id: option.id, label: option.label, detail: option.detail, netCost: cand.evaluation.netCost, met: cand.evaluation.metCount, total: cand.evaluation.criteria.length, failing: cand.evaluation.criteria.filter((c) => !c.ok).map((c) => c.label), verdict: "chosen", reason: "approved by a human operator" }],
    gates: [{ name: "Human approval", pass: true, detail: "operator accepted the contract breach" }],
    planner: "human operator",
    rationale: "A person accepted the trade-off the gate refused to make on its own.",
    stay,
    decision: "human-approved",
  });
  return events;
}

/* ───────────────────────────── execution ───────────────────────────── */

function executeSteps(ctx: Ctx, lane: Lane) {
  const { run, scn, emit } = ctx;
  const t = run.tick;
  for (let n = 0; n < STEPS_PER_TICK; n++) {
    const settled = new Set(lane.steps.filter((s) => s.status === "done" || s.status === "dropped" || s.status === "voided").map((s) => s.id));
    const doubtful = (stepAssumptions: string[]) =>
      lane.policy.holdOnDoubt &&
      stepAssumptions.some((id) => {
        const a = lane.assumptions.find((x) => x.id === id);
        return !!a && (a.state === "weakened" || (a.state === "violated" && !a.absorbed));
      });
    const step = lane.steps.find(
      (s) => s.status === "pending" && (s.notBefore ?? 0) <= t && s.deps.every((d) => settled.has(d)) && !doubtful(s.assumptions),
    );
    if (!step) {
      const held = lane.steps.find((s) => s.status === "pending" && (s.notBefore ?? 0) <= t && s.deps.every((d) => settled.has(d)) && doubtful(s.assumptions));
      if (held && lane.heldStep !== held.id) {
        lane.heldStep = held.id;
        emit(lane.id, "hold", `Paused “${held.title}”: an assumption it depends on is in doubt`, 1);
      }
      return;
    }

    if (step.kind === "commit") {
      const r = scn.canExecute(run.truth, step);
      if (!r.ok) {
        step.status = "failed";
        step.result = r.reason;
        emit(lane.id, "step", `✗ ${step.title}: ${r.reason}`);
        if (lane.id !== "baseline" && r.signal) {
          receive(ctx, lane, { id: `tool-${t}-${step.id}`, tick: t, key: r.signal.key, value: r.signal.value, source: "tool-error", reliability: 1 });
          reevaluate(ctx, lane);
        }
        continue;
      }
    }
    if (step.settle) {
      const refund = run.truth[step.settle.key] === step.settle.value ? step.settle.ifTrue : step.settle.ifFalse;
      step.cost = refund ? -refund : 0;
      step.result = refund > 0 ? `refund ${scn.mission.currency}${refund}` : "no refund (not eligible)";
    } else {
      step.result = step.kind === "confirm" ? "confirmed (not checked against reality)" : step.kind === "notify" ? "sent" : "done";
    }
    step.status = "done";
    step.doneTick = t;
    const money = step.cost ? ` (${step.cost > 0 ? "" : "+"}${scn.mission.currency}${Math.abs(step.cost).toLocaleString("en-US")}${step.cost < 0 ? " back" : ""})` : step.settle ? ` (${step.result})` : "";
    emit(lane.id, "step", `✓ ${step.title}${money}`);
  }
}

/* ───────────────────────────── scoring ───────────────────────────── */

export function computeScore(scn: Scenario, run: RunState, lane: Lane): Score {
  const ev = evaluate(scn, run.truth, lane.steps, "truth");
  const real = lane.steps.filter((s) => s.status !== "dropped");
  const stepsDone = real.filter((s) => s.status === "done" || s.status === "voided").length;
  const stepsFailed = real.filter((s) => s.status === "failed").length;
  const budgetOk = ev.criteria.find((c) => c.id === "budget")?.ok ?? true;
  const othersOk = ev.criteria.filter((c) => c.id !== "budget").every((c) => c.ok);

  let verdict: Score["verdict"];
  let headline: string;
  if (ev.allMet) {
    verdict = "achieved";
    headline = `Mission achieved${lane.revisionsUsed ? ` after ${lane.revisionsUsed} revision${lane.revisionsUsed > 1 ? "s" : ""}` : ""}`;
  } else if (lane.status === "holding" && budgetOk) {
    verdict = "contained";
    headline = "Contained: held safely for a human, contract intact";
  } else if (othersOk && !budgetOk) {
    verdict = "breached";
    headline = "Mission delivered but the budget contract was breached";
  } else if (stepsFailed === 0) {
    verdict = "silent-failure";
    headline = `SILENT FAILURE: ${stepsDone}/${real.length} steps green, mission failed`;
  } else {
    verdict = "failed";
    headline = `Mission failed (${stepsFailed} step${stepsFailed > 1 ? "s" : ""} errored)`;
  }
  return { criteria: ev.criteria, netCost: ev.netCost, allMet: ev.allMet, stepsDone, stepsTotal: real.length, stepsFailed, verdict, headline };
}
