"use client";

import { ArrowRight, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

const GHOSTS = [
  "A prebiotic soda with 5g sugar and adaptogens",
  "A refillable deodorant case with plastic-free refills",
  "A habit app that pairs you with a friend",
  "A gel moisturizer that sits well under makeup",
];

/** Twain-style hero field: example briefs blur in and out word by word until you type. Enter hands the text to the brief form. */
export function HeroInput() {
  const [text, setText] = useState("");
  const [n, setN] = useState(0);
  const [out, setOut] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => {
      setOut(true);
      setTimeout(() => {
        setN((i) => (i + 1) % GHOSTS.length);
        setOut(false);
      }, 450);
    }, 3600);
    return () => clearInterval(t);
  }, []);

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim()) window.dispatchEvent(new CustomEvent("brief:prefill", { detail: text.trim() }));
    document.getElementById("brief")?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => document.getElementById("f-description")?.focus({ preventScroll: true }), 600);
  }

  return (
    <form onSubmit={go} className="sticker mx-auto flex h-16 w-full max-w-xl items-center gap-2 rounded-2xl bg-raise p-2 pl-4">
      <Sparkles aria-hidden className="size-5 shrink-0 text-pop" strokeWidth={1.75} />
      <div className="relative min-w-0 flex-1 self-stretch">
        <label htmlFor="hero-brief" className="sr-only">
          Describe your product
        </label>
        <input
          id="hero-brief"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="absolute inset-0 w-full bg-transparent text-[15px] outline-none"
          autoComplete="off"
        />
        {!text && (
          <span aria-hidden key={n} className="pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-[15px] text-faint">
            {GHOSTS[n].split(" ").map((w, i) => (
              <span
                key={i}
                className={`inline-block ${out ? "word-out" : "motion-safe:animate-word-in"}`}
                style={{ animationDelay: `${i * (out ? 25 : 55)}ms` }}
              >
                {w}&nbsp;
              </span>
            ))}
          </span>
        )}
      </div>
      <button
        type="submit"
        className="group flex h-12 shrink-0 items-center gap-2 rounded-xl bg-text px-4 text-sm font-medium text-ink transition hover:bg-pop"
      >
        <span className="hidden sm:inline">Run my panel</span>
        <ArrowRight aria-hidden className="size-4 transition-transform group-hover:translate-x-0.5" />
      </button>
    </form>
  );
}
