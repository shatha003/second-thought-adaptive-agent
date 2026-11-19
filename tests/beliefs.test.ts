import { describe, expect, it } from "vitest";
import { evaluateAssumption, ingest } from "@/lib/engine/beliefs";
import { GUARDED, UNGUARDED } from "@/lib/engine/policy";
import type { AssumptionRT, Belief, Signal } from "@/lib/domain/types";

const base: Belief = { value: "on_time", source: "initial-survey", reliability: 0.9, tick: 0, reports: [] };
const sig = (value: string | boolean, source: string, reliability: number, tick = 1): Signal => ({
  id: "x",
  tick,
  key: "k",
  value,
  source,
  reliability,
});
const a: AssumptionRT = {
  id: "a",
  statement: "on time",
  key: "k",
  op: "eq",
  value: "on_time",
  criticality: "critical",
  state: "holding",
  since: 0,
  handled: false,
};

describe("belief ingestion", () => {
  it("a weak contradiction is held pending, not believed", () => {
    const { belief, result } = ingest(base, sig("cancelled", "social", 0.4), GUARDED, 1);
    expect(result.kind).toBe("pending");
    expect(belief.value).toBe("on_time");
    expect(evaluateAssumption(a, belief, 1)).toBe("weakened");
  });

  it("an authoritative contradiction is accepted immediately", () => {
    const { belief } = ingest(base, sig("cancelled", "airline", 0.97), GUARDED, 1);
    expect(belief.value).toBe("cancelled");
    expect(evaluateAssumption(a, belief, 1)).toBe("violated");
  });

  it("two independent weak sources corroborate each other", () => {
    const one = ingest(base, sig("cancelled", "aggregator", 0.75), GUARDED, 1).belief;
    const two = ingest(one, sig("cancelled", "social", 0.6, 2), GUARDED, 2);
    expect(two.result.kind).toBe("corroborated");
    expect(two.belief.value).toBe("cancelled");
  });

  it("the same source repeating itself is NOT corroboration", () => {
    const one = ingest(base, sig("cancelled", "aggregator", 0.75), GUARDED, 1).belief;
    const two = ingest(one, sig("cancelled", "aggregator", 0.75, 2), GUARDED, 2);
    expect(two.result.kind).toBe("pending");
  });

  it("a retraction clears the pending contradiction", () => {
    const one = ingest(base, sig("cancelled", "aggregator", 0.75), GUARDED, 1).belief;
    const two = ingest(one, sig("on_time", "aggregator", 0.75, 2), GUARDED, 2);
    expect(two.result.kind).toBe("dismissed");
    expect(evaluateAssumption(a, two.belief, 2)).toBe("holding");
  });

  it("a flapping feed is marked unstable and cannot move beliefs on its own", () => {
    let b = base;
    for (const [v, t] of [["cancelled", 1], ["on_time", 2], ["cancelled", 3]] as const) {
      b = ingest(b, sig(v, "agg", 0.75, t), GUARDED, t).belief;
    }
    expect(b.unstable).toBe(true);
    expect(b.value).toBe("on_time");
  });

  it("with guards off, any single report rewrites the belief (the failure mode)", () => {
    const { belief } = ingest(base, sig("cancelled", "social", 0.4), UNGUARDED, 1);
    expect(belief.value).toBe("cancelled");
  });

  it("an authoritative probe clears instability", () => {
    let b = base;
    for (const [v, t] of [["cancelled", 1], ["on_time", 2], ["cancelled", 3]] as const) {
      b = ingest(b, sig(v, "agg", 0.75, t), GUARDED, t).belief;
    }
    b = ingest(b, sig("on_time", "probe", 1, 4), GUARDED, 4).belief;
    expect(b.unstable).toBe(false);
  });

  it("stale beliefs are flagged so they get re-verified", () => {
    const stale: AssumptionRT = { ...a, ttl: 5 };
    expect(evaluateAssumption(stale, base, 6)).toBe("stale");
  });
});
