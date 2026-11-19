import type { AssumptionDef, StepSeed } from "@/lib/domain/types";

export function seed(p: Partial<StepSeed> & Pick<StepSeed, "id" | "title" | "kind">): StepSeed {
  return { args: {}, deps: [], assumptions: [], reversible: true, cost: 0, ...p };
}

export function assume(p: Omit<AssumptionDef, "criticality"> & { criticality?: AssumptionDef["criticality"] }): AssumptionDef {
  return { criticality: "critical", ...p };
}

export const fmt = (n: number, cur = "€") => `${cur}${Math.round(n).toLocaleString("en-US")}`;
