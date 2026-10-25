"use client";

import { useGSAP } from "@gsap/react";
import { ArrowDown, ArrowRight } from "lucide-react";
import { useRef } from "react";

import { Mark } from "@/components/Mark";
import { gsap, onIntroDone, scrollToId, SplitText } from "@/lib/motion";

export function Hero() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const split = new SplitText("[data-headline]", { type: "words,lines", mask: "lines" });
        gsap.set(split.words, { yPercent: 110 });
        gsap.set("[data-rise]", { y: 24, opacity: 0 });
        const off = onIntroDone(() => {
          gsap
            .timeline({ defaults: { ease: "expo.out" } })
            .to(split.words, { yPercent: 0, duration: 1.3, stagger: 0.06 })
            .to("[data-rise]", { y: 0, opacity: 1, duration: 1.1, stagger: 0.1 }, 0.45);
        });
        // The big table drifts slower than the page, and turns very slowly on its own.
        gsap.to("[data-orbit]", {
          yPercent: 18,
          ease: "none",
          scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
        });
        return () => {
          off();
          split.revert();
        };
      });
    },
    { scope: root },
  );

  const startBrief = (e: React.MouseEvent) => {
    e.preventDefault();
    scrollToId("brief", () => document.getElementById("f-description")?.focus({ preventScroll: true }));
  };

  return (
    <section ref={root} aria-labelledby="hero-head" className="relative flex min-h-[100svh] items-center overflow-hidden">
      <div
        data-orbit
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[80%] w-[min(1100px,150vw)] sm:top-[74%] -translate-x-1/2 opacity-40"
      >
        <Mark outline className="w-full motion-safe:animate-[spin-slow_160s_linear_infinite]" ring="var(--color-sub)" />
      </div>
      {/* Keeps the type legible over the mark: the room darkens toward the edges. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,transparent_25%,rgba(14,15,17,0.7)_80%)]" />

      <div className="relative mx-auto w-full max-w-6xl px-5 pb-24 pt-32 text-center sm:px-8">
        <h1
          id="hero-head"
          data-headline
          className="mx-auto max-w-[14ch] text-balance text-[clamp(2.75rem,min(7.2vw,12.5svh),6rem)] font-light leading-[0.98] tracking-[-0.035em] text-text"
        >
          Know who buys it <span className="accent text-gold">before</span> you launch.
        </h1>
        <p data-rise className="mx-auto mt-8 max-w-[52ch] text-pretty text-[17px] leading-relaxed text-sub">
          A focus group of six panelists built from Qloo taste data. Describe your product, and in about 90 seconds you learn
          which audience to launch to, what will stop them buying, and the price they expect.
        </p>
        <div data-rise className="mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
          <a
            href="#brief"
            onClick={startBrief}
            className="group inline-flex h-12 items-center gap-2.5 rounded-full bg-text pl-6 pr-5 text-[15px] font-medium text-ink transition-colors duration-300 hover:bg-gold"
          >
            Brief the panel
            <ArrowRight aria-hidden className="size-4 transition-transform duration-300 group-hover:translate-x-0.5" strokeWidth={2} />
          </a>
          <a
            href="#how"
            onClick={(e) => {
              e.preventDefault();
              scrollToId("how");
            }}
            className="inline-flex items-center gap-2 text-[15px] text-sub transition-colors hover:text-text"
          >
            See how it works
            <ArrowDown aria-hidden className="size-4" strokeWidth={1.75} />
          </a>
        </div>
      </div>

      <div data-rise aria-hidden className="absolute bottom-8 left-1/2 flex -translate-x-1/2 flex-col items-center gap-3 [@media(max-height:760px)]:hidden">
        <span className="text-[11px] uppercase tracking-[0.3em] text-faint">Scroll</span>
        <span className="h-10 w-px bg-line">
          <span className="block h-full w-px bg-sub motion-safe:animate-[cue_2.4s_var(--ease-out-expo)_infinite]" />
        </span>
      </div>
    </section>
  );
}
