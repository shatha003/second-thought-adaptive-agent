"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import type { LaneKind, PlannerMode, RunEvent, RunState } from "@/lib/domain/types";
import { SCENARIOS, getScenario } from "@/lib/scenarios";
import { netCost } from "@/lib/engine/plan";
import { Hand } from "../ink/marks";
import { sentence } from "../ink/text";
import { Stories } from "./stories";
import { Wire } from "./wire";
import { ProofSheet } from "./proof";
import { Archive } from "./archive";
import { PressBar, SPEEDS, type SpeedId } from "./press-bar";

type Msg =
  | { type: "state"; run: RunState; events: RunEvent[] }
  | { type: "tick"; run: RunState; events: RunEvent[] }
  | { type: "done" | "paused"; run: RunState }
  | { type: "error"; message: string };

const FRONT: Record<string, string> = {
  achieved: "Mission accomplished",
  "silent-failure": "Every step done. Mission failed.",
  failed: "Mission failed",
  contained: "Safely held for a human",
  breached: "Delivered, but over budget",
};

export function Newsroom() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].id);
  const [planner, setPlanner] = useState<PlannerMode>("heuristic");
  const [llmAvailable, setLlmAvailable] = useState(false);
  const [speed, setSpeed] = useState<SpeedId>("2x");
  const [run, setRun] = useState<RunState | null>(null);
  const [events, setEvents] = useState<RunEvent[]>([]);
  const [printing, setPrinting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const source = useRef<EventSource | null>(null);
  const token = useRef(0);
  const scn = getScenario(scenarioId);

  const stop = useCallback(() => {
    source.current?.close();
    source.current = null;
    setPrinting(false);
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
        if (!res.ok) throw new Error("The press would not start. Try a new edition.");
        const data = (await res.json()) as { run: RunState };
        if (mine === token.current) setRun(data.run);
      } catch (e) {
        if (mine === token.current) setError(e instanceof Error ? e.message : "The press would not start.");
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
      setPrinting(true);
      setError(null);
      const end = () => {
        es.close();
        if (source.current === es) source.current = null;
        setPrinting(false);
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
        setError("Lost the line to the press. Press resume to carry on from the saved edition.");
      };
    },
    [speed],
  );

  // Changing press speed mid-run reconnects the stream; state is persisted, so nothing is lost.
  const runId = run?.id;
  useEffect(() => {
    if (source.current && runId) start(runId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [speed]);

  // "Read the live edition" on the front page.
  const canPlay = Boolean(run && run.status !== "finished" && !printing);
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
    if (!printing && run.status !== "finished") start(run.id);
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
    <section id="newsroom" className="mx-auto max-w-[1360px] scroll-mt-4 px-4 pb-24 pt-10 sm:px-8">
      <div className="rule-double" />
      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1.3fr] lg:items-end">
        <h2 className="font-serif text-[clamp(48px,8vw,124px)] font-extrabold leading-[0.9] tracking-[-0.03em]">
          The newsroom<span className="text-red">.</span>
        </h2>
        <p className="max-w-[44ch] font-serif text-[clamp(18px,1.7vw,22px)] italic leading-snug text-ink/80">
          Same story, same world, two editors. One prints the first draft. The other has second thoughts. Pick a story and start the press.
        </p>
      </div>

      <div className="mt-10">
        <Stories scenarios={SCENARIOS} active={scenarioId} onPick={setScenarioId} />
      </div>

      <PressBar
        ready={Boolean(run)}
        printing={printing}
        finished={Boolean(finished)}
        tick={run?.tick ?? 0}
        horizon={run?.horizon ?? scn.horizon}
        clock={run ? scn.clock(run.tick) : "..."}
        presets={scn.presets}
        speed={speed}
        planner={planner}
        llmAvailable={llmAvailable}
        onPrint={() => run && start(run.id)}
        onStop={stop}
        onReset={() => void create(scenarioId, planner)}
        onInject={(id) => void inject(id)}
        onSpeed={setSpeed}
        onPlanner={setPlanner}
      />

      {/* The assignment */}
      <AnimatePresence mode="wait">
        <motion.div
          key={scn.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="mt-12 grid gap-8 lg:grid-cols-[1.4fr_1fr]"
        >
          <div>
            <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em] text-red">The assignment</p>
            <p className="drop-cap mt-3 max-w-[36ch] font-serif text-[clamp(22px,2.3vw,31px)] leading-[1.3]">{scn.mission.brief}</p>
          </div>
          <div className="grid content-start gap-5 border-t border-rule pt-4 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-1">
            <div>
              <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">House rules</p>
              <ul className="mt-2 grid gap-1 font-serif text-[17px]">
                {scn.mission.constraints.map((c) => (
                  <li key={c}>{c}.</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">To go to press, the story must have</p>
              <ul className="mt-2 grid gap-1 font-serif text-[17px]">
                {scn.mission.successCriteria.map((c) => (
                  <li key={c}>{c}.</li>
                ))}
              </ul>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      <AnimatePresence>
        {error && (
          <motion.p role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="mt-8 -rotate-1 text-center">
            <Hand className="text-[26px]">{error}</Hand>
          </motion.p>
        )}
      </AnimatePresence>

      <div className="mt-14 border-t border-rule pt-10">
        {run ? <Wire run={run} scn={scn} /> : <div className="h-[220px] animate-pulse bg-ink/5" aria-busy="true" />}
      </div>

      {/* Tomorrow's front pages: the payoff */}
      <AnimatePresence>
        {finished && run && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-14">
            <p className="font-type text-[11px] font-bold uppercase tracking-[0.2em]">Tomorrow&apos;s front pages</p>
            <div className="mt-4 grid gap-6 md:grid-cols-2">
              {run.lanes.map((l, i) => (
                <motion.div
                  key={l.id}
                  initial={{ opacity: 0, y: 30, rotate: i ? 2 : -2 }}
                  animate={{ opacity: 1, y: 0, rotate: i ? 0.6 : -0.6 }}
                  transition={{ delay: 0.2 + i * 0.3, type: "spring", stiffness: 90, damping: 14 }}
                  className="sheet px-6 pb-7 pt-4"
                >
                  <p className="text-center font-black text-[30px] leading-none">The {l.id === "baseline" ? "First Draft" : l.id === "unguarded" ? "Daily Rumour" : "Second Thought"}</p>
                  <div className="mt-2 border-t-2 border-ink pt-1 text-center font-type text-[10px] uppercase tracking-wider text-ink2">{l.label}</div>
                  <p className={`mt-4 font-serif text-[clamp(30px,3.6vw,48px)] font-extrabold leading-[1] tracking-[-0.02em] ${l.score && l.score.verdict !== "achieved" && l.score.verdict !== "contained" ? "text-red" : ""}`}>
                    {l.score ? FRONT[l.score.verdict] : ""}
                  </p>
                  <p className="mt-3 font-serif text-[17px] italic text-ink/80">{l.score ? sentence(l.score.headline) : ""}</p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* The two proof sheets */}
      <div className="mt-14 grid items-start gap-10 lg:grid-cols-2 lg:gap-8">
        {run
          ? run.lanes.map((lane, i) => (
              <ProofSheet
                key={`${run.id}-${lane.id}`}
                lane={lane}
                scn={scn}
                spend={spend[lane.id] ?? 0}
                tilt={i === 0 ? -0.5 : 0.45}
                clock={scn.clock}
                onApprove={() => void approve(lane.id)}
              />
            ))
          : [0, 1].map((i) => <div key={i} className="sheet h-[620px] animate-pulse" aria-busy="true" />)}
      </div>

      <div className="mt-16">
        <Archive events={events} />
      </div>
    </section>
  );
}
