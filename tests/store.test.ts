import { describe, expect, it } from "vitest";
import { advance, createRun, humanApprove } from "@/lib/engine/loop";
import { memoryStore } from "@/lib/store/memory";
import { lane, runToEnd } from "./helpers";

describe("persistence", () => {
  it("saves are optimistic: a stale writer is rejected", async () => {
    const store = memoryStore();
    const run = createRun("lisbon");
    await store.create(run);
    const a = (await store.get(run.id))!;
    const b = (await store.get(run.id))!;
    const base = a.version;
    expect(await store.save(a, await advance(a), base)).toBe(true);
    expect(await store.save(b, await advance(b), base)).toBe(false);
    expect((await store.get(run.id))!.tick).toBe(1);
  });

  it("a run resumed from its persisted snapshot every tick matches an uninterrupted run", async () => {
    const store = memoryStore();
    const run = createRun("fulfilment");
    await store.create(run);
    for (let i = 0; i < 16; i++) {
      const cur = (await store.get(run.id))!; // fresh load each tick = pause/resume
      const base = cur.version;
      await store.save(cur, await advance(cur), base);
    }
    const resumed = (await store.get(run.id))!;
    const straight = (await runToEnd("fulfilment")).run;
    expect(lane(resumed, "adaptive").score).toEqual(lane(straight, "adaptive").score);
    expect((await store.events(run.id)).length).toBeGreaterThan(20);
  });
});

describe("human in the loop", () => {
  it("approving the held option adopts it, logs the override, and finishes the mission", async () => {
    const run = createRun("phantom");
    while (run.tick < 13) await advance(run);
    const g = lane(run, "adaptive");
    expect(g.status).toBe("holding");
    humanApprove(run, "adaptive");
    expect(g.status).toBe("running");
    expect(g.journal.at(-1)?.revision?.decision).toBe("human-approved");
    while (run.status !== "finished") await advance(run);
    // approved the luxury hotel: lodging solved, budget knowingly exceeded
    expect(g.score?.criteria.find((c) => c.id === "lodging")?.ok).toBe(true);
    expect(g.score?.verdict).toBe("breached");
  });
});
