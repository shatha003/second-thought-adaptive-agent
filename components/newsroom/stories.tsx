"use client";

import type { Scenario } from "@/lib/domain/types";
import { Hand, Ring } from "../ink/marks";

const PAGE: Record<string, number> = { lisbon: 2, fulfilment: 5, phantom: 9 };

/** Story picker as a newspaper index with dot leaders and page numbers. */
export function Stories({ scenarios, active, onPick }: { scenarios: Scenario[]; active: string; onPick: (id: string) => void }) {
  return (
    <div role="tablist" aria-label="Story" className="border-t-2 border-ink">
      {scenarios.map((s) => {
        const on = s.id === active;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={on}
            onClick={() => onPick(s.id)}
            className="group grid w-full grid-cols-[1fr_auto] items-end gap-x-4 border-b border-rule py-4 text-left"
          >
            <span className="min-w-0">
              <span className={`font-type text-[11px] font-bold uppercase tracking-[0.18em] ${s.id === "phantom" ? "text-red" : "text-ink2"}`}>
                {s.id === "phantom" ? "Failure test" : s.domain}
              </span>
              <span className="mt-0.5 flex items-end gap-2">
                <span className={`font-serif text-[clamp(22px,2.6vw,34px)] font-extrabold leading-[1.05] tracking-[-0.01em] transition-colors group-hover:text-red ${on ? "" : "text-ink/80"}`}>
                  {s.mission.title}
                </span>
                <span className="leaders mb-2 hidden min-w-8 flex-1 self-stretch sm:block" />
              </span>
              <span className="mt-1 block max-w-[70ch] font-serif text-[15.5px] italic leading-snug text-ink2">{s.tagline}</span>
            </span>
            <span className="relative mb-1 font-serif text-[clamp(28px,3vw,40px)] font-extrabold italic">
              {on ? <Ring key={s.id}>p.{PAGE[s.id] ?? 1}</Ring> : <span className="text-ink/40">p.{PAGE[s.id] ?? 1}</span>}
              {on && (
                <span className="absolute -top-5 right-[105%] hidden whitespace-nowrap -rotate-6 sm:block">
                  <Hand key={s.id} delay={0.4} className="text-[20px]">
                    reading
                  </Hand>
                </span>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}
