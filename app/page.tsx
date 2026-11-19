import { FrontPage, Masthead } from "@/components/front-page";
import { MarksLegend } from "@/components/marks-legend";
import { Newsroom } from "@/components/newsroom/newsroom";

const REPO = "https://github.com/shatha003/second-thought-adaptive-agent";

export default function Home() {
  return (
    <main className="overflow-x-clip">
      <Masthead />
      <FrontPage />
      <MarksLegend />
      <Newsroom />
      <footer className="mx-auto max-w-[1360px] px-4 pb-12 sm:px-8">
        <div className="rule-double" />
        <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
          <p className="font-black text-[clamp(34px,5vw,60px)] leading-none">The Second Thought</p>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 font-type text-[12.5px] uppercase tracking-wider">
            <a className="hover:text-red" href={`${REPO}/blob/main/docs/ARCHITECTURE.md`}>Architecture</a>
            <a className="hover:text-red" href={`${REPO}/blob/main/docs/FAILURE-TEST.md`}>Failure test</a>
            <a className="hover:text-red" href={`${REPO}/blob/main/docs/THESIS.md`}>Thesis</a>
            <a className="hover:text-red" href={REPO}>Source</a>
          </nav>
        </div>
        <p className="mt-6 font-serif text-[15px] italic text-ink2">Printed live. Every correction is kept on the record.</p>
      </footer>
    </main>
  );
}
