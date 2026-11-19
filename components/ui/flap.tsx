"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const rand = () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)];

const SIZES = {
  xs: "h-[18px] w-[12px] text-[11px] rounded-[2px]",
  sm: "h-[24px] w-[16px] text-[14px] rounded-[3px]",
  md: "h-[38px] w-[26px] text-[22px] rounded-[4px]",
  lg: "h-[clamp(46px,8.4vw,104px)] w-[clamp(32px,5.9vw,74px)] text-[clamp(30px,5.8vw,72px)] rounded-[6px]",
} as const;

const TONES = {
  paper: "text-paper",
  dim: "text-dim",
  signal: "text-signal",
  go: "text-go",
  stop: "text-stop",
} as const;

export type FlapTone = keyof typeof TONES;

function Tile({ char, delay, boot, size }: { char: string; delay: number; boot: boolean; size: keyof typeof SIZES }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(char);
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    if (reduce || (isFirst && !boot)) {
      timers.push(setTimeout(() => setShown(char), 0));
    } else {
      // A real flap cycles through the drum before landing on the target glyph.
      const cycles = char === " " ? 2 : 4 + Math.floor(Math.random() * 3);
      for (let i = 0; i < cycles; i++) timers.push(setTimeout(() => setShown(rand()), delay + i * 52));
      timers.push(setTimeout(() => setShown(char), delay + cycles * 52));
    }
    return () => timers.forEach(clearTimeout);
  }, [char, delay, boot, reduce]);

  return (
    <span className={`flap-tile relative inline-flex shrink-0 items-center justify-center overflow-hidden font-mono font-bold ${SIZES[size]}`} style={{ perspective: 240 }}>
      <motion.span
        key={shown}
        initial={reduce ? false : { rotateX: -88, opacity: 0.4 }}
        animate={{ rotateX: 0, opacity: 1 }}
        transition={{ duration: 0.09, ease: "easeOut" }}
        className="block origin-top leading-none"
      >
        {shown === " " ? " " : shown}
      </motion.span>
    </span>
  );
}

/** Split-flap text. Each tile spins through the drum and lands on its glyph whenever the text changes. */
export function Flap({
  text,
  size = "sm",
  tone = "paper",
  length,
  boot = true,
  stagger = 38,
  className = "",
}: {
  text: string;
  size?: keyof typeof SIZES;
  tone?: FlapTone;
  length?: number;
  boot?: boolean;
  stagger?: number;
  className?: string;
}) {
  const t = (length ? text.padEnd(length).slice(0, length) : text).toUpperCase();
  const gap = size === "lg" ? "gap-[clamp(3px,0.5vw,6px)]" : size === "md" ? "gap-[3px]" : "gap-[2px]";
  return (
    <span className={`inline-flex ${gap} ${TONES[tone]} transition-colors duration-500 ${className}`}>
      <span className="sr-only">{text}</span>
      <span aria-hidden className={`inline-flex ${gap}`}>
        {t.split("").map((c, i) => (
          <Tile key={i} char={c} delay={i * stagger} boot={boot} size={size} />
        ))}
      </span>
    </span>
  );
}

/** Decoding text: characters resolve left to right whenever the text changes. */
export function Scramble({ text, className = "", boot = false }: { text: string; className?: string; boot?: boolean }) {
  const reduce = useReducedMotion();
  const [out, setOut] = useState(text);
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    if (reduce || (isFirst && !boot)) {
      const t = setTimeout(() => setOut(text), 0);
      return () => clearTimeout(t);
    }
    const steps = Math.min(26, Math.max(10, Math.round(text.length / 2)));
    let i = 0;
    const id = setInterval(() => {
      i++;
      const reveal = Math.floor((i / steps) * text.length);
      setOut(text.slice(0, reveal) + text.slice(reveal).replace(/\S/g, () => rand().toLowerCase()));
      if (i >= steps) {
        clearInterval(id);
        setOut(text);
      }
    }, 26);
    return () => clearInterval(id);
  }, [text, reduce, boot]);

  return (
    <span className={className} aria-label={text}>
      <span aria-hidden>{out}</span>
    </span>
  );
}
