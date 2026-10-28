"use client";

import { Check, LoaderCircle, TriangleAlert } from "lucide-react";
import { Fragment, useId, useState, type ReactNode } from "react";

import type { Receipt, Stance } from "@/lib/api";

// Shared by the confirm, panel and report pages.

export const STANCE: Record<Stance, { label: string; text: string; fill: string }> = {
  enthusiast: { label: "Enthusiast", text: "text-enthusiast", fill: "bg-enthusiast" },
  conditional: { label: "On the fence", text: "text-conditional", fill: "bg-conditional" },
  skeptic: { label: "Skeptic", text: "text-skeptic", fill: "bg-skeptic" },
};

export const FILLS = ["bg-mint", "bg-sun", "bg-sky", "bg-peach", "bg-lilac", "bg-tomato"];

export const TIER: Record<number, string> = { 1: "budget", 2: "mid-range", 3: "premium", 4: "luxury" };

/** A persona's price band (tiers 1–4, fractional) in words, e.g. "mid-range to premium". */
export function tierRange(lo: number, hi: number): string {
  const a = TIER[Math.round(lo)], b = TIER[Math.round(hi)];
  return a === b ? a : `${a} to ${b}`;
}

const TYPE: Record<string, string> = { brand: "Brand", artist: "Music", tv_show: "TV show", podcast: "Podcast", comparable: "Comparable brand" };
export const typeLabel = (t: string) => TYPE[t] ?? t.replaceAll("_", " ");
/** Qloo lift (how much more a group likes something than people in general) in words a first-time user gets. */
export const likesHowMuch = (lift: number) =>
  lift >= 0.2 ? "much more than most people" : lift >= 0.1 ? "more than most people" : lift > 0 ? "a little more than most people" : "about as much as most people";

/** "Maya", "Maya and Sam", "Maya, Sam and Ava" */
export const joinNames = (names: string[]) => (names.length < 2 ? names.join("") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

const STEPS = ["Brief", "Brands", "Panel", "Report"];

export function RunSteps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <nav aria-label="Progress">
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2 text-sm">
        {STEPS.map((s, i) => {
          const state = i < current ? "done" : i === current ? "now" : "next";
          return (
            <Fragment key={s}>
              {i > 0 && <li aria-hidden className="h-0.5 w-4 bg-line-2 sm:w-8" />}
              <li
                aria-current={state === "now" ? "step" : undefined}
                className={`flex items-center gap-1.5 rounded-full border-2 px-3 py-1 font-semibold ${
                  state === "now" ? "border-text bg-sun" : state === "done" ? "border-text bg-raise" : "border-line-2 text-faint"
                }`}
              >
                {state === "done" ? <Check aria-hidden className="size-3.5" strokeWidth={3} /> : <span aria-hidden>{i + 1}</span>}
                {s}
                {state === "done" && <span className="sr-only">(done)</span>}
              </li>
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}

export function PageHead({ kicker, title, children }: { kicker: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div>
      <p className="font-hand text-3xl text-pop">{kicker}</p>
      <h1 className="mt-1 font-serif text-[clamp(2rem,5vw,3.3rem)] leading-[1.05] tracking-[-0.02em]">{title}</h1>
      {children && <div className="mt-4 max-w-[60ch] text-lg leading-relaxed text-sub">{children}</div>}
    </div>
  );
}

export function Notice({ children, tone = "warn" }: { children: ReactNode; tone?: "warn" | "error" }) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`flex gap-3 rounded-2xl border border-line-2 px-4 py-3 text-[15px] ${tone === "error" ? "bg-tomato/30" : "bg-sun/40"}`}
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0" strokeWidth={2.25} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <p role="status" className="flex items-center gap-2 py-24 text-sub">
      <LoaderCircle aria-hidden className="size-5 motion-safe:animate-spin" />
      {label}
    </p>
  );
}

/** The meter is relative to this panel (0 = coolest panelist, 1 = warmest), so it says a rank, not a score out of 100. */
export function StanceMeter({ scaled, label, rank, of }: { scaled: number; label: Stance; rank: number; of: number }) {
  const s = STANCE[label];
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className={`font-bold uppercase tracking-wide ${s.text}`}>{s.label}</span>
        <span className="text-sub">
          <span className="font-semibold text-text">{rank === 1 ? "warmest" : rank === of ? "coolest" : `${(["", "1st", "2nd", "3rd"][rank] ?? `${rank}th`)} warmest`}</span> of {of}
        </span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full border border-line-2 bg-raise" aria-hidden>
        <div className={`h-full ${s.fill}`} style={{ width: `${Math.max(4, scaled * 100)}%` }} />
      </div>
    </div>
  );
}

/** A cited Qloo receipt shown by name. Hover, focus or tap shows where it comes from; Esc hides it. */
export function ReceiptChip({ r }: { r: Receipt }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const comp = r.entity_type === "comparable";
  return (
    <span className="relative inline-block" onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        className={`rounded-md border border-text px-1.5 py-px text-[0.9em] font-semibold leading-snug ${comp ? "bg-sky/60" : "bg-sun/70"} hover:bg-raise`}
      >
        {r.entity_name}
      </button>
      <span
        role="tooltip"
        id={id}
        hidden={!open}
        className="absolute bottom-full left-1/2 z-30 mb-2 w-max max-w-60 -translate-x-1/2 rounded-xl border border-line-2 bg-text px-3 py-2 text-left text-xs font-normal leading-relaxed text-ink"
      >
        <span className="block font-semibold">
          {typeLabel(r.entity_type)}: {r.entity_name}
        </span>
        <span className="block">People like this panelist like it {likesHowMuch(r.lift)}. Source: Qloo taste data.</span>
      </span>
    </span>
  );
}

const CITE = /\[([RC]\d+(?:\s*,\s*[RC]\d+)*)\]/g; // same pattern as backend/app/validator.py; Gemini groups them: [R1, R4]

/** "like CeraVe" before a CeraVe chip → "like ": the model names a taste, then cites it, and the chip already shows the name.
 *  Also matches a shortened name ("Paula's Choice" for "Paula's Choice Skin Care"). */
function dropTrailingName(before: string, name: string): string {
  const t = before.trimEnd();
  const words = name.split(/\s+/);
  for (let k = words.length; k > 0; k--) {
    const n = words.slice(0, k).join(" ");
    const rest = t.slice(0, t.length - n.length);
    if (t.toLowerCase().endsWith(n.toLowerCase()) && /(^|[\s("'“])$/.test(rest)) return rest;
  }
  return before;
}

/** Statement text with each [R1] / [R1, C2] citation swapped for receipt chips. */
export function CitedText({ text, receipts }: { text: string; receipts: Receipt[] }) {
  const byLabel = new Map(receipts.map((r) => [r.label, r]));
  const parts = text.split(CITE); // odd indexes are the captured label groups
  for (let i = 1; i < parts.length; i += 2) {
    const r = byLabel.get(parts[i].split(",")[0].trim());
    if (r) parts[i - 1] = dropTrailingName(parts[i - 1], r.entity_name);
  }
  return (
    <>
      {parts.map((p, i) =>
        i % 2 === 0 ? (
          <Fragment key={i}>{p}</Fragment>
        ) : (
          <Fragment key={i}>
            {p.split(",").map((label, j) => {
              const r = byLabel.get(label.trim());
              return (
                <Fragment key={j}>
                  {j > 0 && " "}
                  {r ? (
                    <ReceiptChip r={r} />
                  ) : (
                    <span className="text-skeptic" title="This citation doesn't match one of the panelist's receipts">
                      [{label.trim()}]
                    </span>
                  )}
                </Fragment>
              );
            })}
          </Fragment>
        ),
      )}
    </>
  );
}
