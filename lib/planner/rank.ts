import type { AssumptionRT, Evaluation, PlannerMode, RepairOption, Scenario, Step } from "@/lib/domain/types";
import { llmConfigured, llmRank } from "./llm";

export interface Candidate {
  option: RepairOption;
  steps: Step[];
  evaluation: Evaluation;
}

export interface Ranked {
  ordered: Candidate[];
  planner: string;
  rationale: string;
}

const heuristic = (a: Candidate, b: Candidate) =>
  Number(b.evaluation.allMet) - Number(a.evaluation.allMet) ||
  b.evaluation.metCount - a.evaluation.metCount ||
  a.evaluation.netCost - b.evaluation.netCost ||
  b.option.quality - a.option.quality;

/**
 * The proposer. It only ever *proposes*; the safety gate disposes.
 *  - heuristic: deterministic, cost-aware. Default, and the fallback for everything.
 *  - eager:     scripted stand-in for an over-eager LLM that optimises speed/comfort and ignores spend.
 *               Used by the failure test to prove the gate catches bad proposals.
 *  - llm:       AI SDK via the AI Gateway, ranking grounded options. Any error falls back to heuristic.
 */
export async function rankCandidates(args: {
  scn: Scenario;
  mode: PlannerMode | "eager";
  trigger: AssumptionRT;
  evidence: string;
  candidates: Candidate[];
}): Promise<Ranked> {
  const { scn, mode, trigger, evidence, candidates } = args;

  if (mode === "eager") {
    return {
      ordered: [...candidates].sort((a, b) => b.option.quality - a.option.quality),
      planner: "scripted eager proposer",
      rationale: "Optimises for speed and comfort, and ignores spend. A stand-in for an over-eager model.",
    };
  }

  if (mode === "llm") {
    if (!llmConfigured()) {
      return fallback(candidates, "LLM unavailable (no gateway credentials), used heuristic planner");
    }
    try {
      const r = await llmRank({
        mission: `${scn.mission.title}: ${scn.mission.brief}`,
        trigger: trigger.statement,
        evidence,
        options: candidates.map((c) => ({
          id: c.option.id,
          label: c.option.label,
          detail: c.option.detail,
          netCost: c.evaluation.netCost,
          met: c.evaluation.metCount,
          total: c.evaluation.criteria.length,
          failing: c.evaluation.criteria.filter((x) => !x.ok).map((x) => x.label),
        })),
      });
      const byId = new Map(candidates.map((c) => [c.option.id, c]));
      return {
        ordered: r.ranking.map((id) => byId.get(id)).filter((x): x is Candidate => !!x),
        planner: `LLM · ${r.model}`,
        rationale: r.rationale,
      };
    } catch (e) {
      return fallback(candidates, `LLM call failed (${e instanceof Error ? e.message.slice(0, 80) : "error"}), used heuristic planner`);
    }
  }

  return fallback(candidates, "Prefers options that satisfy every success criterion, then lowest net spend.", "heuristic planner");
}

function fallback(candidates: Candidate[], rationale: string, planner = "heuristic planner (fallback)"): Ranked {
  return { ordered: [...candidates].sort(heuristic), planner, rationale };
}
