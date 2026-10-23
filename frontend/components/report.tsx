"use client";
import { useState } from "react";
import { Persona, Report, TIER_WORDS } from "@/lib/api";
import { Avatar } from "./panel";
import { btn, Card, Pill } from "./ui";

const pct = (x: number) => `${Math.round(x * 100)}%`;

// The panel line: every panelist on one skeptic→enthusiast scale, one row per segment; the winner in the chart hue.
export function PanelLine({ report, personas }: { report: Report; personas: Persona[] }) {
  const win = report.verdict.segment_index;
  return (
    <Card title="Where each segment lands" aside="Stance, 0 skeptic to 100 enthusiast">
      <div className="space-y-5">
        {report.segments.map((s) => {
          const ps = personas.filter((p) => p.segment === s.index);
          const w = s.index === win;
          return (
            <div key={s.index}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className={w ? "font-medium" : ""}>{s.label}{w && <span className="text-hue"> · launch here</span>}</span>
                <span className="num text-xs text-muted">mean {Math.round(s.mean_scaled * 100)} · price fits {pct(s.price_fit_share)}</span>
              </div>
              <div className="relative mx-[18px] h-9" role="img"
                   aria-label={`${s.label}: ${ps.map((p) => `${p.name} ${Math.round(p.stance_scaled * 100)}`).join(", ")}; mean ${Math.round(s.mean_scaled * 100)}`}>
                <div className="absolute top-1/2 -right-[18px] -left-[18px] h-px bg-border" />
                <div className={`absolute top-1 bottom-1 w-0.5 ${w ? "bg-hue" : "bg-[#8a8a8a]"}`} style={{ left: `${s.mean_scaled * 100}%` }} />
                {ps.map((p) => (
                  <span key={p.id} title={`${p.name}: ${Math.round(p.stance_scaled * 100)}`}
                        className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${p.stance_scaled * 100}%` }}>
                    <Avatar p={p} />
                  </span>
                ))}
              </div>
            </div>
          );
        })}
        <div className="num mx-[18px] flex justify-between text-[11px] text-muted"><span className="-ml-1">0</span><span>50</span><span className="-mr-2">100</span></div>
      </div>
    </Card>
  );
}

// One row per persona: the tiers they'd pay (lo..hi) against the concept's tier.
export function PriceBands({ report }: { report: Report }) {
  const pb = report.price_bands;
  if (!pb) return <Card title="Price bands"><p className="text-muted">Not available without data.</p></Card>;
  const x = (t: number) => ((t - 1) / 3) * 100;
  return (
    <Card title="Who will pay that price" aside={`Concept at tier ${pb.concept_tier}, ${TIER_WORDS[pb.concept_tier]}`}>
      <div className="relative space-y-2">
        {pb.personas.map((p) => (
          <div key={p.persona_id} className="grid grid-cols-[88px_1fr_48px] items-center gap-3">
            <span className="truncate text-[13px]">{p.name}</span>
            <div className="relative h-5" role="img"
                 aria-label={`${p.name}: tiers ${p.lo.toFixed(1)} to ${p.hi.toFixed(1)}${p.weak ? ", little data" : ""}; ${p.fit ? "fits" : "does not fit"}`}>
              <div className="absolute top-1/2 right-0 left-0 h-px bg-rule" />
              <div className={`absolute inset-y-1 rounded-sm ${p.weak ? "border border-dashed border-[#8a8a8a]" : "bg-[#141414]"}`}
                   style={{ left: `${x(p.lo)}%`, width: `${Math.max(x(p.hi) - x(p.lo), 1.5)}%` }} />
              <div className="absolute -inset-y-1 w-0.5 bg-hue" style={{ left: `${x(pb.concept_tier)}%` }} />
            </div>
            <span className={`text-right text-xs ${p.fit ? "text-positive" : "text-muted"}`}>{p.fit ? "Fits" : "Outside"}</span>
          </div>
        ))}
        <div className="grid grid-cols-[88px_1fr_48px] gap-3 text-[11px] text-muted">
          <span />
          <div className="relative h-4">
            {[1, 2, 3, 4].map((t) => (
              <span key={t} className="absolute -translate-x-1/2 first:translate-x-0 last:-translate-x-full" style={{ left: `${x(t)}%` }}>
                <span className="sm:hidden">{t}</span><span className="hidden sm:inline">{TIER_WORDS[t]}</span>
              </span>
            ))}
          </div>
          <span />
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">Tiers rank your price against the comparables, 1 budget to 4 luxury. A dashed band means the panelist had little price data, so it spans every tier.</p>
    </Card>
  );
}

export function Objections({ report, personas }: { report: Report; personas: Persona[] }) {
  const name = (id: number) => personas.find((p) => p.id === id)?.name ?? "A panelist";
  return (
    <Card title="Objections" aside={`${report.objections.length} raised`}>
      {report.objections.length ? (
        <ul className="divide-y divide-rule">
          {report.objections.map((o) => (
            <li key={o.text} className="py-3 first:pt-0 last:pb-0">
              <p className="font-medium">{o.text}</p>
              <p className="mt-1 text-[13px] text-muted">
                {o.persona_ids.map(name).join(", ")}
                {o.receipts.length > 0 && <> · tied to {[...new Set(o.receipts.map((r) => r.entity_name))].join(", ")}</>}
              </p>
            </li>
          ))}
        </ul>
      ) : <p className="text-muted">No panelist raised an objection.</p>}
    </Card>
  );
}

export function Variants({ report }: { report: Report }) {
  if (report.variants.length < 2) return null;
  const label = (i: number) => report.segments.find((s) => s.index === i)?.label ?? `Segment ${i + 1}`;
  return (
    <Card title="Variant A against B">
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-xs text-muted">
            <th className="pb-2 font-normal">Segment</th>
            {report.variants.map((v) => [
              <th key={`${v.key}f`} className="pb-2 pl-3 text-right font-normal">{v.key} price fits</th>,
              <th key={`${v.key}p`} className="pb-2 pl-3 text-right font-normal">{v.key} picked by</th>])}
          </tr>
        </thead>
        <tbody>
          {report.variants[0].by_segment.map((row) => (
            <tr key={row.index} className="border-t border-rule">
              <td className="py-2.5">{label(row.index)}</td>
              {report.variants.map((v) => {
                const c = v.by_segment.find((b) => b.index === row.index)!;
                return [<td key={`${v.key}f`} className="num py-2.5 pl-3 text-right">{pct(c.price_fit_share)}</td>,
                  <td key={`${v.key}p`} className="num py-2.5 pl-3 text-right">{c.preferred_count}</td>];
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

const LOVE: Record<string, string> = { brand: "Brands", artist: "Artists", tv_show: "TV shows", podcast: "Podcasts" };

export function Love({ report }: { report: Report }) {
  const groups = Object.entries(report.love ?? {}).filter(([, xs]) => xs.length);
  return (
    <Card title={`What ${report.verdict.segment_label} loves`} aside="Lift vs. baseline">
      {groups.length ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {groups.map(([t, xs]) => (
            <div key={t}>
              <h3 className="mb-1 text-xs text-muted">{LOVE[t] ?? t}</h3>
              <ul>
                {xs.slice(0, 5).map((x) => (
                  <li key={x.name} className="flex justify-between gap-2 py-0.5">
                    <span className="truncate">{x.name}</span><span className="num text-muted">+{x.lift.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : <p className="text-muted">Not available without data.</p>}
    </Card>
  );
}

export function Interview({ report }: { report: Report }) {
  const [copied, setCopied] = useState(false);
  const iv = report.interview;
  const text = [iv.recruit, `Look for: ${iv.markers.join(", ")}`, "", ...iv.questions.map((q, i) => `${i + 1}. ${q}`)].join("\n");
  return (
    <Card title="Validate it with five real people"
          aside={<button type="button" className={btn.text} onClick={() => navigator.clipboard.writeText(text).then(() => setCopied(true))}>
            {copied ? "Copied" : "Copy script"}</button>}>
      <p>{iv.recruit}</p>
      {iv.markers.length > 0 && <p className="mt-1"><span className="text-muted">Look for </span>{iv.markers.join(", ")}</p>}
      <ol className="mt-3 list-decimal space-y-1.5 pl-5">{iv.questions.map((q) => <li key={q}>{q}</li>)}</ol>
    </Card>
  );
}

export function VerdictHead({ report, variantName }: { report: Report; variantName: string }) {
  const v = report.verdict;
  const g = report.grounding;
  const tone = v.confidence === "strong" ? "positive" : v.confidence === "weak" ? "warning" : "neutral";
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <Pill tone={tone}>{v.confidence[0].toUpperCase() + v.confidence.slice(1)} confidence</Pill>
        <span className="num">{g.passed} of {g.total} statements cite real receipts ({pct(g.rate)})</span>
        <span className="num">· {g.qloo_calls} Qloo calls</span>
      </div>
      <h1 className="mt-3 text-xl font-semibold tracking-[-0.01em] sm:text-2xl">Launch to {v.segment_label}</h1>
      <p className="mt-1 text-[15px]">with {variantName} at tier {v.tier}, {TIER_WORDS[v.tier]} pricing.</p>
      {report.sensitivity && (
        <p className="mt-2 text-muted">
          {report.sensitivity.robust ? "Robust: " : "Fragile: "}{report.sensitivity.change}
        </p>
      )}
      <p className="mt-3 text-xs text-muted">{report.disclaimer}</p>
    </div>
  );
}
