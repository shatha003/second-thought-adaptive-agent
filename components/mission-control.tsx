"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowCounterClockwise, CaretDown, Flask, Pause, Play, Syringe, WarningCircle } from "@phosphor-icons/react";
import type { Lane, LaneKind, PlannerMode, RunEvent, RunState } from "@/lib/domain/types";
import { SCENARIOS, getScenario } from "@/lib/scenarios";
import { netCost } from "@/lib/engine/plan";
import { LanePanel } from "./lane-panel";
import { RealityStrip } from "./reality-strip";
import { EventLog } from "./event-log";

type Msg =
  | { type: "state"; run: RunState; events: RunEvent[] }
  | { type: "tick"; run: RunState; events: RunEvent[] }
  | { type: "done" | "paused"; run: RunState }
  | { type: "error"; message: string };

const SPEEDS = [
  { id: "slow", label: "Slow", ms: 1600 },
  { id: "normal", label: "Normal", ms: 800 },
  { id: "fast", label: "Fast", ms: 300 },
] as const;

export function MissionControl() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [planner, setPlanner] = useState<PlannerMode>("heuristic");
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]["id"]>("normal");
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [injectOpen, setInjectOpen] = useState(false);

  const source = useRef<EventSource | null>(null);
  const token = useRef(0);
  const scn = getScenario(scenarioId);

  const stop = useCallback(() => {
    source.current?.close();
    source.current = null;
    setStreaming(false);
  }, []);

  const create = useCallback(
    async (sid: string, pl: PlannerMode) => {
      stop();
      const mine = ++token.current;
      setRun(null);
      setEvents([]);
      setError(null);
      try {
        const res = await fetch("/api/runs", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ scenarioId: sid, planner: pl }),
        });
        if (!res.ok) throw new Error("Could not create a run");
        const data = (await res.json()) as { run: RunState };
        if (mine === token.current) setRun(data.run);
      } catch (e) {
        if (mine === token.current) setError(e instanceof Error ? e.message : "Could not create a run");
      }
    },
    [stop],
  );

  useEffect(() => {
    // Creating a run is a fetch against an external system; it is the sync this effect exists for.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void create(scenarioId, planner);
    return stop;
  }, [scenarioId, planner, create, stop]);

  useEffect(() => {
    fetch("/api/health")
      .then((r) => r.json())
      .then((h: { llm?: boolean }) => setLlmAvailable(Boolean(h.llm)))
      .catch(() => setLlmAvailable(false));
  }, []);

  const start = useCallback(
    (runId: string) => {
      source.current?.close();
      const ms = SPEEDS.find((s) => s.id === speed)?.ms ?? 800;
      const es = new EventSource(`/api/runs/${runId}/stream?ms=${ms}`);
      source.current = es;
      setStreaming(true);
      setError(null);
      es.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as Msg;
        if (msg.type === "state") {
          setRun(msg.run);
          setEvents(msg.events);
        } else if (msg.type === "tick") {
          setRun(msg.run);
          setEvents((prev) => [...prev, ...msg.events]);
        } else if (msg.type === "done" || msg.type === "paused") {
          setRun(msg.run);
          es.close();
          source.current = null;
          setStreaming(false);
        } else if (msg.type === "error") {
          setError(msg.message);
          es.close();
          source.current = null;
          setStreaming(false);
        }
      };
      es.onerror = () => {
        es.close();
        source.current = null;
        setStreaming(false);
        setError("Connection lost. Press Run to resume from the saved state.");
      };
    },
    [speed],
  );

  // Changing speed mid-run reconnects the stream; state is persisted, so nothing is lost.
  const runId = run?.id;
  useEffect(() => {
    if (source.current && runId) start(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  const inject = async (presetId: string) => {
    if (!run) return;
    setInjectOpen(false);
    await fetch(`/api/runs/${run.id}/inject`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ presetId }),
    });
    if (!streaming && run.status !== "finished") start(run.id);
  };

  const approve = async (lane: LaneKind) => {
    if (!run) return;
    const res = await fetch(`/api/runs/${run.id}/approve`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lane }),
    });
    if (res.ok) {
      const data = (await res.json()) as { run: RunState };
      setRun(data.run);
      const full = await fetch(`/api/runs/${run.id}`).then((r) => r.json()).catch(() => null);
      if (full?.events) setEvents(full.events as RunEvent[]);
      if (data.run.status !== "finished") start(run.id);
    }
  };

  const finished = run?.status === "finished";
  const progress = run ? Math.min(1, run.tick / run.horizon) : 0;
  const costs: Partial<Record<LaneKind, number>> = {};
  if (run) for (const l of run.lanes) costs[l.id] = netCost(scn, run.truth, l.steps, "truth");

  return (
    <div className="mx-auto w-full max-w-[1400px] px-4 pb-16 sm:px-6">
      <header className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="mr-auto min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">Second Thought</h1>
            <p className="text-[12.5px] text-muted">An agent that notices reality changed, and shows why it changed its mind.</p>
          </div>

          <div role="tablist" aria-label="Scenario" className="flex gap-1 rounded-[var(--radius)] border border-line bg-panel p-1">
            {SCENARIOS.map((s) => {
              const on = s.id === scenarioId;
              return (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={on}
                  onClick={() => setScenarioId(s.id)}
                  className={`flex items-center gap-1.5 rounded-[var(--radius-chip)] px-3 py-1.5 text-[13px] transition-colors ${
                    on ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-fg"
                  }`}
                >
                  {s.id === "phantom" && <Flask size={14} />}
                  {s.domain}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main className="mt-5 grid gap-4">
        {/* Mission */}
        <section className="grid gap-4 rounded-[var(--radius)] border border-line bg-panel p-4 md:grid-cols-[1.4fr_1fr] md:p-5">
          <div>
            <p className="text-[12px] text-muted">{scn.tagline}</p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{scn.mission.title}</h2>
            <p className="mt-1.5 max-w-[65ch] text-[13.5px] leading-relaxed text-muted">{scn.mission.brief}</p>
          </div>
          <div className="grid content-start gap-3 text-[12.5px]">
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted">Constraints</p>
              <ul className="grid gap-0.5">
                {scn.mission.constraints.map((c) => (
                  <li key={c} className="text-fg">{c}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 text-[11px] font-medium text-muted">Success means</p>
              <ul className="grid gap-0.5">
                {scn.mission.successCriteria.map((c) => (
                  <li key={c} className="text-fg">{c}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Controls */}
        <section className="flex flex-wrap items-center gap-3 rounded-[var(--radius)] border border-line bg-panel px-4 py-3">
          {streaming ? (
            <button
              onClick={stop}
              className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-line bg-panel2 px-3.5 py-2 text-[13px] font-medium transition-transform active:scale-[0.98]"
            >
              <Pause size={15} weight="fill" /> Pause
            </button>
          ) : (
            <button
              disabled={!run || finished}
              onClick={() => run && start(run.id)}
              className="flex items-center gap-1.5 rounded-[var(--radius-chip)] bg-accent px-3.5 py-2 text-[13px] font-semibold text-bg transition-transform active:scale-[0.98] disabled:opacity-40"
            >
              <Play size={15} weight="fill" /> {run && run.tick > 0 && !finished ? "Resume" : "Run"}
            </button>
          )}
          <button
            onClick={() => void create(scenarioId, planner)}
            className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-line px-3 py-2 text-[13px] text-muted transition-colors hover:text-fg active:scale-[0.98]"
          >
            <ArrowCounterClockwise size={15} /> Reset
          </button>

          <div className="relative">
            <button
              disabled={!run || finished}
              onClick={() => setInjectOpen((o) => !o)}
              aria-expanded={injectOpen}
              className="flex items-center gap-1.5 rounded-[var(--radius-chip)] border border-line px-3 py-2 text-[13px] transition-colors hover:border-accent active:scale-[0.98] disabled:opacity-40"
            >
              <Syringe size={15} /> Inject an event <CaretDown size={12} />
            </button>
            <AnimatePresence>
              {injectOpen && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute left-0 top-full z-10 mt-1.5 w-80 max-w-[85vw] rounded-[var(--radius)] border border-line bg-panel p-1 shadow-lg"
                >
                  {scn.presets.map((p) => (
                    <li key={p.id}>
                      <button
                        onClick={() => void inject(p.id)}
                        className="w-full rounded-[var(--radius-chip)] px-3 py-2 text-left transition-colors hover:bg-panel2"
                      >
                        <span className="block text-[13px] font-medium">{p.label}</span>
                        <span className="block text-[11.5px] leading-snug text-muted">{p.description}</span>
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <div className="ml-auto flex flex-wrap items-center gap-3 text-[12.5px]">
            <label className="flex items-center gap-1.5 text-muted">
              Speed
              <select
                value={speed}
                onChange={(e) => setSpeed(e.target.value as typeof speed)}
                className="rounded-[var(--radius-chip)] border border-line bg-panel px-2 py-1.5 text-fg"
              >
                {SPEEDS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1.5 text-muted">
              Planner
              <select
                value={planner}
                onChange={(e) => setPlanner(e.target.value as PlannerMode)}
                className="rounded-[var(--radius-chip)] border border-line bg-panel px-2 py-1.5 text-fg"
              >
                <option value="heuristic">Deterministic</option>
                <option value="llm" disabled={!llmAvailable}>
                  Language model{llmAvailable ? "" : " (not configured)"}
                </option>
              </select>
            </label>
            <div className="min-w-32 text-right">
              <p className="font-mono text-[12px]">{run ? scn.clock(run.tick) : "..."}</p>
              <div className="mt-1 h-0.5 w-full bg-line">
                <motion.div className="h-full origin-left bg-accent" animate={{ scaleX: progress }} transition={{ type: "spring", stiffness: 120, damping: 24 }} style={{ width: "100%" }} />
              </div>
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="flex items-center gap-2 rounded-[var(--radius)] border border-bad bg-bad-soft px-4 py-2.5 text-[13px]">
            <WarningCircle size={16} weight="fill" className="text-bad" /> {error}
          </p>
        )}

        {run && <RealityStrip world={run.world} clock={scn.clock} />}

        {/* Lanes */}
        {run ? (
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {run.lanes.map((lane: Lane) => (
              <LanePanel key={lane.id} lane={lane} mission={scn.mission} netCost={costs[lane.id] ?? 0} onApprove={(id) => void approve(id)} />
            ))}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-96 animate-pulse rounded-[var(--radius)] border border-line bg-panel" />
            ))}
          </div>
        )}

        <EventLog events={events} />
      </main>

      <footer className="mt-10 border-t border-line pt-5 text-[12.5px] text-muted">
        Both agents live in the same simulated world. Reality changes on a schedule the agents cannot see, and each acts only on the signals it receives. Nothing here is timer-driven re-prompting: a revision happens only when a signal touches an assumption the plan depends on.
      </footer>
    </div>
  );
}
