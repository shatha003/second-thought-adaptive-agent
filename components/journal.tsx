"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowsClockwise,
  CaretDown,
  CheckCircle,
  Hand,
  MagnifyingGlass,
  MinusCircle,
  ProhibitInset,
  ShieldCheck,
  SpeakerSlash,
  WarningOctagon,
  XCircle,
} from "@phosphor-icons/react";
import type { JournalEntry, Lane, Revision } from "@/lib/domain/types";

const LEVEL_NAME = ["Ignored", "Verified", "Patched", "Re-planned", "Escalated"];

function Frame({
  entry,
  icon,
  tone,
  children,
  label,
}: {
  entry: JournalEntry;
  icon: React.ReactNode;
  tone: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 240, damping: 26 }}
      className={`rounded-[var(--radius)] border bg-panel2 p-3 ${tone}`}
    >
      <div className="mb-1 flex items-center gap-2 text-[11px]">
        {icon}
        <span className="font-medium uppercase tracking-wide text-muted">{label}</span>
        <span className="ml-auto font-mono text-muted">t{entry.tick}</span>
      </div>
      <p className="text-[13.5px] leading-snug text-fg">{entry.headline}</p>
      {children}
    </motion.li>
  );
}

function Gate({ g }: { g: Revision["gates"][number] }) {
  return (
    <li className="flex items-start gap-1.5 text-[11.5px]" title={g.detail}>
      {g.pass ? <CheckCircle size={13} weight="fill" className="mt-px shrink-0 text-good" /> : <XCircle size={13} weight="fill" className="mt-px shrink-0 text-bad" />}
      <span className="text-fg">{g.name}</span>
      <span className="truncate text-muted">{g.detail}</span>
    </li>
  );
}

function RevisionBody({ r, currency }: { r: Revision; currency: string }) {
  const [open, setOpen] = useState(true);
  const t = r.trigger;
  return (
    <>
      <p className="mt-1.5 text-[12px] text-muted">
        I had assumed <span className="font-mono text-fg">{String(t.before)}</span>. I now believe{" "}
        <span className="font-mono text-fg">{String(t.after)}</span>.{" "}
        {t.dependents.length > 0 && (
          <>
            {t.dependents.length} step{t.dependents.length === 1 ? "" : "s"} depended on it.
          </>
        )}
      </p>

      {r.decision !== "escalated" && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 text-[11px]">
          <Chip tone="text-muted" n={r.diff.kept.length} label="kept" />
          <Chip tone="text-bad" n={r.diff.dropped.length} label="dropped" />
          <Chip tone="text-good" n={r.diff.added.length} label="added" />
          <Chip tone="text-accent" n={r.diff.compensated.length} label="compensated" />
          <span className="ml-auto font-mono text-muted">
            {r.before.met}/{r.before.total} → {r.after?.met ?? r.before.met}/{r.after?.total ?? r.before.total} criteria
          </span>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        className="mt-2.5 flex items-center gap-1 text-[11.5px] text-muted transition-colors hover:text-fg"
      >
        <CaretDown size={12} className={`transition-transform ${open ? "" : "-rotate-90"}`} />
        {open ? "Hide reasoning" : "Show reasoning"}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="mt-2 text-[11px] font-medium text-muted">Options weighed ({r.planner})</p>
            <ul className="mt-1 flex flex-col gap-1">
              {r.options.map((o) => (
                <li key={o.id} className="flex items-start gap-1.5 text-[12px]">
                  {o.verdict === "chosen" ? (
                    <CheckCircle size={14} weight="fill" className="mt-px shrink-0 text-good" />
                  ) : o.verdict === "rejected" ? (
                    <XCircle size={14} weight="fill" className="mt-px shrink-0 text-bad" />
                  ) : (
                    <MinusCircle size={14} className="mt-px shrink-0 text-muted" />
                  )}
                  <div className="min-w-0">
                    <span className={o.verdict === "chosen" ? "font-medium text-fg" : "text-fg"}>{o.label}</span>
                    <span className="ml-1.5 font-mono text-[11px] text-muted">
                      {currency}
                      {o.netCost.toLocaleString("en-US")} · {o.met}/{o.total}
                    </span>
                    {o.verdict !== "not-tried" && (
                      <p className="text-[11px] leading-snug text-muted">
                        {o.reason}
                      </p>
                    )}
                    {o.verdict === "not-tried" && o.failing.length > 0 && (
                      <p className="text-[11px] leading-snug text-muted">would fail: {o.failing.join("; ")}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {r.gates.length > 0 && (
              <>
                <p className="mt-2.5 text-[11px] font-medium text-muted">Safety gate on the chosen plan</p>
                <ul className="mt-1 flex flex-col gap-0.5">
                  {r.gates.map((g) => (
                    <Gate key={g.name} g={g} />
                  ))}
                </ul>
              </>
            )}
            <p className="mt-2 text-[11px] leading-snug text-muted">{r.rationale}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function Chip({ tone, n, label }: { tone: string; n: number; label: string }) {
  return (
    <span className="rounded-[var(--radius-chip)] border border-line px-1.5 py-0.5">
      <span className={`font-mono ${tone}`}>{n}</span> <span className="text-muted">{label}</span>
    </span>
  );
}

export function Journal({
  lane,
  currency,
  onApprove,
}: {
  lane: Lane;
  currency: string;
  onApprove: (laneId: Lane["id"]) => void;
}) {
  const entries = [...lane.journal].reverse();
  const lastEscalation = [...lane.journal].reverse().find((j) => j.kind === "escalation");

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-xs font-medium text-muted">Mind changes and decisions</h4>
        <span className="font-mono text-[11px] text-muted">{lane.revisionsUsed} revision{lane.revisionsUsed === 1 ? "" : "s"}</span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-[var(--radius-chip)] border border-dashed border-line px-3 py-3 text-[12.5px] text-muted">
          {lane.id === "baseline"
            ? "Nothing here, and that is the problem: this agent never notices that reality changed."
            : "Nothing yet. Every change of mind will appear here with its receipt."}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          <AnimatePresence initial={false}>
            {entries.map((e) => {
              if (e.kind === "revision" && e.revision) {
                return (
                  <Frame key={e.id} entry={e} tone="border-accent" label={`Level ${e.level} · ${LEVEL_NAME[e.level]}`} icon={<ArrowsClockwise size={14} weight="bold" className="text-accent" />}>
                    <RevisionBody r={e.revision} currency={currency} />
                  </Frame>
                );
              }
              if (e.kind === "escalation" && e.revision) {
                const active = lane.status === "holding" && !lane.score && lane.escalation && e.id === lastEscalation?.id;
                return (
                  <Frame key={e.id} entry={e} tone="border-bad" label="Level 4 · Escalated to a human" icon={<Hand size={14} weight="fill" className="text-bad" />}>
                    <RevisionBody r={e.revision} currency={currency} />
                    {active && lane.escalation?.optionId && (
                      <button
                        onClick={() => onApprove(lane.id)}
                        className="mt-3 w-full rounded-[var(--radius-chip)] border border-bad bg-bad-soft px-3 py-2 text-left text-[12.5px] font-medium text-fg transition-transform active:scale-[0.98]"
                      >
                        Approve “{lane.escalation.optionLabel}” and accept the contract breach
                        <span className="block text-[11px] font-normal text-muted">A human overrides the gate. This is logged.</span>
                      </button>
                    )}
                  </Frame>
                );
              }
              if (e.kind === "verify") {
                return (
                  <Frame key={e.id} entry={e} tone="border-line" label="Level 1 · Verified, no change" icon={<MagnifyingGlass size={14} className="text-good" />}>
                    {e.detail && <p className="mt-1.5 text-[12px] leading-snug text-muted">{e.detail}</p>}
                  </Frame>
                );
              }
              if (e.kind === "guard") {
                return (
                  <Frame key={e.id} entry={e} tone="border-line" label="Guard" icon={<ShieldCheck size={14} className="text-accent" />}>
                    {e.detail && <p className="mt-1.5 text-[12px] leading-snug text-muted">{e.detail}</p>}
                  </Frame>
                );
              }
              if (e.kind === "absorbed") {
                return (
                  <Frame key={e.id} entry={e} tone="border-line" label="Level 0 · Absorbed" icon={<ProhibitInset size={14} className="text-muted" />}>
                    {e.detail && <p className="mt-1.5 text-[12px] leading-snug text-muted">{e.detail}</p>}
                  </Frame>
                );
              }
              return (
                <Frame key={e.id} entry={e} tone="border-line" label="Level 0 · Ignored as noise" icon={<SpeakerSlash size={14} className="text-muted" />}>
                  {e.detail && <p className="mt-1.5 text-[12px] leading-snug text-muted">{e.detail}</p>}
                </Frame>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      {lane.status === "holding" && !lane.escalation && (
        <p className="mt-2 flex items-center gap-1.5 text-[12px] text-bad">
          <WarningOctagon size={14} weight="fill" /> Holding
        </p>
      )}
    </div>
  );
}
