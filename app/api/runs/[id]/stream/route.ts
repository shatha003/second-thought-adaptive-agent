import { advance } from "@/lib/engine/loop";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => (clearTimeout(t), resolve()), { once: true });
  });

/**
 * Server-Sent Events driver. Opening the stream = (re)starting the run from its persisted state;
 * closing it = pause. Every tick is persisted before it is sent, so a reconnect resumes exactly
 * where the run left off.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const ms = Math.min(3000, Math.max(120, Number(new URL(req.url).searchParams.get("ms")) || 800));
  const store = getStore();
  let run = await store.get(id);
  if (!run) return Response.json({ error: "Run not found" }, { status: 404 });

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let open = true;
      const send = (obj: unknown) => {
        if (open) controller.enqueue(enc.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };
      try {
        send({ type: "state", run, events: await store.events(id) });
        while (!req.signal.aborted && run && run.status !== "finished") {
          await sleep(ms, req.signal);
          if (req.signal.aborted) break;
          const fresh = await store.get(id);
          if (!fresh) break;
          run = fresh;
          if (run.status === "finished") break;
          const base = run.version;
          const events = await advance(run);
          if (!(await store.save(run, events, base))) continue; // someone else wrote: reload and retry
          send({ type: "tick", run, events });
        }
        send({ type: run?.status === "finished" ? "done" : "paused", run });
      } catch (e) {
        send({ type: "error", message: e instanceof Error ? e.message : "stream failed" });
      } finally {
        open = false;
        try {
          controller.close();
        } catch {}
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
