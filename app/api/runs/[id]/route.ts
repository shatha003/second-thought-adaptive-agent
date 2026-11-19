import { getStore } from "@/lib/store";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const store = getStore();
  const run = await store.get(id);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });
  return Response.json({ run, events: await store.events(id) });
}
