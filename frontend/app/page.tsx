import { BriefForm } from "@/components/BriefForm";
import { Hero } from "@/components/Hero";

// Run of show for one panel. Times are approximate.
const RUNDOWN: [string, string, string][] = [
  ["00:00", "You brief the panel", "Describe the product, its price, up to two variants and up to three audiences."],
  ["00:20", "You confirm the brands", "An AI suggests 3 to 6 rival brands; each is checked against Qloo before you approve it."],
  ["00:40", "The panel debates, live", "Six panelists argue over two rounds with a moderator. Stances come from Qloo affinity data."],
  ["01:30", "You get the verdict", "Which audience to launch to, the objections to test, and the price band they expect."],
];

export default function Home() {
  return (
    <>
      <Hero />

      <section id="how" aria-labelledby="how-head" className="scroll-mt-4 bg-blue-deep">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-3">
            <h2 id="how-head" className="display text-[clamp(2.5rem,5vw,4rem)] text-white">
              Run of show
            </h2>
            <p className="max-w-[40ch] text-[15px] leading-relaxed text-sub">
              One brief, one confirmation, then you watch. Nothing runs until you press the button.
            </p>
          </div>
          <ol className="mt-12 grid gap-px bg-white/15 sm:grid-cols-2 lg:grid-cols-4">
            {RUNDOWN.map(([time, title, body]) => (
              <li key={time} className="group bg-blue-deep pb-2 pr-6 pt-6 transition-colors sm:pl-6">
                <span className="display block text-[3.5rem] text-signal">{time}</span>
                <h3 className="tag mt-3 text-xl text-white">{title}</h3>
                <p className="mt-2 max-w-[34ch] text-[15px] leading-relaxed text-sub">{body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BriefForm />
    </>
  );
}
