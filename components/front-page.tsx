"use client";

import { motion, useReducedMotion } from "motion/react";
import { Arrow, Hand, Strike, Tick, Typed } from "./ink/marks";

const REPO = "https://github.com/shatha003/second-thought-adaptive-agent";

export function Masthead() {
  return (
    <header className="mx-auto max-w-[1360px] px-4 pt-5 sm:px-8">
      <div className="flex items-center justify-between gap-4 font-type text-[11px] uppercase tracking-wider text-ink2">
        <span>Vol. I, No. 1</span>
        <span className="hidden sm:block">The adaptive agent, reported live</span>
        <span>Late edition</span>
      </div>
      <motion.h1
        initial={{ opacity: 0, filter: "blur(6px)", scale: 1.03 }}
        animate={{ opacity: 1, filter: "blur(0px)", scale: 1 }}
        transition={{ duration: 0.9, ease: [0.2, 0.7, 0.2, 1] }}
        className="press py-3 text-center font-black text-[clamp(46px,9.5vw,132px)] leading-[1.05]"
      >
        The Second Thought
      </motion.h1>
      <div className="rule-double" />
      <nav className="mt-3 flex flex-wrap justify-center gap-x-6 gap-y-1 border-b border-rule pb-2.5 font-type text-[12px] uppercase tracking-wider">
        <a href="#front" className="hover:text-red">Front page</a>
        <a href="#marks" className="hover:text-red">How to read the marks</a>
        <a href="#newsroom" className="hover:text-red">The newsroom</a>
        <a href={`${REPO}/blob/main/docs/FAILURE-TEST.md`} className="hover:text-red">Corrections policy</a>
      </nav>
    </header>
  );
}

export function FrontPage() {
  const reduce = useReducedMotion();
  const play = () => {
    document.getElementById("newsroom")?.scrollIntoView({ behavior: "smooth" });
    window.setTimeout(() => window.dispatchEvent(new Event("st:play")), 800);
  };

  return (
    <section id="front" className="mx-auto max-w-[1360px] px-4 pb-20 pt-8 sm:px-8">
        <p className="font-type text-[12px] font-bold uppercase tracking-[0.18em] text-red">Exclusive</p>

        {/* The headline corrects itself. */}
        <h2 className="press mt-6 font-serif text-[clamp(36px,7.1vw,104px)] font-extrabold leading-[1.42] tracking-[-0.02em] [font-variation-settings:'opsz'_72]">
          Agent{" "}
          <span className="relative inline-block whitespace-nowrap">
            <Strike delay={1.5} duration={0.55}>
              sticks to the plan.
            </Strike>
            <span className="absolute -top-[0.62em] left-[2%] -rotate-[3deg] whitespace-nowrap">
              <Hand delay={2.2} className="text-[0.74em]">
                changes its mind.
              </Hand>
            </span>
          </span>
          <br />
          Mission{" "}
          <span className="relative inline-block whitespace-nowrap">
            <Strike delay={2.1} duration={0.5}>
              fails anyway.
            </Strike>
            <span className="absolute -top-[0.62em] left-[10%] -rotate-[4deg] whitespace-nowrap">
              <Hand delay={3.1} className="text-[0.85em]">
                saved.
              </Hand>
            </span>
          </span>
        </h2>

      <div className="mt-10 grid gap-10 lg:grid-cols-12 lg:gap-0">
      <div className="lg:col-span-7 lg:pr-10">
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-8 max-w-[34ch] font-serif text-[clamp(19px,1.8vw,24px)] italic leading-snug text-ink/85"
        >
          Second Thought tracks what its plan depends on, notices when reality changes, and prints every correction with its reasons.
        </motion.p>

        <div className="relative mt-9 flex flex-wrap items-center gap-5">
          <motion.button
            onClick={play}
            whileHover={reduce ? undefined : { x: 3, y: -3, boxShadow: "-3px 3px 0 var(--red)" }}
            whileTap={{ x: 0, y: 0, boxShadow: "0 0 0 var(--red)" }}
            className="bg-ink px-6 py-3.5 font-type text-[15px] font-bold uppercase tracking-wider text-sheet"
          >
            Read the live edition ↓
          </motion.button>
          <a href={REPO} target="_blank" rel="noreferrer" className="font-type text-[14px] uppercase tracking-wider underline decoration-1 underline-offset-4 hover:text-red">
            Source code
          </a>
          <span className="pointer-events-none absolute -top-16 left-[19rem] hidden items-start gap-1 sm:flex">
            <Arrow delay={3.8} className="h-14 w-10 -scale-x-100 rotate-[50deg]" />
            <Hand delay={4.2} className="mt-1 -rotate-[4deg] text-[26px]">
              and it shows you why
            </Hand>
          </span>
        </div>
      </div>

      {/* Sidebar: a real correction, typed as it happens */}
      <aside className="border-t border-rule pt-6 lg:col-span-5 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0">
        <p className="border-b-2 border-ink pb-1 font-type text-[13px] font-bold uppercase tracking-[0.2em]">Corrections</p>
        <p className="mt-4 font-serif text-[18px] leading-[1.5]">
          <Typed
            boot
            cps={55}
            text="An earlier version of this plan relied on flight LH1234 landing in Lisbon on Wednesday at 21:00. The airline cancelled it (airline-feed, 97% reliable). The plan now flies TP505, landing Thursday at 05:00. Three steps changed; two bookings were refunded."
          />
        </p>
        <p className="mt-4 font-type text-[12px] uppercase tracking-wider text-ink2">The adaptive agent, Tuesday 13:00</p>
        <div className="mt-5 flex items-center gap-2 -rotate-2">
          <Tick delay={6.4} size="28px" />
          <Hand ink="blue" delay={6.7} className="text-[28px]">
            5 of 5 checks passed
          </Hand>
        </div>
        <div className="mt-10 border-t border-rule pt-5">
          <p className="font-type text-[12px] font-bold uppercase tracking-[0.2em]">Also in this edition</p>
          <ul className="mt-3 grid gap-3 font-serif text-[16px] leading-snug">
            <li>
              <span className="font-bold">Supply chain.</span> 500 units by Friday, then the port goes on strike.
            </li>
            <li>
              <span className="font-bold">Failure test.</span> An agent that believes every rumour, and one that checks first.
            </li>
          </ul>
        </div>
      </aside>
      </div>
    </section>
  );
}
