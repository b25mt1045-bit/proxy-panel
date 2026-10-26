import { ArrowRight } from "lucide-react";

const STEPS = [
  { title: "Tell us about it", body: "What it is, what it costs, and who you think will buy it. Four short questions.", bg: "bg-sky" },
  { title: "Check the brands", body: "We suggest 3 to 6 similar brands to compare it with. You tick the ones that fit.", bg: "bg-sun" },
  { title: "Watch the debate", body: "Six panelists argue for two rounds, live. Every claim points to Qloo data.", bg: "bg-mint" },
];

const ANSWERS = ["Who should I launch to first?", "What will stop people buying?", "What price will they pay?"];

export function Steps() {
  return (
    <section id="how" className="scroll-mt-16 border-y-2 border-text bg-raise">
      <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
        <h2 className="font-serif text-[clamp(2rem,4.5vw,3.2rem)] font-bold leading-tight tracking-[-0.02em]">How it works</h2>
        <p className="mt-3 text-lg text-sub">Three steps, then about 90 seconds of waiting.</p>

        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className={`sticker rounded-3xl ${s.bg} p-7`}>
              <span className="flex size-12 items-center justify-center rounded-full border-2 border-text bg-raise font-serif text-2xl font-bold">
                {i + 1}
              </span>
              <h3 className="mt-5 font-serif text-2xl font-bold">{s.title}</h3>
              <p className="mt-2 leading-relaxed">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="sticker mt-10 grid items-center gap-8 rounded-3xl bg-text p-8 text-ink md:grid-cols-[minmax(0,1fr)_auto] md:p-10">
          <div>
            <p className="font-hand text-2xl text-sun">then you get a report that answers</p>
            <ul className="mt-4 grid gap-3">
              {ANSWERS.map((a) => (
                <li key={a} className="flex items-center gap-3 font-serif text-xl sm:text-2xl">
                  <span aria-hidden className="size-3 shrink-0 rounded-full bg-sun" />
                  {a}
                </li>
              ))}
            </ul>
          </div>
          <a
            href="#brief"
            className="group inline-flex h-14 items-center justify-center gap-2 rounded-full border-2 border-ink bg-sun px-7 font-semibold text-text transition-transform hover:-translate-y-0.5"
          >
            Try it now
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
          </a>
        </div>
      </div>
    </section>
  );
}
