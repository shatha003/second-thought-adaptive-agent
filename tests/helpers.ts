import { advance, createRun } from "@/lib/engine/loop";
import type { Lane, LaneKind, RunEvent, RunState } from "@/lib/domain/types";

export async function runToEnd(scenarioId: string, inject: Record<number, string[]> = {}) {
  const run = createRun(scenarioId);
  const events: RunEvent[] = [];
  while (run.status !== "finished") {
    const next = run.tick + 1;
    if (inject[next]) run.pendingInjections.push(...inject[next]);
    events.push(...(await advance(run)));
  }
  return { run, events };
}

export const lane = (run: RunState, id: LaneKind): Lane => run.lanes.find((l) => l.id === id)!;
