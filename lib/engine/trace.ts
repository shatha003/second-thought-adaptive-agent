import type { Revision } from "@/lib/domain/types";

/**
 * The "I changed my mind because…" receipt, rendered from the structured revision record,
 * never from free text, so it cannot hallucinate.
 */
export function narrate(r: Revision): string {
  const t = r.trigger;
  const lines: string[] = [];
  if (r.decision === "escalated") {
    lines.push(`I'm stopping to ask a human, because ${t.evidence} contradicted "${t.statement}".`);
  } else {
    lines.push(`I changed my mind because ${t.evidence} contradicted "${t.statement}".`);
  }
  lines.push(
    `I had assumed ${String(t.before)}; I now believe ${String(t.after)}. ${t.dependents.length} step${t.dependents.length === 1 ? "" : "s"} depended on that: ${t.dependents.join("; ") || "none"}.`,
  );
  const tried = r.options.map((o) => `${o.verdict === "chosen" ? "✓" : o.verdict === "rejected" ? "✗" : "·"} ${o.label}`).join(" | ");
  lines.push(`Options weighed: ${tried}.`);
  if (r.chosenId) {
    const c = r.options.find((o) => o.id === r.chosenId);
    lines.push(`Chosen: ${c?.label}. Kept ${r.diff.kept.length} · dropped ${r.diff.dropped.length} · added ${r.diff.added.length} · compensated ${r.diff.compensated.length}.`);
  } else {
    lines.push("No option passed the safety gate, so the plan is on hold.");
  }
  return lines.join("\n");
}
