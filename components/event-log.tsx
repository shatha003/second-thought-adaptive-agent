"use client";

import type { RunEvent } from "@/lib/domain/types";

const LANE = { baseline: "baseline", adaptive: "guarded", unguarded: "unguarded" } as const;

/** The full append-only event log. Nothing the agents do is hidden from it. */
export function EventLog({ events }: { events: RunEvent[] }) {
  return (
    <details className="rounded-[var(--radius)] border border-line bg-panel">
      <summary className="cursor-pointer select-none px-4 py-3 text-[13px] font-semibold">
        Event log <span className="ml-1 font-mono text-[12px] font-normal text-muted">{events.length} events</span>
      </summary>
      <div className="scroll-thin max-h-72 overflow-y-auto border-t border-line px-4 py-2 font-mono text-[11.5px]">
        {events.length === 0 ? (
          <p className="py-2 text-muted">No events yet.</p>
        ) : (
          <table className="w-full border-separate border-spacing-y-0.5">
            <tbody>
              {[...events].reverse().map((e) => (
                <tr key={e.seq} className="align-top">
                  <td className="w-10 pr-2 text-muted">t{e.tick}</td>
                  <td className="w-20 pr-2 text-muted">{e.lane ? LANE[e.lane] : "world"}</td>
                  <td className="w-20 pr-2 text-accent">{e.type}</td>
                  <td className="text-fg">{e.message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </details>
  );
}
