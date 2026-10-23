// Shared pieces in the achromatic-ledger style: white cards on the ground, 8px radius, 1px border, no shadow.
import type { ReactNode } from "react";

export function Card({ title, aside, children, className = "" }:
  { title?: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-lg border border-border bg-surface p-5 ${className}`}>
      {(title || aside) && (
        <div className="mb-3 flex items-baseline justify-between gap-3">
          {title && <h2 className="text-base font-medium">{title}</h2>}
          {aside && <div className="text-xs text-muted">{aside}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const PILL = {
  positive: "bg-pos-bg text-pos-ink", negative: "bg-neg-bg text-neg-ink",
  warning: "bg-warn-bg text-warn-ink", neutral: "bg-raised text-[#3d3d3d]",
};

export function Pill({ tone = "neutral", children }: { tone?: keyof typeof PILL; children: ReactNode }) {
  return <span className={`inline-flex h-5 flex-none items-center whitespace-nowrap rounded px-1.5 text-xs font-medium ${PILL[tone]}`}>{children}</span>;
}

export function Notice({ tone = "warning", children, action }:
  { tone?: "warning" | "negative"; children: ReactNode; action?: ReactNode }) {
  const c = tone === "warning" ? "border-[#fde68a] bg-warn-bg text-warn-ink" : "border-[#f5c2c0] bg-neg-bg text-neg-ink";
  return (
    <div role="alert" className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-[13px] ${c}`}>
      <span>{children}</span>{action}
    </div>
  );
}

export const btn = {
  primary: "inline-flex h-9 items-center justify-center gap-2 rounded-md bg-[#141414] px-4 font-medium text-white " +
    "transition-colors hover:bg-[#2a2a2a] active:bg-black disabled:cursor-not-allowed disabled:bg-[#9a9a9a]",
  secondary: "inline-flex h-9 items-center justify-center rounded-md bg-raised px-3 font-medium text-ink " +
    "transition-colors hover:bg-[#e2e2e2] disabled:cursor-not-allowed disabled:text-muted",
  text: "font-medium text-ink underline-offset-2 hover:underline",
};

export const field = "h-10 w-full rounded-md border border-control bg-surface px-3 text-ink placeholder:text-[#6b6b6b] " +
  "focus:border-ink focus:outline-none";

export function Label({ htmlFor, children, hint }: { htmlFor: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-2 flex items-baseline justify-between">
      <label htmlFor={htmlFor} className="font-medium">{children}</label>
      {hint && <span className="num text-xs text-muted">{hint}</span>}
    </div>
  );
}

export function Bar({ w = "w-24", h = "h-4" }: { w?: string; h?: string }) {
  return <span aria-hidden="true" className={`inline-block rounded bg-raised ${w} ${h}`} />;
}
