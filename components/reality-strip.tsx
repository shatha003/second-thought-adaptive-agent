"use client";

import { AnimatePresence, motion } from "motion/react";
import { Globe, Syringe } from "@phosphor-icons/react";
import type { WorldEntry } from "@/lib/domain/types";

/** What actually happened in the world. Agents never see this directly, only the signals it emits. */
export function RealityStrip({ world, clock }: { world: WorldEntry[]; clock: (t: number) => string }) {
  return (
    <div className="rounded-[var(--radius)] border border-line bg-panel p-4">
      <div className="mb-2 flex items-center gap-2">
        <Globe size={15} className="text-muted" />
        <h2 className="text-[13px] font-semibold">What actually happened</h2>
        <span className="text-[12px] text-muted">The agents never see this, only the signals it causes.</span>
      </div>
      {world.length === 0 ? (
        <p className="text-[12.5px] text-muted">Quiet so far. Press Run, or inject an event.</p>
      ) : (
        <ol className="scroll-thin flex max-h-40 flex-col gap-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {[...world].reverse().map((w, i) => (
              <motion.li
                key={`${w.tick}-${w.text}-${i}`}
                layout
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-start gap-2 text-[12.5px]"
              >
                <span className="w-24 shrink-0 font-mono text-[11px] text-muted">{clock(w.tick)}</span>
                <span className="text-fg">
                  {w.injected && <Syringe size={12} className="mr-1 inline text-accent" />}
                  {w.text}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      )}
    </div>
  );
}
