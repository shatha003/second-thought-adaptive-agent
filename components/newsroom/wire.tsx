"use client";

import { AnimatePresence, motion } from "motion/react";
import type { RunState, Scenario } from "@/lib/domain/types";
import { Hand, Typed } from "../ink/marks";

/** The news wire: what really happened. Neither editor reads it; they only get signals. */
export function Wire({ run, scn }: { run: RunState; scn: Scenario }) {
  const H = run.horizon;
  const pct = (t: number) => `${(t / H) * 100}%`;
  const every = Math.max(1, Math.round(H / 6));
  const entries = [...run.world].reverse();

  return (
    <section className="grid gap-8 lg:grid-cols-[1fr_1.5fr]">
      <div>
        <h3 className="font-serif text-[clamp(34px,4vw,54px)] font-extrabold leading-none tracking-[-0.01em]">The wire</h3>
        <p className="mt-3 max-w-[38ch] font-serif text-[17px] italic leading-snug text-ink/75">
          What really happened, as it happened. Neither editor reads the wire. They only receive signals, and signals can be wrong.
        </p>

        {/* Ruler with a red-pencil playhead */}
        <div className="mt-12 px-6">
        <div className="relative h-16">
          <div className="absolute inset-x-0 top-5 h-px bg-ink" />
          {Array.from({ length: H + 1 }, (_, t) => (
            <span key={t} className={`absolute top-5 w-px bg-ink ${t % every === 0 ? "h-3" : "h-1.5"}`} style={{ left: pct(t) }} />
          ))}
          {Array.from({ length: H + 1 }, (_, t) => t)
            .filter((t) => t % every === 0)
            .map((t) => (
              <span
                key={t}
                className={`absolute top-10 -translate-x-1/2 whitespace-nowrap font-type text-[10px] text-ink2 ${(t / every) % 2 ? "max-sm:hidden" : ""}`}
                style={{ left: pct(t) }}
              >
                {scn.clock(t)}
              </span>
            ))}
          {run.world.map((w, i) => (
            <motion.span
              key={`${w.tick}-${i}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 500, damping: 15 }}
              className={`absolute top-[15px] h-[11px] w-[11px] -translate-x-1/2 ${w.injected ? "bg-red" : "bg-ink"}`}
              style={{ left: pct(w.tick) }}
              title={w.text}
            />
          ))}
          <div className="absolute -top-6 -translate-x-[85%] whitespace-nowrap" style={{ left: pct(scn.mission.deadline) }}>
            <Hand className="text-[18px]">deadline ↓</Hand>
          </div>
          <motion.span
            className="pointer-events-none absolute top-0 block h-10 w-[3px] -translate-x-1/2 -rotate-3 rounded-full bg-red"
            initial={false}
            animate={{ left: pct(run.tick) }}
            transition={{ type: "spring", stiffness: 90, damping: 20 }}
          />
        </div>
        </div>
      </div>

      {/* Ticker tape */}
      <div className="tape scroll-thin relative max-h-[260px] min-h-[180px] overflow-y-auto px-7 py-4 font-type text-[14px] leading-relaxed shadow-[inset_0_10px_10px_-10px_rgb(0_0_0/0.25)]">
        {entries.length === 0 ? (
          <p className="text-ink2">
            WIRE OPEN. NOTHING TO REPORT YET.
            <span className="caret ml-1 inline-block h-[0.95em] w-[0.5em] translate-y-[0.12em] bg-ink" />
          </p>
        ) : (
          <ol>
            <AnimatePresence initial={false}>
              {entries.map((w, i) => (
                <motion.li key={`${w.tick}-${w.text}`} layout initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[88px_1fr] gap-2 border-b border-dashed border-ink/20 py-1.5">
                  <span className="text-ink2">{scn.clock(w.tick).toUpperCase()}</span>
                  <span className={w.injected ? "text-red" : ""}>
                    {w.injected && "BREAKING: "}
                    {i === 0 ? <Typed text={w.text.toUpperCase()} boot cps={90} /> : w.text.toUpperCase()}
                  </span>
                </motion.li>
              ))}
            </AnimatePresence>
          </ol>
        )}
      </div>
    </section>
  );
}
