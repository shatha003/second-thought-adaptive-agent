"use client";

import { motion, useReducedMotion } from "motion/react";
import type { AssumptionDef, AssumptionRT, Lane, Mission, Scenario, Score, Step } from "@/lib/domain/types";
import { Caret, Cross, Hand, Ring, Squiggle, Stamp, Strike, Tick, Typed } from "../ink/marks";
import { Corrections } from "./corrections";
import { sentence } from "../ink/text";

const TITLE: Record<Lane["id"], { title: string; checking: string }> = {
  baseline: { title: "The first draft", checking: "Fact-checking: none" },
  adaptive: { title: "With second thoughts", checking: "Fact-checking: on. Guards: on" },
  unguarded: { title: "Rewritten on every rumour", checking: "Fact-checking: believes everything. Guards: off" },
};

const STAMP: Record<Score["verdict"], { text: string; ink: "red" | "blue" }> = {
  achieved: { text: "Passed for press", ink: "blue" },
  "silent-failure": { text: "Printed. Wrong.", ink: "red" },
  failed: { text: "Failed", ink: "red" },
  contained: { text: "Held for the author", ink: "blue" },
  breached: { text: "Over budget", ink: "red" },
};

type Fact = (AssumptionDef & Partial<AssumptionRT>) & { unchecked?: boolean };

const money = (n: number, c: string) => `${c}${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

function Margin({ s, held, currency }: { s: Step; held: boolean; currency: string }) {
  if (s.status === "dropped" || s.status === "voided")
    return <Hand className="text-[22px]">{s.status === "voided" ? "undo" : "del"}</Hand>;
  if (held) return <Hand className="text-[22px]">hold</Hand>;
  if (s.status === "failed")
    return (
      <span className="inline-flex items-center gap-1">
        <Cross /> <Hand className="text-[22px]">failed</Hand>
      </span>
    );
  if (s.status === "done") {
    if (s.kind === "cancel")
      return s.cost === 0 ? (
        <Hand className="text-[22px]">no refund!</Hand>
      ) : (
        <Hand ink="blue" className="text-[22px]">{`+${money(s.cost, currency)} back`}</Hand>
      );
    return (
      <span className="inline-flex items-center gap-1">
        <Tick /> <span className="font-type text-[12px] text-ink2">{s.cost > 0 ? `-${money(s.cost, currency)}` : "done"}</span>
      </span>
    );
  }
  return <span className="font-type text-[11.5px] uppercase tracking-wider text-ink2/70">queued</span>;
}

function Line({ s, n, lane, facts, currency }: { s: Step; n: number; lane: Lane; facts: Fact[]; currency: string }) {
  const gone = s.status === "dropped" || s.status === "voided";
  const inserted = s.origin > 1;
  const held = lane.heldStep === s.id && s.status === "pending";
  const refs = s.assumptions.map((id) => facts.findIndex((f) => f.id === id) + 1).filter((i) => i > 0);
  const title = (
    <>
      {s.title}
      {refs.map((r) => {
        const broken = facts[r - 1]?.state === "violated" && !facts[r - 1]?.absorbed;
        return (
          <sup key={r} className={`ml-0.5 font-type text-[0.6em] font-bold ${broken ? "text-red" : "text-ink2"}`}>
            {r}
          </sup>
        );
      })}
    </>
  );
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative grid grid-cols-[30px_1fr_auto] items-baseline gap-x-3 py-[7px]"
    >
      <span className="font-type text-[12px] text-ink2">{n}.</span>
      <span className={`font-serif text-[17px] leading-snug ${gone ? "text-ink/45" : ""}`}>
        {inserted && !gone && (
          <span className="absolute -left-[18px] top-[0.95em] h-[13px] w-[13px] sm:-left-[26px]">
            <Caret size="100%" />
          </span>
        )}
        {gone ? <Strike>{title}</Strike> : inserted ? <Typed text={s.title} boot className="" /> : title}
        {inserted && !gone && refs.length > 0 && (
          <sup className="ml-0.5 font-type text-[0.6em] font-bold text-ink2">{refs.join(",")}</sup>
        )}
        {inserted && !gone && <span className="ml-2 font-hand text-[19px] font-bold text-red">ins. v{s.origin}</span>}
        {s.result && !gone && s.status !== "pending" && <span className="block font-type text-[11.5px] text-ink2">{s.result}</span>}
      </span>
      <span className="justify-self-end whitespace-nowrap text-right">
        <Margin s={s} held={held} currency={currency} />
      </span>
    </motion.li>
  );
}

function Footnote({ f, i, lane }: { f: Fact; i: number; lane: Lane }) {
  const b = lane.beliefs[f.key];
  const base = <span>{f.statement}</span>;
  let body: React.ReactNode = base;
  let note: React.ReactNode = null;

  if (f.unchecked) {
    note = <span className="font-type text-[11.5px] uppercase tracking-wider text-ink2">never checked</span>;
  } else if (f.state === "retired") {
    body = <span className="text-ink/45"><Strike ink="ink">{base}</Strike></span>;
    note = <span className="font-type text-[11.5px] uppercase tracking-wider text-ink2">retired</span>;
  } else if (f.absorbed) {
    note = <Hand ink="blue" className="text-[21px]">changed, still fine</Hand>;
  } else if (f.state === "violated") {
    body = <Strike>{base}</Strike>;
    note = <Hand className="text-[24px]">false</Hand>;
  } else if (f.state === "weakened") {
    body = <Squiggle>{base}</Squiggle>;
    note = <Hand className="text-[21px]">disputed, checking</Hand>;
  } else if (f.state === "stale") {
    body = <Squiggle ink="ink">{base}</Squiggle>;
    note = <Hand ink="ink" className="text-[21px] opacity-60">stale</Hand>;
  } else {
    note = (
      <span className="inline-flex items-center gap-1">
        <Tick size="0.95em" /> <span className="font-type text-[11.5px] uppercase tracking-wider text-blue">checked</span>
      </span>
    );
  }

  return (
    <li className="grid grid-cols-[22px_1fr_auto] items-baseline gap-x-2 py-1">
      <span className="font-type text-[12px] font-bold">
        {f.state === "violated" && !f.absorbed ? <Ring>{i}</Ring> : i}
      </span>
      <span className="font-serif text-[15.5px] leading-snug">
        {body}
        {b && !f.unchecked && (
          <span className="block font-type text-[11px] text-ink2">
            {f.key} = {String(b.value)} ({Math.round(b.reliability * 100)}%, {b.source})
            {b.pending && <span className="text-red"> unconfirmed claim: {String(b.pending.value)}</span>}
          </span>
        )}
      </span>
      <span className="justify-self-end whitespace-nowrap">{note}</span>
    </li>
  );
}

/** Plays once per new change of mind (keyed by the journal entry id). */
function SecondThoughtFlash() {
  const reduce = useReducedMotion();
  if (reduce) return null;
  return (
    <motion.div
      aria-hidden
      initial={{ opacity: 1 }}
      animate={{ opacity: [1, 1, 0] }}
      transition={{ duration: 3, times: [0, 0.8, 1] }}
      className="pointer-events-none absolute inset-x-0 top-24 z-10 flex justify-center"
    >
      <span className="-rotate-[8deg]">
        <Ring>
          <Hand className="px-3 text-[clamp(56px,7vw,96px)]" speed={0.06}>
            second thought!
          </Hand>
        </Ring>
      </span>
    </motion.div>
  );
}

export function ProofSheet({ lane, scn, spend, tilt, clock, onApprove }: { lane: Lane; scn: Scenario; spend: number; tilt: number; clock: (t: number) => string; onApprove: () => void }) {
  const m: Mission = scn.mission;
  const t = TITLE[lane.id];
  const facts: Fact[] = lane.assumptions.length ? lane.assumptions : scn.assumptions.map((a) => ({ ...a, unchecked: true }));
  const shownFacts = lane.id === "baseline" ? facts.map((f) => ({ ...f, unchecked: true })) : facts;
  const lastThought = [...lane.journal].reverse().find((e) => e.kind === "revision");
  const pct = Math.min(1.5, Math.max(0, spend) / m.budget);
  const over = spend > m.budget;

  return (
    <motion.article
      initial={{ opacity: 0, y: 40, rotate: tilt * 2 }}
      animate={{ opacity: 1, y: 0, rotate: tilt }}
      transition={{ type: "spring", stiffness: 70, damping: 16 }}
      aria-label={lane.label}
      className="sheet relative min-w-0 px-5 pb-8 pt-6 sm:px-8"
    >
      {lastThought && <SecondThoughtFlash key={lastThought.id} />}
      <p className="font-type text-[11px] uppercase tracking-[0.2em] text-ink2">Proof. {lane.label}</p>
      <h3 className="mt-1 font-serif text-[clamp(30px,3.2vw,44px)] font-extrabold italic leading-[1] tracking-[-0.01em]">{t.title}</h3>
      <p className="mt-2 font-type text-[12px] text-ink2">{t.checking}</p>

      {/* Expenses */}
      <div className="mt-5">
        <div className="flex items-baseline justify-between font-type text-[12px]">
          <span className="uppercase tracking-wider text-ink2">Expenses</span>
          <span className={over ? "font-bold text-red" : ""}>
            {money(spend, m.currency)} of {money(m.budget, m.currency)}
          </span>
        </div>
        <div className="relative mt-1.5 h-[6px]">
          <div className="absolute inset-y-[2px] left-0 w-2/3 border-t border-dashed border-ink/30" style={{ width: `${(1 / 1.5) * 100}%` }} />
          <motion.div
            className={`absolute inset-y-0 left-0 origin-left ${over ? "bg-red" : "bg-ink"}`}
            style={{ width: "100%" }}
            initial={false}
            animate={{ scaleX: pct / 1.5 }}
            transition={{ type: "spring", stiffness: 80, damping: 18 }}
          />
          <span className="absolute -top-1.5 h-[18px] w-[2px] bg-red" style={{ left: `${(1 / 1.5) * 100}%` }} title="budget" />
        </div>
      </div>

      {lane.status === "holding" && !lane.score && (
        <p className="mt-4 -rotate-1">
          <Hand className="text-[26px]">Press stopped. Waiting for the author.</Hand>
        </p>
      )}
      {lane.score && (
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-6">
          <Stamp key={lane.score.verdict} ink={STAMP[lane.score.verdict].ink} className="text-[clamp(20px,2.3vw,28px)]">
            {STAMP[lane.score.verdict].text}
          </Stamp>
          <p className="min-w-0 flex-1 basis-48 font-serif text-[17px] font-bold italic leading-snug">{sentence(lane.score.headline)}</p>
        </div>
      )}

      {/* The manuscript */}
      <div className="mt-6 border-t-2 border-ink pt-2">
        <div className="flex items-baseline justify-between">
          <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">The plan</p>
          <p className="font-type text-[11px] text-ink2">draft v{lane.planVersion}</p>
        </div>
        <ol className="mt-1 divide-y divide-rule">
          {lane.steps.map((s, i) => (
            <Line key={s.id} s={s} n={i + 1} lane={lane} facts={facts} currency={m.currency} />
          ))}
        </ol>
      </div>

      {/* Footnotes: what the plan relies on */}
      <div className="mt-6 border-t border-ink pt-2">
        <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">Facts this plan relies on</p>
        <ol className="mt-1">
          {shownFacts.map((f, i) => (
            <Footnote key={f.id} f={f} i={i + 1} lane={lane} />
          ))}
        </ol>
        {lane.id === "baseline" && (
          <p className="mt-2 -rotate-1">
            <Hand inView className="text-[22px]">nobody is checking these</Hand>
          </p>
        )}
      </div>

      <Corrections lane={lane} currency={m.currency} clock={clock} onApprove={onApprove} />
    </motion.article>
  );
}
