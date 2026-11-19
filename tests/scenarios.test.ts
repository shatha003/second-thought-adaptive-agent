import { describe, expect, it } from "vitest";
import { lane, runToEnd } from "./helpers";

describe("Scenario A: Keynote to Lisbon", () => {
  it("static baseline fails SILENTLY: every step green, mission failed", async () => {
    const { run } = await runToEnd("lisbon");
    const b = lane(run, "baseline");
    expect(b.score?.verdict).toBe("silent-failure");
    expect(b.score?.stepsFailed).toBe(0);
    expect(b.score?.stepsDone).toBe(b.score?.stepsTotal);
    expect(b.score?.allMet).toBe(false);
    expect(b.journal).toHaveLength(0); // it never even noticed
  });

  it("adaptive agent re-plans twice (replan, then patch) and achieves the mission", async () => {
    const { run } = await runToEnd("lisbon");
    const a = lane(run, "adaptive");
    expect(a.score?.verdict).toBe("achieved");
    const revs = a.journal.filter((j) => j.revision?.decision === "adopted").map((j) => j.revision!);
    expect(revs.map((r) => r.level)).toEqual([3, 2]);
    expect(revs[0].trigger.statement).toMatch(/LH1234/);
    expect(revs[0].chosenId).toBe("tp505");
    // alternatives are on the record, with reasons
    expect(revs[0].options.find((o) => o.id === "rail")?.failing.join()).toMatch(/Lisbon by/);
    expect(a.score?.netCost).toBeLessThanOrEqual(1200);
  });

  it("irrelevant signals are ignored, not acted on", async () => {
    const { run } = await runToEnd("lisbon");
    const a = lane(run, "adaptive");
    expect(a.journal.some((j) => j.kind === "noise" && /weather/.test(j.headline))).toBe(true);
  });

  it("stale assumptions are re-verified, not re-planned", async () => {
    const { run } = await runToEnd("lisbon");
    const a = lane(run, "adaptive");
    expect(a.journal.some((j) => j.kind === "verify" && /visa/.test(j.headline))).toBe(true);
  });
});

describe("Scenario B: 500 units by Friday", () => {
  it("baseline ships nothing yet reports all green", async () => {
    const { run } = await runToEnd("fulfilment");
    const b = lane(run, "baseline");
    expect(b.score?.verdict).toBe("silent-failure");
    expect(b.score?.criteria.find((c) => c.id === "units")?.detail).toBe("0/500 units");
  });

  it("adaptive patches (L2), re-routes (L3) and ABSORBS the harmless customs delay", async () => {
    const { run } = await runToEnd("fulfilment");
    const a = lane(run, "adaptive");
    expect(a.score?.verdict).toBe("achieved");
    expect(a.journal.filter((j) => j.revision?.decision === "adopted").map((j) => j.revision!.level)).toEqual([2, 3]);
    expect(a.journal.some((j) => j.kind === "absorbed" && /Customs/.test(j.headline))).toBe(true);
    // The air-freight option was priced and rejected on the contract, not on vibes.
    const antwerp = a.journal.find((j) => j.revision?.chosenId === "antwerp")!.revision!;
    expect(antwerp.options.find((o) => o.id === "air")?.failing.join()).toMatch(/Spend within/);
  });
});

describe("Failure test: Phantom Alarm (adaptation goes wrong, contained)", () => {
  it("UNGUARDED agent overreacts to a rumour and a flapping feed and breaches the budget", async () => {
    const { run } = await runToEnd("phantom");
    const u = lane(run, "unguarded");
    expect(u.revisionsUsed).toBeGreaterThanOrEqual(3);
    expect(u.score?.verdict).toBe("breached");
    expect(u.score!.netCost).toBeGreaterThan(1200);
    // the rumour caused a non-refundable loss
    expect(u.steps.find((s) => s.title.startsWith("Claim refund: Book flight LH1234"))?.cost).toBe(0);
  });

  it("GUARDED agent dismisses the rumour via a probe, makes no revision for it", async () => {
    const { run } = await runToEnd("phantom");
    const g = lane(run, "adaptive");
    expect(g.journal.some((j) => j.kind === "verify" && /False alarm dismissed: flight/.test(j.headline))).toBe(true);
    expect(g.steps.some((s) => s.id.includes("TP505"))).toBe(false);
  });

  it("GUARDED agent detects the flapping feed and stops trusting it", async () => {
    const { run } = await runToEnd("phantom");
    const g = lane(run, "adaptive");
    expect(g.journal.some((j) => j.kind === "guard" && /Flapping feed/.test(j.headline))).toBe(true);
    expect(g.steps.some((s) => s.id.includes("taxi"))).toBe(false);
  });

  it("GATE rejects the over-budget proposal and falls back to an affordable option", async () => {
    const { run } = await runToEnd("phantom");
    const g = lane(run, "adaptive");
    const rev = g.journal.find((j) => j.revision?.decision === "adopted")!.revision!;
    expect(rev.chosenId).toBe("baixa");
    const rooftop = rev.options.find((o) => o.id === "rooftop")!;
    expect(rooftop.verdict).toBe("rejected");
    expect(rooftop.reason).toMatch(/Contract/);
  });

  it("when nothing affordable remains it ESCALATES to a human and keeps the contract intact", async () => {
    const { run } = await runToEnd("phantom");
    const g = lane(run, "adaptive");
    expect(g.status).toBe("holding");
    expect(g.escalation?.optionId).toBe("rooftop");
    expect(g.score?.verdict).toBe("contained");
    expect(g.score!.netCost).toBeLessThanOrEqual(1200);
  });
});

describe("Event-driven injection", () => {
  it("an injected real cancellation triggers adaptation in the next tick", async () => {
    const { run } = await runToEnd("lisbon", { 4: ["cancel-flight"] });
    const a = lane(run, "adaptive");
    expect(run.world.some((w) => w.injected)).toBe(true);
    expect(a.journal.some((j) => /LH1234/.test(j.headline) && j.tick === 4)).toBe(true);
  });
});
