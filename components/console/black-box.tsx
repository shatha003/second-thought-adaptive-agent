"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CaretRight } from "@phosphor-icons/react";
import type { RunEvent } from "@/lib/domain/types";

const LANE = { baseline: "STATIC", adaptive: "GUARDED", unguarded: "UNGUARDED" } as const;
const TONE: Record<string, string> = {
  revision: "text-signal",
  escalation: "text-stop",
  approval: "text-stop",
  gate: "text-stop",
  verify: "text-go",
  score: "text-paper",
  world: "text-paper",
};

/** The flight recorder: the complete append-only event log. Nothing the agents do is hidden from it. */
export function BlackBox({ events }: { events: RunEvent[] }) {
  const [open, setOpen] = useState(false);
  const shown = events.filter((e) => e.type !== "tick");
  return (
    <section className="rounded-2xl border border-line bg-ink">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-5 py-4 text-left">
        <CaretRight size={14} className={`text-dim transition-transform ${open ? "rotate-90" : ""}`} />
        <span className="font-display text-[22px] font-black uppercase leading-none">Flight recorder</span>
        <span className="font-mono text-[10.5px] text-dim">{shown.length} events, append-only, persisted</span>
        <span className="caret ml-auto h-3.5 w-2 bg-signal" />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="scroll-thin max-h-80 overflow-y-auto border-t border-line px-5 py-3 font-mono text-[11.5px] leading-relaxed">
              {shown.length === 0 ? (
                <p className="text-dim">&gt; waiting for the first event</p>
              ) : (
                [...shown].reverse().map((e) => (
                  <p key={e.seq} className="grid grid-cols-[42px_84px_92px_1fr] gap-2">
                    <span className="text-dim">T{e.tick}</span>
                    <span className="text-dim">{e.lane ? LANE[e.lane] : "WORLD"}</span>
                    <span className={TONE[e.type] ?? "text-dim"}>{e.type.toUpperCase()}</span>
                    <span className="text-paper/85">{e.message}</span>
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
