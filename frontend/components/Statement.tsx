"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";

import { gsap, SplitText } from "@/lib/motion";

/** The product's one promise, lit word by word as it scrolls past. */
export function Statement() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = new SplitText("[data-lit]", { type: "words" });
        gsap.fromTo(
          split.words,
          { opacity: 0.16 },
          {
            opacity: 1,
            ease: "none",
            stagger: 0.1,
            scrollTrigger: { trigger: root.current, start: "top 75%", end: "bottom 55%", scrub: true },
          },
        );
        return () => split.revert();
      });
    },
    { scope: root },
  );

  return (
    <section ref={root} aria-label="How the panel stays honest" className="border-y border-line">
      <div className="mx-auto max-w-5xl px-5 py-32 sm:px-8 sm:py-44">
        <p data-lit className="text-balance text-[clamp(1.9rem,4.2vw,3.5rem)] font-light leading-[1.15] tracking-[-0.025em] text-text">
          Every stance is computed from <span className="accent text-gold">measured</span> taste data. The AI only puts it into
          words, and every line it writes cites a Qloo receipt you can check.
        </p>
      </div>
    </section>
  );
}
