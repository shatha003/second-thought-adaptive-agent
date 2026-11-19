"use client";

import { motion, useReducedMotion } from "motion/react";
import { Caret, Hand, Ring, Squiggle, Strike, Tick } from "./ink/marks";

const GATES = [
  ["Evidence", "Anything irreversible needs a strong source, or two sources that agree."],
  ["Contract", "The budget and the deadline still hold in the new plan."],
  ["Dry run", "The new plan is simulated against what the agent believes before it is trusted."],
  ["Better than staying", "It has to beat leaving the plan exactly as it is."],
  ["Budget for second thoughts", "Only so many changes of mind per mission. No thrashing."],
];

function Row({ n, name, children, means }: { n: number; name: string; children: React.ReactNode; means: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ duration: 0.5 }}
      className="grid gap-x-8 gap-y-3 border-t border-rule py-7 md:grid-cols-[110px_1.25fr_1fr] md:items-center"
    >
      <p className="font-serif text-[clamp(44px,5vw,64px)] font-extrabold italic leading-none">
        L{n}
        <span className="ml-3 align-middle font-type text-[13px] font-bold uppercase not-italic tracking-wider md:ml-0 md:block md:mt-2">{name}</span>
      </p>
      <div className="font-serif text-[clamp(21px,2.2vw,30px)] leading-[1.6]">{children}</div>
      <p className="max-w-[40ch] font-serif text-[16.5px] leading-snug text-ink/75">{means}</p>
    </motion.li>
  );
}

export function MarksLegend() {
  return (
    <section id="marks" className="mx-auto max-w-[1360px] px-4 py-20 sm:px-8">
      <div className="rule-double" />
      <h2 className="mt-8 max-w-[18ch] font-serif text-[clamp(40px,6vw,86px)] font-extrabold leading-[0.98] tracking-[-0.02em]">
        How to read the marks in this paper.
      </h2>
      <div className="drop-cap mt-8 gap-8 font-serif text-[17.5px] leading-[1.6] md:columns-3">
        Most agents treat a plan as a script. They run it to the end and report every step done, even when the world it was written for has moved on. This one treats its plan as a draft. Each step cites the facts it relies on, like footnotes. A signal from the world only matters if it disputes one of those facts. When it does, the agent fact-checks, and if the fact is really gone it edits the plan in red pencil and prints a correction explaining why. The cheapest edit that works always wins.
      </div>

      <ol className="mt-14">
        <Row n={0} name="Noise" means="Nothing in the plan depends on it. Noted in the margin, ignored.">
          Heavy rain forecast in Lisbon.{" "}
          <Hand ink="ink" inView delay={0.3} className="ml-2 -rotate-3 text-[0.9em] opacity-60">
            n/a
          </Hand>
        </Row>
        <Row n={1} name="Stet" means="Doubt, so check an authoritative source first. It held: let it stand.">
          <Squiggle ink="blue" inView>Speaker needs no visa.</Squiggle>{" "}
          <Tick inView delay={0.6} />
          <Hand ink="blue" inView delay={0.8} className="ml-1 -rotate-3 text-[0.95em]">
            stet
          </Hand>
        </Row>
        <Row n={2} name="Patch" means="One fact broke. Strike one step, insert a replacement, keep the rest.">
          Reserve{" "}
          <span className="relative inline-block">
            <Strike inView delay={0.3}>Hotel Alfama</Strike>
            <span className="absolute -top-[0.75em] left-[10%] -rotate-3 whitespace-nowrap">
              <Hand inView delay={0.9} className="text-[0.9em]">Hotel Baixa</Hand>
            </span>
            <span className="absolute -bottom-[0.35em] left-[-0.25em] h-[0.45em] w-[0.45em]">
              <Caret inView delay={0.75} size="100%" />
            </span>
          </span>
          .
        </Row>
        <Row n={3} name="Rewrite" means="A load-bearing fact broke. Strike the affected passage and rebuild the route.">
          <span className="relative inline-block">
            <Strike inView double delay={0.3}>Fly LH1234, then the pickup.</Strike>
            <span className="absolute -top-[0.78em] left-[4%] -rotate-2 whitespace-nowrap">
              <Hand inView delay={1.1} className="text-[0.9em]">rewrite: fly TP505</Hand>
            </span>
          </span>
        </Row>
        <Row n={4} name="Query" means="No option is safe. The agent stops and asks the author (a human), instead of guessing.">
          <Ring inView delay={0.3}>No hotel fits the budget.</Ring>{" "}
          <Hand inView delay={1} className="ml-3 -rotate-3 text-[0.95em]">
            AU: your call?
          </Hand>
        </Row>
      </ol>

      <div className="mt-16 grid gap-10 border-t-2 border-ink pt-8 lg:grid-cols-[1fr_1.5fr]">
        <h3 className="font-serif text-[clamp(32px,4vw,56px)] font-extrabold leading-[1] tracking-[-0.01em]">
          Nothing goes to press until all five boxes are ticked.
        </h3>
        <ul className="grid gap-4">
          {GATES.map(([name, v], i) => (
            <li key={name} className="grid grid-cols-[34px_1fr] items-start gap-3">
              <span className="relative mt-1 grid h-[26px] w-[26px] place-items-center border-2 border-ink">
                <span className="absolute -left-1 -top-2">
                  <Tick inView delay={0.3 + i * 0.35} size="32px" />
                </span>
              </span>
              <p className="font-serif text-[18px] leading-snug">
                <span className="font-bold">{name}.</span> <span className="text-ink/75">{v}</span>
              </p>
            </li>
          ))}
          <li className="mt-2 font-serif text-[18px] italic text-ink/80">
            Miss one, and the old plan stands, or the author decides.
          </li>
        </ul>
      </div>
    </section>
  );
}
