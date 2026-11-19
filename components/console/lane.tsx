"use client";

import { motion, useReducedMotion } from "motion/react";
import type { Lane, Mission, Score } from "@/lib/domain/types";
import { Flap } from "../ui/flap";
import { Board } from "./board";
import { Threads } from "./threads";
import { Thoughts } from "./thoughts";

const POLICY: Record<Lane["id"], { word: string; cls: string }> = {
  baseline: { word: "NO WORLD MODEL", cls: "border-line text-dim" },
  adaptive: { word: "GUARDS ON", cls: "border-go/50 text-go" },
  unguarded: { word: "GUARDS OFF", cls: "border-stop/50 text-stop" },
};

const STAMP: Record<Score["verdict"], { word: string; cls: string }> = {
  achieved: { word: "Mission achieved", cls: "border-go text-go" },
  "silent-failure": { word: "Silent failure", cls: "border-stop text-stop" },
  failed: { word: "Mission failed", cls: "border-stop text-stop" },
  contained: { word: "Contained", cls: "border-signal text-signal" },
  breached: { word: "Contract breached", cls: "border-stop text-stop" },
};

/** Spend as a strip of lamps, one per twelfth of the budget. Over budget spills into red. */
function SpendMeter({ spend, budget }: { spend: number; budget: number }) {
  const cells = 12;
  const lit = Math.min(cells + 4, Math.ceil((Math.max(0, spend) / budget) * cells));
  return (
    <div className="flex gap-[3px]" aria-hidden>
      {Array.from({ length: cells + Math.max(0, lit - cells) }, (_, i) => (
        <motion.span
          key={i}
          animate={{ opacity: i < lit ? 1 : 0.18, scaleY: i < lit ? 1 : 0.6 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: i * 0.02 }}
          className={`h-3 w-[7px] rounded-[2px] ${i >= cells ? "bg-stop" : i < lit ? "bg-paper" : "bg-line"}`}
        />
      ))}
    </div>
  );
}

/** Plays once each time a new change of mind is recorded (keyed by the entry id). */
function MindFlash({ headline }: { headline: string }) {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0] }}
      transition={{ duration: 2.6, times: [0, 0.08, 0.78, 1] }}
      className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-center overflow-hidden rounded-2xl bg-ink/85 p-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ x: "-100%" }}
        animate={{ x: "100%" }}
        transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
        className="absolute inset-y-0 left-0 w-full bg-gradient-to-r from-transparent via-signal/25 to-transparent"
      />
      <motion.p
        initial={{ y: 30, opacity: 0, letterSpacing: "0.2em" }}
        animate={{ y: 0, opacity: 1, letterSpacing: "0em" }}
        transition={{ type: "spring", stiffness: 140, damping: 16 }}
        className="font-display text-[clamp(44px,6vw,80px)] font-black uppercase leading-[0.85] text-signal"
      >
        Second
        <br />
        thought
      </motion.p>
      <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="mt-4 max-w-[46ch] text-[15px] leading-snug text-paper">
        {headline}
      </motion.p>
    </motion.div>
  );
}

function VerdictStamp({ score }: { score: Score }) {
  const s = STAMP[score.verdict];
  return (
    <motion.div
      initial={{ scale: 2.4, rotate: -24, opacity: 0 }}
      animate={{ scale: 1, rotate: -7, opacity: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 14 }}
      className={`pointer-events-none absolute right-3 top-3 z-[5] rounded-lg border-[3px] px-3 py-1.5 font-display text-[clamp(20px,2.4vw,30px)] font-black uppercase leading-none ${s.cls} bg-ink/80 shadow-[0_10px_40px_-10px_currentColor]`}
    >
      {s.word}
    </motion.div>
  );
}

export function LaneView({ lane, mission, spend, onApprove }: { lane: Lane; mission: Mission; spend: number; onApprove: () => void }) {
  const p = POLICY[lane.id];
  const lastBig = [...lane.journal].reverse().find((e) => e.revision);
  const over = spend > mission.budget;
  const digits = String(mission.budget).length;

  return (
    <motion.section
      layout
      aria-label={lane.label}
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      className={`relative flex min-w-0 flex-col rounded-2xl border bg-ink2 ${lane.status === "holding" && !lane.score ? "border-stop/60" : "border-line"}`}
    >
      {lastBig && <MindFlash key={lastBig.id} headline={lastBig.headline} />}
      {lane.score && <VerdictStamp key={lane.score.verdict} score={lane.score} />}

      <header className="border-b border-line p-5">
        <span className={`inline-block rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold tracking-wider ${p.cls}`}>{p.word}</span>
        <h3 className="mt-2.5 pr-36 font-display text-[clamp(30px,3.4vw,44px)] font-black uppercase leading-[0.9]">{lane.label}</h3>
        <p className="mt-1.5 max-w-[46ch] text-[13.5px] text-dim">{lane.blurb}</p>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Flap text={`${mission.currency}${String(Math.max(0, Math.round(spend))).padStart(digits, "0")}`} size="sm" tone={over ? "stop" : "paper"} boot={false} />
          <div className="grid gap-1">
            <SpendMeter spend={spend} budget={mission.budget} />
            <span className="font-mono text-[10px] text-dim">
              NET SPEND OF {mission.currency}
              {mission.budget.toLocaleString("en-US")} BUDGET
            </span>
          </div>
        </div>

        {lane.score && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-3 text-[14px] font-medium">
            {lane.score.headline}
          </motion.p>
        )}
        {lane.status === "holding" && !lane.score && (
          <p className="mt-3 flex items-center gap-2 text-[13.5px] text-stop">
            <span className="lamp-live h-2 w-2 rounded-full bg-stop text-stop" /> Paused. Waiting for a human decision.
          </p>
        )}
      </header>

      <div className="grid gap-7 p-5">
        <Board lane={lane} currency={mission.currency} />
        <Threads lane={lane} />
        <Thoughts lane={lane} currency={mission.currency} onApprove={onApprove} />
      </div>
    </motion.section>
  );
}
