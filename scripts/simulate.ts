import { advance, createRun } from "../lib/engine/loop";

async function main() {
  const id = process.argv[2] ?? "lisbon";
  const run = createRun(id);
  while (run.status !== "finished") {
    const ev = await advance(run);
    for (const e of ev) if (process.argv.includes("-v") || e.type !== "tick") console.log(`t${e.tick} [${e.lane ?? "world"}] ${e.type}: ${e.message}`);
  }
  for (const l of run.lanes) {
    console.log(`\n== ${l.label} (${l.id}) → ${l.score?.headline}`);
    console.log(l.score?.criteria.map((c) => `${c.ok ? "✓" : "✗"} ${c.label} [${c.detail}]`).join("\n"), `\nnet ${l.score?.netCost}`);
  }
}
main();
