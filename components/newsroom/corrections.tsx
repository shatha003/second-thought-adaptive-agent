"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { JournalEntry, Lane, Revision } from "@/lib/domain/types";
import { Cross, Hand, Ring, Tick } from "../ink/marks";
import { sentence } from "../ink/text";

const LEVEL = ["noise", "stet", "patch", "rewrite", "query"];

const n2w = (n: number) => ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"][n] ?? String(n);

function Checklist({ gates }: { gates: Revision["gates"] }) {
  return (
    <ul className="mt-3 grid gap-1 sm:grid-cols-2">
      {gates.map((g, i) => (
        <li key={g.name} className="flex items-center gap-2 font-type text-[12px]" title={g.detail}>
          <span className="relative grid h-[15px] w-[15px] shrink-0 place-items-center border-[1.5px] border-ink">
            <span className="absolute -left-0.5 -top-1.5">{g.pass ? <Tick delay={0.4 + i * 0.25} size="20px" /> : <Cross delay={0.4 + i * 0.25} size="18px" />}</span>
          </span>
          <span className={g.pass ? "" : "font-bold text-red"}>{g.name}</span>
        </li>
      ))}
    </ul>
  );
}

function Considered({ r, currency, initial }: { r: Revision; currency: string; initial: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen((o) => !o)} className="font-type text-[11.5px] uppercase tracking-wider underline decoration-dotted underline-offset-4 hover:text-red">
        {open ? "Hide" : "Show"} {r.options.length === 1 ? "the one option" : `the ${n2w(r.options.length)} options`} it considered
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.ul initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            {r.options.map((o) => (
              <li key={o.id} className="mt-2 grid grid-cols-[22px_1fr] gap-x-1.5 font-serif text-[15px] leading-snug">
                <span className="pt-0.5">{o.verdict === "chosen" ? <Tick size="17px" /> : <Cross size="15px" ink={o.verdict === "rejected" ? "red" : "ink"} />}</span>
                <span>
                  <span className={o.verdict === "chosen" ? "font-bold" : ""}>{o.label}</span>
                  <span className="ml-2 font-type text-[11.5px] text-ink2">
                    {currency}
                    {o.netCost.toLocaleString("en-US")}, meets {o.met} of {o.total}
                  </span>
                  <span className="block text-[13.5px] italic text-ink2">
                    {o.verdict === "not-tried" && o.failing.length ? `Would fail: ${o.failing.join("; ")}.` : `${o.reason.charAt(0).toUpperCase()}${o.reason.slice(1)}.`}
                  </span>
                </span>
              </li>
            ))}
            <li className="mt-2 font-type text-[11px] text-ink2">Decided by the {r.planner}. {r.rationale}</li>
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}

function Because({ text }: { text: string }) {
  const i = text.indexOf(" because ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)} <span className="mx-0.5 font-hand text-[1.3em] font-bold leading-none text-red">because</span>{" "}
      {text.slice(i + 9)}
    </>
  );
}

function Correction({ e, currency, clock, latest, lane, onApprove }: { e: JournalEntry; currency: string; clock: (t: number) => string; latest: boolean; lane: Lane; onApprove: () => void }) {
  const r = e.revision!;
  const query = e.kind === "escalation";
  const canApprove = query && latest && lane.status === "holding" && !lane.score && lane.escalation?.optionId;
  const t = r.trigger;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, x: -16 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ type: "spring", stiffness: 140, damping: 18 }}
      className={`relative border-l-[3px] py-1 pl-4 ${query ? "border-red" : "border-ink"}`}
    >
      <p className="font-type text-[11.5px] font-bold uppercase tracking-wider">
        <span className="text-red">{query ? "Query to the author" : "Correction"}</span>
        <span className="text-ink2">
          {" "}
          {clock(e.tick)}, {LEVEL[e.level]} (L{e.level})
        </span>
      </p>
      <p className="mt-1.5 font-serif text-[17px] leading-[1.5]">
        <Because text={sentence(e.headline)} />{" "}
        <span className="text-ink/80">
          I had assumed <span className="font-type text-[14px]">{String(t.before)}</span>; I now believe{" "}
          <span className="font-type text-[14px] font-bold text-red">{String(t.after)}</span>.
          {t.dependents.length > 0 && ` ${n2w(t.dependents.length).replace(/^./, (c) => c.toUpperCase())} step${t.dependents.length === 1 ? "" : "s"} depended on it.`}
        </span>
      </p>
      {!query && (
        <p className="mt-1.5 font-type text-[12px] text-ink2">
          Kept {r.diff.kept.length}. Struck {r.diff.dropped.length}. Inserted {r.diff.added.length}. Undone {r.diff.compensated.length}. Criteria met {r.before.met}/{r.before.total} to{" "}
          <span className="font-bold text-ink">
            {r.after?.met ?? r.before.met}/{r.after?.total ?? r.before.total}
          </span>
          .
        </p>
      )}
      {r.gates.length > 0 && <Checklist gates={r.gates} />}
      <Considered r={r} currency={currency} initial={latest} />
      {canApprove && (
        <div className="mt-4">
          <button onClick={onApprove} className="group relative w-full border-2 border-red bg-sheet px-4 py-3 text-left transition-colors hover:bg-red hover:text-sheet">
            <span className="block font-type text-[13px] font-bold uppercase tracking-wider">Author approves: print “{lane.escalation?.optionLabel}”</span>
            <span className="block font-serif text-[14px] italic opacity-80">You override the checklist and accept the budget breach. It goes on the record.</span>
          </button>
        </div>
      )}
    </motion.li>
  );
}

function Brief({ e, clock }: { e: JournalEntry; clock: (t: number) => string }) {
  const stet = e.kind === "verify" || e.kind === "absorbed";
  const label = e.kind === "verify" ? "Stet" : e.kind === "absorbed" ? "Stet (absorbed)" : e.kind === "guard" ? "Guard" : "N/a";
  return (
    <motion.li layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-1 pl-[19px]">
      <p className="font-serif text-[15.5px] leading-snug">
        <span className={`mr-2 font-type text-[11px] font-bold uppercase tracking-wider ${stet ? "text-blue" : e.kind === "guard" ? "text-red" : "text-ink2"}`}>
          {label}, {clock(e.tick)}.
        </span>
        <span className={e.kind === "noise" ? "text-ink/60" : ""}>{sentence(e.headline)}</span>
        {e.detail && <span className="block text-[13.5px] italic text-ink2">{e.detail}</span>}
      </p>
    </motion.li>
  );
}

export function Corrections({ lane, currency, clock, onApprove }: { lane: Lane; currency: string; clock: (t: number) => string; onApprove: () => void }) {
  const entries = [...lane.journal].reverse();
  const latestBig = entries.find((e) => e.revision)?.id;
  return (
    <div className="mt-8 border-t-2 border-ink pt-2">
      <div className="flex items-baseline justify-between">
        <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">Corrections and clarifications</p>
        <p className="font-type text-[11px] text-ink2">
          {lane.revisionsUsed} of {lane.policy.revisionBudget > 50 ? "unlimited" : lane.policy.revisionBudget}
        </p>
      </div>
      {entries.length === 0 ? (
        <p className="mt-3 font-serif text-[16px] italic text-ink2">
          {lane.id === "baseline" ? (
            <>
              None. <Ring>This paper never prints a correction</Ring>, so it never knows it is wrong.
            </>
          ) : (
            "None yet. Every change of mind will be printed here, with its reasons."
          )}
        </p>
      ) : (
        <ul className="mt-3 grid gap-4">
          <AnimatePresence initial={false}>
            {entries.map((e) =>
              e.revision ? (
                <Correction key={e.id} e={e} currency={currency} clock={clock} latest={e.id === latestBig} lane={lane} onApprove={onApprove} />
              ) : (
                <Brief key={e.id} e={e} clock={clock} />
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
      {lane.revisionsUsed > 0 && (
        <p className="mt-4 -rotate-1 text-right">
          <Hand className="text-[22px]">{`${n2w(lane.revisionsUsed)} second thought${lane.revisionsUsed === 1 ? "" : "s"}, all on the record`}</Hand>
        </p>
      )}
    </div>
  );
}
