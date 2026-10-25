"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";

import { gsap } from "@/lib/motion";

// Sample report for the "Calm Fizz" sample brief; labelled as a sample below.
const OBJECTIONS = ["Over $3 a can feels like a café price", "“Calm” claims sound like every other soda", "Needs to be in the gym fridge, not the aisle"];
const BAND = { lo: 2.49, hi: 3.49, min: 1.5, max: 4.5, yours: 3.29 };
const pct = (v: number) => ((v - BAND.min) / (BAND.max - BAND.min)) * 100;

export function Outcome() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap
          .timeline({ defaults: { ease: "expo.out" }, scrollTrigger: { trigger: q("[data-cols]")[0], start: "top 75%" } })
          .fromTo(q("[data-col]"), { y: 56, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, stagger: 0.12 })
          .fromTo(q("[data-band]"), { scaleX: 0 }, { scaleX: 1, duration: 1.2 }, 0.5)
          .fromTo(q("[data-yours]"), { y: -10, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6 }, 1)
          .fromTo(q("[data-objection]"), { x: -16, opacity: 0 }, { x: 0, opacity: 1, duration: 0.8, stagger: 0.1 }, 0.4);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="outcome-head" className="relative">
      <div className="mx-auto max-w-6xl px-5 py-32 sm:px-8 sm:py-40">
        <h2 id="outcome-head" className="max-w-[16ch] text-[clamp(2.5rem,5.5vw,4.5rem)] font-light leading-[1] tracking-[-0.035em] text-text">
          You leave with <span className="accent text-gold">three</span> answers.
        </h2>

        <div data-cols className="mt-20 grid border-t border-line md:grid-cols-3">
          <article data-col className="border-b border-line py-10 md:border-b-0 md:border-r md:pr-10">
            <h3 className="text-sm text-sub">Who to launch to</h3>
            <p className="accent mt-6 text-[2.25rem] leading-[1.1] text-gold">Gen Z urban fitness</p>
            <p className="mt-5 text-[15px] leading-relaxed text-faint">The audience whose panelists lean in the most, out of the ones you named.</p>
          </article>

          <article data-col className="border-b border-line py-10 md:border-b-0 md:border-r md:px-10">
            <h3 className="text-sm text-sub">What will stop them buying</h3>
            <ol className="mt-6 grid gap-4">
              {OBJECTIONS.map((o, i) => (
                <li key={o} data-objection className="flex gap-4 text-[15px] leading-snug text-text">
                  <span className="tabular-nums text-skeptic">{String(i + 1).padStart(2, "0")}</span>
                  {o}
                </li>
              ))}
            </ol>
          </article>

          <article data-col className="py-10 md:pl-10">
            <h3 className="text-sm text-sub">The price they expect</h3>
            <p className="mt-6 text-[2.25rem] font-light tabular-nums leading-[1.1] tracking-[-0.02em] text-text">
              ${BAND.lo.toFixed(2)}–${BAND.hi.toFixed(2)}
            </p>
            <div className="relative mt-8 h-1.5 rounded-full bg-line">
              <span
                data-band
                className="absolute inset-y-0 origin-left rounded-full bg-gold/70"
                style={{ left: `${pct(BAND.lo)}%`, width: `${pct(BAND.hi) - pct(BAND.lo)}%` }}
              />
              <span data-yours className="absolute -top-7 -translate-x-1/2 text-[11px] text-sub" style={{ left: `${pct(BAND.yours)}%` }}>
                yours ${BAND.yours}
                <span className="absolute left-1/2 top-5 h-4 w-px bg-text" />
              </span>
            </div>
            <p className="mt-6 text-[15px] leading-relaxed text-faint">From the price tiers of the brands they over-index on.</p>
          </article>
        </div>
        <p className="mt-10 text-sm text-faint">
          Plus an interview script for talking to real customers. Sample report, for illustration.
        </p>
      </div>
    </section>
  );
}
