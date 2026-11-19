import type {
  Criterion,
  Facts,
  Json,
  Preset,
  RepairContext,
  RepairOption,
  Scenario,
  Step,
  StepSeed,
} from "@/lib/domain/types";
import { liveSteps } from "@/lib/engine/plan";
import { assume, seed } from "./helpers";

const DEADLINE = 14;
const NEED = 500;

const truth0: Facts = {
  "supplier.S1.stock": 500,
  "supplier.S1.price": 62,
  "supplier.S2.stock": 400,
  "supplier.S2.price": 78,
  "port.rotterdam.status": "open",
  "port.antwerp.status": "open",
  "port.air.status": "open",
  "customs.delay": 0,
};

const assumptions = [
  assume({ id: "a-s1-stock", statement: "Supplier S1 can ship all 500 units", key: "supplier.S1.stock", op: "gte", value: 500 }),
  assume({ id: "a-port-rotterdam", statement: "Rotterdam port is open", key: "port.rotterdam.status", op: "eq", value: "open" }),
  assume({ id: "a-customs", statement: "Customs clears without delay", key: "customs.delay", op: "lte", value: 0, criticality: "important" }),
];

const plan: StepSeed[] = [
  seed({ id: "b1", title: "Order 500 units from S1 @ €62", kind: "commit", args: { type: "order", id: "S1", units: 500, unit: 62, via: "freight" }, cost: 31000, reversible: false, assumptions: ["a-s1-stock"] }),
  seed({ id: "b2", title: "Book sea freight via Rotterdam", kind: "commit", args: { type: "freight", id: "rotterdam", arrive: 12 }, cost: 2500, deps: ["b1"], assumptions: ["a-port-rotterdam"] }),
  seed({ id: "b3", title: "Pre-clear customs", kind: "commit", args: { type: "customs", id: "cc1" }, cost: 300, deps: ["b2"], assumptions: ["a-customs"] }),
  seed({ id: "b4", title: "Notify customer of ETA", kind: "notify", deps: ["b2"] }),
  seed({ id: "b5", title: "Confirm dock slot", kind: "confirm", notBefore: 8, deps: ["b2"], assumptions: ["a-port-rotterdam"] }),
  seed({ id: "b6", title: "Hand off to destination carrier", kind: "confirm", notBefore: 12, deps: ["b3"], assumptions: ["a-customs"] }),
];

const stockOf = (facts: Facts, id: string) => Number(facts[`supplier.${id}.stock`] ?? Infinity);

function costAdjust(facts: Facts, steps: Step[], mode: "plan" | "truth"): number {
  // Suppliers credit back units they cannot ship.
  return -liveSteps(steps, mode)
    .filter((s) => s.args.type === "order")
    .reduce((sum, s) => sum + Math.max(0, Number(s.args.units) - stockOf(facts, String(s.args.id))) * Number(s.args.unit), 0);
}

function outcome(facts: Facts, steps: Step[], mode: "plan" | "truth"): Criterion[] {
  const live = liveSteps(steps, mode);
  const delay = Math.max(0, Number(facts["customs.delay"] ?? 0) - (live.some((s) => s.args.type === "customs-express") ? 1 : 0));
  const freightOk = live.some(
    (s) => s.args.type === "freight" && facts[`port.${s.args.id}.status`] !== "strike" && Number(s.args.arrive) + delay <= DEADLINE,
  );
  let delivered = 0;
  for (const s of live.filter((x) => x.args.type === "order")) {
    const units = Math.min(Number(s.args.units), stockOf(facts, String(s.args.id)));
    if (s.args.via === "freight" ? freightOk : Number(s.args.deliver) + delay <= DEADLINE) delivered += units;
  }
  return [
    {
      id: "units",
      label: `${NEED} units delivered by Day ${DEADLINE}`,
      ok: delivered >= NEED,
      hard: true,
      detail: `${delivered}/${NEED} units`,
    },
  ];
}

function canExecute(truth: Facts, step: Step): { ok: boolean; reason?: string; signal?: { key: string; value: Json } } {
  if (step.kind !== "commit") return { ok: true };
  const id = String(step.args.id);
  if (step.args.type === "order" && Number(truth[`supplier.${id}.stock`] ?? Infinity) < Number(step.args.units)) {
    return { ok: false, reason: "insufficient stock", signal: { key: `supplier.${id}.stock`, value: Number(truth[`supplier.${id}.stock`]) } };
  }
  if (step.args.type === "freight" && truth[`port.${id}.status`] === "strike") {
    return { ok: false, reason: `${id} port is on strike`, signal: { key: `port.${id}.status`, value: "strike" } };
  }
  return { ok: true };
}

function repair(ctx: RepairContext): RepairOption[] {
  const { trigger, version: v, dependents, lane } = ctx;
  const dropIds = dependents.map((s) => s.id);

  if (trigger.id.startsWith("a-s1-stock")) {
    const restated = assume({ id: "a-s1-stock-320", statement: "S1 can still ship the 320 units it has", key: "supplier.S1.stock", op: "gte", value: 320 });
    const s2 = assume({ id: "a-s2-stock", statement: "Supplier S2 has 180 units", key: "supplier.S2.stock", op: "gte", value: 180 });
    const common = { level: 2 as const, dropStepIds: [] as string[], retireAssumptionIds: [trigger.id] };
    return [
      {
        ...common, id: "topup-s2", label: "Top up 180 units from S2", quality: 7,
        detail: "S2 has stock and delivers direct by Day 11. Keeps the S1 shipment untouched.",
        addSteps: [
          seed({ id: `order-S2-v${v}`, title: "Order 180 units from S2 @ €78", kind: "commit", args: { type: "order", id: "S2", units: 180, unit: 78, via: "direct", deliver: 11 }, cost: 14040, reversible: false, assumptions: ["a-s2-stock"] }),
          seed({ id: `notify-split-v${v}`, title: "Tell customer: delivery arrives in two parts", kind: "notify", deps: [`order-S2-v${v}`] }),
        ],
        addAssumptions: [restated, s2],
      },
      {
        ...common, id: "wait-restock", label: "Wait for S1 to restock", quality: 3,
        detail: "S1 expects restock on Day 15, after the deadline.",
        addSteps: [seed({ id: `order-S1R-v${v}`, title: "Order 180 units from S1 restock (Day 15)", kind: "commit", args: { type: "order", id: "S1R", units: 180, unit: 62, via: "direct", deliver: 15 }, cost: 11160, reversible: false })],
        addAssumptions: [restated],
      },
      {
        ...common, id: "short-ship", label: "Ship 320 now, apologise for 180", quality: 1,
        detail: "Cheapest and fastest, but misses the contract quantity.",
        addSteps: [seed({ id: `notify-short-v${v}`, title: "Tell customer: 180 units short", kind: "notify" })],
        addAssumptions: [restated],
      },
    ];
  }

  if (trigger.id === "a-port-rotterdam") {
    const orderId = lane.steps.find((s) => s.args.type === "order" && s.args.via === "freight")?.id ?? "b1";
    const oldFreight = dependents.find((s) => s.args.type === "freight");
    const comp: StepSeed[] =
      oldFreight?.status === "done"
        ? [seed({ id: `cancel-${oldFreight.id}-v${v}`, title: "Cancel Rotterdam freight (90% refund)", kind: "cancel", cost: -2250, settle: { key: trigger.key, value: "strike", ifTrue: 2250, ifFalse: 2250 } })]
        : [];
    const mk = (id: string, label: string, detail: string, arrive: number, cost: number, q: number, irrev: boolean) => ({
      id, label, detail, quality: q, level: 3 as const,
      dropStepIds: dropIds,
      addSteps: [
        ...comp,
        seed({ id: `freight-${id}-v${v}`, title: `Book ${label.toLowerCase()} (arr Day ${arrive})`, kind: "commit", args: { type: "freight", id: id === "air" ? "air" : "antwerp", arrive }, cost, deps: [orderId], reversible: !irrev, assumptions: [`a-port-${id === "air" ? "air" : "antwerp"}`] }),
        seed({ id: `dock-${id}-v${v}`, title: "Confirm new dock/airfield slot", kind: "confirm", notBefore: Math.max(arrive - 3, ctx.tick + 1), deps: [`freight-${id}-v${v}`], assumptions: [`a-port-${id === "air" ? "air" : "antwerp"}`] }),
        seed({ id: `eta-${id}-v${v}`, title: "Notify customer of new ETA", kind: "notify", deps: [`freight-${id}-v${v}`] }),
      ],
      addAssumptions: [assume({ id: `a-port-${id === "air" ? "air" : "antwerp"}`, statement: `${id === "air" ? "Air freight lane" : "Antwerp port"} is open`, key: `port.${id === "air" ? "air" : "antwerp"}.status`, op: "eq", value: "open" })],
      retireAssumptionIds: [trigger.id],
    });
    return [
      mk("antwerp", "Re-route via Antwerp", "Same sea freight, one day longer. Arrives Day 13.", 13, 2800, 5, false),
      mk("air", "Air freight", "Fast (Day 9) but very expensive.", 9, 9500, 9, true),
      {
        id: "wait-strike", label: "Wait out the strike", detail: "Keep Rotterdam and hope. The strike runs past the deadline.", quality: 2, level: 3 as const,
        dropStepIds: [], addSteps: [seed({ id: `hold-v${v}`, title: "Hold shipment until strike ends", kind: "notify" })],
        addAssumptions: [], retireAssumptionIds: [trigger.id],
      },
    ];
  }

  if (trigger.id === "a-customs") {
    return [
      {
        id: "express", label: "Express customs clearance", detail: "Pays to recover one day.", quality: 5, level: 2 as const,
        dropStepIds: [], addSteps: [seed({ id: `cx-v${v}`, title: "Buy express customs clearance", kind: "commit", args: { type: "customs-express", id: "cx" }, cost: 600 })],
        addAssumptions: [], retireAssumptionIds: [trigger.id],
      },
    ];
  }
  return [];
}

const presets: Preset[] = [
  { id: "stock-drop", label: "Supplier S1 stock drops", description: "Real change", item: { world: "S1 reports a production fault: only 320 units can ship.", truth: { "supplier.S1.stock": 320 }, signals: [{ key: "supplier.S1.stock", value: 320, source: "supplier-feed", reliability: 0.95 }] } },
  { id: "port-strike", label: "Rotterdam port strike", description: "Real change", item: { world: "Rotterdam dockworkers go on strike (indefinite).", truth: { "port.rotterdam.status": "strike" }, signals: [{ key: "port.rotterdam.status", value: "strike", source: "port-authority", reliability: 0.97 }] } },
  { id: "customs-delay", label: "Customs slows by a day", description: "Minor change", item: { world: "Customs backlog adds one day to clearance.", truth: { "customs.delay": 1 }, signals: [{ key: "customs.delay", value: 1, source: "customs-feed", reliability: 0.9 }] } },
  { id: "rumour-strike", label: "Rumour: port strike", description: "False alarm", item: { world: "A forum post claims Rotterdam is on strike. It is not.", signals: [{ key: "port.rotterdam.status", value: "strike", source: "social-feed", reliability: 0.35 }] } },
];

export const fulfilment: Scenario = {
  id: "fulfilment",
  title: "500 units by Friday",
  tagline: "Stock falls short, then a port strike. Every step turns green anyway.",
  domain: "Supply chain",
  mission: {
    title: "Fulfil a 500-unit order",
    brief: "Deliver 500 units to the customer by Day 14 under a €40,000 budget.",
    budget: 40000,
    currency: "€",
    deadline: DEADLINE,
    deadlineLabel: `Day ${DEADLINE}`,
    constraints: ["Net spend ≤ €40,000", "Deliver by Day 14", "Never ship irreversibly on a rumour"],
    successCriteria: ["500 units delivered by Day 14"],
  },
  horizon: 16,
  lanes: [
    { id: "baseline", label: "Static agent", blurb: "Executes its original plan to the end. No world model." },
    { id: "adaptive", label: "Adaptive agent", blurb: "Watches its assumptions and revises behind a safety gate." },
  ],
  clock: (t) => `Day ${t}`,
  truth: truth0,
  knowledge: { ...truth0 },
  assumptions,
  plan,
  timeline: [
    { tick: 2, world: "Fuel price index rises 2% (irrelevant to the plan).", signals: [{ key: "fuel.index", value: 1.02, source: "market-feed", reliability: 0.8 }] },
    { tick: 4, world: "S1 reports a production fault: only 320 units can ship.", truth: { "supplier.S1.stock": 320 }, signals: [{ key: "supplier.S1.stock", value: 320, source: "supplier-feed", reliability: 0.95 }] },
    { tick: 6, world: "Rotterdam dockworkers go on strike (indefinite).", truth: { "port.rotterdam.status": "strike" }, signals: [{ key: "port.rotterdam.status", value: "strike", source: "port-authority", reliability: 0.97 }] },
    { tick: 9, world: "Customs backlog adds one day to clearance.", truth: { "customs.delay": 1 }, signals: [{ key: "customs.delay", value: 1, source: "customs-feed", reliability: 0.9 }] },
  ],
  presets,
  canExecute,
  outcome,
  costAdjust,
  repair,
};


