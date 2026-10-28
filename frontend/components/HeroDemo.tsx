"use client";

import { FileText } from "lucide-react";
import { useEffect, useState } from "react";

// Illustration only: a scripted debate that plays on a loop, showing the shape of a live panel.
type Who = { name: string; who: string; fill: string; stance: string; cls: string };
const P: Record<string, Who> = {
  maya: { name: "Maya", who: "Wellness runner", fill: "bg-mint", stance: "Enthusiast", cls: "text-enthusiast" },
  sam: { name: "Sam", who: "Soda loyalist", fill: "bg-tomato", stance: "Skeptic", cls: "text-skeptic" },
  dev: { name: "Dev", who: "Office snacker", fill: "bg-sun", stance: "On the fence", cls: "text-conditional" },
  ana: { name: "Ana", who: "Foodie", fill: "bg-lilac", stance: "On the fence", cls: "text-conditional" },
  leo: { name: "Leo", who: "Gym regular", fill: "bg-sky", stance: "Enthusiast", cls: "text-enthusiast" },
  ruth: { name: "Ruth", who: "Budget parent", fill: "bg-peach", stance: "Skeptic", cls: "text-skeptic" },
};

// A line is text with [brand] chips: the brands are the Qloo data the panelist leans on.
const SCRIPT: { by: keyof typeof P | "mod"; line: string }[] = [
  { by: "maya", line: "I'd swap my [Olipop] for this. 5g sugar is the number I check." },
  { by: "sam", line: "[Coca-Cola] already does this job. Adaptogens sound like a gimmick." },
  { by: "dev", line: "$3.29 is fine if it helps me focus. [Poppi] is cheaper though." },
  { by: "mod", line: "Sam and Maya: what would change your mind?" },
  { by: "ana", line: "Show me the flavours first. I cook from [Bon Appétit], I'm picky." },
];
const STEP_MS = 1900;

function Line({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\[[^\]]+\])/).map((part, i) =>
        part.startsWith("[") ? (
          <span key={i} className="mx-0.5 rounded-md bg-pop/10 px-1.5 py-px text-[0.92em] font-medium text-pop">
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function HeroDemo() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const t = setTimeout(() => setStep(SCRIPT.length + 1)); // show the whole debate, no loop
      return () => clearTimeout(t);
    }
    const t = setInterval(() => setStep((s) => (s >= SCRIPT.length + 2 ? 0 : s + 1)), STEP_MS);
    return () => clearInterval(t);
  }, []);

  const shown = SCRIPT.slice(0, step);
  const next = SCRIPT[step];
  const speaking = next && next.by !== "mod" ? next.by : null;

  return (
    <div className="sticker relative mx-auto w-full max-w-4xl overflow-hidden rounded-[28px] bg-raise text-left">
      <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
        <div className="flex items-center gap-2.5 text-sm font-medium">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 rounded-full bg-skeptic/60 motion-safe:animate-ping" />
            <span className="relative size-2.5 rounded-full bg-skeptic" />
          </span>
          Live panel · Low-sugar soda
        </div>
        <span className="text-xs text-faint">Round {step > 3 ? 2 : 1} of 2</span>
      </div>

      <div className="grid md:grid-cols-[13rem_minmax(0,1fr)]">
        <ul className="hidden gap-1 border-r border-line p-3 md:grid">
          {Object.entries(P).map(([k, p]) => (
            <li
              key={k}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 transition-colors duration-300 ${speaking === k ? "bg-bg" : ""}`}
            >
              <span
                className={`flex size-8 shrink-0 items-center justify-center rounded-full ${p.fill} font-serif text-sm transition-shadow duration-300 ${speaking === k ? "ring-2 ring-pop ring-offset-2" : ""}`}
              >
                {p.name[0]}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block text-sm font-medium">{p.name}</span>
                <span className={`block text-[11px] font-medium ${p.cls}`}>{p.stance}</span>
              </span>
            </li>
          ))}
        </ul>

        <div aria-hidden className="flex h-[22rem] flex-col justify-end gap-3 overflow-hidden p-4 sm:p-5">
          {shown.map((m, i) =>
            m.by === "mod" ? (
              <p key={i} className="bubble mx-auto rounded-full bg-bg px-4 py-1.5 text-center text-sm text-sub">
                Moderator: {m.line}
              </p>
            ) : (
              <div key={i} className="bubble flex items-start gap-2.5">
                <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${P[m.by].fill} font-serif text-sm`}>
                  {P[m.by].name[0]}
                </span>
                <div className="min-w-0 rounded-2xl rounded-tl-md bg-bg px-3.5 py-2.5">
                  <p className="text-xs text-faint">
                    <span className="font-medium text-text">{P[m.by].name}</span> · {P[m.by].who}
                  </p>
                  <p className="mt-0.5 text-[15px] leading-snug">
                    <Line text={m.line} />
                  </p>
                </div>
              </div>
            ),
          )}
          {speaking && (
            <div key={`t${step}`} className="bubble flex items-center gap-2.5">
              <span className={`flex size-8 items-center justify-center rounded-full ${P[speaking].fill} font-serif text-sm`}>
                {P[speaking].name[0]}
              </span>
              <span className="flex gap-1 rounded-2xl bg-bg px-3.5 py-3">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="typing-dot size-1.5 rounded-full bg-faint" style={{ animationDelay: `${d * 150}ms` }} />
                ))}
              </span>
            </div>
          )}
          {step > SCRIPT.length && (
            <div className="bubble flex items-center gap-3 rounded-2xl bg-text px-4 py-3 text-ink">
              <FileText aria-hidden className="size-5 shrink-0" strokeWidth={1.75} />
              <p className="text-sm">
                <span className="font-medium">Report ready.</span> Launch to Gen Z fitness fans first, priced mid-range.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
