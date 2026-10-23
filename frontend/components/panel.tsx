"use client";
import { useId, useState } from "react";
import type { Persona, Progress, Receipt, StanceLabel, Statement } from "@/lib/api";
import { Pill } from "./ui";

const TYPE: Record<string, string> = { brand: "Brand", artist: "Artist", tv_show: "TV show", podcast: "Podcast", comparable: "Comparable" };
const CITE = /\[([RC]\d+)\]/g; // same pattern as backend validator.CITE

export function ReceiptChip({ label, receipt }: { label: string; receipt?: Receipt }) {
  const [open, setOpen] = useState(false);
  const tip = useId();
  return (
    <span className="relative inline-block">
      <button type="button" aria-describedby={open ? tip : undefined}
              onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}
              onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              className={`num mx-px inline-flex h-[18px] items-center rounded px-1 align-[1px] text-[11px] font-medium transition-colors ${
                receipt ? "bg-hue-tint text-hue hover:bg-[#d6e3f5]" : "bg-neg-bg text-neg-ink"}`}>
        {label}
      </button>
      {open && (
        <span id={tip} role="tooltip"
              className="absolute bottom-full left-0 z-20 mb-1 w-max max-w-[240px] rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs shadow-[0_4px_16px_rgba(0,0,0,.08)]">
          {receipt ? (
            <>
              <span className="block font-medium text-ink">{receipt.entity_name}</span>
              <span className="num text-muted">{TYPE[receipt.entity_type] ?? receipt.entity_type} · lift {receipt.lift >= 0 ? "+" : ""}{receipt.lift.toFixed(3)} vs. baseline</span>
            </>
          ) : <span className="text-neg-ink">Not one of this panelist&rsquo;s receipts</span>}
        </span>
      )}
    </span>
  );
}

export function StatementText({ text, receipts }: { text: string; receipts: Receipt[] }) {
  const by = new Map(receipts.map((r) => [r.label, r]));
  const parts = text.split(CITE); // odd indexes are captured labels
  return <>{parts.map((p, i) => (i % 2 ? <ReceiptChip key={i} label={p} receipt={by.get(p)} /> : p))}</>;
}

export function StatementBubble({ s, receipts, variantName }: { s: Statement; receipts: Receipt[]; variantName?: string }) {
  return (
    <div className="border-t border-rule pt-3">
      <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <span>Round {s.round}</span>
        {variantName && <span>· prefers {variantName}</span>}
        {!s.passed && <Pill tone="warning" >Unverified: {s.flags.join(", ").replaceAll("_", " ")}</Pill>}
      </div>
      <p className="leading-[22px]"><StatementText text={s.text} receipts={receipts} /></p>
    </div>
  );
}

const STANCE: Record<StanceLabel, string> = { enthusiast: "Enthusiast", conditional: "Conditional", skeptic: "Skeptic" };

export function StanceMeter({ scaled, label }: { scaled: number; label: StanceLabel }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs">
        <span className="font-medium">{STANCE[label]}</span>
        <span className="num text-muted">{Math.round(scaled * 100)} / 100</span>
      </div>
      <div className="relative h-2 rounded-full bg-raised" role="meter" aria-valuemin={0} aria-valuemax={100}
           aria-valuenow={Math.round(scaled * 100)} aria-label={`Stance: ${STANCE[label]}`}>
        <div className="absolute inset-y-0 left-0 rounded-full bg-[#141414]" style={{ width: `${Math.max(scaled * 100, 2)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted"><span>Skeptic</span><span>Enthusiast</span></div>
    </div>
  );
}

const initials = (n: string) => n.split(/\s+/).map((w) => w[0]).join("").slice(0, 2).toUpperCase();
// Stable pale identity tints, 60°+ apart (identity, not data: never used in charts).
const TINTS = ["#f3e6e6", "#e6eef3", "#e9f3e6", "#f3efe2", "#ece6f3", "#e2f0ef"];

export function Avatar({ p }: { p: Pick<Persona, "id" | "name"> }) {
  return (
    <span aria-hidden="true" style={{ background: TINTS[p.id % TINTS.length] }}
          className="inline-flex size-9 flex-none items-center justify-center rounded-full text-xs font-medium text-[#3d3d3d]">
      {initials(p.name)}
    </span>
  );
}

export function PersonaCard({ p, statements, variantNames, highlight }:
  { p: Persona; statements: Statement[]; variantNames: Record<string, string>; highlight?: boolean }) {
  const tastes = Object.entries(p.top).filter(([, xs]) => xs.length).slice(0, 3);
  return (
    <article className={`rounded-lg border bg-surface p-5 ${highlight ? "border-ink" : "border-border"}`}>
      <header className="flex items-start gap-3">
        <Avatar p={p} />
        <div className="min-w-0">
          <h3 className="font-medium">{p.name}</h3>
          <p className="text-xs text-muted">{p.segment_label}</p>
        </div>
      </header>
      <p className="mt-3 text-[13px] text-muted">{p.bio}</p>
      <div className="mt-4"><StanceMeter scaled={p.stance_scaled} label={p.stance_label} /></div>
      {tastes.length > 0 && (
        <dl className="mt-4 space-y-1 text-[13px]">
          {tastes.map(([t, xs]) => (
            <div key={t} className="flex gap-2">
              <dt className="w-16 flex-none text-muted">{TYPE[t] ?? t}</dt>
              <dd className="truncate">{xs.slice(0, 3).join(", ")}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="mt-4 space-y-3">
        {statements.length ? statements.map((s) => (
          <StatementBubble key={s.id} s={s} receipts={p.receipts}
                           variantName={s.preferred_variant ? variantNames[s.preferred_variant] : undefined} />
        )) : <p className="border-t border-rule pt-3 text-[13px] text-muted">Waiting for round 1…</p>}
      </div>
    </article>
  );
}

const STEPS = [
  ["segments", "Resolve segments"], ["personas", "Build personas"], ["round1", "Round 1"],
  ["moderator", "Moderator"], ["round2", "Round 2"], ["report", "Write report"],
] as const;

export function ProgressSteps({ steps, done }: { steps: Progress[]; done: boolean }) {
  const at = done ? STEPS.length + 1 : Math.max(0, ...steps.map((s) => s.index));
  return (
    <ol className="flex flex-wrap gap-x-5 gap-y-2 text-[13px]">
      {STEPS.map(([k, label], i) => {
        const n = i + 1;
        const state = n < at ? "done" : n === at ? "current" : "todo";
        return (
          <li key={k} aria-current={state === "current" ? "step" : undefined}
              className={`flex items-center gap-1.5 ${state === "todo" ? "text-muted" : "text-ink"} ${state === "current" ? "font-medium" : ""}`}>
            <span aria-hidden="true" className={`size-2 rounded-full ${
              state === "done" ? "bg-[#141414]" : state === "current" ? "bg-hue animate-pulse" : "border border-control"}`} />
            {label}<span className="sr-only">{state === "done" ? " (done)" : state === "current" ? " (in progress)" : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}
