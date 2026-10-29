import { ArrowRight, ChevronDown } from "lucide-react";

const STEPS = [
  { title: "Tell us about it", body: "What it is, what it costs, and who you think will buy it. Four short questions, under two minutes." },
  { title: "Check the brands", body: "We suggest 3 to 6 brands people would compare it with. You keep the ones that fit and fix their prices." },
  { title: "Watch the debate", body: "Six panelists argue for two rounds while you watch. Every claim points to the Qloo data behind it." },
];

// What the report answers: a label, the answer in big type, and an example line from a real-looking report.
const ANSWERS = [
  { label: "Who to sell to first", big: "Gen Z fitness fans", note: "Ranked against the other groups you named, with how sure we are.", tint: "text-[#1f5a35]", bg: "bg-mint" },
  { label: "What puts people off", big: "“$3.29 feels steep”", note: "The top objections, grouped, in the panelists' own words.", tint: "text-[#1b3a78]", bg: "bg-lilac" },
  { label: "What they'd pay", big: "Mid-range", note: "Each panelist's price band, next to the brands you picked.", tint: "text-[#6b3a12]", bg: "bg-peach" },
];

const FAQ = [
  { q: "Are the panelists real people?", a: "No. Each one is built from Qloo taste data: the brands, music, shows and places a real audience over-indexes on. The language model only puts that data into words." },
  { q: "Where do the numbers come from?", a: "Who leans in, the price bands and the segment ranking are computed from Qloo data in plain code. The AI never makes up a score." },
  { q: "How long does a run take?", a: "About two minutes to fill in the brief, then roughly 90 seconds while the panel debates." },
  { q: "Is this a sales forecast?", a: "No. It gives you hypotheses about who to target and what will stop them, so you know what to test with real customers first." },
];

export function Steps() {
  return (
    <section id="how" className="scroll-mt-16">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-28 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="lg:sticky lg:top-28 lg:self-start">
          <h2 className="reveal font-serif text-[clamp(2.4rem,5vw,4rem)] leading-[1] tracking-[-0.025em]">
            Three steps.
            <br />
            <span className="text-faint">Then about 90 seconds of waiting.</span>
          </h2>
        </div>
        <ol className="grid gap-14">
          {STEPS.map((s, i) => (
            <li key={s.title} className="reveal grid grid-cols-[auto_minmax(0,1fr)] gap-6 border-t border-line pt-8">
              <span className="font-serif text-6xl leading-none text-pop/25">0{i + 1}</span>
              <div>
                <h3 className="font-serif text-3xl tracking-[-0.015em]">{s.title}</h3>
                <p className="mt-3 text-lg leading-relaxed text-sub">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <h2 className="reveal max-w-3xl font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.025em]">
          Then a short report answers three questions
        </h2>
        <ul className="mt-12 grid gap-4">
          {ANSWERS.map((a) => (
            <li key={a.label} className={`reveal grid items-end gap-4 rounded-[32px] ${a.bg} p-8 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:p-10 ${a.tint}`}>
              <div>
                <p className="text-sm font-medium opacity-80">{a.label}</p>
                <p className="mt-3 font-serif text-[clamp(2rem,4.4vw,3.6rem)] leading-none tracking-[-0.025em]">{a.big}</p>
              </div>
              <p className="text-lg leading-relaxed">{a.note}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-28 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <h2 className="reveal font-serif text-[clamp(2.2rem,4.6vw,3.6rem)] leading-[1.02] tracking-[-0.025em]">Questions</h2>
        <div className="reveal divide-y divide-line border-y border-line">
          {FAQ.map((f) => (
            <details key={f.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-lg font-medium [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden className="size-5 shrink-0 text-faint transition-transform duration-300 group-open:rotate-180" />
              </summary>
              <p className="mt-3 max-w-[60ch] leading-relaxed text-sub">{f.a}</p>
            </details>
          ))}
        </div>
      </div>

      <div className="px-3 sm:px-4">
        <div className="reveal relative isolate mx-auto max-w-7xl overflow-hidden rounded-[48px] bg-text px-6 py-20 text-center text-ink sm:rounded-[80px] sm:py-28">
          <div aria-hidden className="drift absolute -left-24 -top-24 -z-10 size-96 rounded-full bg-pop/40 blur-3xl" />
          <div aria-hidden className="drift absolute -bottom-32 -right-24 -z-10 size-96 rounded-full bg-[#7c5cd6]/30 blur-3xl [animation-delay:-6s]" />
          <h2 className="mx-auto max-w-3xl font-serif text-[clamp(2.2rem,5vw,4rem)] leading-[1] tracking-[-0.025em]">
            Find your first buyers before you launch
          </h2>
          <a
            href="#brief"
            className="group mt-10 inline-flex h-13 items-center gap-2 rounded-2xl bg-ink px-6 font-medium text-text transition hover:-translate-y-0.5"
          >
            Start your brief
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2} />
          </a>
        </div>
      </div>
    </section>
  );
}
