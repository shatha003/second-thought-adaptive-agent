import type { Scenario, TimelineItem } from "@/lib/domain/types";
import { canExecuteLisbon, clockLisbon, lisbon, outcomeLisbon, presets, repairLisbon, truth0 } from "./lisbon";

/**
 * Failure test: where adaptation goes wrong, and how it is contained.
 *
 * Same world as Lisbon, but the signals lie:
 *  t3  a social-media rumour says LH1234 is cancelled (it is not)
 *  t6-9 a flaky aggregator flaps "transfer service down / up / down / up"
 *  t10 a REAL change: Hotel Alfama is overbooked, an eager proposer reaches for the luxury option
 *  t12 a REAL change: the replacement hotel sells out too, so nothing affordable remains
 */
const timeline: TimelineItem[] = [
  { tick: 3, world: "A social-media rumour claims LH1234 is cancelled. The flight is operating normally.", signals: [{ key: "flight.LH1234.status", value: "cancelled", source: "social-feed", reliability: 0.4 }] },
  { tick: 6, world: "Aggregator glitch: reports the airport transfer service as DOWN. It is running.", signals: [{ key: "transfer.available", value: false, source: "aggregator", reliability: 0.75 }] },
  { tick: 7, world: "Aggregator flips back: transfer service UP.", signals: [{ key: "transfer.available", value: true, source: "aggregator", reliability: 0.75 }] },
  { tick: 8, world: "Aggregator glitch again: transfer service DOWN.", signals: [{ key: "transfer.available", value: false, source: "aggregator", reliability: 0.75 }] },
  { tick: 9, world: "Aggregator flips back again: transfer service UP.", signals: [{ key: "transfer.available", value: true, source: "aggregator", reliability: 0.75 }] },
  { tick: 10, world: "REAL: Hotel Alfama overbooks; our reservation is voided.", truth: { "hotel.alfama.rooms": 0 }, signals: [{ key: "hotel.alfama.rooms", value: 0, source: "hotel-feed", reliability: 0.95 }] },
  { tick: 12, world: "REAL: Hotel Baixa also sells out. Only the €900 luxury hotel is left.", truth: { "hotel.baixa.rooms": 0 }, signals: [{ key: "hotel.baixa.rooms", value: 0, source: "hotel-feed", reliability: 0.95 }] },
];

export const phantom: Scenario = {
  ...lisbon,
  id: "phantom",
  title: "Phantom Alarm",
  tagline: "Failure test: the signals lie, then reality bites. Guards ON vs guards OFF.",
  domain: "Failure containment",
  mission: {
    ...lisbon.mission,
    title: "Same mission, hostile signals",
    brief:
      "Same Lisbon mission, but a rumour, a flapping feed and an over-eager proposer try to push the agent into making things worse.",
  },
  horizon: 19,
  proposer: "eager",
  lanes: [
    { id: "unguarded", label: "Adaptive · guards OFF", blurb: "Believes every signal. Adopts whatever the proposer suggests." },
    { id: "adaptive", label: "Adaptive · guards ON", blurb: "Corroboration, probes, flap guard, contract gate, human escalation." },
  ],
  clock: clockLisbon,
  truth: { ...truth0 },
  knowledge: { ...truth0 },
  timeline,
  presets,
  canExecute: canExecuteLisbon,
  outcome: outcomeLisbon,
  // A charter jet is out of scope for this test so the rumour response stays plausible.
  repair: (ctx) => repairLisbon(ctx).filter((o) => o.id !== "charter"),
};


