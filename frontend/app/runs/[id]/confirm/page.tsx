"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Bar, btn, Card, field, Notice } from "@/components/ui";
import { ApiError, Comparable, getRun, money, putComparables, RunView, searchQloo } from "@/lib/api";

type Row = { qloo_id: string; name: string; weight: number; price: string; bWeight: number };

function AddBrand({ taken, onAdd }: { taken: Set<string>; onAdd: (r: { qloo_id: string; name: string }) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ qloo_id: string; name: string }[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const seq = useRef(0);

  useEffect(() => {
    if (q.trim().length < 2) { setHits([]); setMsg(null); return; }
    const n = ++seq.current;
    const t = setTimeout(() => {
      searchQloo(q.trim()).then(
        (r) => { if (n === seq.current) { setHits(r.results); setActive(0); setMsg(r.results.length ? null : "No Qloo brand by that name."); } },
        (e: ApiError) => { if (n === seq.current) { setHits([]); setMsg(e.message); } });
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const pick = (h: { qloo_id: string; name: string }) => { onAdd(h); setQ(""); setHits([]); };
  const open = hits.length > 0;

  return (
    <div className="relative">
      <input role="combobox" aria-expanded={open} aria-controls="brand-hits" aria-autocomplete="list" aria-label="Add a brand"
             aria-activedescendant={open ? `hit-${active}` : undefined}
             value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a brand, e.g. Poppi" className={field}
             onKeyDown={(e) => {
               if (!open) return;
               if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)); }
               if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
               if (e.key === "Enter") { e.preventDefault(); if (!taken.has(hits[active].qloo_id)) pick(hits[active]); }
               if (e.key === "Escape") setHits([]);
             }} />
      {open && (
        <ul id="brand-hits" role="listbox" className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface p-1 shadow-[0_4px_16px_rgba(0,0,0,.08)]">
          {hits.map((h, i) => {
            const dup = taken.has(h.qloo_id);
            return (
              <li key={h.qloo_id} id={`hit-${i}`} role="option" aria-selected={i === active} aria-disabled={dup}
                  onMouseDown={(e) => { e.preventDefault(); if (!dup) pick(h); }} onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer justify-between rounded px-2 py-2 ${i === active ? "bg-ground" : ""} ${dup ? "text-muted" : ""}`}>
                {h.name}{dup && <span className="text-xs">Already added</span>}
              </li>
            );
          })}
        </ul>
      )}
      {msg && <p className="mt-1.5 text-[13px] text-muted">{msg}</p>}
    </div>
  );
}

function Weight({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={0} max={1} step={0.1} value={value} aria-label={label}
             aria-valuetext={value === 0 ? "ignored" : `${value.toFixed(1)} of 1`}
             onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-[#141414]" />
      <span className="num w-7 text-right">{value.toFixed(1)}</span>
    </div>
  );
}

export default function Confirm() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getRun(id).then((r) => {
      if (r.run.status === "running") return router.replace(`/runs/${id}/panel`);
      if (r.run.status !== "confirming") return router.replace(`/runs/${id}/report`);
      setRun(r);
      setRows(r.comparables.map((c) => ({ qloo_id: c.qloo_id, name: c.name, weight: c.weight, price: String(c.price), bWeight: c.weight })));
    }, (e: ApiError) => setError(e.status === 404 ? "Run not found." : e.message));
  }, [id, router]);

  const up = (i: number, p: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const hasB = run?.run.brief.variants.length === 2;
  const badPrice = rows.filter((r) => !(Number(r.price) > 0 && Number(r.price) <= 10000));
  const reason = rows.length < 3 ? `Add ${3 - rows.length} more brand${rows.length === 2 ? "" : "s"}; the panel needs at least 3.`
    : rows.length > 6 ? "Keep 6 brands at most."
    : !rows.some((r) => r.weight > 0) ? "Give at least one brand a weight above 0."
    : hasB && !rows.some((r) => r.bWeight > 0) ? "Give at least one variant B weight above 0."
    : badPrice.length ? `Enter a price for ${badPrice.map((r) => r.name).join(", ")}.` : null;

  async function start() {
    setBusy(true);
    setError(null);
    const comps: Comparable[] = rows.map((r) => ({ qloo_id: r.qloo_id, name: r.name, weight: r.weight, price: Number(r.price) }));
    const vw: Record<string, Record<string, number>> = hasB ? { B: Object.fromEntries(rows.map((r) => [r.qloo_id, r.bWeight])) } : {};
    try {
      await putComparables(id, comps, vw);
      router.push(`/runs/${id}/panel`);
    } catch (e) {
      setError((e as ApiError).message);
      setBusy(false);
    }
  }

  if (error && !run) return <Notice tone="negative">{error}</Notice>;
  const brief = run?.run.brief;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">Confirm comparable brands</h1>
      <p className="mt-1 max-w-[640px] text-muted">
        Each panelist&rsquo;s stance comes from how much they over-index on these brands. The weight says how close
        each one is to your product; the prices set the budget-to-luxury tiers.
      </p>

      <div className="mt-6 grid items-start gap-3 lg:grid-cols-[1fr_340px]">
        <Card title="Brands the panel compares you to" aside={`${rows.length} of 3–6`}>
          {!run ? <div className="space-y-2" aria-busy="true">{[0, 1, 2, 3].map((i) => <Bar key={i} w="w-full" h="h-11" />)}</div> : (
            <>
              <table className="w-full">
                <thead>
                  <tr className="text-left text-xs text-muted">
                    <th className="pb-2 font-normal">Brand</th>
                    <th className="w-[38%] pb-2 font-normal">Weight</th>
                    <th className="w-24 pb-2 text-right font-normal">Price</th>
                    <th className="w-16 pb-2"><span className="sr-only">Remove</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={r.qloo_id} className="border-t border-rule align-top">
                      <td className="py-2.5 pr-3 font-medium leading-9">{r.name}</td>
                      <td className="py-2.5 pr-3">
                        <Weight label={`${r.name} weight`} value={r.weight} onChange={(v) => up(i, { weight: v })} />
                        {hasB && (
                          <div className="mt-1 text-xs text-muted">
                            Variant B
                            <Weight label={`${r.name} weight for variant B`} value={r.bWeight} onChange={(v) => up(i, { bWeight: v })} />
                          </div>
                        )}
                      </td>
                      <td className="py-2.5">
                        <div className="relative">
                          <span className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-muted">$</span>
                          <input aria-label={`${r.name} price`} inputMode="decimal" value={r.price} placeholder="0.00"
                                 aria-invalid={!(Number(r.price) > 0)} onChange={(e) => up(i, { price: e.target.value })}
                                 className={`${field} num h-9 pl-5 text-right`} />
                        </div>
                      </td>
                      <td className="py-2.5 text-right">
                        <button type="button" onClick={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                                className={`${btn.text} leading-9 text-muted`}>Remove</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length < 6 && (
                <div className="mt-3 border-t border-rule pt-3">
                  <AddBrand taken={new Set(rows.map((r) => r.qloo_id))}
                            onAdd={(h) => setRows((rs) => [...rs, { ...h, weight: 0.5, price: "", bWeight: 0.5 }])} />
                </div>
              )}
              {run.warnings.length > 0 && <div className="mt-3"><Notice>{run.warnings.join(" ")}</Notice></div>}
            </>
          )}
        </Card>

        <div className="space-y-3">
          <Card title="Your brief">
            {brief ? (
              <dl className="space-y-2.5">
                <div><dt className="text-xs text-muted">Product</dt><dd>{brief.description}</dd></div>
                {brief.variants.map((v) => (
                  <div key={v.key} className="flex justify-between gap-3">
                    <dt className="text-muted">{brief.variants.length > 1 ? `Variant ${v.key}` : "Name"}</dt>
                    <dd className="text-right">{v.name} <span className="num text-muted">{money(v.price ?? brief.price)}</span></dd>
                  </div>
                ))}
                <div className="flex justify-between gap-3">
                  <dt className="text-muted">Segments</dt><dd className="num">{brief.segments.length}</dd>
                </div>
              </dl>
            ) : <Bar w="w-full" h="h-24" />}
          </Card>
          <div className="space-y-2">
            {error && <Notice tone="negative">{error}</Notice>}
            <button type="button" onClick={start} disabled={!run || !!reason || busy} className={`${btn.primary} w-full`}
                    aria-describedby={reason ? "start-why" : undefined}>
              {busy ? "Starting the panel…" : "Start the panel"}
            </button>
            {reason && run && <p id="start-why" className="text-[13px] text-muted">{reason}</p>}
          </div>
        </div>
      </div>
    </>
  );
}
