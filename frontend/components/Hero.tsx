import { ArrowRight } from "lucide-react";

type Stance = "enthusiast" | "conditional" | "skeptic";
const STANCE: Record<Stance, { label: string; cls: string }> = {
  enthusiast: { label: "Enthusiast", cls: "text-enthusiast" },
  conditional: { label: "On the fence", cls: "text-conditional" },
  skeptic: { label: "Skeptic", cls: "text-skeptic" },
};

// Illustration only: shows the shape of a panel, not real output.
const PANEL: { name: string; who: string; stance: Stance; says: string; bg: string; tilt: string }[] = [
  { name: "Maya", who: "Wellness runner", stance: "enthusiast", says: "I'd swap my kombucha for this.", bg: "bg-mint", tilt: "-rotate-2" },
  { name: "Dev", who: "Office snacker", stance: "conditional", says: "Cute can. $3.29 though?", bg: "bg-sun", tilt: "rotate-2" },
  { name: "Ruth", who: "Budget parent", stance: "skeptic", says: "My kids won't drink 'adaptogens'.", bg: "bg-peach", tilt: "-rotate-1" },
  { name: "Leo", who: "Gym regular", stance: "enthusiast", says: "Low sugar? I'm in.", bg: "bg-sky", tilt: "rotate-1" },
  { name: "Ana", who: "Foodie", stance: "conditional", says: "Show me the flavours first.", bg: "bg-lilac", tilt: "-rotate-2" },
  { name: "Sam", who: "Soda loyalist", stance: "skeptic", says: "Coke already does this job.", bg: "bg-tomato", tilt: "rotate-2" },
];

export function Hero() {
  return (
    <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] lg:pt-20">
      <div>
        <p className="font-hand text-3xl text-pop">Hello! 👋</p>
        <h1 className="mt-2 font-serif text-[clamp(2.6rem,6vw,4.4rem)] font-bold leading-[1.02] tracking-[-0.02em]">
          Test your product on six shoppers{" "}
          <span className="italic underline decoration-sun decoration-[0.18em] underline-offset-[0.12em]">before</span> you launch.
        </h1>
        <p className="mt-6 max-w-[48ch] text-lg leading-relaxed text-sub">
          Describe your product. Six panelists, built from real Qloo taste data, argue about it. You get a short report: who to
          sell to first, what puts people off, and what they&apos;d pay.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-4">
          <a
            href="#brief"
            className="sticker group inline-flex h-14 items-center gap-2 rounded-full bg-sun px-7 text-base font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0.5"
          >
            Start your brief
            <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
          </a>
          <a href="#how" className="font-medium underline decoration-2 hover:text-pop">
            How does it work?
          </a>
        </div>
        <p className="mt-5 font-hand text-2xl text-sub">takes about 2 minutes, free to try</p>
      </div>

      <figure>
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {PANEL.map((p, i) => (
            <li
              key={p.name}
              className={`sticker rounded-3xl ${p.bg} ${p.tilt} p-4 transition-transform duration-300 hover:-translate-y-1 hover:rotate-0 motion-safe:animate-float`}
              style={{ animationDelay: `${i * -0.8}s` }}
            >
              <div className="flex items-center gap-2.5">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-text bg-raise font-serif font-bold">
                  {p.name[0]}
                </span>
                <span className="min-w-0 leading-tight">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="block text-xs">{p.who}</span>
                </span>
              </div>
              <p className="mt-3 rounded-2xl bg-raise px-3 py-2 text-sm leading-snug">&ldquo;{p.says}&rdquo;</p>
              <p className={`mt-2 w-fit rounded-full bg-raise px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${STANCE[p.stance].cls}`}>
                {STANCE[p.stance].label}
              </p>
            </li>
          ))}
        </ul>
        <figcaption className="mt-5 text-center font-hand text-xl text-sub">an example panel for a low-sugar soda</figcaption>
      </figure>
    </section>
  );
}
