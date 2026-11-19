import type { LaneKind, Policy } from "@/lib/domain/types";

/** Every safeguard on: this is the production configuration. */
export const GUARDED: Policy = {
  name: "Guarded adaptive",
  corroboration: true,
  flapGuard: true,
  probe: true,
  gate: true,
  holdOnDoubt: true,
  revisionBudget: 4,
  cooldown: 1,
};

/** Adaptive but with every safeguard off: used to *show* how adaptation goes wrong. */
export const UNGUARDED: Policy = {
  name: "Adaptive, guards off",
  corroboration: false,
  flapGuard: false,
  probe: false,
  gate: false,
  holdOnDoubt: false,
  revisionBudget: 99,
  cooldown: 0,
};

/** Never revises. Executes the original plan to the end. */
export const BASELINE: Policy = {
  name: "Static plan",
  corroboration: false,
  flapGuard: false,
  probe: false,
  gate: false,
  holdOnDoubt: false,
  revisionBudget: 0,
  cooldown: 0,
};

export function policyFor(kind: LaneKind): Policy {
  return kind === "adaptive" ? { ...GUARDED } : kind === "unguarded" ? { ...UNGUARDED } : { ...BASELINE };
}
