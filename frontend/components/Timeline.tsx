"use client";

import { useGSAP } from "@gsap/react";
import { useRef } from "react";

import { Table } from "@/components/Table";
import { gsap, ScrollTrigger } from "@/lib/motion";

const STEPS = [
  ["About 0:00", "Describe it.", "Product, price, up to two variants and up to three audiences. That is the whole brief."],
  ["About 0:20", "Confirm the brands.", "An AI suggests 3 to 6 rival brands. Each one is checked against Qloo before you approve it."],
  ["About 0:40", "Watch them debate.", "Six panelists argue over two rounds with a moderator. Each stance is computed from their Qloo affinity to those brands."],
  ["About 1:30", "Get the verdict.", "The audience to launch to, the objections to test, and the price band they expect."],
] as const;

/** How a run works: a line that draws down the page; each step lights up and arrives as the line reaches it. */
export function Timeline() {
  const root = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add("(prefers-reduced-motion: no-preference)", () => {
        const q = gsap.utils.selector(root);
        gsap.fromTo(
          q("[data-fill]"),
          { scaleY: 0 },
          { scaleY: 1, ease: "none", scrollTrigger: { trigger: q("[data-track]")[0], start: "top 60%", end: "bottom 60%", scrub: 0.6 } },
        );
        q("[data-row]").forEach((row: Element) => {
          const r = gsap.utils.selector(row);
          const tl = gsap
            .timeline({ paused: true, defaults: { ease: "expo.out" } })
            .fromTo(r("[data-node]"), { scale: 0.4, backgroundColor: "#34373d" }, { scale: 1, backgroundColor: "#d9c08c", duration: 0.6 })
            .fromTo(r("[data-node-ring]"), { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.9 }, 0)
            .fromTo(r("[data-copy] > *"), { y: 36, opacity: 0 }, { y: 0, opacity: 1, duration: 1, stagger: 0.08 }, 0.05)
            .fromTo(r("[data-visual]"), { y: 48, opacity: 0, scale: 0.94 }, { y: 0, opacity: 1, scale: 1, duration: 1.2 }, 0.1)
            .fromTo(r("[data-brand]"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.6, stagger: 0.07, ease: "back.out(2)" }, 0.45)
            .fromTo(r("[data-chord]"), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 0.8, stagger: 0.1, ease: "power2.inOut" }, 0.5);
          ScrollTrigger.create({ trigger: row, start: "top 62%", onEnter: () => tl.play(), onLeaveBack: () => tl.reverse() });
        });
      });
    },
    { scope: root },
  );

  return (
    <section id="how" ref={root} aria-labelledby="how-head" className="relative">
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-32 sm:px-8 sm:pt-40">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="how-head" className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-light leading-[1] tracking-[-0.035em] text-text">
            How a run <span className="accent text-gold">works.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-[46ch] text-[17px] leading-relaxed text-sub">
            From brief to verdict in about 90 seconds. You make two decisions; the panel does the rest.
          </p>
        </div>

        <ol data-track className="relative mt-24">
          {/* The line: a faint track, and a gold fill that grows with the scroll. */}
          <div aria-hidden className="absolute bottom-0 left-[11px] top-0 w-px bg-line lg:left-1/2">
            <span data-fill className="absolute inset-0 origin-top bg-linear-to-b from-gold/90 to-gold/40" />
          </div>

          {STEPS.map(([time, title, body], i) => {
            const flip = i % 2 === 1;
            return (
              <li key={title} data-row className="relative grid items-center gap-x-24 gap-y-8 pb-28 pl-12 last:pb-0 lg:grid-cols-2 lg:pl-0">
                {/* Node on the line */}
                <span aria-hidden className="absolute left-[11px] top-2 -translate-x-1/2 lg:left-1/2 lg:top-1/2 lg:-translate-y-1/2">
                  <span data-node-ring className="absolute -inset-2.5 rounded-full border border-gold/40" />
                  <span data-node className="relative block size-3 rounded-full bg-gold" />
                </span>

                <div data-copy className={`max-w-md ${flip ? "lg:order-2 lg:justify-self-start" : "lg:justify-self-end lg:text-right"}`}>
                  <p className="text-sm tabular-nums text-gold">{time}</p>
                  <h3 className="mt-3 text-[clamp(2rem,3.6vw,3rem)] font-light leading-[1.05] tracking-[-0.03em] text-text">{title}</h3>
                  <p className={`mt-4 max-w-[38ch] text-[17px] leading-relaxed text-sub ${flip ? "" : "lg:ml-auto"}`}>{body}</p>
                </div>

                <div data-visual className={`w-full max-w-[22rem] ${flip ? "lg:order-1 lg:justify-self-end" : "lg:justify-self-start"}`}>
                  <Table stage={i as 0 | 1 | 2 | 3} className="w-full" />
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-16 text-center text-xs text-faint">Sample run, for illustration.</p>
      </div>
    </section>
  );
}
