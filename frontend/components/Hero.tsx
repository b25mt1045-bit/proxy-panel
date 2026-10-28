import { HeroDemo } from "@/components/HeroDemo";
import { HeroInput } from "@/components/HeroInput";
import { RotatingWord } from "@/components/RotatingWord";

const STAGGER = 70; // ms between headline words
const rise = (i: number) => ({ animationDelay: `${i * STAGGER}ms` });

// The kind of taste signals each panelist is built from (illustrative names across Qloo's entity types).
const SIGNALS = [
  "Olipop", "Peloton", "Taylor Swift", "The Bear", "Glossier", "Trader Joe's", "Huberman Lab", "Lululemon",
  "Bon Appétit", "Patagonia", "Succession", "Liquid Death", "Strava", "Erewhon", "Dua Lipa", "Allbirds",
];

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden pt-16 sm:pt-24">
      <div aria-hidden className="drift absolute -right-48 -top-48 -z-10 size-[44rem] rounded-full bg-lilac blur-3xl" />
      <div aria-hidden className="drift absolute -left-56 top-64 -z-10 size-[36rem] rounded-full bg-mint/80 blur-3xl [animation-delay:-7s]" />
      <div aria-hidden className="drift absolute right-1/4 top-[38rem] -z-10 size-[28rem] rounded-full bg-peach/70 blur-3xl [animation-delay:-3s]" />

      <div className="mx-auto max-w-6xl px-5 text-center sm:px-8">
        <h1 className="mx-auto max-w-6xl font-serif text-[clamp(2.6rem,7.4vw,5.6rem)] leading-[0.92] tracking-[-0.025em]">
          <span className="inline-block motion-safe:animate-rise" style={rise(0)}>
            Hear&nbsp;
          </span>
          <span className="inline-block motion-safe:animate-rise" style={rise(1)}>
            six&nbsp;
          </span>
          <span className="inline-block motion-safe:animate-rise" style={rise(2)}>
            <RotatingWord words={["shoppers", "skeptics", "parents", "runners", "foodies"]} className="text-pop" />
          </span>
          <br />
          {"argue about your product".split(" ").map((w, i) => (
            <span key={i} className="inline-block motion-safe:animate-rise" style={rise(i + 3)}>
              {w}&nbsp;
            </span>
          ))}
        </h1>
        <p className="mx-auto mt-7 max-w-[46ch] text-lg leading-relaxed text-sub motion-safe:animate-rise [animation-delay:500ms]">
          Six panelists built from <span className="shine font-medium">real Qloo taste data</span> debate your idea, live. You get
          who to sell to first, what puts people off, and what they&apos;d pay.
        </p>

        <div className="mt-9 motion-safe:animate-rise [animation-delay:650ms]">
          <HeroInput />
          <p className="mt-4 flex flex-wrap justify-center gap-x-5 gap-y-1 text-sm text-faint">
            <span>6 panelists</span>
            <span aria-hidden>·</span>
            <span>about 90 seconds</span>
            <span aria-hidden>·</span>
            <span>free to try</span>
          </p>
        </div>

        <div className="mt-14 motion-safe:animate-rise [animation-delay:850ms]">
          <HeroDemo />
        </div>
      </div>

      <div className="mt-20 pb-6">
        <p className="text-center text-sm text-faint">Panelists are built from what real people over-index on</p>
        <div className="marquee mt-5 flex overflow-hidden">
          <ul className="flex shrink-0 gap-3 pr-3">
            {[...SIGNALS, ...SIGNALS].map((s, i) => (
              <li key={i} aria-hidden={i >= SIGNALS.length} className="whitespace-nowrap rounded-full bg-raise/80 px-4 py-2 text-sm text-sub shadow-sm">
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
