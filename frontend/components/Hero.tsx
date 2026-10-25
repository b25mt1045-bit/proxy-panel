"use client";

import { ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Stance = "Enthusiast" | "Conditional" | "Skeptic";
type Line = { who: string; seg?: string; stance?: Stance; text: string; receipt?: string };

// Illustrative only: a sample debate for the "Calm Fizz" sample brief. Labelled "Sample debate" on the page.
const SCRIPT: Line[] = [
  { who: "Maya, 24", seg: "Gen Z urban fitness", stance: "Enthusiast", text: "Five grams of sugar after a run? I'd grab two.", receipt: "R1" },
  { who: "Lena, 34", seg: "Remote tech workers", stance: "Skeptic", text: "At $3.29 a can, I'm staying with seltzer.", receipt: "R1" },
  { who: "Priya, 33", seg: "Millennial wellness", stance: "Enthusiast", text: "Adaptogens at 4pm instead of a third coffee. Yes.", receipt: "R2" },
  { who: "Jordan, 27", seg: "Gen Z urban fitness", stance: "Conditional", text: "Only if it's in the gym fridge, not a café shelf.", receipt: "R2" },
  { who: "Sam, 36", seg: "Millennial wellness", stance: "Skeptic", text: "Every soda says calm now. Show me why this one.", receipt: "R3" },
  { who: "Dev, 31", seg: "Remote tech workers", stance: "Conditional", text: "Pitch it as focus and I'd try it at my desk.", receipt: "R2" },
  { who: "Moderator", text: "Price splits the room. Round two: is $3.29 the problem?" },
];
const PRODUCTS = ["your product", "Calm Fizz", "Refill Club", "Buddy Streaks"]; // the sample briefs
const STANCES: Stance[] = ["Enthusiast", "Conditional", "Skeptic"];
const STANCE_BG: Record<Stance, string> = { Enthusiast: "bg-enthusiast", Conditional: "bg-conditional", Skeptic: "bg-skeptic" };
const TICKER = [
  "6 panelists built from Qloo taste data",
  "2 rounds and a moderator",
  "Stances computed from data, not written by AI",
  "Every line cites a receipt",
  "Launch segment, objections and price band",
  "About 90 seconds",
];

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True while the element is on screen and the tab is visible, so loops stop when nobody is watching. */
function useLive<T extends Element>() {
  const ref = useRef<T>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    let seen = false;
    const sync = () => setLive(seen && !document.hidden && !reducedMotion());
    const io = new IntersectionObserver(([e]) => {
      seen = e.isIntersecting;
      sync();
    });
    if (ref.current) io.observe(ref.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  return [ref, live] as const;
}

export function Hero() {
  const [heroRef, heroLive] = useLive<HTMLElement>();
  const [product, setProduct] = useState(0);
  // spoken = lines fully said; typing = whether the next speaker is mid-sentence.
  const [spoken, setSpoken] = useState(0);
  const [typing, setTyping] = useState(true);

  useEffect(() => {
    if (reducedMotion()) {
      setSpoken(SCRIPT.length);
      setTyping(false);
    }
  }, []);

  useEffect(() => {
    if (!heroLive) return;
    const t = setInterval(() => setProduct((p) => (p + 1) % PRODUCTS.length), 2600);
    return () => clearInterval(t);
  }, [heroLive]);

  useEffect(() => {
    if (!heroLive) return;
    const done = spoken >= SCRIPT.length;
    const t = setTimeout(
      () => {
        if (done) {
          setSpoken(0);
          setTyping(true);
        } else if (typing) setTyping(false);
        else {
          setSpoken((s) => s + 1);
          setTyping(spoken + 1 < SCRIPT.length);
        }
      },
      done ? 3600 : typing ? 900 : 1900,
    );
    return () => clearTimeout(t);
  }, [heroLive, spoken, typing]);

  // While not typing, the current line is being "said": show it, count it once it's done.
  const shown = SCRIPT.slice(0, Math.min(spoken + (typing ? 0 : 1), SCRIPT.length));
  const counted = SCRIPT.slice(0, spoken);
  const tally = (s: Stance) => counted.filter((l) => l.stance === s).length;
  const visible = shown.slice(-3);
  const next = typing && spoken < SCRIPT.length ? SCRIPT[spoken] : null;

  function startBrief(e: React.MouseEvent) {
    const el = document.getElementById("f-description");
    if (!el) return;
    e.preventDefault();
    document.getElementById("brief")?.scrollIntoView({ block: "start" });
    el.focus({ preventScroll: true });
  }

  return (
    <section ref={heroRef} aria-labelledby="hero-head" className="relative flex min-h-[100svh] flex-col overflow-hidden bg-blue">
      {/* Set piece: a deep-blue slab angled behind the debate screen. */}
      <div
        aria-hidden
        className="absolute inset-y-0 right-0 hidden w-[46%] bg-blue-deep [clip-path:polygon(18%_0,100%_0,100%_100%,0_100%)] lg:block"
      />

      <div className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-x-12 gap-y-10 px-4 pb-8 pt-20 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,31rem)] lg:pt-16">
        <div>
          <h1 id="hero-head" aria-label="Who buys your product first?" className="display text-[clamp(2.75rem,min(6.4vw,11.5svh),6rem)] text-white">
            <span aria-hidden className="block motion-safe:animate-[rise-in_.7s_var(--ease-out-expo)_both]">
              Who buys
            </span>
            <span aria-hidden className="relative my-[0.06em] inline-block motion-safe:animate-[rise-in_.7s_var(--ease-out-expo)_.08s_both]">
              <span
                key={product}
                className="cut inline-block whitespace-nowrap bg-signal py-[0.02em] pl-[0.12em] pr-[0.45em] text-ink motion-safe:animate-[wipe-in_.45s_var(--ease-out-expo)]"
              >
                {PRODUCTS[product]}
              </span>
            </span>
            <span aria-hidden className="block motion-safe:animate-[rise-in_.7s_var(--ease-out-expo)_.16s_both]">
              first?
            </span>
          </h1>
          <p className="mt-5 max-w-[50ch] text-pretty text-base leading-relaxed text-sub">
            Brief a panel of six shoppers built from <strong className="font-semibold text-white">Qloo taste data</strong>. Watch
            them argue over your product, then get the audience to launch to, what stops them buying, and the price they expect.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-x-7 gap-y-4">
            <a
              href="#brief"
              onClick={startBrief}
              className="cut group tag inline-flex h-14 items-center gap-3 bg-signal pl-6 pr-9 text-xl text-ink transition-[background-color,transform] duration-150 hover:bg-white active:translate-y-px"
            >
              Brief the panel
              <ArrowRight aria-hidden className="size-5 transition-transform duration-200 group-hover:translate-x-1" strokeWidth={2.75} />
            </a>
            <a href="#how" className="tag text-base text-white underline decoration-white/40 decoration-2 hover:decoration-signal">
              How a run works
            </a>
          </div>
        </div>

        <figure className="relative">
          <div className="bg-navy shadow-[0_30px_70px_-25px_rgba(3,8,40,0.85)]">
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="tag cut bg-signal pl-2 pr-4 text-sm text-ink">Round 1</span>
                <span className="tag text-sm text-sub">Calm Fizz · sample debate</span>
              </div>
              <span className="tag flex items-center gap-1.5 text-xs text-live">
                <span aria-hidden className="size-1.5 rounded-full bg-live motion-safe:animate-[blink_1.4s_steps(1)_infinite]" />
                On air
              </span>
            </div>

            <ol aria-live="off" className="flex h-[min(15.5rem,30svh)] min-h-[11rem] flex-col justify-end gap-3 overflow-hidden px-4 py-4 [mask-image:linear-gradient(to_bottom,transparent,black_2.5rem)]">
              {visible.map((l) => (
                <li key={l.who} className="motion-safe:animate-[rise-in_.45s_var(--ease-out-expo)]">
                  <Speaker line={l} />
                  <p className="mt-1.5 flex items-start justify-between gap-3 text-[15px] leading-snug text-white">
                    <span className="motion-safe:animate-[wipe-in_.9s_steps(28)]">“{l.text}”</span>
                    {l.receipt && (
                      <span className="tag shrink-0 border border-signal/70 px-1.5 text-xs leading-5 text-signal">{l.receipt}</span>
                    )}
                  </p>
                </li>
              ))}
              {next && (
                <li key={`${next.who}-typing`} className="motion-safe:animate-[rise-in_.35s_var(--ease-out-expo)]">
                  <Speaker line={next} />
                  <p aria-hidden className="mt-2 flex gap-1">
                    {[0, 1, 2].map((d) => (
                      <span
                        key={d}
                        className="size-1.5 rounded-full bg-sub motion-safe:animate-[blink_.9s_ease-in-out_infinite]"
                        style={{ animationDelay: `${d * 0.15}s` }}
                      />
                    ))}
                  </p>
                </li>
              )}
            </ol>

            <div className="border-t border-line px-4 py-3">
              <p className="tag text-xs text-faint">Swing meter · panelists who have spoken</p>
              <dl className="mt-1.5 grid gap-1">
                {STANCES.map((s) => (
                  <div key={s} className="grid grid-cols-[6.5rem_minmax(0,1fr)_1.25rem] items-center gap-3">
                    <dt className="tag text-sm text-white">{s}</dt>
                    {/* One cell per panelist; cells light as each one speaks. */}
                    <dd aria-hidden className="grid grid-cols-6 gap-1">
                      {[0, 1, 2, 3, 4, 5].map((c) => (
                        <span
                          key={c}
                          className={`h-2.5 transition-colors duration-500 ${c < tally(s) ? STANCE_BG[s] : "bg-white/10"}`}
                        />
                      ))}
                    </dd>
                    <dd className="display text-right text-lg not-italic">{tally(s)}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
          <figcaption className="mt-3 text-[13px] leading-snug text-sub">
            Sample debate. In a real run every stance is computed from Qloo data and every line cites a receipt you can open.
          </figcaption>
        </figure>
      </div>

      <div className="relative overflow-hidden bg-signal py-2.5 text-ink" aria-label="What a run includes">
        <ul className="flex w-max motion-safe:animate-[crawl_45s_linear_infinite] hover:[animation-play-state:paused]">
          {[...TICKER, ...TICKER].map((t, i) => (
            <li key={i} aria-hidden={i >= TICKER.length} className="tag flex items-center whitespace-nowrap text-base">
              <span className="px-6">{t}</span>
              <span aria-hidden className="size-2 rotate-45 bg-ink" />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Speaker({ line }: { line: Line }) {
  if (!line.stance) {
    return <span className="tag cut inline-block bg-signal pl-2 pr-4 text-sm text-ink">{line.who}</span>;
  }
  return (
    <span className="flex flex-wrap items-center gap-x-2">
      <span className="tag cut inline-block bg-plate pl-2 pr-4 text-sm text-ink">{line.who}</span>
      <span className="text-xs text-faint">{line.seg}</span>
      <span className="tag flex items-center gap-1 text-xs text-white">
        <span aria-hidden className={`size-2 ${STANCE_BG[line.stance]}`} />
        {line.stance}
      </span>
    </span>
  );
}
