"use client";

/*
  Proofreader's marks, drawn by hand. Every mark is made in front of you, because a
  correction you can watch being made is the point.

  Two drawing techniques:
  - Fixed-aspect marks (tick, cross, caret, arrow) animate pathLength: the stroke draws itself.
  - Stretched marks (strike, squiggle, ring) are sized to the text they mark, so their SVG is
    non-uniformly scaled. pathLength dashes break under that, so they are revealed with a
    left-to-right pencil wipe instead.
  Scroll-triggered marks observe an unclipped wrapper, never the clipped element itself.
*/

import { useEffect, useRef, useState } from "react";
import { motion, useInView, useReducedMotion } from "motion/react";

type Ink = "red" | "blue" | "ink";
const COLOR: Record<Ink, string> = { red: "var(--red)", blue: "var(--blue)", ink: "var(--ink)" };
const TEXT: Record<Ink, string> = { red: "text-red", blue: "text-blue", ink: "text-ink" };
const EASE = [0.6, 0, 0.3, 1] as const;

interface DrawOpts {
  delay?: number;
  duration?: number;
  inView?: boolean;
}

/** True once the mark should be drawn: immediately, or when its wrapper scrolls into view. */
function useGo<T extends Element>(inView: boolean) {
  const ref = useRef<T>(null);
  const seen = useInView(ref, { once: true, amount: 0.5 });
  return [ref, !inView || seen] as const;
}

function draw(go: boolean, reduce: boolean | null, delay: number, duration: number) {
  const on = { pathLength: 1, opacity: 1 };
  if (reduce) return { initial: false as const, animate: on };
  return {
    initial: { pathLength: 0, opacity: 0 },
    animate: go ? on : { pathLength: 0, opacity: 0 },
    transition: { delay, duration, ease: EASE, opacity: { delay, duration: 0.01 } },
  };
}

const HIDDEN = "inset(-60% 100% -60% -4%)";
const SHOWN = "inset(-60% -4% -60% -4%)";
function wipe(go: boolean, reduce: boolean | null, delay: number, duration: number) {
  if (reduce) return { initial: false as const, animate: { clipPath: SHOWN } };
  return {
    initial: { clipPath: HIDDEN },
    animate: { clipPath: go ? SHOWN : HIDDEN },
    transition: { delay, duration, ease: EASE },
  };
}

const line = (ink: Ink, w: number, scaled: boolean) => ({
  stroke: COLOR[ink],
  strokeWidth: w,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  fill: "none",
  ...(scaled ? { vectorEffect: "non-scaling-stroke" as const } : {}),
});

/** A pencil line struck through its children. */
export function Strike({ children, ink = "red", double = false, delay = 0, duration = 0.45, inView = false }: { children: React.ReactNode; ink?: Ink; double?: boolean } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<HTMLSpanElement>(inView);
  return (
    <span ref={ref} className="relative inline">
      {children}
      <motion.svg
        aria-hidden
        viewBox="0 0 100 10"
        preserveAspectRatio="none"
        {...wipe(go, reduce, delay, duration)}
        className="pointer-events-none absolute left-[-1%] top-[54%] h-[0.42em] w-[102%] -translate-y-1/2 overflow-visible"
      >
        <path d="M1 6 C 28 3.6, 64 7.6, 99 4.2" {...line(ink, 2.6, true)} />
        {double && <path d="M2 8.8 C 35 6.6, 70 9.8, 98 7" {...line(ink, 2, true)} />}
      </motion.svg>
    </span>
  );
}

/** A loose hand-drawn ring around its children. */
export function Ring({ children, ink = "red", delay = 0, duration = 0.55, inView = false }: { children: React.ReactNode; ink?: Ink } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<HTMLSpanElement>(inView);
  return (
    <span ref={ref} className="relative inline-block">
      {children}
      <motion.svg
        aria-hidden
        viewBox="0 0 100 40"
        preserveAspectRatio="none"
        {...wipe(go, reduce, delay, duration)}
        className="pointer-events-none absolute -left-[12%] -top-[28%] h-[156%] w-[124%] overflow-visible"
      >
        <path d="M54 4 C 84 3, 98 13, 96 22 C 94 34, 68 38, 44 37 C 17 36, 3 28, 4 18 C 5 8, 27 2, 62 6" {...line(ink, 2, true)} />
      </motion.svg>
    </span>
  );
}

/** Wavy underline: a fact in dispute. */
export function Squiggle({ children, ink = "red", delay = 0, duration = 0.6, inView = false }: { children: React.ReactNode; ink?: Ink } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<HTMLSpanElement>(inView);
  return (
    <span ref={ref} className="relative inline">
      {children}
      <motion.svg
        aria-hidden
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        {...wipe(go, reduce, delay, duration)}
        className="pointer-events-none absolute -bottom-[0.3em] left-0 h-[0.3em] w-full overflow-visible"
      >
        <path d="M0 3 Q 4 0 8 3 T 16 3 T 24 3 T 32 3 T 40 3 T 48 3 T 56 3 T 64 3 T 72 3 T 80 3 T 88 3 T 96 3 T 100 3" {...line(ink, 1.6, true)} />
      </motion.svg>
    </span>
  );
}

function Glyph({ size, children, go: goRef }: { size: string; children: React.ReactNode; go: React.RefObject<SVGSVGElement | null> }) {
  return (
    <svg ref={goRef} aria-hidden viewBox="0 0 24 24" style={{ width: size, height: size }} className="inline-block overflow-visible align-[-0.15em]">
      {children}
    </svg>
  );
}

export function Tick({ ink = "blue", size = "1.1em", delay = 0, duration = 0.35, inView = false }: { ink?: Ink; size?: string } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<SVGSVGElement>(inView);
  return (
    <Glyph size={size} go={ref}>
      <motion.path d="M3 13.5 C 5.5 15.5, 7.5 17.5, 9 20 C 12 13, 16 7.5, 22 3" {...line(ink, 2.6, false)} {...draw(go, reduce, delay, duration)} />
    </Glyph>
  );
}

export function Cross({ ink = "red", size = "1.1em", delay = 0, inView = false }: { ink?: Ink; size?: string } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<SVGSVGElement>(inView);
  return (
    <Glyph size={size} go={ref}>
      <motion.path d="M4 4 C 10 10, 15 15, 20 21" {...line(ink, 2.6, false)} {...draw(go, reduce, delay, 0.2)} />
      <motion.path d="M20 3 C 14 9, 9 15, 4 20" {...line(ink, 2.6, false)} {...draw(go, reduce, delay + 0.18, 0.2)} />
    </Glyph>
  );
}

/** Insertion caret, drawn where new text goes in. */
export function Caret({ ink = "red", size = "1em", delay = 0, inView = false }: { ink?: Ink; size?: string } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<SVGSVGElement>(inView);
  return (
    <Glyph size={size} go={ref}>
      <motion.path d="M3 21 C 7 14, 9 9, 12 3 C 15 9, 17 14, 21 21" {...line(ink, 2.4, false)} {...draw(go, reduce, delay, 0.3)} />
    </Glyph>
  );
}

/** A curling pencil arrow. Points down by default. */
export function Arrow({ ink = "red", className = "", delay = 0, inView = false }: { ink?: Ink; className?: string } & DrawOpts) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<SVGSVGElement>(inView);
  return (
    <svg ref={ref} aria-hidden viewBox="0 0 60 80" className={`overflow-visible ${className}`}>
      <motion.path d="M8 4 C 40 10, 52 34, 30 72" {...line(ink, 2.6, false)} {...draw(go, reduce, delay, 0.6)} />
      <motion.path d="M18 62 L 30 73 L 38 58" {...line(ink, 2.6, false)} {...draw(go, reduce, delay + 0.55, 0.2)} />
    </svg>
  );
}

/** Handwriting that writes itself left to right. */
export function Hand({
  children,
  ink = "red",
  className = "",
  delay = 0,
  inView = false,
  speed = 0.045,
}: {
  children: string;
  ink?: Ink;
  className?: string;
  delay?: number;
  inView?: boolean;
  speed?: number;
}) {
  const reduce = useReducedMotion();
  const [ref, go] = useGo<HTMLSpanElement>(inView);
  const duration = Math.min(2.2, 0.25 + children.length * speed);
  const shown = { clipPath: "inset(-40% -12% -50% -8%)" };
  const hidden = { clipPath: "inset(-40% 100% -50% -8%)" };
  return (
    <span ref={ref} className={`inline-block font-hand font-bold leading-[0.95] ${TEXT[ink]} ${className}`}>
      <motion.span
        className="inline-block"
        initial={reduce ? false : hidden}
        animate={reduce || go ? shown : hidden}
        transition={{ delay, duration, ease: "linear" }}
      >
        {children}
      </motion.span>
    </span>
  );
}

/** Typewriter: text types itself out (only when it changes, or on mount when `boot`). */
export function Typed({ text, boot = false, cps = 70, className = "" }: { text: string; boot?: boolean; cps?: number; className?: string }) {
  const reduce = useReducedMotion();
  const [n, setN] = useState(boot && !reduce ? 0 : text.length);
  const prev = useRef(text);

  useEffect(() => {
    const changed = prev.current !== text;
    prev.current = text;
    if (reduce || (!changed && !boot)) {
      const t = setTimeout(() => setN(text.length), 0);
      return () => clearTimeout(t);
    }
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setN(i);
      if (i >= text.length) clearInterval(id);
    }, 1000 / cps);
    return () => clearInterval(id);
  }, [text, boot, cps, reduce]);

  const typing = n < text.length;
  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{text.slice(0, n)}</span>
      {typing && <span aria-hidden className="caret ml-px inline-block h-[0.95em] w-[0.5em] translate-y-[0.12em] bg-ink" />}
    </span>
  );
}

/** Ink stamp that slams onto the sheet. */
export function Stamp({ children, ink = "red", className = "" }: { children: React.ReactNode; ink?: Ink; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      initial={reduce ? false : { scale: 2.4, rotate: -18, opacity: 0 }}
      animate={{ scale: 1, rotate: -5, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 16, mass: 0.9 }}
      className={`stamp-ink pointer-events-none inline-block select-none border-[3px] px-4 pb-1.5 pt-2 text-center font-type font-bold uppercase leading-none tracking-wider ${
        ink === "red" ? "border-red text-red" : ink === "blue" ? "border-blue text-blue" : "border-ink text-ink"
      } ${className}`}
    >
      {children}
    </motion.div>
  );
}
