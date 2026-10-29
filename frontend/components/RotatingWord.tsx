"use client";

import { useEffect, useState } from "react";

/** Cycles through `words` with a blur-in. All words share one grid cell, so the line never reflows. */
export function RotatingWord({ words, className = "" }: { words: string[]; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setN((i) => (i + 1) % words.length), 2400);
    return () => clearInterval(t);
  }, [words.length]);
  return (
    <>
      <span className="sr-only">{words[0]}</span>
      <span aria-hidden className={`inline-grid ${className}`}>
        {words.map((w, i) => (
          <span key={w} style={{ gridArea: "1 / 1" }} className={i === n ? "motion-safe:animate-word-in" : "invisible"}>
            {w}
          </span>
        ))}
      </span>
    </>
  );
}
