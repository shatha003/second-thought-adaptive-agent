"use client";

import { AnimatePresence, motion } from "motion/react";
import { CheckCircle, Circle, MinusCircle, ProhibitInset, XCircle } from "@phosphor-icons/react";
import type { Lane, Step } from "@/lib/domain/types";

const ICON = 16;

function StatusIcon({ s }: { s: Step["status"] }) {
  switch (s) {
    case "done":
      return <CheckCircle size={ICON} weight="fill" className="text-good" />;
    case "failed":
      return <XCircle size={ICON} weight="fill" className="text-bad" />;
    case "voided":
      return <ProhibitInset size={ICON} className="text-muted" />;
    case "dropped":
      return <MinusCircle size={ICON} className="text-muted" />;
    default:
      return <Circle size={ICON} className="text-muted" />;
  }
}

export function PlanList({ lane, currency }: { lane: Lane; currency: string }) {
  // Show the live plan first, then superseded steps beneath it so the diff stays readable.
  const live = lane.steps.filter((s) => s.status !== "dropped" && s.status !== "voided");
  const retired = lane.steps.filter((s) => s.status === "dropped" || s.status === "voided");
  const ordered = [...live, ...retired];

  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h4 className="text-xs font-medium text-muted">Plan</h4>
        <span className="font-mono text-[11px] text-muted">v{lane.planVersion}</span>
      </div>
      <ul className="flex flex-col gap-1">
        <AnimatePresence initial={false}>
          {ordered.map((s) => {
            const gone = s.status === "dropped" || s.status === "voided";
            const fresh = s.origin > 1 && !gone;
            return (
              <motion.li
                key={s.id}
                layout="position"
                initial={{ opacity: 0, y: -6, backgroundColor: "var(--accent-soft)" }}
                animate={{ opacity: gone ? 0.55 : 1, y: 0, backgroundColor: fresh ? "var(--accent-soft)" : "transparent" }}
                transition={{ type: "spring", stiffness: 260, damping: 28 }}
                className="flex items-start gap-2 rounded-[var(--radius-chip)] px-2 py-1.5"
              >
                <span className="mt-0.5 shrink-0">
                  <StatusIcon s={s.status} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug ${gone ? "text-muted line-through" : "text-fg"}`}>{s.title}</p>
                  {(s.result || gone || fresh) && (
                    <p className="mt-0.5 text-[11px] text-muted">
                      {gone ? (s.status === "voided" ? "voided by revision" : "dropped by revision") : s.result}
                      {fresh && <span className="ml-1.5 font-medium text-accent">added in v{s.origin}</span>}
                    </p>
                  )}
                </div>
                {s.cost !== 0 && (
                  <span className={`shrink-0 font-mono text-[11px] ${s.cost < 0 ? "text-good" : "text-muted"}`}>
                    {s.cost < 0 ? "+" : ""}
                    {currency}
                    {Math.abs(s.cost).toLocaleString("en-US")}
                  </span>
                )}
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </div>
  );
}
