"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowRight, CaretRight, CheckCircle, Hand, MagnifyingGlass, MinusCircle, ShieldCheck, SpeakerSlash, Waves, XCircle } from "@phosphor-icons/react";
import type { JournalEntry, Lane, Revision } from "@/lib/domain/types";
import { Flap } from "../ui/flap";

const LEVEL = ["Ignore", "Verify", "Patch", "Re-plan", "Escalate"];

/** "I changed my mind because X" with the reason given the accent. */
function Because({ text }: { text: string }) {
  const i = text.indexOf(" because ");
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)} <em className="font-semibold not-italic text-signal">because</em>
      {text.slice(i + 8)}
    </>
  );
}

function GateLamps({ gates }: { gates: Revision["gates"] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-2">
      {gates.map((g, i) => (
        <li key={g.name} className="flex items-center gap-1.5" title={g.detail}>
          <motion.span
            initial={{ backgroundColor: "rgb(38 43 58)", scale: 0.6 }}
            animate={{
              backgroundColor: g.pass ? "rgb(75 227 160)" : "rgb(255 72 103)",
              scale: 1,
              boxShadow: g.pass ? "0 0 12px 1px rgb(75 227 160 / 0.5)" : "0 0 12px 1px rgb(255 72 103 / 0.55)",
            }}
            transition={{ delay: 0.25 + i * 0.22, type: "spring", stiffness: 300, damping: 18 }}
            className="h-2.5 w-2.5 rounded-full"
          />
          <span className={`font-mono text-[10.5px] ${g.pass ? "text-paper/75" : "text-stop"}`}>{g.name}</span>
        </li>
      ))}
    </ul>
  );
}

function Reasoning({ r, currency, open: initial }: { r: Revision; currency: string; open: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <div className="mt-3">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-1 font-mono text-[10.5px] text-dim transition-colors hover:text-paper">
        <CaretRight size={11} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        {open ? "HIDE" : "SHOW"} THE OPTIONS IT WEIGHED ({r.options.length})
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ul className="mt-2 grid gap-1.5">
              {r.options.map((o, i) => (
                <motion.li
                  key={o.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`grid grid-cols-[16px_1fr_auto] gap-x-2 rounded-lg px-2 py-1.5 ${o.verdict === "chosen" ? "bg-go/[0.08]" : ""}`}
                >
                  {o.verdict === "chosen" ? (
                    <CheckCircle size={15} weight="fill" className="mt-px text-go" />
                  ) : o.verdict === "rejected" ? (
                    <XCircle size={15} weight="fill" className="mt-px text-stop" />
                  ) : (
                    <MinusCircle size={15} className="mt-px text-dim" />
                  )}
                  <div className="min-w-0">
                    <p className={`text-[13px] leading-tight ${o.verdict === "chosen" ? "font-semibold" : "text-paper/85"}`}>{o.label}</p>
                    <p className="mt-0.5 text-[11.5px] leading-snug text-dim">
                      {o.verdict === "not-tried" && o.failing.length ? `would fail: ${o.failing.join("; ")}` : o.reason}
                    </p>
                  </div>
                  <span className="font-mono text-[10.5px] text-dim">
                    {currency}
                    {o.netCost.toLocaleString("en-US")} · {o.met}/{o.total}
                  </span>
                </motion.li>
              ))}
            </ul>
            <p className="mt-2 font-mono text-[10.5px] text-dim">
              DECIDED BY {r.planner.toUpperCase()}. {r.rationale}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RevisionCard({ e, n, currency, latest, lane, onApprove }: { e: JournalEntry; n: number; currency: string; latest: boolean; lane: Lane; onApprove: () => void }) {
  const r = e.revision!;
  const escalated = e.kind === "escalation";
  const canApprove = escalated && latest && lane.status === "holding" && !lane.score && lane.escalation?.optionId;
  const tone = escalated ? "border-stop/50 bg-stop/[0.06]" : "border-signal/50 bg-signal/[0.06]";
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 22 }}
      className={`relative overflow-hidden rounded-xl border p-4 ${tone}`}
    >
      <div className="flex items-center gap-2">
        <span className={`font-display text-[15px] font-black uppercase tracking-wide ${escalated ? "text-stop" : "text-signal"}`}>
          {escalated ? "Held for a human" : `Second thought ${String(n).padStart(2, "0")}`}
        </span>
        <span className="ml-auto rounded-full border border-line px-2 py-0.5 font-mono text-[10px] text-dim">
          L{e.level} {LEVEL[e.level].toUpperCase()}
        </span>
        <span className="font-mono text-[10px] text-dim">T{e.tick}</span>
      </div>

      <p className="mt-2 text-[15.5px] font-medium leading-snug">
        {escalated ? <Hand size={16} weight="fill" className="mr-1.5 inline -translate-y-px text-stop" /> : null}
        <Because text={e.headline} />
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[10.5px] text-dim">
        <span>ASSUMED</span>
        <Flap text={String(r.trigger.before)} size="xs" boot={false} />
        <ArrowRight size={12} className="text-signal" />
        <span>NOW</span>
        <Flap text={String(r.trigger.after)} size="xs" tone={escalated ? "stop" : "signal"} />
        {r.trigger.dependents.length > 0 && <span className="ml-1">· {r.trigger.dependents.length} steps depended on it</span>}
      </div>

      {!escalated && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
          <span><span className="text-paper">{r.diff.kept.length}</span> <span className="text-dim">kept</span></span>
          <span><span className="text-stop">{r.diff.dropped.length}</span> <span className="text-dim">dropped</span></span>
          <span><span className="text-go">{r.diff.added.length}</span> <span className="text-dim">added</span></span>
          <span><span className="text-signal">{r.diff.compensated.length}</span> <span className="text-dim">undone</span></span>
          <span className="ml-auto text-dim">
            criteria {r.before.met}/{r.before.total} <ArrowRight size={10} className="inline" /> <span className="text-go">{r.after?.met ?? r.before.met}/{r.after?.total ?? r.before.total}</span>
          </span>
        </div>
      )}

      {r.gates.length > 0 && (
        <div className="mt-3 border-t border-line/70 pt-3">
          <GateLamps gates={r.gates} />
        </div>
      )}

      <Reasoning r={r} currency={currency} open={latest} />

      {canApprove && (
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.98 }}
          onClick={onApprove}
          className="mt-4 w-full rounded-xl border border-stop bg-stop/15 px-4 py-3 text-left"
        >
          <span className="block font-display text-[17px] font-extrabold uppercase">Approve “{lane.escalation?.optionLabel}”</span>
          <span className="block text-[12px] text-paper/70">You override the gate and accept the budget breach. This is logged.</span>
        </motion.button>
      )}
    </motion.li>
  );
}

function SmallEntry({ e }: { e: JournalEntry }) {
  const map = {
    verify: { Icon: MagnifyingGlass, cls: "text-go", tag: "VERIFIED" },
    guard: { Icon: ShieldCheck, cls: "text-signal", tag: "GUARD" },
    absorbed: { Icon: Waves, cls: "text-dim", tag: "ABSORBED" },
    noise: { Icon: SpeakerSlash, cls: "text-dim", tag: "IGNORED" },
  } as const;
  const m = map[e.kind as keyof typeof map] ?? map.noise;
  return (
    <motion.li layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-[18px_1fr] gap-x-2.5 px-1 py-2">
      <m.Icon size={16} className={`mt-0.5 ${m.cls}`} />
      <div className="min-w-0">
        <p className="text-[13.5px] leading-snug text-paper/90">
          <span className={`mr-2 font-mono text-[10px] ${m.cls}`}>
            L{e.level} {m.tag} T{e.tick}
          </span>
          {e.headline}
        </p>
        {e.detail && <p className="mt-0.5 text-[12px] leading-snug text-dim">{e.detail}</p>}
      </div>
    </motion.li>
  );
}

export function Thoughts({ lane, currency, onApprove }: { lane: Lane; currency: string; onApprove: () => void }) {
  let n = 0;
  const numbered = lane.journal.map((e) => ({ e, n: e.kind === "revision" ? ++n : 0 }));
  const entries = numbered.reverse();
  const latestBig = entries.find((x) => x.e.revision)?.e.id;

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <h4 className="font-display text-[20px] font-extrabold uppercase leading-none">Second thoughts</h4>
        <span className="font-mono text-[10.5px] text-dim">
          {lane.revisionsUsed} of {lane.policy.revisionBudget > 50 ? "unlimited" : lane.policy.revisionBudget} changes of mind used
        </span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-4 text-[13.5px] text-dim">
          {lane.id === "baseline"
            ? "Empty, and that is the problem. This agent will never notice that anything changed."
            : "Nothing yet. Every change of mind lands here with its reasons."}
        </p>
      ) : (
        <ul className="grid gap-2">
          <AnimatePresence initial={false}>
            {entries.map(({ e, n }) =>
              e.revision ? (
                <RevisionCard key={e.id} e={e} n={n} currency={currency} latest={e.id === latestBig} lane={lane} onApprove={onApprove} />
              ) : (
                <SmallEntry key={e.id} e={e} />
              ),
            )}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
