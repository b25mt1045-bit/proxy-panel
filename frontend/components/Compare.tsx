"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";

import { gsap } from "@/lib/motion";

const R = ({ n }: { n: number }) => (
  <span className="mx-0.5 inline-block translate-y-[-2px] rounded border border-gold/50 px-1 text-[11px] leading-4 tabular-nums text-gold">
    R{n}
  </span>
);

/** Why receipts matter: the generic answer blurs out of focus as the grounded one comes forward. */
export function Compare() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap
          .timeline({ scrollTrigger: { trigger: q("[data-pair]")[0], start: "top 70%", end: "center 45%", scrub: 0.8 } })
          .fromTo(q("[data-generic]"), { opacity: 1, filter: "blur(0px)" }, { opacity: 0.45, filter: "blur(1.5px)", ease: "none" }, 0)
          .fromTo(q("[data-grounded]"), { y: 40, borderColor: "rgba(52,55,61,1)" }, { y: 0, borderColor: "rgba(217,192,140,0.45)", ease: "none" }, 0);
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-labelledby="compare-head" className="relative">
      <div className="mx-auto max-w-6xl px-5 py-32 sm:px-8 sm:py-40">
        <h2 id="compare-head" className="max-w-[18ch] text-[clamp(2.25rem,4.6vw,3.75rem)] font-light leading-[1.02] tracking-[-0.035em] text-text">
          A chatbot gives you a guess. The panel gives you <span className="accent text-gold">receipts.</span>
        </h2>

        <div data-pair className="mt-16 grid gap-6 md:grid-cols-2">
          <figure data-generic className="rounded-2xl border border-line p-8 sm:p-10">
            <figcaption className="text-sm text-faint">A generic AI answer</figcaption>
            <blockquote className="mt-6 text-xl font-light leading-relaxed text-sub">
              “Health-conscious millennials will probably love it. Consider competitive pricing and a strong social media
              presence.”
            </blockquote>
          </figure>
          <figure data-grounded className="rounded-2xl border border-line-2 bg-raise/60 p-8 sm:p-10">
            <figcaption className="flex items-center gap-2 text-sm text-text">
              <span aria-hidden className="size-1.5 rounded-full bg-gold" />
              Proxy Panel
            </figcaption>
            <blockquote className="mt-6 text-xl font-light leading-relaxed text-text">
              “Launch to Gen Z urban fitness first: their panelists over-index on brands in the same price tier <R n={1} /> and
              drink it after training <R n={2} />. Millennial wellness splits on whether ‘calm’ is believable <R n={3} />.”
            </blockquote>
          </figure>
        </div>
        <p className="mt-8 text-sm text-faint">
          Every report shows both answers side by side, so you can see what the data changed. Illustrative example.
        </p>
      </div>
    </section>
  );
}
