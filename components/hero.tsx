"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ArrowDown, GithubLogo, Lightning } from "@phosphor-icons/react";
import { Flap, Scramble, type FlapTone } from "./ui/flap";

type Row = { code: string; what: string; status: string; tone: FlapTone };

const BASE: Row[] = [
  { code: "LH1234", what: "FLIGHT TO LIS", status: "ON TIME", tone: "go" },
  { code: "ALFAMA", what: "HOTEL 3 NTS", status: "BOOKED", tone: "go" },
  { code: "PICKUP", what: "ARR WED 21:00", status: "BOOKED", tone: "go" },
];

/** A scripted loop of the real story: the plan holds, reality breaks it, the agent re-plans and says why. */
const SCRIPT: { at: number; rows: Row[]; caption: string; kind: "calm" | "signal" | "thought" }[] = [
  { at: 0, rows: BASE, caption: "Plan v1. Every step depends on something staying true.", kind: "calm" },
  {
    at: 2600,
    rows: [{ ...BASE[0], status: "CANCEL", tone: "stop" }, BASE[1], BASE[2]],
    caption: "Signal: airline-feed (97%) says LH1234 is cancelled.",
    kind: "signal",
  },
  {
    at: 5000,
    rows: [
      { code: "TP505", what: "FLIGHT TO LIS", status: "REBOOKED", tone: "signal" },
      BASE[1],
      { code: "PICKUP", what: "ARR THU 05:00", status: "MOVED", tone: "signal" },
    ],
    caption: "I changed my mind because the flight my plan depended on is gone.",
    kind: "thought",
  },
];
const LOOP = 10400;

function DemoBoard() {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (reduce) return;
    let timers: ReturnType<typeof setTimeout>[] = [];
    const run = () => {
      timers = SCRIPT.map((s, i) => setTimeout(() => setPhase(i), s.at));
      timers.push(setTimeout(run, LOOP));
    };
    run();
    return () => timers.forEach(clearTimeout);
  }, [reduce]);

  const s = SCRIPT[reduce ? 2 : phase];

  return (
    <div className="relative">
      <div aria-hidden className="absolute -inset-10 -z-10 rounded-full bg-signal/10 blur-3xl" />
      <div className="rounded-2xl border border-line bg-ink2/90 p-4 shadow-[0_30px_80px_-30px_rgb(255_106_43/0.25)] sm:p-6">
        <div className="mb-3 flex items-center justify-between font-mono text-[11px] text-dim">
          <span>LIVE PLAN</span>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${s.kind === "calm" ? "bg-go" : s.kind === "signal" ? "bg-stop" : "bg-signal"} lamp-live`} />
            v{s.kind === "thought" ? 2 : 1}
          </span>
        </div>
        <div className="grid gap-3">
          {s.rows.map((r, i) => (
            <div key={i} className="flex items-center gap-3 border-b border-line/60 pb-2 last:border-0 last:pb-0">
              <div className="grid gap-1.5">
                <span className="hidden sm:inline-flex">
                  <Flap text={r.code} length={6} size="md" boot={false} />
                </span>
                <span className="sm:hidden">
                  <Flap text={r.code} length={6} size="sm" boot={false} />
                </span>
                <Flap text={r.what} length={13} size="xs" tone="dim" boot={false} stagger={22} />
              </div>
              <span className="ml-auto hidden sm:inline-flex">
                <Flap text={r.status} length={8} size="md" tone={r.tone} boot={false} />
              </span>
              <span className="ml-auto sm:hidden">
                <Flap text={r.status} length={8} size="sm" tone={r.tone} boot={false} />
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 min-h-[44px] border-t border-line pt-3">
          <AnimatePresence mode="wait">
            <motion.p
              key={phase}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className={`text-[13.5px] leading-snug ${s.kind === "thought" ? "text-signal" : s.kind === "signal" ? "text-stop" : "text-dim"}`}
            >
              <Scramble text={s.caption} boot />
            </motion.p>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export function Hero() {
  const [word, setWord] = useState("FIRST");
  useEffect(() => {
    const t = setTimeout(() => setWord("SECOND"), 1900);
    return () => clearTimeout(t);
  }, []);

  const play = () => {
    document.getElementById("console")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => window.dispatchEvent(new Event("st:play")), 700);
  };

  return (
    <section className="relative mx-auto grid min-h-[100dvh] max-w-[1400px] content-center items-center gap-12 px-4 pb-16 pt-10 sm:px-8 lg:grid-cols-[1.15fr_1fr] lg:gap-16">
      <div>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-5 flex items-center gap-2 font-mono text-[11px] tracking-[0.2em] text-dim"
        >
          <Lightning size={13} weight="fill" className="text-signal" /> THE ADAPTIVE AGENT
        </motion.p>
        <h1 className="grid gap-[clamp(4px,0.7vw,10px)]" aria-label="Second Thought">
          <Flap text={word} length={6} size="lg" tone={word === "SECOND" ? "signal" : "paper"} stagger={70} />
          <Flap text="THOUGHT" size="lg" stagger={70} />
        </h1>
        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 120, damping: 20 }}
          className="mt-7 max-w-[34ch] text-[clamp(17px,1.6vw,21px)] leading-snug text-paper/80"
        >
          An agent that notices when reality changes, changes its mind, and shows you exactly why.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7, type: "spring", stiffness: 120, damping: 20 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <motion.button
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.97 }}
            onClick={play}
            className="group flex items-center gap-2 rounded-full bg-signal px-6 py-3.5 font-display text-[19px] font-extrabold uppercase tracking-wide text-ink"
          >
            Watch it think
            <ArrowDown size={18} weight="bold" className="transition-transform group-hover:translate-y-0.5" />
          </motion.button>
          <a
            href="https://github.com/shatha003/second-thought-adaptive-agent"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 rounded-full border border-line px-5 py-3.5 text-[14px] text-paper/80 transition-colors hover:border-paper/40 hover:text-paper"
          >
            <GithubLogo size={17} /> Source
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, rotate: -1.5 }}
        animate={{ opacity: 1, y: 0, rotate: 0 }}
        transition={{ delay: 0.35, type: "spring", stiffness: 90, damping: 18 }}
      >
        <DemoBoard />
      </motion.div>
    </section>
  );
}
