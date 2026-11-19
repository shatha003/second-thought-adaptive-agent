/**
 * Domain model for Second Thought.
 *
 * Chain of relevance (this is what makes adaptation mission-driven):
 *   Mission -> Plan steps -> Assumptions each step depends on -> Signals that can falsify them
 */

export type Json = string | number | boolean | null;
export type Facts = Record<string, Json>;

export type LaneKind = "baseline" | "adaptive" | "unguarded";
export type PlannerMode = "heuristic" | "llm";

/* ───────────────────────────── Mission ───────────────────────────── */

export interface Mission {
  title: string;
  brief: string;
  budget: number;
  currency: string;
  deadline: number; // tick
  deadlineLabel: string;
  constraints: string[];
  successCriteria: string[];
}

/* ───────────────────────────── Signals ───────────────────────────── */

export interface SignalSpec {
  key: string;
  value: Json;
  source: string;
  reliability: number; // 0..1
}

export interface Signal extends SignalSpec {
  id: string;
  tick: number;
  injected?: boolean;
}

/** One moment on the (hidden) reality timeline. `truth` mutates the world; `signals` are what agents get to see. */
export interface TimelineItem {
  tick: number;
  world: string; // human description of what happens in reality
  truth?: Facts;
  signals?: SignalSpec[];
}

export interface Preset {
  id: string;
  label: string;
  description: string;
  item: Omit<TimelineItem, "tick">;
}

/* ───────────────────────────── Plan ───────────────────────────── */

export type StepKind = "commit" | "cancel" | "notify" | "confirm";
export type StepStatus = "pending" | "done" | "failed" | "dropped" | "voided";

/** Refund logic evaluated against *reality* when a compensation step executes. */
export interface Settle {
  key: string;
  value: Json;
  ifTrue: number;
  ifFalse: number;
}

export interface Step {
  id: string;
  title: string;
  kind: StepKind;
  args: Record<string, Json>;
  deps: string[];
  assumptions: string[];
  notBefore?: number;
  reversible: boolean;
  cost: number; // positive = spend, negative = refund
  settle?: Settle;
  status: StepStatus;
  origin: number; // plan version that introduced the step
  doneTick?: number;
  result?: string;
}

export type StepSeed = Omit<Step, "status" | "origin">;

/* ───────────────────────────── Assumptions ───────────────────────────── */

export type Op = "eq" | "neq" | "gte" | "lte";

export interface AssumptionDef {
  id: string;
  statement: string;
  key: string;
  op: Op;
  value: Json;
  criticality: "critical" | "important";
  ttl?: number; // staleness horizon in ticks
}

export type AState = "holding" | "weakened" | "violated" | "stale" | "retired";

export interface AssumptionRT extends AssumptionDef {
  state: AState;
  since: number;
  handled: boolean;
  absorbed?: boolean;
}

export interface Report {
  tick: number;
  value: Json;
  source: string;
  reliability: number;
}

export interface Belief {
  value: Json;
  prev?: Json;
  source: string;
  reliability: number;
  tick: number;
  pending?: { value: Json; reports: Report[] };
  reports: Report[];
  unstable?: boolean;
  corroborated?: boolean;
}

/* ───────────────────────────── Policy ───────────────────────────── */

export interface Policy {
  name: string;
  /** Contradictions from weak sources need corroboration before they change beliefs. */
  corroboration: boolean;
  /** Detect flapping feeds and stop trusting them without a direct probe. */
  flapGuard: boolean;
  /** Verify (probe an authoritative source) instead of acting on doubt. */
  probe: boolean;
  /** Safety gate: contract validator, dry-run, change-vs-stay, evidence. */
  gate: boolean;
  /** Pause steps whose assumptions are violated/weakened. */
  holdOnDoubt: boolean;
  revisionBudget: number;
  cooldown: number;
}

/* ───────────────────────────── Evaluation ───────────────────────────── */

export interface Criterion {
  id: string;
  label: string;
  ok: boolean;
  hard: boolean;
  detail: string;
}

export interface Evaluation {
  criteria: Criterion[];
  netCost: number;
  allMet: boolean;
  hardMet: boolean;
  metCount: number;
}

/* ───────────────────────────── Revisions & journal ───────────────────────────── */

export interface RepairOption {
  id: string;
  label: string;
  detail: string;
  level: 2 | 3;
  quality: number; // speed / comfort: what an over-eager proposer optimises
  dropStepIds: string[];
  addSteps: StepSeed[];
  addAssumptions: AssumptionDef[];
  retireAssumptionIds: string[];
}

export interface OptionVerdict {
  id: string;
  label: string;
  detail: string;
  netCost: number;
  met: number;
  total: number;
  failing: string[];
  verdict: "chosen" | "rejected" | "not-tried";
  reason: string;
}

export interface GateResult {
  name: string;
  pass: boolean;
  detail: string;
}

export interface RevisionTrigger {
  assumptionId: string;
  statement: string;
  key: string;
  before: Json;
  after: Json;
  evidence: string;
  dependents: string[];
}

export interface Revision {
  id: string;
  tick: number;
  level: 2 | 3 | 4;
  planVersion: number;
  trigger: RevisionTrigger;
  options: OptionVerdict[];
  chosenId?: string;
  gates: GateResult[];
  diff: { kept: string[]; dropped: string[]; added: string[]; compensated: string[] };
  decision: "adopted" | "escalated" | "human-approved";
  planner: string;
  rationale: string;
  before: { met: number; total: number; cost: number };
  after?: { met: number; total: number; cost: number };
}

export interface JournalEntry {
  id: string;
  tick: number;
  kind: "revision" | "verify" | "absorbed" | "noise" | "escalation" | "guard";
  level: 0 | 1 | 2 | 3 | 4;
  headline: string;
  detail?: string;
  revision?: Revision;
}

export interface Escalation {
  id: string;
  tick: number;
  reason: string;
  assumptionId: string;
  optionId?: string;
  optionLabel?: string;
}

export interface Score {
  criteria: Criterion[];
  netCost: number;
  allMet: boolean;
  stepsDone: number;
  stepsTotal: number;
  stepsFailed: number;
  verdict: "achieved" | "silent-failure" | "failed" | "contained" | "breached";
  headline: string;
}

/* ───────────────────────────── Lanes & run ───────────────────────────── */

export interface Lane {
  id: LaneKind;
  label: string;
  blurb: string;
  policy: Policy;
  steps: Step[];
  assumptions: AssumptionRT[];
  beliefs: Record<string, Belief>;
  journal: JournalEntry[];
  planVersion: number;
  revisionsUsed: number;
  lastRevisionTick: number;
  status: "running" | "holding" | "done";
  escalation?: Escalation;
  heldStep?: string;
  score?: Score;
}

export interface WorldEntry {
  tick: number;
  text: string;
  injected?: boolean;
}

export interface RunState {
  id: string;
  scenarioId: string;
  planner: PlannerMode;
  version: number;
  tick: number;
  horizon: number;
  status: "ready" | "running" | "finished";
  truth: Facts;
  world: WorldEntry[];
  lanes: Lane[];
  pendingInjections: string[];
  eventSeq: number;
  createdAt: string;
}

export interface RunEvent {
  seq: number;
  tick: number;
  lane?: LaneKind;
  type: string;
  level?: 0 | 1 | 2 | 3 | 4;
  message: string;
}

/* ───────────────────────────── Scenario contract ───────────────────────────── */

export interface LaneSpec {
  id: LaneKind;
  label: string;
  blurb: string;
}

export interface RepairContext {
  tick: number;
  version: number; // plan version the repair would create
  lane: Lane;
  trigger: AssumptionRT;
  facts: Facts;
  dependents: Step[];
}

export interface Scenario {
  id: string;
  title: string;
  tagline: string;
  domain: string;
  mission: Mission;
  horizon: number;
  lanes: LaneSpec[];
  proposer?: "heuristic" | "eager";
  clock(tick: number): string;
  truth: Facts;
  knowledge: Facts; // what the agent believes at t0
  assumptions: AssumptionDef[];
  plan: StepSeed[];
  timeline: TimelineItem[];
  presets: Preset[];
  canExecute(truth: Facts, step: Step): { ok: boolean; reason?: string; signal?: { key: string; value: Json } };
  outcome(facts: Facts, steps: Step[], mode: "plan" | "truth"): Criterion[];
  costAdjust?(facts: Facts, steps: Step[], mode: "plan" | "truth"): number;
  repair(ctx: RepairContext): RepairOption[];
}
