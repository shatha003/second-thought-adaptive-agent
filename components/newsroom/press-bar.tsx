"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { PlannerMode, Preset } from "@/lib/domain/types";

export const SPEEDS = [
  { id: "1x", ms: 1300 },
  { id: "2x", ms: 700 },
  { id: "4x", ms: 300 },
] as const;
export type SpeedId = (typeof SPEEDS)[number]["id"];

function Seg<T extends string>({ label, value, options, onPick, disabled }: { label: string; value: T; options: { id: T; text: string }[]; onPick: (v: T) => void; disabled?: (v: T) => boolean }) {
  return (
    <div className="flex items-center gap-2" role="radiogroup" aria-label={label}>
      <span className="text-sheet/50">{label}</span>
      {options.map((o) => (
        <button
          key={o.id}
          role="radio"
          aria-checked={value === o.id}
          disabled={disabled?.(o.id)}
          onClick={() => onPick(o.id)}
          className={`relative px-1.5 py-0.5 disabled:opacity-30 ${value === o.id ? "text-ink" : "text-sheet/80 hover:text-sheet"}`}
        >
          {value === o.id && <motion.span layoutId={`seg-${label}`} className="absolute inset-0 bg-sheet" transition={{ type: "spring", stiffness: 500, damping: 34 }} />}
          <span className="relative">{o.text}</span>
        </button>
      ))}
    </div>
  );
}

/** The press: start and stop it, pull a new edition, or push breaking news onto the wire. */
export function PressBar(p: {
  ready: boolean;
  printing: boolean;
  finished: boolean;
  tick: number;
  horizon: number;
  clock: string;
  presets: Preset[];
  speed: SpeedId;
  planner: PlannerMode;
  llmAvailable: boolean;
  onPrint: () => void;
  onStop: () => void;
  onReset: () => void;
  onInject: (id: string) => void;
  onSpeed: (s: SpeedId) => void;
  onPlanner: (m: PlannerMode) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="pointer-events-none sticky bottom-3 z-40 mt-8 flex justify-center px-1">
      <div className="pointer-events-auto relative flex w-full max-w-[1100px] flex-wrap items-center gap-x-5 gap-y-2 bg-ink px-3 py-2.5 font-type text-[12.5px] uppercase tracking-wider text-sheet shadow-[6px_6px_0_var(--red)] sm:px-4">
        <motion.button
          whileTap={{ scale: 0.96 }}
          disabled={!p.ready || p.finished}
          onClick={p.printing ? p.onStop : p.onPrint}
          aria-label={p.printing ? "Stop the press" : "Print"}
          className={`flex items-center gap-2 px-4 py-2 font-bold disabled:opacity-40 ${p.printing ? "bg-sheet text-ink" : "bg-red text-sheet"}`}
        >
          {p.printing ? (
            <>
              <span className="inline-block h-2.5 w-2.5 bg-red" /> Stop the press
            </>
          ) : (
            <>
              <span className="inline-block h-0 w-0 border-y-[6px] border-l-[10px] border-y-transparent border-l-current" />
              {p.finished ? "Printed" : p.tick > 0 ? "Resume" : "Print"}
            </>
          )}
        </motion.button>

        <div className="leading-tight">
          <span className="block text-[15px] font-bold normal-case tracking-normal">{p.clock}</span>
          <span className="block text-[10.5px] text-sheet/60">
            Edition {p.tick} of {p.horizon}
          </span>
        </div>

        <button onClick={p.onReset} className="text-sheet/80 underline-offset-4 hover:text-sheet hover:underline">
          New edition
        </button>

        <div className="relative">
          <button
            disabled={!p.ready || p.finished}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="font-bold text-red transition-colors hover:text-sheet disabled:opacity-40"
          >
            Breaking news ▴
          </button>
          <AnimatePresence>
            {open && (
              <motion.ul
                initial={{ opacity: 0, y: 12, rotate: -1 }}
                animate={{ opacity: 1, y: 0, rotate: -1 }}
                exit={{ opacity: 0, y: 12 }}
                transition={{ type: "spring", stiffness: 300, damping: 24 }}
                className="sheet absolute bottom-full left-0 mb-4 w-[min(360px,86vw)] p-2 normal-case tracking-normal text-ink"
              >
                <li className="px-2 pb-1 pt-1 font-type text-[10.5px] uppercase tracking-wider text-ink2">Put a story on the wire. It lands next edition.</li>
                {p.presets.map((pr) => (
                  <li key={pr.id}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        p.onInject(pr.id);
                      }}
                      className="w-full px-2 py-2 text-left transition-colors hover:bg-paper"
                    >
                      <span className="block font-serif text-[17px] font-bold leading-tight">{pr.label}</span>
                      <span className="block font-serif text-[14px] italic leading-snug text-ink2">{pr.description}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <div className="ml-auto hidden items-center gap-5 md:flex">
          <Seg label="Press" value={p.speed} options={[{ id: "1x", text: "1×" }, { id: "2x", text: "2×" }, { id: "4x", text: "4×" }]} onPick={p.onSpeed} />
          <span className="hidden lg:inline-flex">
            <Seg
              label="Editor"
              value={p.planner}
              options={[
                { id: "heuristic", text: "Rules" },
                { id: "llm", text: "LLM" },
              ]}
              onPick={p.onPlanner}
              disabled={(v) => v === "llm" && !p.llmAvailable}
            />
          </span>
        </div>
      </div>
    </div>
  );
}
