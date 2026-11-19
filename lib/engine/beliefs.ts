import type {
  AssumptionDef,
  AssumptionRT,
  AState,
  Belief,
  Json,
  Policy,
  Report,
  Signal,
} from "@/lib/domain/types";

/** Reliability at/above which a single source is treated as authoritative. */
export const AUTHORITATIVE = 0.9;

export function holds(a: AssumptionDef, v: Json | undefined): boolean {
  if (v === undefined) return false;
  switch (a.op) {
    case "eq":
      return v === a.value;
    case "neq":
      return v !== a.value;
    case "gte":
      return typeof v === "number" && typeof a.value === "number" && v >= a.value;
    case "lte":
      return typeof v === "number" && typeof a.value === "number" && v <= a.value;
  }
}

export type IngestKind = "new" | "confirmed" | "dismissed" | "accepted" | "corroborated" | "pending";

export interface IngestResult {
  kind: IngestKind;
  unstable: boolean;
  detail: string;
}

function noisyOr(reports: Report[]): number {
  return 1 - reports.reduce((p, r) => p * (1 - r.reliability), 1);
}

function alternations(reports: Report[], tick: number, window = 6): number {
  const recent = reports.filter((r) => tick - r.tick <= window);
  let n = 0;
  for (let i = 1; i < recent.length; i++) if (recent[i].value !== recent[i - 1].value) n++;
  return n;
}

/**
 * Fold one observation into a belief.
 *
 * With `corroboration` on, a contradiction from a non-authoritative source is held as *pending*
 * until a second independent source agrees (or a direct probe settles it). With `flapGuard` on, a
 * feed that keeps alternating is marked unstable and can no longer change beliefs on its own.
 */
export function ingest(
  prior: Belief | undefined,
  s: Signal,
  policy: Policy,
  tick: number,
): { belief: Belief; result: IngestResult } {
  const report: Report = { tick, value: s.value, source: s.source, reliability: s.reliability };

  if (!prior) {
    return {
      belief: { value: s.value, source: s.source, reliability: s.reliability, tick, reports: [report] },
      result: { kind: "new", unstable: false, detail: `learned ${s.key} = ${String(s.value)}` },
    };
  }

  const b: Belief = structuredClone(prior);
  b.reports = [...b.reports, report].slice(-8);
  const authoritative = s.reliability >= AUTHORITATIVE;

  if (policy.flapGuard) b.unstable = alternations(b.reports, tick) >= 2 && !authoritative;
  if (authoritative) b.unstable = false;

  const accept = (corroborated: boolean) => {
    b.prev = b.value;
    b.value = s.value;
    b.source = s.source;
    b.reliability = corroborated && b.pending ? noisyOr(b.pending.reports) : s.reliability;
    b.corroborated = corroborated;
    b.tick = tick;
    b.pending = undefined;
  };

  // Report agrees with what we already believe.
  if (s.value === b.value) {
    const hadPending = !!b.pending;
    b.pending = undefined;
    b.tick = tick;
    if (s.reliability >= b.reliability) {
      b.source = s.source;
      b.reliability = s.reliability;
    }
    return {
      belief: b,
      result: {
        kind: hadPending ? "dismissed" : "confirmed",
        unstable: !!b.unstable,
        detail: hadPending ? `retracted its contradiction of ${s.key}` : `confirms ${s.key}`,
      },
    };
  }

  // Report contradicts what we believe.
  if (!policy.corroboration || authoritative) {
    accept(false);
    return {
      belief: b,
      result: { kind: "accepted", unstable: !!b.unstable, detail: `${s.key} → ${String(s.value)}` },
    };
  }

  const pending =
    b.pending && b.pending.value === s.value ? b.pending : { value: s.value, reports: [] as Report[] };
  if (!pending.reports.some((r) => r.source === s.source)) pending.reports.push(report);
  b.pending = pending;

  if (pending.reports.length >= 2 && noisyOr(pending.reports) >= 0.8 && !b.unstable) {
    accept(true);
    return {
      belief: b,
      result: { kind: "corroborated", unstable: false, detail: `${s.key} → ${String(s.value)} (corroborated by ${pending.reports.map((r) => r.source).join(" + ")})` },
    };
  }

  return {
    belief: b,
    result: {
      kind: "pending",
      unstable: !!b.unstable,
      detail: b.unstable
        ? `feed is flapping on ${s.key}; not trusting it without a direct probe`
        : `says ${s.key} = ${String(s.value)}; unconfirmed, held as pending`,
    },
  };
}

export function evaluateAssumption(a: AssumptionRT, belief: Belief | undefined, tick: number): AState {
  if (a.state === "retired") return "retired";
  if (!belief) return "violated";
  if (!holds(a, belief.value)) return "violated";
  if (belief.unstable) return "weakened";
  if (belief.pending && !holds(a, belief.pending.value)) return "weakened";
  if (a.ttl !== undefined && tick - belief.tick > a.ttl) return "stale";
  return "holding";
}

export function pct(r: number): string {
  return `${Math.round(r * 100)}%`;
}

export function evidenceLine(b: Belief | undefined): string {
  if (!b) return "no evidence";
  const rs = b.pending ? b.pending.reports : b.reports.slice(-2);
  const sources = Array.from(new Set(rs.map((r) => `${r.source} (${pct(r.reliability)})`)));
  return b.corroborated ? `${sources.join(" + ")}, corroborated` : sources.join(" + ") || b.source;
}
