import { generateText, Output } from "ai";
import { z } from "zod";

export interface LlmOption {
  id: string;
  label: string;
  detail: string;
  netCost: number;
  met: number;
  total: number;
  failing: string[];
}

const schema = z.object({
  ranking: z.array(z.string()).describe("Option ids, best first. Include every id exactly once."),
  rationale: z.string().describe("Two sentences max: why the top choice best serves the mission."),
});

export function llmConfigured(): boolean {
  return Boolean(process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL);
}

/**
 * The LLM only *proposes* a ranking over grounded repair options. It never invents plan steps,
 * and the safety gate validates whatever it proposes.
 */
export async function llmRank(input: {
  mission: string;
  trigger: string;
  evidence: string;
  options: LlmOption[];
}): Promise<{ ranking: string[]; rationale: string; model: string }> {
  const model = process.env.AI_MODEL ?? "anthropic/claude-sonnet-4.5";
  const { output } = await generateText({
    model,
    output: Output.object({ schema }),
    abortSignal: AbortSignal.timeout(20_000),
    prompt: [
      "You are the re-planning module of an autonomous agent. Reality just contradicted one of its assumptions.",
      `MISSION: ${input.mission}`,
      `BROKEN ASSUMPTION: ${input.trigger}`,
      `EVIDENCE: ${input.evidence}`,
      "CANDIDATE REPAIRS (each already dry-run against the agent's world model):",
      ...input.options.map(
        (o) =>
          `- id=${o.id} | ${o.label} | ${o.detail} | net spend ${o.netCost} | criteria met ${o.met}/${o.total}${o.failing.length ? ` | FAILS: ${o.failing.join(", ")}` : ""}`,
      ),
      "Rank the options best-first for the mission. Prefer options that satisfy every success criterion and hard constraint, then lowest risk and spend.",
    ].join("\n"),
  });
  const ids = new Set(input.options.map((o) => o.id));
  const ranking = output.ranking.filter((id, i, a) => ids.has(id) && a.indexOf(id) === i);
  for (const id of ids) if (!ranking.includes(id)) ranking.push(id);
  return { ranking, rationale: output.rationale, model };
}
