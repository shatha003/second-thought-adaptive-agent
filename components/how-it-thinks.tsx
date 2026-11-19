"use client";

import { motion, useReducedMotion } from "motion/react";

const CHAIN = [
  { k: "Mission", v: "Speaker on stage in Lisbon, Thursday 09:00, under €1,200." },
  { k: "Plan", v: "Book LH1234. Reserve Hotel Alfama. Book the airport pickup." },
  { k: "Assumptions", v: "LH1234 operates on time. Alfama still has our room." },
  { k: "Signals", v: "airline-feed, 97% reliable: LH1234 cancelled." },
];

const LADDER = [
  { n: 0, name: "Ignore", ex: "Rain in Lisbon. Nothing depends on it." },
  { n: 1, name: "Verify", ex: "A 40% rumour. Ask an authoritative source first." },
  { n: 2, name: "Patch", ex: "Hotel overbooked. Swap one step, keep the rest." },
  { n: 3, name: "Re-plan", ex: "Flight cancelled. Rebuild the route." },
  { n: 4, name: "Escalate", ex: "No safe option left. Hand it to a human." },
];

const GATES = [
  { name: "Evidence", v: "Irreversible moves need strong or corroborated evidence." },
  { name: "Contract", v: "Budget and deadline must still hold." },
  { name: "Dry-run", v: "The new plan is simulated before it is trusted." },
  { name: "Better than staying", v: "It must beat doing nothing." },
  { name: "Budget", v: "Only so many changes of mind per mission." },
];

const spring = { type: "spring", stiffness: 110, damping: 20 } as const;

export function HowItThinks() {
  const reduce = useReducedMotion();
  const reveal = (i = 0) =>
    reduce
      ? {}
      : {
          initial: { opacity: 0, y: 26 },
          whileInView: { opacity: 1, y: 0 },
          viewport: { once: true, amount: 0.4 },
          transition: { ...spring, delay: i * 0.08 },
        };

  return (
    <section className="mx-auto max-w-[1400px] overflow-x-clip px-4 py-24 sm:px-8 md:py-32">
      <motion.h2 {...reveal()} className="max-w-[16ch] font-display text-[clamp(44px,7vw,96px)] font-black uppercase leading-[0.9] tracking-tight">
        It doesn&apos;t re-plan on a timer. <span className="text-signal">It notices.</span>
      </motion.h2>
      <motion.p {...reveal(1)} className="mt-6 max-w-[52ch] text-[17px] leading-relaxed text-paper/70">
        A signal only matters if it breaks something the plan depends on. When it does, the agent takes the cheapest response that works.
      </motion.p>

      {/* The chain: signals travel back up to the mission */}
      <div className="relative mt-16 overflow-x-clip">
        <div aria-hidden className="absolute left-0 right-0 top-[7px] hidden h-px bg-line md:block" />
        {!reduce && (
          <motion.div
            aria-hidden
            className="absolute left-0 right-0 top-0 hidden md:block"
            initial={{ x: "100%" }}
            animate={{ x: "0%" }}
            transition={{ duration: 3.2, repeat: Infinity, ease: [0.65, 0, 0.35, 1], repeatDelay: 0.6 }}
          >
            <span className="block h-[15px] w-[15px] -translate-x-1/2 rounded-full bg-signal shadow-[0_0_24px_6px_rgb(255_106_43/0.5)]" />
          </motion.div>
        )}
        <ol className="grid gap-8 md:grid-cols-4 md:gap-6">
          {CHAIN.map((c, i) => (
            <motion.li key={c.k} {...reveal(i)} className="relative pl-6 md:pl-0 md:pt-8">
              <span aria-hidden className="absolute left-0 top-1 h-[15px] w-[15px] rounded-full border-2 border-paper/60 bg-ink md:top-0" />
              <p className="font-display text-[26px] font-extrabold uppercase leading-none">{c.k}</p>
              <p className="mt-2 max-w-[30ch] text-[14.5px] leading-snug text-paper/65">{c.v}</p>
            </motion.li>
          ))}
        </ol>
        <p className="mt-6 font-mono text-[11.5px] text-dim">A signal is traced back through the assumptions it touches, to the steps that rely on them, to the mission.</p>
      </div>

      {/* The ladder */}
      <div className="mt-28 grid gap-12 lg:grid-cols-[1fr_1.6fr] lg:items-end">
        <motion.div {...reveal()}>
          <h3 className="font-display text-[clamp(36px,4.6vw,64px)] font-black uppercase leading-[0.92]">
            The cheapest response <span className="text-signal">that works</span> wins.
          </h3>
          <p className="mt-4 max-w-[42ch] text-[15.5px] leading-relaxed text-paper/65">
            Most signals should cost nothing. Every step up the ladder is more expensive and more disruptive, so the agent climbs only as far as it has to.
          </p>
        </motion.div>
        <div className="grid h-[320px] grid-cols-5 items-end gap-2 sm:gap-3">
          {LADDER.map((l, i) => (
            <div key={l.n} className="flex h-full flex-col justify-end">
              <motion.div
                initial={reduce ? false : { scaleY: 0 }}
                whileInView={{ scaleY: 1 }}
                viewport={{ once: true, amount: 0.5 }}
                transition={{ ...spring, delay: 0.1 + i * 0.12 }}
                style={{ height: `${46 + i * 13.5}%` }}
                className={`flex origin-bottom flex-col justify-between rounded-t-xl border border-b-0 p-2.5 sm:p-3.5 ${
                  l.n === 4 ? "border-stop/50 bg-stop/10" : l.n >= 2 ? "border-signal/40 bg-signal/10" : "border-line bg-ink2"
                }`}
              >
                <span className={`font-display text-[clamp(30px,4vw,54px)] font-black leading-none ${l.n === 4 ? "text-stop" : l.n >= 2 ? "text-signal" : "text-paper/50"}`}>
                  L{l.n}
                </span>
                <div>
                  <p className="font-display text-[15px] font-extrabold uppercase leading-none sm:text-[19px]">{l.name}</p>
                  <p className="mt-1.5 hidden text-[12px] leading-snug text-paper/60 lg:block">{l.ex}</p>
                </div>
              </motion.div>
            </div>
          ))}
        </div>
      </div>

      {/* The gate */}
      <div className="mt-28">
        <motion.h3 {...reveal()} className="font-display text-[clamp(36px,4.6vw,64px)] font-black uppercase leading-[0.92]">
          Five lamps before <span className="text-signal">any change of mind.</span>
        </motion.h3>
        <ul className="mt-10 grid gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-5">
          {GATES.map((g, i) => (
            <motion.li key={g.name} {...reveal(i)} className="border-t border-line pt-5">
              <motion.span
                aria-hidden
                initial={reduce ? false : { backgroundColor: "rgb(38 43 58)", boxShadow: "0 0 0 0 rgb(75 227 160 / 0)" }}
                whileInView={{ backgroundColor: "rgb(75 227 160)", boxShadow: "0 0 22px 4px rgb(75 227 160 / 0.45)" }}
                viewport={{ once: true, amount: 0.8 }}
                transition={{ delay: 0.4 + i * 0.28, duration: 0.25 }}
                className="mb-4 block h-3.5 w-3.5 rounded-full"
              />
              <p className="font-display text-[22px] font-extrabold uppercase leading-none">{g.name}</p>
              <p className="mt-2 text-[14px] leading-snug text-paper/60">{g.v}</p>
            </motion.li>
          ))}
        </ul>
        <motion.p {...reveal(2)} className="mt-10 max-w-[60ch] text-[15.5px] text-paper/65">
          If any lamp stays dark, the plan stays as it is, or a human decides. The candidate plan never touches the live one until every check passes.
        </motion.p>
      </div>
    </section>
  );
}
