"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";
import type Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger, SplitText);

export { gsap, ScrollTrigger, SplitText };

// The page's one smooth-scroll engine, set by <SmoothScroll>. Null under reduced motion.
let lenis: Lenis | null = null;
export const setLenis = (l: Lenis | null) => {
  lenis = l;
};

export const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scroll to an element by id, through Lenis when it runs so the glide matches the rest of the page. */
export function scrollToId(id: string, then?: () => void) {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { duration: 1.4, onComplete: then });
  else {
    el.scrollIntoView({ block: "start" });
    then?.();
  }
}

/** Fires once the intro has handed the page over (immediately when no intro plays). */
export function onIntroDone(fn: () => void) {
  if (document.documentElement.dataset.intro !== "play") {
    fn();
    return () => {};
  }
  window.addEventListener("pp:intro-done", fn, { once: true });
  return () => window.removeEventListener("pp:intro-done", fn);
}
