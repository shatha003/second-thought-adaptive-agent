"use client";

import { motion } from "motion/react";
import { CheckCircle, Hourglass, Lightning, Prohibit, ShieldWarning, Warning, XCircle } from "@phosphor-icons/react";
import type { Lane, Mission, Score } from "@/lib/domain/types";
import { AssumptionBoard } from "./assumption-board";
import { Journal } from "./journal";
import { PlanList } from "./plan-list";

const VERDICT: Record<Score["verdict"], { tone: string; bg: string; Icon: typeof CheckCircle; title: string }> = {
  achieved: { tone: "text-good", bg: "bg-good-soft border-good", Icon: CheckCircle, title: "Mission achieved" },
  "silent-failure": { tone: "text-bad", bg: "bg-bad-soft border-bad", Icon: Prohibit, title: "Silent failure" },
  failed: { tone: "text-bad", bg: "bg-bad-soft border-bad", Icon: XCircle, title: "Mission failed" },
  contained: { tone: "text-accent", bg: "bg-accent-soft border-accent", Icon: ShieldWarning, title: "Contained" },
  breached: { tone: "text-bad", bg: "bg-bad-soft border-bad", Icon: Warning, title: "Contract breached" },
};

function Money({ n, currency }: { n: number; currency: string }) {
  return (
    <span className="font-mono">
      {currency}
      {Math.round(n).toLocaleString("en-US")}
    </span>
  );
}

export function LanePanel({
  lane,
  mission,
  netCost,
  onApprove,
}: {
  lane: Lane;
  mission: Mission;
  netCost: number;
  onApprove: (id: Lane["id"]) => void;
}) {
  const score = lane.score;
  const v = score ? VERDICT[score.verdict] : null;
  const over = netCost > mission.budget;
  const unguarded = lane.id === "unguarded";

  return (
    <section
      aria-label={lane.label}
      className="flex min-w-0 flex-col rounded-[var(--radius)] border border-line bg-panel"
    >
      <header className="border-b border-line p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="flex items-center gap-2 text-[15px] font-semibold tracking-tight">
              {lane.label}
              {unguarded && <Lightning size={14} weight="fill" className="text-bad" />}
            </h3>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{lane.blurb}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-[11px] text-muted">Net spend</p>
            <p className={`text-[15px] ${over ? "text-bad" : "text-fg"}`}>
              <Money n={netCost} currency={mission.currency} />
            </p>
            <p className="font-mono text-[11px] text-muted">
              of <Money n={mission.budget} currency={mission.currency} />
            </p>
          </div>
        </div>

        {lane.status === "holding" && !score && (
          <p className="mt-3 flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-bad-soft px-2.5 py-1.5 text-[12.5px] text-fg">
            <Hourglass size={14} weight="fill" className="text-bad" /> Paused, waiting for a human decision
          </p>
        )}

        {score && v && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`mt-3 rounded-[var(--radius-chip)] border px-3 py-2.5 ${v.bg}`}
          >
            <p className={`flex items-center gap-1.5 text-[13px] font-semibold ${v.tone}`}>
              <v.Icon size={16} weight="fill" /> {v.title}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-fg">{score.headline}</p>
            <ul className="mt-2 grid gap-1">
              {score.criteria.map((c) => (
                <li key={c.id} className="flex items-start gap-1.5 text-[12px]">
                  {c.ok ? (
                    <CheckCircle size={13} weight="fill" className="mt-px shrink-0 text-good" />
                  ) : (
                    <XCircle size={13} weight="fill" className="mt-px shrink-0 text-bad" />
                  )}
                  <span className="text-fg">{c.label}</span>
                  <span className="truncate text-muted">{c.detail}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </header>

      <div className="grid gap-5 p-4">
        <PlanList lane={lane} currency={mission.currency} />
        <AssumptionBoard lane={lane} />
        <Journal lane={lane} currency={mission.currency} onApprove={onApprove} />
      </div>
    </section>
  );
}
