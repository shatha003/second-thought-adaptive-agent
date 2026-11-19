"use client";

import { motion } from "motion/react";
import type { Scenario } from "@/lib/domain/types";
import { Flap } from "../ui/flap";

const CODE: Record<string, string> = { lisbon: "LIS", fulfilment: "500", phantom: "???" };

/** Scenario picker styled as boarding passes with a perforated stub. */
export function Tickets({ scenarios, active, onPick }: { scenarios: Scenario[]; active: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Scenario" className="scroll-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:grid sm:grid-cols-[1.15fr_1fr_1fr] sm:overflow-visible sm:px-0">
      {scenarios.map((s, i) => {
        const on = s.id === active;
        const failure = s.id === "phantom";
        return (
          <motion.button
            key={s.id}
            role="tab"
            aria-selected={on}
            onClick={() => onPick(s.id)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            animate={{ y: on ? -6 : 0 }}
            whileHover={{ y: on ? -6 : -3 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, delay: i * 0.05 }}
            className={`relative flex min-w-[280px] snap-start overflow-hidden rounded-2xl border text-left transition-colors sm:min-w-0 ${
              on ? (failure ? "border-stop bg-stop/[0.07]" : "border-signal bg-signal/[0.07]") : "border-line bg-ink2 hover:border-paper/25"
            }`}
          >
            <div className="flex flex-col justify-between gap-6 p-4">
              <div>
                <p className={`font-mono text-[10.5px] font-bold tracking-wider ${failure ? "text-stop" : on ? "text-signal" : "text-dim"}`}>
                  {failure ? "FAILURE TEST" : s.domain.toUpperCase()}
                </p>
                <p className="mt-1.5 font-display text-[23px] font-black uppercase leading-[0.95]">{s.mission.title}</p>
              </div>
              <p className="text-[12.5px] leading-snug text-paper/60">{s.tagline}</p>
            </div>
            <div className="relative ml-auto flex shrink-0 flex-col items-center justify-center gap-2 border-l border-dashed border-line px-4">
              <span aria-hidden className="absolute -left-[9px] -top-[9px] h-4 w-4 rounded-full border border-line bg-ink" />
              <span aria-hidden className="absolute -bottom-[9px] -left-[9px] h-4 w-4 rounded-full border border-line bg-ink" />
              <Flap text={CODE[s.id] ?? "RUN"} size="sm" tone={on ? (failure ? "stop" : "signal") : "dim"} />
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
