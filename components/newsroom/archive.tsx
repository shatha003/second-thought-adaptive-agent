"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { RunEvent } from "@/lib/domain/types";

const DESK = { baseline: "STATIC", adaptive: "GUARDED", unguarded: "UNGUARDED" } as const;

/** The complete, append-only event log, typed out like a teleprinter roll. */
export function Archive({ events }: { events: RunEvent[] }) {
  const [open, setOpen] = useState(false);
  const shown = events.filter((e) => e.type !== "tick");
  return (
    <section className="border-t-2 border-ink pt-3">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full flex-wrap items-baseline gap-x-4 text-left">
        <span className="font-serif text-[28px] font-extrabold italic hover:text-red">From the archive {open ? "−" : "+"}</span>
        <span className="font-type text-[12px] uppercase tracking-wider text-ink2">
          the full record: {shown.length} entries, append-only, stored in Postgres
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="scroll-thin mt-3 max-h-80 overflow-y-auto font-type text-[12.5px] leading-relaxed">
              {shown.length === 0 ? (
                <p className="text-ink2">Nothing on file yet.</p>
              ) : (
                [...shown].reverse().map((e) => (
                  <p key={e.seq} className="grid grid-cols-[40px_88px_96px_1fr] gap-2 border-b border-dashed border-ink/15 py-0.5">
                    <span className="text-ink2">T{e.tick}</span>
                    <span className="text-ink2">{e.lane ? DESK[e.lane] : "WIRE"}</span>
                    <span className={e.type === "revision" || e.type === "escalation" || e.type === "approval" || e.type === "gate" ? "font-bold text-red" : e.type === "verify" ? "text-blue" : "text-ink2"}>
                      {e.type.toUpperCase()}
                    </span>
                    <span>{e.message}</span>
                  </p>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
