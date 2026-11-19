"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { WarningCircle } from "@phosphor-icons/react";
import type { LaneKind, PlannerMode, RunEvent, RunState } from "@/lib/domain/types";
import { SCENARIOS, getScenario } from "@/lib/scenarios";
import { netCost } from "@/lib/engine/plan";
import { Tickets } from "./tickets";
import { Timeline } from "./timeline";
import { LaneView } from "./lane";
import { BlackBox } from "./black-box";
import { Dock, SPEEDS, type SpeedId } from "./dock";

type Msg =
  | { type: "state"; run: RunState; events: RunEvent[] }
  | { type: "tick"; run: RunState; events: RunEvent[] }
  | { type: "done" | "paused"; run: RunState }
  | { type: "error"; message: string };

const VERDICT_WORD = {
  achieved: { w: "Achieved", c: "text-go" },
  "silent-failure": { w: "Failed silently", c: "text-stop" },
  failed: { w: "Failed", c: "text-stop" },
  contained: { w: "Contained", c: "text-signal" },
  breached: { w: "Breached", c: "text-stop" },
} as const;

export function Console() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [planner, setPlanner] = useState<PlannerMode>("heuristic");
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>("2x");
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        if (!res.ok) throw new Error("Could not create a run.");
        const data = (await res.json()) as { run: RunState };
        if (mine === token.current) setRun(data.run);
      } catch (e) {
        if (mine === token.current) setError(e instanceof Error ? e.message : "Could not create a run.");
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
      const ms = SPEEDS.find((s) => s.id === speed)?.ms ?? 700;
      const es = new EventSource(`/api/runs/${runId}/stream?ms=${ms}`);
      source.current = es;
      setStreaming(true);
      setError(null);
      const end = () => {
        es.close();
        if (source.current === es) source.current = null;
        setStreaming(false);
      };
      es.onmessage = (ev) => {
        const msg = JSON.parse(ev.data) as Msg;
        if (msg.type === "state") {
          setRun(msg.run);
          setEvents(msg.events);
        } else if (msg.type === "tick") {
          setRun(msg.run);
          setEvents((prev) => [...prev, ...msg.events]);
        } else if (msg.type === "error") {
          setError(msg.message);
          end();
        } else {
          setRun(msg.run);
          end();
        }
      };
      es.onerror = () => {
        end();
        setError("Connection lost. Press play to resume from the saved state.");
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

  // The hero's "Watch it think" button.
  const canPlay = Boolean(run && run.status !== "finished" && !streaming);
  useEffect(() => {
    const onPlay = () => {
      if (canPlay && runId) start(runId);
    };
    window.addEventListener("st:play", onPlay);
    return () => window.removeEventListener("st:play", onPlay);
  }, [canPlay, runId, start]);

  const inject = async (presetId: string) => {
    if (!run) return;
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
  const spend: Partial<Record<LaneKind, number>> = {};
  if (run) for (const l of run.lanes) spend[l.id] = netCost(scn, run.truth, l.steps, "truth");

  return (
    <section id="console" className="mx-auto max-w-[1400px] scroll-mt-6 px-4 pb-24 sm:px-8">
      <motion.h2
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ type: "spring", stiffness: 110, damping: 20 }}
        className="font-display text-[clamp(48px,8vw,120px)] font-black uppercase leading-[0.86] tracking-tight"
      >
        Same world.
        <br />
        <span className="text-signal">Two minds.</span>
      </motion.h2>
      <p className="mt-5 max-w-[56ch] text-[17px] leading-relaxed text-paper/70">
        Pick a mission and press play. Reality changes on a schedule neither agent can see. Only one of them notices.
      </p>

      <div className="mt-10">
        <Tickets scenarios={SCENARIOS} active={scenarioId} onPick={setScenarioId} />
      </div>

      <Dock
        ready={Boolean(run)}
        streaming={streaming}
        finished={Boolean(finished)}
        progress={run ? Math.min(1, run.tick / run.horizon) : 0}
        clock={run ? scn.clock(run.tick).toUpperCase() : "--- --:--"}
        presets={scn.presets}
        speed={speed}
        planner={planner}
        llmAvailable={llmAvailable}
        onPlay={() => run && start(run.id)}
        onPause={stop}
        onReset={() => void create(scenarioId, planner)}
        onInject={(id) => void inject(id)}
        onSpeed={setSpeed}
        onPlanner={setPlanner}
      />

      {/* Mission brief */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scn.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          className="mt-8 grid gap-6 lg:grid-cols-[1.5fr_1fr]"
        >
          <div>
            <p className="font-mono text-[11px] text-dim">THE MISSION</p>
            <h3 className="mt-2 max-w-[28ch] text-[clamp(22px,2.4vw,32px)] font-medium leading-[1.15]">{scn.mission.brief}</h3>
          </div>
          <div className="grid content-start gap-4">
            <div className="flex flex-wrap gap-1.5">
              {scn.mission.constraints.map((c) => (
                <span key={c} className="rounded-full border border-line px-3 py-1 text-[12.5px] text-paper/85">
                  {c}
                </span>
              ))}
            </div>
            <ul className="grid gap-1.5">
              {scn.mission.successCriteria.map((c) => (
                <li key={c} className="flex items-baseline gap-2 text-[14px]">
                  <span className="font-mono text-[10px] text-signal">MUST</span> {c}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-6 flex items-center gap-2 rounded-xl border border-stop/60 bg-stop/10 px-4 py-3 text-[14px]"
          >
            <WarningCircle size={18} weight="fill" className="text-stop" /> {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-8 grid gap-5">
        {run ? (
          <Timeline run={run} scn={scn} />
        ) : (
          <div className="h-[260px] animate-pulse rounded-2xl border border-line bg-ink2" aria-busy="true" />
        )}

        {/* The payoff: same world, different outcomes */}
        <AnimatePresence>
          {finished && run && (
            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 140, damping: 18 }}
              className="grid gap-4 rounded-2xl border border-line bg-ink2 p-5 sm:grid-cols-2 sm:p-6"
            >
              {run.lanes.map((l, i) => {
                const v = l.score ? VERDICT_WORD[l.score.verdict] : null;
                return (
                  <motion.div key={l.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.25, type: "spring", stiffness: 160, damping: 18 }}>
                    <p className="font-mono text-[11px] text-dim">{l.label.toUpperCase()}</p>
                    <p className={`font-display text-[clamp(40px,5vw,72px)] font-black uppercase leading-[0.9] ${v?.c ?? ""}`}>{v?.w}</p>
                    <p className="mt-1 text-[14px] text-paper/70">{l.score?.headline}</p>
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        {run ? (
          <div className="grid items-start gap-5 lg:grid-cols-2">
            {run.lanes.map((lane) => (
              <LaneView key={`${run.id}-${lane.id}`} lane={lane} mission={scn.mission} spend={spend[lane.id] ?? 0} onApprove={() => void approve(lane.id)} />
            ))}
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2" aria-busy="true">
            {[0, 1].map((i) => (
              <div key={i} className="h-[560px] animate-pulse rounded-2xl border border-line bg-ink2" />
            ))}
          </div>
        )}

        <BlackBox events={events} />
      </div>
    </section>
  );
}
