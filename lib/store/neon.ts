import { neon } from "@neondatabase/serverless";
import type { RunEvent, RunState } from "@/lib/domain/types";
import type { Store } from "./index";

/** Postgres store (Neon). Snapshot + append-only event log; optimistic concurrency on `version`. */
export function neonStore(url: string): Store {
  const sql = neon(url);
  let ready: Promise<void> | undefined;

  const bootstrap = () =>
    (ready ??= (async () => {
      await sql`CREATE TABLE IF NOT EXISTS runs (
        id text PRIMARY KEY,
        scenario text NOT NULL,
        planner text NOT NULL,
        status text NOT NULL,
        version integer NOT NULL DEFAULT 0,
        snapshot jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS events (
        run_id text NOT NULL,
        seq integer NOT NULL,
        tick integer NOT NULL,
        lane text,
        type text NOT NULL,
        level integer,
        message text NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (run_id, seq)
      )`;
    })());

  return {
    kind: "neon",
    async create(run) {
      await bootstrap();
      await sql`INSERT INTO runs (id, scenario, planner, status, version, snapshot)
                VALUES (${run.id}, ${run.scenarioId}, ${run.planner}, ${run.status}, ${run.version}, ${JSON.stringify(run)}::jsonb)`;
    },
    async get(id) {
      await bootstrap();
      const rows = await sql`SELECT snapshot, version FROM runs WHERE id = ${id}`;
      if (!rows.length) return null;
      const run = rows[0].snapshot as RunState;
      run.version = rows[0].version as number;
      return run;
    },
    async save(run, events, expectedVersion) {
      await bootstrap();
      const next = expectedVersion + 1;
      run.version = next;
      const rows = await sql`UPDATE runs
        SET snapshot = ${JSON.stringify(run)}::jsonb, status = ${run.status}, version = ${next}, updated_at = now()
        WHERE id = ${run.id} AND version = ${expectedVersion}
        RETURNING version`;
      if (!rows.length) {
        run.version = expectedVersion;
        return false;
      }
      if (events.length) {
        await sql`INSERT INTO events (run_id, seq, tick, lane, type, level, message)
          SELECT ${run.id}, e.seq, e.tick, e.lane, e.type, e.level, e.message
          FROM jsonb_to_recordset(${JSON.stringify(events)}::jsonb)
            AS e(seq int, tick int, lane text, type text, level int, message text)
          ON CONFLICT DO NOTHING`;
      }
      return true;
    },
    async events(id) {
      await bootstrap();
      const rows = await sql`SELECT seq, tick, lane, type, level, message FROM events WHERE run_id = ${id} ORDER BY seq`;
      return rows.map((r) => ({
        seq: r.seq as number,
        tick: r.tick as number,
        lane: (r.lane ?? undefined) as RunEvent["lane"],
        type: r.type as string,
        level: (r.level ?? undefined) as RunEvent["level"],
        message: r.message as string,
      }));
    },
  };
}
