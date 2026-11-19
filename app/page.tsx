import { Hero } from "@/components/hero";
import { HowItThinks } from "@/components/how-it-thinks";
import { Console } from "@/components/console/console";

const DOCS = "https://github.com/shatha003/second-thought-adaptive-agent/blob/main/docs";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Hero />
      <HowItThinks />
      <Console />
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end justify-between gap-6 px-4 py-10 sm:px-8">
          <p className="font-display text-[clamp(40px,6vw,80px)] font-black uppercase leading-[0.85]">
            Second
            <br />
            <span className="text-signal">thought</span>
          </p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-paper/70">
            <a className="transition-colors hover:text-signal" href={`${DOCS}/ARCHITECTURE.md`}>Architecture</a>
            <a className="transition-colors hover:text-signal" href={`${DOCS}/FAILURE-TEST.md`}>Failure test</a>
            <a className="transition-colors hover:text-signal" href={`${DOCS}/THESIS.md`}>Thesis</a>
            <a className="transition-colors hover:text-signal" href="https://github.com/shatha003/second-thought-adaptive-agent">Source</a>
          </nav>
        </div>
      </footer>
    </main>
  );
}
