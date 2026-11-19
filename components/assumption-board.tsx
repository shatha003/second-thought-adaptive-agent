"use client";

import { motion } from "motion/react";
import { Eye, EyeSlash, ShieldCheck, Warning, WarningOctagon, Hourglass } from "@phosphor-icons/react";
import type { AssumptionRT, Lane } from "@/lib/domain/types";

const STATE = {
  holding: { label: "holds", cls: "border-line text-fg", Icon: ShieldCheck, tone: "text-good" },
  weakened: { label: "in doubt", cls: "border-accent text-fg bg-accent-soft", Icon: Warning, tone: "text-accent" },
  stale: { label: "stale", cls: "border-line text-fg", Icon: Hourglass, tone: "text-muted" },
  violated: { label: "violated", cls: "border-bad text-fg bg-bad-soft", Icon: WarningOctagon, tone: "text-bad" },
  retired: { label: "retired", cls: "border-line text-muted", Icon: ShieldCheck, tone: "text-muted" },
} as const;

function Chip({ a, lane }: { a: AssumptionRT; lane: Lane }) {
  const st = a.absorbed ? { ...STATE.violated, label: "absorbed", cls: "border-line text-fg", tone: "text-muted" } : STATE[a.state];
  const b = lane.beliefs[a.key];
  const pulsing = a.state === "violated" && !a.handled;
  const deps = lane.steps.filter((s) => (s.status === "pending" || s.status === "done") && s.assumptions.includes(a.id)).length;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: a.state === "retired" ? 0.5 : 1, scale: 1 }}
      className={`rounded-[var(--radius-chip)] border px-2.5 py-1.5 ${st.cls} ${pulsing ? "animate-pulse" : ""}`}
      title={`${a.key} = ${b ? String(b.value) : "?"}${b?.pending ? ` (pending: ${String(b.pending.value)})` : ""}`}
    >
      <div className="flex items-center gap-1.5">
        <st.Icon size={14} weight="fill" className={st.tone} />
        <span className="text-[12.5px] leading-tight">{a.statement}</span>
      </div>
      <div className="mt-1 flex items-center gap-2 pl-5 font-mono text-[10.5px] text-muted">
        <span className={st.tone}>{st.label}</span>
        <span>{a.key.split(".").slice(-2).join(".")} = {b ? String(b.value) : "?"}</span>
        {b?.pending && <span className="text-accent">pending {String(b.pending.value)}</span>}
        {a.state !== "retired" && <span>{deps} step{deps === 1 ? "" : "s"} depend</span>}
      </div>
    </motion.li>
  );
}

export function AssumptionBoard({ lane }: { lane: Lane }) {
  if (lane.id === "baseline") {
    return (
      <div>
        <h4 className="mb-2 text-xs font-medium text-muted">World model</h4>
        <div className="flex items-center gap-2 rounded-[var(--radius-chip)] border border-dashed border-line px-3 py-2.5 text-[12.5px] text-muted">
          <EyeSlash size={16} />
          None. This agent does not track what its plan depends on.
        </div>
      </div>
    );
  }
  const visible = lane.assumptions.filter((a) => a.state !== "retired");
  const retired = lane.assumptions.filter((a) => a.state === "retired");
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-xs font-medium text-muted">Assumptions it is watching</h4>
        <span className="flex items-center gap-1 font-mono text-[11px] text-muted">
          <Eye size={12} /> {visible.length}
        </span>
      </div>
      <ul className="flex flex-col gap-1.5">
        {visible.map((a) => (
          <Chip key={a.id} a={a} lane={lane} />
        ))}
        {retired.length > 0 && (
          <li className="px-1 pt-1 text-[11px] text-muted">{retired.length} retired by revisions</li>
        )}
      </ul>
    </div>
  );
}
