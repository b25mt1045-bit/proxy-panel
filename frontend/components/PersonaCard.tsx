"use client";

import { CitedText, FILLS, StanceMeter, tierRange, typeLabel } from "@/components/run";
import type { Persona, Statement } from "@/lib/api";

// One panelist, shown the same way on the panel page and in the report, so people recognise them later.

const FLAG: Record<string, string> = {
  no_receipt: "cites no Qloo data",
  foreign_receipt: "cites data that isn't theirs",
  price_out_of_band: "names a price outside their band",
  price_in_words: "names a price in words",
  length: "is too short or too long",
  stance_mismatch: "sounds off for their stance",
};

/** Colour and warmth rank per panelist. Both pages derive them from the same ordering, so Maya is mint everywhere. */
export function panelLook(personas: Persona[]) {
  const ordered = [...personas].sort((a, b) => a.segment - b.segment || a.id - b.id);
  const warm = [...personas].sort((a, b) => b.stance_scaled - a.stance_scaled).map((p) => p.id);
  return {
    ordered,
    fill: (id: number) => FILLS[Math.max(0, ordered.findIndex((p) => p.id === id)) % FILLS.length],
    rank: (id: number) => warm.indexOf(id) + 1,
    of: personas.length,
  };
}

export function Avatar({ name, fill, size = "md" }: { name: string; fill: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "size-7 text-sm" : size === "lg" ? "size-11 text-lg" : "size-9";
  return (
    <span aria-hidden className={`flex ${s} shrink-0 items-center justify-center rounded-full border-2 border-text ${fill} font-serif font-bold`}>
      {name[0]}
    </span>
  );
}

export function PersonaCard({
  p,
  fill,
  r1,
  r2,
  inRound2,
  variantName,
  waiting,
  rank,
  of,
  headingLevel = 2,
}: {
  p: Persona;
  fill: string;
  r1?: Statement;
  r2?: Statement;
  inRound2: boolean;
  variantName: (k: string | null) => string | undefined;
  waiting: boolean;
  rank: number;
  of: number;
  headingLevel?: 2 | 3;
}) {
  const tastes = Object.entries(p.top).filter(([, names]) => names.length > 0);
  const H = headingLevel === 2 ? "h2" : "h3";
  return (
    <div className="sticker flex h-full flex-col rounded-3xl bg-raise">
      <div className={`rounded-t-[22px] border-b-2 border-text ${fill} p-5`}>
        <div className="flex items-center gap-3">
          <Avatar name={p.name} fill="bg-raise" size="lg" />
          <div className="min-w-0">
            <H className="truncate text-lg font-bold leading-tight">{p.name}</H>
            <p className="truncate text-sm">{p.segment_label}</p>
          </div>
        </div>
        <div className="mt-4 rounded-xl bg-raise/80 p-3">
          <StanceMeter scaled={p.stance_scaled} label={p.stance_label} rank={rank} of={of} />
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5">
        <p className="text-[15px] leading-relaxed text-sub">{p.bio}</p>
        <dl className="grid grid-cols-[minmax(0,1fr)] gap-1.5 text-sm">
          <div className="flex gap-2">
            <dt className="w-16 shrink-0 font-semibold">Pays</dt>
            <dd>{p.price_weak ? "No clear signal (any price)" : tierRange(p.price_lo, p.price_hi)}</dd>
          </div>
          {tastes.slice(0, 3).map(([type, names]) => (
            <div key={type} className="flex gap-2">
              <dt className="w-16 shrink-0 font-semibold">{typeLabel(type)}</dt>
              <dd className="min-w-0 truncate" title={names.join(", ")}>
                {names.slice(0, 3).join(", ")}
              </dd>
            </div>
          ))}
        </dl>

        <div className="grid gap-3">
          <Bubble s={r1} round={1} waiting={waiting} variantName={variantName} persona={p} />
          {(inRound2 || r2) && <Bubble s={r2} round={2} waiting={waiting} variantName={variantName} persona={p} />}
        </div>
      </div>
    </div>
  );
}

function Bubble({
  s,
  round,
  waiting,
  variantName,
  persona,
}: {
  s?: Statement;
  round: number;
  waiting: boolean;
  variantName: (k: string | null) => string | undefined;
  persona: Persona;
}) {
  if (!s)
    return waiting ? (
      <p className="rounded-2xl border-2 border-dashed border-line-2 px-4 py-3 text-sm text-faint">
        <span className="sr-only">Round {round}: </span>
        <span className="motion-safe:animate-pulse">thinking…</span>
      </p>
    ) : null;
  const pick = variantName(s.preferred_variant);
  return (
    <figure className={`rounded-2xl border-2 border-text px-4 py-3 ${round === 2 ? "bg-lilac/40" : "bg-bg"}`}>
      <figcaption className="mb-1.5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide text-sub">
        Round {round}
        {pick && <span className="rounded-full border border-text bg-raise px-2 py-px normal-case tracking-normal text-text">picks {pick}</span>}
        {!s.passed && (
          <span className="rounded-full border border-skeptic bg-raise px-2 py-px normal-case tracking-normal text-skeptic">
            ⚠ Unverified: {s.flags.map((f) => FLAG[f] ?? f).join("; ")}
          </span>
        )}
      </figcaption>
      <blockquote className="text-[15px] leading-relaxed">
        <CitedText text={s.text} receipts={persona.receipts} />
      </blockquote>
    </figure>
  );
}
