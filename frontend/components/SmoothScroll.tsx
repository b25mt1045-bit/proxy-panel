"use client";

import Lenis from "lenis";
import { useEffect } from "react";

import { gsap, reducedMotion, ScrollTrigger, setLenis } from "@/lib/motion";

/** Lenis smooth scrolling, driven by GSAP's ticker so ScrollTrigger and the scroll never disagree. Off under reduced motion. */
export function SmoothScroll() {
  useEffect(() => {
    if (reducedMotion()) return;
    const lenis = new Lenis({ autoRaf: false, lerp: 0.1 });
    setLenis(lenis);
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    // Fonts change line heights; re-measure pinned sections once they land.
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      setLenis(null);
    };
  }, []);
  return null;
}
