"use client";

import { AnimatePresence, motion } from "motion/react";
import { Eye, EyeSlash } from "@phosphor-icons/react";
import type { RunState, Scenario } from "@/lib/domain/types";
import { Scramble } from "../ui/flap";

/** Hidden reality on a track. The playhead is the clock; diamonds are things that truly happened. */
export function Timeline({ run, scn }: { run: RunState; scn: Scenario }) {
  const H = run.horizon;
  const pct = (t: number) => `${(t / H) * 100}%`;
  const latest = run.world.at(-1);
  const every = Math.max(1, Math.round(H / 6));
  const labels = Array.from({ length: H + 1 }, (_, t) => t).filter((t) => t % every === 0);

  return (
    <section className="overflow-x-clip rounded-2xl border border-line bg-ink2 p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h3 className="font-display text-[clamp(26px,3vw,36px)] font-black uppercase leading-none">What actually happened</h3>
        <span className="flex items-center gap-1.5 font-mono text-[10.5px] text-dim">
          <EyeSlash size={13} /> HIDDEN FROM BOTH AGENTS. THEY ONLY SEE SIGNALS.
        </span>
      </div>

      <div className="relative mx-2 mt-10 h-16">
        <div className="absolute inset-x-0 top-6 h-px bg-line" />
        {Array.from({ length: H + 1 }, (_, t) => (
          <span key={t} className="absolute top-[21px] h-[7px] w-px bg-line" style={{ left: pct(t) }} />
        ))}
        <motion.div
          className="absolute inset-x-0 top-[23px] h-[3px] origin-left rounded-full bg-signal"
          initial={false}
          animate={{ scaleX: run.tick / H }}
          transition={{ type: "spring", stiffness: 90, damping: 20 }}
        />

        {/* deadline flag */}
        <div className="absolute top-0 -translate-x-1/2" style={{ left: pct(scn.mission.deadline) }}>
          <span className="block font-mono text-[9.5px] font-bold text-stop">DEADLINE</span>
          <span className="mx-auto mt-0.5 block h-8 w-px bg-stop/60" />
        </div>

        {/* reality events */}
        {run.world.map((w, i) => (
          <div key={`${w.tick}-${i}`} className="absolute top-6" style={{ left: pct(w.tick) }}>
            <span className={`ripple absolute left-0 top-0 h-5 w-5 rounded-full ${w.injected ? "bg-signal/50" : "bg-paper/40"}`} />
            <motion.span
              initial={{ scale: 0, rotate: 0 }}
              animate={{ scale: 1, rotate: 45 }}
              transition={{ type: "spring", stiffness: 400, damping: 14 }}
              className={`absolute -left-[6px] -top-[6px] block h-3 w-3 ${w.injected ? "bg-signal" : "bg-paper"}`}
              title={w.text}
            />
          </div>
        ))}

        {/* playhead */}
        <motion.div className="pointer-events-none absolute inset-x-0 top-0" initial={false} animate={{ x: pct(run.tick) }} transition={{ type: "spring", stiffness: 90, damping: 20 }}>
          <span className="block h-12 w-[2px] -translate-x-1/2 bg-paper shadow-[0_0_14px_2px_rgb(239_233_220/0.35)]" />
        </motion.div>

        {labels.map((t) => (
          <span key={t} className="absolute top-11 -translate-x-1/2 whitespace-nowrap font-mono text-[9.5px] text-dim" style={{ left: pct(t) }}>
            {scn.clock(t).toUpperCase()}
          </span>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.3fr_1fr]">
        <div className="min-h-[64px]">
          <p className="mb-1 flex items-center gap-1.5 font-mono text-[10.5px] text-dim">
            <Eye size={13} /> LATEST {latest ? `· ${scn.clock(latest.tick).toUpperCase()}` : ""}
          </p>
          {latest ? (
            <p className={`font-display text-[clamp(22px,2.4vw,30px)] font-extrabold uppercase leading-[1.02] ${latest.injected ? "text-signal" : ""}`}>
              <Scramble key={run.world.length} text={latest.text} boot />
            </p>
          ) : (
            <p className="font-display text-[clamp(22px,2.4vw,30px)] font-extrabold uppercase leading-[1.02] text-dim">Nothing yet. Press play.</p>
          )}
        </div>
        <ol className="scroll-thin grid max-h-36 content-start gap-1.5 overflow-y-auto pr-1">
          <AnimatePresence initial={false}>
            {[...run.world].reverse().map((w, i) => (
              <motion.li key={`${w.tick}-${w.text}-${i}`} layout initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} className="grid grid-cols-[72px_1fr] gap-2 text-[12.5px]">
                <span className="font-mono text-[10.5px] text-dim">{scn.clock(w.tick).toUpperCase()}</span>
                <span className={w.injected ? "text-signal" : "text-paper/80"}>
                  {w.injected && "Injected: "}
                  {w.text}
                </span>
              </motion.li>
            ))}
          </AnimatePresence>
        </ol>
      </div>
    </section>
  );
}
