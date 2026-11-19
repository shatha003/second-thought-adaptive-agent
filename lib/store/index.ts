import type { RunEvent, RunState } from "@/lib/domain/types";
import { memoryStore } from "./memory";
import { neonStore } from "./neon";

/**
 * Persistence contract. State is a versioned snapshot plus an append-only event log.
 * `save` is optimistic: it only succeeds if nobody else advanced the run since `expectedVersion`.
 */
export interface Store {
  kind: "neon" | "memory";
  create(run: RunState): Promise<void>;
  get(id: string): Promise<RunState | null>;
  save(run: RunState, events: RunEvent[], expectedVersion: number): Promise<boolean>;
  events(id: string): Promise<RunEvent[]>;
}

let instance: Store | undefined;

export function getStore(): Store {
  if (!instance) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    instance = url ? neonStore(url) : memoryStore();
  }
  return instance;
}

/** Read-modify-write with retry on version conflicts (used for injections and approvals). */
export async function mutate(id: string, fn: (run: RunState) => RunEvent[] | Promise<RunEvent[]>): Promise<RunState | null> {
  const store = getStore();
  for (let i = 0; i < 5; i++) {
    const run = await store.get(id);
    if (!run) return null;
    const base = run.version;
    const events = await fn(run);
    if (await store.save(run, events, base)) return run;
  }
  throw new Error("Could not update run (too many concurrent writers)");
}
