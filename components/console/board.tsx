"use client";

import { AnimatePresence, motion } from "motion/react";
import type { Lane, Step } from "@/lib/domain/types";
import { Flap, Scramble, type FlapTone } from "../ui/flap";

function statusOf(s: Step, held: boolean): { word: string; tone: FlapTone; lamp: string } {
  if (held) return { word: "HELD", tone: "stop", lamp: "bg-stop lamp-live text-stop" };
  switch (s.status) {
    case "done":
      if (s.kind === "cancel" && s.cost === 0) return { word: "NO REF", tone: "stop", lamp: "bg-stop text-stop" };
      return { word: s.kind === "notify" ? "SENT" : s.kind === "cancel" ? "REFUND" : "DONE", tone: "go", lamp: "bg-go text-go" };
    case "failed":
      return { word: "FAILED", tone: "stop", lamp: "bg-stop text-stop" };
    case "voided":
      return { word: "VOID", tone: "dim", lamp: "bg-line text-dim" };
    case "dropped":
      return { word: "DROP", tone: "dim", lamp: "bg-line text-dim" };
    default:
      return { word: "QUEUED", tone: "paper", lamp: "bg-paper/30 text-paper" };
  }
}

function Row({ s, lane, currency }: { s: Step; lane: Lane; currency: string }) {
  const gone = s.status === "dropped" || s.status === "voided";
  const fresh = s.origin > 1 && !gone;
  const st = statusOf(s, lane.heldStep === s.id && s.status === "pending");
  return (
    <motion.li
      layout="position"
      initial={{ opacity: 0, x: -14 }}
      animate={{ opacity: gone ? 0.42 : 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className={`relative grid grid-cols-[10px_1fr_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2.5 py-2 ${fresh ? "bg-signal/[0.07]" : ""}`}
    >
      {fresh && (
        <motion.span
          aria-hidden
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          className="absolute inset-y-1.5 left-0 w-[3px] origin-top rounded-full bg-signal"
        />
      )}
      <span className={`h-2 w-2 rounded-full ${st.lamp}`} />
      <div className="min-w-0">
        <p className={`line-clamp-2 text-[14px] leading-tight sm:line-clamp-1 ${gone ? "text-dim line-through decoration-stop/60" : "text-paper"}`}>
          <Scramble text={s.title} boot={fresh} />
        </p>
        <p className="mt-0.5 font-mono text-[10.5px] text-dim">
          {gone ? (s.status === "voided" ? "voided by a revision" : "dropped by a revision") : s.result ?? (s.reversible ? "reversible" : "irreversible")}
          {fresh && <span className="ml-2 text-signal">NEW IN V{s.origin}</span>}
          {s.cost !== 0 && (
            <span className={`ml-2 ${s.cost < 0 ? "text-go" : ""}`}>
              {s.cost < 0 ? "+" : "-"}
              {currency}
              {Math.abs(s.cost).toLocaleString("en-US")}
            </span>
          )}
        </p>
      </div>
      <Flap text={st.word} length={6} size="xs" tone={st.tone} boot={false} stagger={30} />
    </motion.li>
  );
}

export function Board({ lane, currency }: { lane: Lane; currency: string }) {
  const live = lane.steps.filter((s) => s.status !== "dropped" && s.status !== "voided");
  const retired = lane.steps.filter((s) => s.status === "dropped" || s.status === "voided");
  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <h4 className="font-display text-[20px] font-extrabold uppercase leading-none">The plan</h4>
        <span className="flex items-center gap-2 font-mono text-[10.5px] text-dim">
          VERSION <Flap text={String(lane.planVersion)} size="xs" tone={lane.planVersion > 1 ? "signal" : "paper"} />
        </span>
      </div>
      <ul className="grid gap-0.5 rounded-xl border border-line bg-ink p-1.5">
        <AnimatePresence initial={false}>
          {live.map((s) => (
            <Row key={s.id} s={s} lane={lane} currency={currency} />
          ))}
        </AnimatePresence>
      </ul>
      {retired.length > 0 && (
        <details className="group mt-2">
          <summary className="cursor-pointer list-none font-mono text-[10.5px] text-dim transition-colors hover:text-paper">
            <span className="inline-block transition-transform group-open:rotate-90">›</span> {retired.length} superseded step{retired.length === 1 ? "" : "s"} from earlier versions
          </summary>
          <ul className="mt-1 grid gap-0.5">
            {retired.map((s) => (
              <Row key={s.id} s={s} lane={lane} currency={currency} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
