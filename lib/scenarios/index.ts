import type { Scenario } from "@/lib/domain/types";
import { fulfilment } from "./fulfilment";
import { lisbon } from "./lisbon";
import { phantom } from "./phantom";

export const SCENARIOS: Scenario[] = [lisbon, fulfilment, phantom];

export function getScenario(id: string): Scenario {
  const s = SCENARIOS.find((x) => x.id === id);
  if (!s) throw new Error(`Unknown scenario: ${id}`);
  return s;
}
