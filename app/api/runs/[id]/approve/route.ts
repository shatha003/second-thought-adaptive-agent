import { z } from "zod";
import { humanApprove } from "@/lib/engine/loop";
import { mutate } from "@/lib/store";

const body = z.object({ lane: z.enum(["baseline", "adaptive", "unguarded"]) });

/** Human-in-the-loop: approve the suggested option of a lane held in safe-hold. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return Response.json({ error: "lane required" }, { status: 400 });
  const run = await mutate(id, (r) => humanApprove(r, parsed.data.lane));
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json({ run });
}
