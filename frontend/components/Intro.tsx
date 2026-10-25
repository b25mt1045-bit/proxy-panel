"use client";

import { useEffect, useRef } from "react";

import { Mark } from "@/components/Mark";
import { gsap, ScrollTrigger, SplitText } from "@/lib/motion";

/**
 * First-visit intro: the six seats take their places, the name rises, then the whole lockup glides into the header
 * while the page comes up beneath it. The head script in layout.tsx decides whether it plays (once per session,
 * never under reduced motion); any click, key or scroll skips to the end.
 */
export function Intro() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const html = document.documentElement;
    const el = root.current;
    if (html.dataset.intro !== "play" || !el) return;

    const lockup = el.querySelector<HTMLElement>("[data-lockup]")!;
    const target = document.getElementById("site-lockup");
    const header = document.querySelector<HTMLElement>(".site-header");
    const split = new SplitText(el.querySelector("[data-word]"), { type: "chars", mask: "chars" });
    html.style.overflow = "hidden";

    const finish = () => {
      try {
        sessionStorage.setItem("pp-intro", "1");
      } catch {}
      html.style.overflow = "";
      delete html.dataset.intro;
      split.revert();
      el.style.display = "none";
      // The scrollbar is back now; pinned sections were measured without it.
      ScrollTrigger.refresh();
      window.dispatchEvent(new Event("pp:intro-done"));
    };

    const tl = gsap.timeline({ defaults: { ease: "expo.out" }, onComplete: finish });
    // fromTo throughout: React runs this effect twice in development, and a plain from() would take the
    // half-played first run as its end state.
    tl.fromTo(el.querySelector("[data-ring]"), { strokeDasharray: 1, strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: 1.1, ease: "power2.inOut" }, 0.1)
      .fromTo(el.querySelectorAll("[data-seat]"), { scale: 0, transformOrigin: "50% 50%" }, { scale: 1, duration: 0.7, stagger: 0.08 }, 0.2)
      .fromTo(split.chars, { yPercent: 110 }, { yPercent: 0, duration: 0.9, stagger: 0.025 }, 0.55)
      .addLabel("fly", 1.55)
      .add(() => {
        // Measured at fly time so a resize during the intro still lands on the header.
        if (!target) return;
        const a = lockup.getBoundingClientRect();
        const b = target.getBoundingClientRect();
        gsap.to(lockup, {
          x: b.left - a.left,
          y: b.top - a.top,
          scale: b.width / a.width,
          transformOrigin: "0 0",
          duration: 1.05,
          ease: "expo.inOut",
        });
      }, "fly")
      .fromTo(el.querySelector("[data-veil]"), { opacity: 1 }, { opacity: 0, duration: 0.9, ease: "power2.inOut" }, "fly+=0.3")
      .fromTo("main", { y: 48, opacity: 0 }, { y: 0, opacity: 1, duration: 1.2, clearProps: "transform,opacity" }, "fly+=0.45")
      .to(header, { opacity: 1, duration: 0.01 }, "fly+=1.05")
      .to(lockup, { opacity: 0, duration: 0.01 }, "fly+=1.06");

    const skip = () => tl.progress(1);
    el.addEventListener("click", skip);
    window.addEventListener("keydown", skip, { once: true });
    window.addEventListener("wheel", skip, { once: true, passive: true });
    window.addEventListener("touchmove", skip, { once: true, passive: true });
    return () => {
      tl.kill();
      split.revert();
      gsap.set(["main", lockup], { clearProps: "all" });
      window.removeEventListener("keydown", skip);
      window.removeEventListener("wheel", skip);
      window.removeEventListener("touchmove", skip);
      html.style.overflow = "";
    };
  }, []);

  return (
    <div ref={root} aria-hidden className="intro fixed inset-0 z-50 cursor-pointer items-center justify-center">
      <div data-veil className="absolute inset-0 bg-bg" />
      {/* Same proportions as the header lockup, at 2.6x, so the glide is a pure scale. */}
      <span data-lockup className="relative flex items-center gap-[26px]">
        <Mark className="size-[73px]" />
        <span data-word className="text-[44px] font-medium tracking-[-0.01em] text-text">
          Proxy Panel
        </span>
      </span>
    </div>
  );
}
