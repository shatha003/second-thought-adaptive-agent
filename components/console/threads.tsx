"use client";

import { motion, useReducedMotion } from "motion/react";
import type { AssumptionRT, Lane } from "@/lib/domain/types";

const CALM = "M0 6 L200 6";
const WAVE_A = "M0 6 C25 1, 50 11, 75 6 S125 1, 150 6 S190 11, 200 6";
const WAVE_B = "M0 6 C25 11, 50 1, 75 6 S125 11, 150 6 S190 1, 200 6";

/** An assumption drawn as a thread: taut when it holds, trembling in doubt, snapped when violated. */
function Thread({ a }: { a: AssumptionRT }) {
  const reduce = useReducedMotion();
  if (a.state === "violated" && !a.absorbed) {
    return (
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="h-3 w-full overflow-visible" aria-hidden>
        <motion.path d="M0 6 L92 6" stroke="var(--stop)" strokeWidth="2" fill="none" initial={{ x: 0 }} animate={{ x: -6, rotate: reduce ? 0 : 4 }} style={{ originX: 0 }} />
        <motion.path d="M108 6 L200 6" stroke="var(--stop)" strokeWidth="2" fill="none" initial={{ x: 0 }} animate={{ x: 6, rotate: reduce ? 0 : -4 }} style={{ originX: 1 }} />
        <motion.circle cx="100" cy="6" r="3" fill="var(--stop)" initial={{ scale: 2.5, opacity: 1 }} animate={{ scale: 0, opacity: 0 }} transition={{ duration: 0.8 }} />
      </svg>
    );
  }
  if (a.state === "weakened" || a.state === "stale") {
    const color = a.state === "weakened" ? "var(--signal)" : "var(--dim)";
    return (
      <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="h-3 w-full overflow-visible" aria-hidden>
        <motion.path
          d={WAVE_A}
          stroke={color}
          strokeWidth="1.6"
          fill="none"
          strokeDasharray={a.state === "stale" ? "4 4" : undefined}
          animate={reduce ? undefined : { d: [WAVE_A, WAVE_B, WAVE_A] }}
          transition={{ duration: a.state === "weakened" ? 0.7 : 2.4, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
    );
  }
  const color = a.absorbed ? "var(--dim)" : "var(--go)";
  return (
    <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="h-3 w-full overflow-visible" aria-hidden>
      <path d={CALM} stroke={color} strokeOpacity="0.35" strokeWidth="1.6" fill="none" />
      {!reduce && !a.absorbed && (
        <motion.path
          d={CALM}
          stroke={color}
          strokeWidth="2"
          fill="none"
          strokeDasharray="18 182"
          animate={{ strokeDashoffset: [200, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "linear" }}
        />
      )}
    </svg>
  );
}

const LABEL: Record<AssumptionRT["state"], { word: string; cls: string }> = {
  holding: { word: "HOLDS", cls: "text-go" },
  weakened: { word: "IN DOUBT", cls: "text-signal" },
  stale: { word: "STALE", cls: "text-dim" },
  violated: { word: "BROKEN", cls: "text-stop" },
  retired: { word: "RETIRED", cls: "text-dim" },
};

export function Threads({ lane }: { lane: Lane }) {
  if (lane.id === "baseline") {
    return (
      <div>
        <h4 className="mb-2 font-display text-[20px] font-extrabold uppercase leading-none">What it believes</h4>
        <div className="rounded-xl border border-dashed border-line px-4 py-4">
          <svg viewBox="0 0 200 12" preserveAspectRatio="none" className="h-3 w-full" aria-hidden>
            <path d={CALM} stroke="var(--line)" strokeWidth="1.6" strokeDasharray="2 6" fill="none" />
          </svg>
          <p className="mt-2 text-[13.5px] text-dim">Nothing. This agent holds no beliefs about the world, so it cannot notice when they stop being true.</p>
        </div>
      </div>
    );
  }
  const visible = lane.assumptions.filter((a) => a.state !== "retired");
  const retired = lane.assumptions.length - visible.length;
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <h4 className="font-display text-[20px] font-extrabold uppercase leading-none">What it believes</h4>
        {retired > 0 && <span className="font-mono text-[10.5px] text-dim">{retired} retired after revisions</span>}
      </div>
      <ul className="grid gap-3">
        {visible.map((a) => {
          const b = lane.beliefs[a.key];
          const l = a.absorbed ? { word: "ABSORBED", cls: "text-dim" } : LABEL[a.state];
          return (
            <motion.li layout key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-[14px] leading-tight">{a.statement}</span>
                <span className={`shrink-0 font-mono text-[10.5px] font-bold ${l.cls}`}>{l.word}</span>
              </div>
              <Thread a={a} />
              <p className="font-mono text-[10.5px] text-dim">
                {a.key} = <span className="text-paper/80">{b ? String(b.value) : "?"}</span>
                {b && <span> · {Math.round(b.reliability * 100)}% via {b.source}</span>}
                {b?.pending && <span className="text-signal"> · unconfirmed claim: {String(b.pending.value)}</span>}
              </p>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
