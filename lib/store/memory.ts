import type { RunEvent, RunState } from "@/lib/domain/types";
import type { Store } from "./index";

interface Bucket {
  runs: Map<string, RunState>;
  events: Map<string, RunEvent[]>;
}

const g = globalThis as unknown as { __secondThoughtMem?: Bucket };

/** In-process store for local dev and tests. Survives hot reloads, not restarts. */
export function memoryStore(): Store {
  const b = (g.__secondThoughtMem ??= { runs: new Map(), events: new Map() });
  return {
    kind: "memory",
    async create(run) {
      b.runs.set(run.id, structuredClone(run));
      b.events.set(run.id, []);
    },
    async get(id) {
      const r = b.runs.get(id);
      return r ? structuredClone(r) : null;
    },
    async save(run, events, expectedVersion) {
      const cur = b.runs.get(run.id);
      if (!cur || cur.version !== expectedVersion) return false;
      run.version = expectedVersion + 1;
      b.runs.set(run.id, structuredClone(run));
      b.events.get(run.id)?.push(...structuredClone(events));
      return true;
    },
    async events(id) {
      return structuredClone(b.events.get(id) ?? []);
    },
  };
}
