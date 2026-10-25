"use client";

import { useGSAP } from "@gsap/react";
import { useEffect, useRef } from "react";

import { gsap, reducedMotion } from "@/lib/motion";

type Dot = { x: number; y: number; vx: number; vy: number; r: number; gold: boolean };

/**
 * The page's living background: a sparse field of brand-dots that drift, link to near neighbours (taste affinity,
 * drawn literally) and lean away from the cursor, under two soft lights that travel as you scroll.
 * Pauses when the tab is hidden; under reduced motion it draws one still frame.
 */
export function Ambient() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const lights = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cv = canvas.current!;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const still = reducedMotion();
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const LINK = 150;
    let w = 0,
      h = 0,
      dots: Dot[] = [];
    const mouse = { x: -9999, y: -9999 };

    const seed = () => {
      w = window.innerWidth;
      h = window.innerHeight;
      cv.width = w * dpr;
      cv.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(Math.min(80, Math.max(28, (w * h) / 17000)));
      dots = Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 0.8 + Math.random() * 1.2,
        gold: Math.random() < 0.28,
      }));
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < dots.length; i++) {
        const a = dots[i];
        for (let j = i + 1; j < dots.length; j++) {
          const b = dots[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < LINK) {
            ctx.strokeStyle = `rgba(217,192,140,${(1 - d / LINK) * 0.11})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      for (const d of dots) {
        ctx.fillStyle = d.gold ? "rgba(217,192,140,0.55)" : "rgba(162,158,149,0.35)";
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    };

    const step = () => {
      for (const d of dots) {
        const dx = d.x - mouse.x,
          dy = d.y - mouse.y,
          dist = Math.hypot(dx, dy);
        if (dist < 160 && dist > 0) {
          const f = (1 - dist / 160) * 0.6;
          d.x += (dx / dist) * f;
          d.y += (dy / dist) * f;
        }
        d.x += d.vx;
        d.y += d.vy;
        if (d.x < -20) d.x = w + 20;
        if (d.x > w + 20) d.x = -20;
        if (d.y < -20) d.y = h + 20;
        if (d.y > h + 20) d.y = -20;
      }
      draw();
    };

    seed();
    draw();
    if (still) {
      const onResize = () => {
        seed();
        draw();
      };
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const onMove = (e: PointerEvent) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };
    const onLeave = () => {
      mouse.x = mouse.y = -9999;
    };
    const tick = () => {
      if (!document.hidden) step();
    };
    window.addEventListener("resize", seed);
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    gsap.ticker.add(tick);
    return () => {
      gsap.ticker.remove(tick);
      window.removeEventListener("resize", seed);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  // The two lights cross the room over the length of the page.
  useGSAP(() => {
    const mm = gsap.matchMedia();
    mm.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.to(lights.current!.children[0], {
        xPercent: 60,
        yPercent: 70,
        ease: "none",
        scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.5 },
      });
      gsap.to(lights.current!.children[1], {
        xPercent: -70,
        yPercent: -40,
        ease: "none",
        scrollTrigger: { trigger: document.body, start: "top top", end: "bottom bottom", scrub: 1.5 },
      });
    });
  });

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div ref={lights}>
        <div className="absolute -left-[20vw] -top-[25vh] size-[70vw] max-w-[1000px] rounded-full bg-[radial-gradient(closest-side,rgba(217,192,140,0.09),transparent)]" />
        <div className="absolute -right-[15vw] top-[40vh] size-[60vw] max-w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(120,140,170,0.07),transparent)]" />
      </div>
      <canvas ref={canvas} className="absolute inset-0 size-full" />
    </div>
  );
}
