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
  TimelineItem,
} from "@/lib/domain/types";
import { liveSteps } from "@/lib/engine/plan";
import { assume, seed } from "./helpers";

export const DEADLINE = 18;
const TRAVEL = ["flight", "rail", "charter"];

export function clockLisbon(t: number): string {
  const h = 9 + 4 * t;
  const day = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][Math.floor(h / 24) % 7];
  return `${day} ${String(h % 24).padStart(2, "0")}:00`;
}

export const truth0: Facts = {
  "flight.LH1234.status": "on_time",
  "flight.TP505.status": "on_time",
  "flight.LH1236.status": "on_time",
  "rail.LX77.status": "on_time",
  "charter.CH1.status": "on_time",
  "hotel.alfama.rooms": 3,
  "hotel.baixa.rooms": 5,
  "hotel.rooftop.rooms": 2,
  "visa.required": false,
  "transfer.available": true,
};

const baseAssumptions = [
  assume({ id: "a-flight-LH1234", statement: "Flight LH1234 operates on time", key: "flight.LH1234.status", op: "eq", value: "on_time" }),
  assume({ id: "a-hotel-alfama", statement: "Hotel Alfama still has our room", key: "hotel.alfama.rooms", op: "gte", value: 1 }),
  assume({ id: "a-visa", statement: "Speaker needs no visa", key: "visa.required", op: "eq", value: false, criticality: "important", ttl: 10 }),
  assume({ id: "a-transfer", statement: "Airport transfer service is running", key: "transfer.available", op: "eq", value: true, criticality: "important" }),
];

const basePlan: StepSeed[] = [
  seed({ id: "s1", title: "Book flight LH1234 (arr Wed 21:00)", kind: "commit", args: { type: "flight", id: "LH1234", arrive: 15 }, cost: 420, reversible: false, assumptions: ["a-flight-LH1234", "a-visa"] }),
  seed({ id: "s2", title: "Reserve Hotel Alfama", kind: "commit", args: { type: "hotel", id: "alfama" }, cost: 380, assumptions: ["a-hotel-alfama"] }),
  seed({ id: "s3", title: "Book airport transfer for arrival", kind: "commit", args: { type: "transfer", id: "T1", at: 15 }, cost: 60, deps: ["s1"], assumptions: ["a-flight-LH1234", "a-transfer"] }),
  seed({ id: "s4", title: "Send itinerary to speaker", kind: "notify", deps: ["s1", "s2", "s3"] }),
  seed({ id: "s5", title: "Confirm pickup with driver", kind: "confirm", notBefore: 12, deps: ["s3"], assumptions: ["a-flight-LH1234", "a-transfer"] }),
  seed({ id: "s6", title: "Hotel check-in & keynote AV prep", kind: "confirm", notBefore: 16, deps: ["s2"], assumptions: ["a-hotel-alfama"] }),
];

/* ───────────────────────────── repair generators ───────────────────────────── */

function currentArrival(steps: Step[]): number {
  const t = liveSteps(steps, "plan").filter((s) => TRAVEL.includes(String(s.args.type)));
  return t.length ? Math.min(...t.map((s) => Number(s.args.arrive))) : DEADLINE;
}

function cancelFor(old: Step, trigger: { key: string }, version: number, ifFalse: number, value: Json = "cancelled"): StepSeed {
  return seed({
    id: `cancel-${old.id}-v${version}`,
    title: `Claim refund: ${old.title}`,
    kind: "cancel",
    cost: -old.cost,
    settle: { key: trigger.key, value, ifTrue: old.cost, ifFalse },
  });
}

export function repairLisbon(ctx: RepairContext): RepairOption[] {
  const { version: v, trigger, lane } = ctx;
  const dependents = ctx.dependents;
  const dropIds = dependents.map((s) => s.id);

  /* flight cancelled → re-route */
  if (trigger.id.startsWith("a-flight-")) {
    const oldTravel = dependents.find((s) => TRAVEL.includes(String(s.args.type)));
    const oldTransfer = dependents.find((s) => s.args.type === "transfer");
    const comp: StepSeed[] = [];
    if (oldTravel?.status === "done") comp.push(cancelFor(oldTravel, trigger, v, oldTravel.reversible ? oldTravel.cost : 0));
    if (oldTransfer?.status === "done") comp.push({ ...cancelFor(oldTransfer, trigger, v, 40), cost: -40, settle: { key: trigger.key, value: "cancelled", ifTrue: 40, ifFalse: 40 } });

    const cands = [
      { id: "tp505", label: "Fly TAP TP505 + new transfer", type: "flight", ref: "TP505", arrive: 17, cost: 340, q: 6, irrev: true, detail: "Next available flight, 3 seats left. Lands Thu 05:00, four hours of slack." },
      { id: "rail", label: "Rail via Madrid (LX77)", type: "rail", ref: "LX77", arrive: 19, cost: 210, q: 4, irrev: false, detail: "Cheap and reliable, but arrives Thu 13:00, after the keynote." },
      { id: "wait", label: "Wait for LH next-day rebooking", type: "flight", ref: "LH1236", arrive: 21, cost: 0, q: 2, irrev: false, detail: "Free rebooking, but lands Thu 21:00." },
      { id: "charter", label: "Private charter jet", type: "charter", ref: "CH1", arrive: 16, cost: 2400, q: 10, irrev: true, detail: "Fastest and most comfortable. Lands Thu 01:00." },
    ];
    return cands.map((c) => {
      const trav = `trav-${c.ref}-v${v}`;
      const xfer = `xfer-${c.ref}-v${v}`;
      return {
        id: c.id,
        label: c.label,
        detail: c.detail,
        level: 3 as const,
        quality: c.q,
        dropStepIds: dropIds,
        addSteps: [
          ...comp,
          seed({ id: trav, title: `Book ${c.type === "charter" ? "charter" : c.type} ${c.ref} (arr ${clockLisbon(c.arrive)})`, kind: "commit", args: { type: c.type, id: c.ref, arrive: c.arrive }, cost: c.cost, reversible: !c.irrev, assumptions: [`a-${c.type}-${c.ref}`] }),
          seed({ id: xfer, title: `Re-book airport transfer for ${clockLisbon(c.arrive)}`, kind: "commit", args: { type: "transfer", id: `T-${c.ref}`, at: c.arrive }, cost: 60, deps: [trav], assumptions: ["a-transfer"] }),
          seed({ id: `itin-${c.ref}-v${v}`, title: "Send updated itinerary", kind: "notify", deps: [trav, xfer] }),
          seed({ id: `pick-${c.ref}-v${v}`, title: "Confirm new pickup with driver", kind: "confirm", notBefore: Math.max(c.arrive - 1, ctx.tick + 1), deps: [xfer], assumptions: [`a-${c.type}-${c.ref}`, "a-transfer"] }),
        ],
        addAssumptions: [assume({ id: `a-${c.type}-${c.ref}`, statement: `${c.type === "charter" ? "Charter" : c.type === "rail" ? "Train" : "Flight"} ${c.ref} operates`, key: `${c.type}.${c.ref}.status`, op: "eq", value: "on_time" })],
        retireAssumptionIds: [trigger.id],
      };
    });
  }

  /* hotel sold out → re-lodge */
  if (trigger.id.startsWith("a-hotel-")) {
    const oldHotel = dependents.find((s) => s.args.type === "hotel");
    const comp: StepSeed[] = [];
    if (oldHotel?.status === "done") comp.push(cancelFor(oldHotel, trigger, v, oldHotel.cost * 0.5, 0));
    const failedId = trigger.key.split(".")[1];
    const cands = [
      { id: "baixa", name: "Hotel Baixa", cost: 300, q: 6, detail: "Mid-range, 10 minutes from the venue." },
      { id: "rooftop", name: "Rooftop Palace", cost: 900, q: 9, detail: "Five-star, next to the venue." },
    ].filter((c) => c.id !== failedId);
    return cands.map((c) => ({
      id: c.id,
      label: `Move to ${c.name}`,
      detail: c.detail,
      level: 2 as const,
      quality: c.q,
      dropStepIds: dropIds,
      addSteps: [
        ...comp,
        seed({ id: `hotel-${c.id}-v${v}`, title: `Reserve ${c.name}`, kind: "commit", args: { type: "hotel", id: c.id }, cost: c.cost, assumptions: [`a-hotel-${c.id}`] }),
        seed({ id: `checkin-${c.id}-v${v}`, title: `Check-in & AV prep at ${c.name}`, kind: "confirm", notBefore: 16, deps: [`hotel-${c.id}-v${v}`], assumptions: [`a-hotel-${c.id}`] }),
      ],
      addAssumptions: [assume({ id: `a-hotel-${c.id}`, statement: `${c.name} has our room`, key: `hotel.${c.id}.rooms`, op: "gte", value: 1 })],
      retireAssumptionIds: [trigger.id],
    }));
  }

  /* transfer service down → alternative ground transport */
  if (trigger.id === "a-transfer") {
    const oldTransfer = dependents.find((s) => s.args.type === "transfer");
    const oldConfirm = dependents.find((s) => s.kind === "confirm");
    const arrive = currentArrival(lane.steps);
    const comp: StepSeed[] = oldTransfer?.status === "done"
      ? [{ ...cancelFor(oldTransfer, trigger, v, 40, false), cost: -40, settle: { key: trigger.key, value: false, ifTrue: 40, ifFalse: 40 } }]
      : [];
    const carry = (oldConfirm?.assumptions ?? []).filter((x) => x !== trigger.id);
    return [
      { id: "taxi", label: "Pre-booked taxi", detail: "Independent of the shuttle service.", cost: 90, q: 7 },
      { id: "rideshare", label: "Rideshare pickup", detail: "Cheaper, less predictable.", cost: 70, q: 4 },
    ].map((c) => ({
      id: c.id,
      label: c.label,
      detail: c.detail,
      level: 2 as const,
      quality: c.q,
      dropStepIds: dropIds,
      addSteps: [
        ...comp,
        seed({ id: `xfer-${c.id}-v${v}`, title: `Book ${c.label.toLowerCase()} for ${clockLisbon(arrive)}`, kind: "commit", args: { type: "transfer", id: c.id, at: arrive }, cost: c.cost }),
        seed({ id: `pick-${c.id}-v${v}`, title: `Confirm ${c.label.toLowerCase()} pickup`, kind: "confirm", notBefore: Math.max(arrive - 1, ctx.tick + 1), deps: [`xfer-${c.id}-v${v}`], assumptions: carry }),
      ],
      addAssumptions: [],
      retireAssumptionIds: [trigger.id],
    }));
  }

  return [];
}

/* ───────────────────────────── outcome model ───────────────────────────── */

export function outcomeLisbon(facts: Facts, steps: Step[], mode: "plan" | "truth"): Criterion[] {
  const live = liveSteps(steps, mode);
  const legs = live
    .filter((s) => TRAVEL.includes(String(s.args.type)) && facts[`${s.args.type}.${s.args.id}.status`] === "on_time")
    .map((s) => Number(s.args.arrive));
  const arrive = legs.length ? Math.min(...legs) : Infinity;
  const hotel = live.find((s) => s.args.type === "hotel" && Number(facts[`hotel.${s.args.id}.rooms`]) >= 1);
  const pickup = Number.isFinite(arrive)
    ? live.find((s) => s.args.type === "transfer" && Number(s.args.at) === arrive && (["taxi", "rideshare"].includes(String(s.args.id)) || facts["transfer.available"] !== false))
    : undefined;
  return [
    {
      id: "arrival",
      label: `Speaker in Lisbon by ${clockLisbon(DEADLINE)}`,
      ok: arrive <= DEADLINE,
      hard: true,
      detail: Number.isFinite(arrive) ? `lands ${clockLisbon(arrive)}` : "no working travel leg",
    },
    { id: "lodging", label: "Confirmed accommodation", ok: !!hotel, hard: false, detail: hotel ? String(hotel.title) : "none valid" },
    { id: "pickup", label: "Airport pickup matches arrival", ok: !!pickup, hard: false, detail: pickup ? String(pickup.title) : "no matching pickup" },
  ];
}

export function canExecuteLisbon(truth: Facts, step: Step): { ok: boolean; reason?: string; signal?: { key: string; value: Json } } {
  if (step.kind !== "commit") return { ok: true };
  const type = String(step.args.type);
  const id = String(step.args.id);
  if (TRAVEL.includes(type)) {
    const key = `${type}.${id}.status`;
    if (truth[key] === "cancelled") return { ok: false, reason: `${id} is cancelled`, signal: { key, value: "cancelled" } };
  }
  if (type === "hotel") {
    const key = `hotel.${id}.rooms`;
    if (Number(truth[key]) < 1) return { ok: false, reason: "no rooms left", signal: { key, value: 0 } };
  }
  if (type === "transfer" && !["taxi", "rideshare"].includes(id) && truth["transfer.available"] === false) {
    return { ok: false, reason: "transfer service is down", signal: { key: "transfer.available", value: false } };
  }
  return { ok: true };
}

/* ───────────────────────────── timelines & presets ───────────────────────────── */

export const presets: Preset[] = [
  { id: "cancel-flight", label: "Airline cancels LH1234", description: "Real change, authoritative source", item: { world: "Airline cancels LH1234 (fog at origin).", truth: { "flight.LH1234.status": "cancelled" }, signals: [{ key: "flight.LH1234.status", value: "cancelled", source: "airline-feed", reliability: 0.97 }] } },
  { id: "rumour-flight", label: "Rumour: LH1234 cancelled", description: "False alarm from a social feed", item: { world: "A social-media rumour claims LH1234 is cancelled. It is not.", signals: [{ key: "flight.LH1234.status", value: "cancelled", source: "social-feed", reliability: 0.4 }] } },
  { id: "hotel-full", label: "Hotel Alfama overbooked", description: "Real change, authoritative source", item: { world: "Hotel Alfama overbooks; our reservation is voided.", truth: { "hotel.alfama.rooms": 0 }, signals: [{ key: "hotel.alfama.rooms", value: 0, source: "hotel-feed", reliability: 0.95 }] } },
  { id: "transfer-down", label: "Transfer service goes down", description: "Real change, partner feed", item: { world: "The airport shuttle service suspends operations.", truth: { "transfer.available": false }, signals: [{ key: "transfer.available", value: false, source: "partner-feed", reliability: 0.92 }] } },
];

export const lisbonTimeline: TimelineItem[] = [
  { tick: 2, world: "Heavy rain forecast in Lisbon (irrelevant to the plan).", signals: [{ key: "weather.lisbon", value: "rain", source: "weather-feed", reliability: 0.8 }] },
  { tick: 7, world: "Airline cancels LH1234 (fog at origin).", truth: { "flight.LH1234.status": "cancelled" }, signals: [{ key: "flight.LH1234.status", value: "cancelled", source: "airline-feed", reliability: 0.97 }] },
  { tick: 8, world: "Flight aggregators now also show LH1234 as cancelled.", signals: [{ key: "flight.LH1234.status", value: "cancelled", source: "aggregator", reliability: 0.75 }] },
  { tick: 12, world: "Hotel Alfama overbooks; our reservation is voided.", truth: { "hotel.alfama.rooms": 0 }, signals: [{ key: "hotel.alfama.rooms", value: 0, source: "hotel-feed", reliability: 0.95 }] },
];

export const lisbon: Scenario = {
  id: "lisbon",
  title: "Keynote to Lisbon",
  tagline: "A flight is cancelled mid-plan. Every remaining step still “succeeds”.",
  domain: "Travel logistics",
  mission: {
    title: "Get the keynote speaker to Lisbon",
    brief: "Dana must be on stage in Lisbon on Thursday 09:00, with a room and an airport pickup, without overspending.",
    budget: 1200,
    currency: "€",
    deadline: DEADLINE,
    deadlineLabel: clockLisbon(DEADLINE),
    constraints: ["Net spend ≤ €1,200", "Arrive by Thu 09:00", "Irreversible bookings need trustworthy evidence"],
    successCriteria: ["Speaker in Lisbon in time", "Confirmed accommodation", "Airport pickup matches arrival"],
  },
  horizon: 19,
  lanes: [
    { id: "baseline", label: "Static agent", blurb: "Executes its original plan to the end. No world model." },
    { id: "adaptive", label: "Adaptive agent", blurb: "Watches its assumptions and revises behind a safety gate." },
  ],
  clock: clockLisbon,
  truth: truth0,
  knowledge: { ...truth0 },
  assumptions: baseAssumptions,
  plan: basePlan,
  timeline: lisbonTimeline,
  presets,
  canExecute: canExecuteLisbon,
  outcome: outcomeLisbon,
  repair: repairLisbon,
};
