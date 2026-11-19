"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, Pause, Play, Syringe } from "@phosphor-icons/react";
import type { PlannerMode, Preset } from "@/lib/domain/types";
import { Flap } from "../ui/flap";

export const SPEEDS = [
  { id: "1x", ms: 1300 },
  { id: "2x", ms: 700 },
  { id: "4x", ms: 300 },
] as const;
export type SpeedId = (typeof SPEEDS)[number]["id"];

/** Floating control dock. The play button wears the run's progress as a ring. */
export function Dock(p: {
  ready: boolean;
  streaming: boolean;
  finished: boolean;
  progress: number;
  clock: string;
  presets: Preset[];
  speed: SpeedId;
  planner: PlannerMode;
  llmAvailable: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onInject: (id: string) => void;
  onSpeed: (s: SpeedId) => void;
  onPlanner: (m: PlannerMode) => void;
}) {
  const [open, setOpen] = useState(false);
  const R = 25;
  const C = 2 * Math.PI * R;

  return (
    <div className="pointer-events-none sticky bottom-4 z-40 flex justify-center">
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 160, damping: 20 }}
        className="pointer-events-auto relative flex items-center gap-2 rounded-full border border-line bg-ink2/90 p-2 pr-3 shadow-[0_20px_60px_-15px_rgb(0_0_0/0.8)] backdrop-blur-md sm:gap-3"
      >
        <motion.button
          aria-label={p.streaming ? "Pause" : p.finished ? "Finished" : "Play"}
          disabled={!p.ready || p.finished}
          onClick={p.streaming ? p.onPause : p.onPlay}
          whileTap={{ scale: 0.92 }}
          className="relative grid h-[58px] w-[58px] shrink-0 place-items-center rounded-full bg-signal text-ink disabled:bg-line disabled:text-dim"
        >
          <svg viewBox="0 0 58 58" className="absolute inset-0 -rotate-90" aria-hidden>
            <circle cx="29" cy="29" r={R} fill="none" stroke="rgb(9 10 15 / 0.25)" strokeWidth="3" />
            <motion.circle
              cx="29"
              cy="29"
              r={R}
              fill="none"
              stroke="var(--ink)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={C}
              initial={false}
              animate={{ strokeDashoffset: C * (1 - p.progress) }}
              transition={{ type: "spring", stiffness: 80, damping: 20 }}
            />
          </svg>
          <AnimatePresence mode="wait" initial={false}>
            <motion.span key={p.streaming ? "pause" : "play"} initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0, rotate: 90 }}>
              {p.streaming ? <Pause size={22} weight="fill" /> : <Play size={22} weight="fill" className="translate-x-[1px]" />}
            </motion.span>
          </AnimatePresence>
        </motion.button>

        <div className="hidden sm:block">
          <Flap text={p.clock} length={9} size="sm" boot={false} stagger={25} />
        </div>
        <div className="sm:hidden">
          <Flap text={p.clock.slice(-5)} length={5} size="xs" boot={false} />
        </div>

        <span className="mx-0.5 h-8 w-px bg-line" />

        <button aria-label="Reset" onClick={p.onReset} className="grid h-10 w-10 place-items-center rounded-full text-dim transition-colors hover:bg-ink3 hover:text-paper active:scale-95">
          <ArrowCounterClockwise size={19} />
        </button>

        <div className="relative">
          <button
            disabled={!p.ready || p.finished}
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex h-10 items-center gap-1.5 rounded-full border border-line px-3.5 text-[13px] transition-colors hover:border-signal hover:text-signal disabled:opacity-40"
          >
            <Syringe size={16} /> <span className="hidden sm:inline">Inject</span>
          </button>
          <AnimatePresence>
            {open && (
              <motion.ul
                initial={{ opacity: 0, y: 10, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.97 }}
                transition={{ type: "spring", stiffness: 320, damping: 26 }}
                className="absolute bottom-full left-1/2 mb-3 w-[min(340px,86vw)] -translate-x-1/2 rounded-2xl border border-line bg-ink2 p-1.5 shadow-2xl"
              >
                <li className="px-3 pb-1 pt-2 font-mono text-[10px] text-dim">PUSH AN EVENT INTO REALITY. IT LANDS ON THE NEXT TICK.</li>
                {p.presets.map((pr) => (
                  <li key={pr.id}>
                    <button
                      onClick={() => {
                        setOpen(false);
                        p.onInject(pr.id);
                      }}
                      className="w-full rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-ink3"
                    >
                      <span className="block font-display text-[17px] font-extrabold uppercase leading-tight">{pr.label}</span>
                      <span className="block text-[12px] leading-snug text-dim">{pr.description}</span>
                    </button>
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </div>

        <div className="hidden items-center rounded-full border border-line p-0.5 md:flex" role="radiogroup" aria-label="Speed">
          {SPEEDS.map((s) => (
            <button
              key={s.id}
              role="radio"
              aria-checked={p.speed === s.id}
              onClick={() => p.onSpeed(s.id)}
              className="relative rounded-full px-2.5 py-1.5 font-mono text-[11px]"
            >
              {p.speed === s.id && <motion.span layoutId="speed-pill" className="absolute inset-0 rounded-full bg-paper" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className={`relative ${p.speed === s.id ? "text-ink" : "text-dim"}`}>{s.id}</span>
            </button>
          ))}
        </div>

        <div className="hidden items-center rounded-full border border-line p-0.5 lg:flex" role="radiogroup" aria-label="Planner">
          {(["heuristic", "llm"] as const).map((m) => (
            <button
              key={m}
              role="radio"
              aria-checked={p.planner === m}
              disabled={m === "llm" && !p.llmAvailable}
              title={m === "llm" ? "Language model ranks the same grounded options. Falls back to rules on any error." : "Deterministic ranking"}
              onClick={() => p.onPlanner(m)}
              className="relative rounded-full px-2.5 py-1.5 font-mono text-[11px] disabled:opacity-40"
            >
              {p.planner === m && <motion.span layoutId="planner-pill" className="absolute inset-0 rounded-full bg-paper" transition={{ type: "spring", stiffness: 400, damping: 30 }} />}
              <span className={`relative ${p.planner === m ? "text-ink" : "text-dim"}`}>{m === "heuristic" ? "RULES" : "LLM"}</span>
            </button>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
