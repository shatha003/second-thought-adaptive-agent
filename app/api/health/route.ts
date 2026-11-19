import { llmConfigured } from "@/lib/planner/llm";
import { getStore } from "@/lib/store";

export async function GET() {
  return Response.json({ ok: true, store: getStore().kind, llm: llmConfigured() });
}
