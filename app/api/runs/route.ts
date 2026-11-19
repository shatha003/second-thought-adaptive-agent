import { z } from "zod";
import { createRun } from "@/lib/engine/loop";
import { getStore } from "@/lib/store";
import { SCENARIOS } from "@/lib/scenarios";

const body = z.object({
  scenarioId: z.enum(SCENARIOS.map((s) => s.id) as [string, ...string[]]),
  planner: z.enum(["heuristic", "llm"]).default("heuristic"),
});

export async function POST(req: Request) {
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "Invalid scenario or planner" }, { status: 400 });
  const run = createRun(parsed.data.scenarioId, parsed.data.planner);
  await getStore().create(run);
  return Response.json({ run });
}
