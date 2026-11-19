import { z } from "zod";
import { getScenario } from "@/lib/scenarios";
import { mutate } from "@/lib/store";

const body = z.object({ presetId: z.string().min(1).max(64) });

/** Judge-injected signal: queued in persisted run state, consumed by the next tick (event-driven input). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "presetId required" }, { status: 400 });
  const run = await mutate(id, (r) => {
    const scn = getScenario(r.scenarioId);
    if (!scn.presets.some((p) => p.id === parsed.data.presetId) || r.status === "finished") return [];
    r.pendingInjections.push(parsed.data.presetId);
    return [];
  });
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json({ ok: true, queued: run.pendingInjections.length });
}
