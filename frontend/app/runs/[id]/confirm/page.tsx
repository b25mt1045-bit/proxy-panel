"use client";

import { ArrowRight, LoaderCircle, Plus, Search, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";

import { Loading, Notice, PageHead, RunSteps } from "@/components/run";
import { ApiError, getPresets, getRun, putComparables, searchQloo, type RunView } from "@/lib/api";

// Same limits as PUT /runs/{id}/comparables; the server stays the authority.
const MIN = 3, MAX = 6;

type Row = { qloo_id: string; name: string; weight: number; price: string; b: number };

const closeness = (w: number) => (w === 0 ? "ignored" : w <= 0.3 ? "a little like it" : w <= 0.7 ? "like it" : "very like it");

function priceOk(raw: string) {
  const n = Number(raw);
  return raw.trim() !== "" && Number.isFinite(n) && n > 0 && n <= 10000;
}

export default function ConfirmPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [run, setRun] = useState<RunView | null>(null);
  const [presetLabels, setPresetLabels] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [splitB, setSplitB] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    getRun(id)
      .then((r) => {
        // Only a run waiting for brands belongs here.
        if (r.run.status === "done") return router.replace(`/runs/${id}/report`);
        if (r.run.status !== "confirming") return router.replace(`/runs/${id}/panel`);
        setRun(r);
        setRows(r.comparables.map((c) => ({ qloo_id: c.qloo_id, name: c.name, weight: c.weight, price: String(c.price), b: c.weight })));
      })
      .catch((e) => setLoadError(e instanceof ApiError && e.status === 404 ? "We couldn't find this run." : (e as Error).message));
    getPresets()
      .then((p) => setPresetLabels(Object.fromEntries(p.presets.map((x) => [x.id, x.label]))))
      .catch(() => {});
  }, [id, router]);

  if (loadError)
    return (
      <Shell>
        <Notice tone="error">
          {loadError}{" "}
          <Link href="/#brief" className="font-semibold underline">
            Start a new brief
          </Link>
        </Notice>
      </Shell>
    );
  if (!run) return <Shell><Loading label="Loading your brands…" /></Shell>;

  const brief = run.run.brief;
  const hasB = brief.variants.length > 1;
  const setRow = (i: number, patch: Partial<Row>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const noPrice = rows.find((r) => !priceOk(r.price));
  const blocker =
    rows.length < MIN
      ? `Add ${MIN - rows.length} more brand${MIN - rows.length > 1 ? "s" : ""}. The panel needs at least ${MIN}.`
      : noPrice
        ? `Enter a price for ${noPrice.name}.`
        : !rows.some((r) => r.weight > 0)
          ? "Set at least one brand above “ignored”."
          : hasB && splitB && !rows.some((r) => r.b > 0)
            ? `Set at least one brand above “ignored” for ${brief.variants[1].name}.`
            : null;

  async function start() {
    if (blocker || starting) return;
    setStarting(true);
    setBanner(null);
    try {
      await putComparables(
        id,
        rows.map((r) => ({ qloo_id: r.qloo_id, name: r.name, weight: r.weight, price: Number(r.price) })),
        hasB && splitB ? { B: Object.fromEntries(rows.map((r) => [r.qloo_id, r.b])) } : {},
      );
      router.push(`/runs/${id}/panel`);
    } catch (e) {
      setStarting(false);
      if (e instanceof ApiError && e.code === "bad_status") return router.replace(`/runs/${id}/panel`); // already started
      setBanner((e as Error).message);
    }
  }

  return (
    <Shell>
      <PageHead kicker="step two" title="Check the brands we'll compare you with.">
        Panelists who love these brands lean toward your product, and their prices set what counts as cheap or premium. Fix the
        list so it matches who you&apos;d really compete with.
      </PageHead>

      <div className="mt-10 grid gap-8 lg:grid-cols-[minmax(0,1fr)_19rem]">
        <section aria-labelledby="brands-head" className="sticker rounded-3xl bg-raise p-5 sm:p-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 id="brands-head" className="font-serif text-2xl">
              Comparable brands
            </h2>
            <p className={`text-sm tabular-nums ${rows.length < MIN ? "font-semibold text-skeptic" : "text-sub"}`}>
              {rows.length} of {MIN}–{MAX}
            </p>
          </div>

          {rows.length === 0 ? (
            <p className="mt-6 rounded-2xl border-2 border-dashed border-line-2 px-4 py-8 text-center text-sub">
              We couldn&apos;t find comparables for this brief. Search below to add {MIN} or more.
            </p>
          ) : (
            <ul className="mt-6 grid gap-4">
              {rows.map((r, i) => (
                <BrandRow
                  key={r.qloo_id}
                  row={r}
                  splitB={hasB && splitB}
                  bName={hasB ? brief.variants[1].name : ""}
                  aName={brief.variants[0].name}
                  onChange={(patch) => setRow(i, patch)}
                  onRemove={() => setRows((rs) => rs.filter((_, j) => j !== i))}
                />
              ))}
            </ul>
          )}

          {rows.length < MAX ? (
            <AddBrand
              taken={new Set(rows.map((r) => r.qloo_id))}
              onAdd={(b) => setRows((rs) => [...rs, { ...b, weight: 0.5, price: "", b: 0.5 }])}
            />
          ) : (
            <p className="mt-6 text-sm text-sub">That&apos;s the maximum of {MAX}. Remove one to add another.</p>
          )}

          {hasB && (
            <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border-2 border-line-2 p-4 hover:border-text">
              <input type="checkbox" checked={splitB} onChange={(e) => setSplitB(e.target.checked)} className="mt-1 size-4 accent-pop" />
              <span>
                <span className="block font-semibold">{brief.variants[1].name} is closer to different brands</span>
                <span className="block text-sm text-sub">
                  Off: both versions use the same similarity. On: set a second similarity per brand for {brief.variants[1].name}.
                </span>
              </span>
            </label>
          )}
        </section>

        <aside className="grid content-start gap-6">
          <section aria-labelledby="brief-sum" className="rounded-3xl border border-line-2 bg-peach/50 p-5">
            <h2 id="brief-sum" className="text-xs font-bold uppercase tracking-wide">
              Your brief
            </h2>
            <p className="mt-2 line-clamp-5 leading-relaxed">{brief.description}</p>
            <dl className="mt-4 grid gap-2 text-sm">
              {brief.variants.map((v) => (
                <div key={v.key} className="flex justify-between gap-3">
                  <dt className="truncate text-sub">{v.name}</dt>
                  <dd className="font-semibold tabular-nums">${(v.price ?? brief.price).toFixed(2)}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-xs font-bold uppercase tracking-wide">Panel drawn from</p>
            <ul className="mt-1 text-sm leading-relaxed">
              {brief.segments.map((s, i) => (
                <li key={i}>• {s.preset_id ? (presetLabels[s.preset_id] ?? s.preset_id.replaceAll("_", " ")) : s.text}</li>
              ))}
            </ul>
          </section>
          {run.warnings.length > 0 && (
            <Notice>
              <ul className="grid gap-1">
                {run.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Notice>
          )}
        </aside>
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button
          type="button"
          onClick={start}
          aria-disabled={!!blocker || starting}
          aria-describedby="start-why"
          className="sticker group inline-flex h-14 items-center gap-2 rounded-full bg-sun px-7 text-base font-semibold transition-transform hover:-translate-y-0.5 active:translate-y-0.5 aria-disabled:cursor-not-allowed aria-disabled:bg-line aria-disabled:text-faint aria-disabled:shadow-none aria-disabled:hover:translate-y-0"
        >
          {starting ? (
            <>
              <LoaderCircle aria-hidden className="size-4 motion-safe:animate-spin" /> Starting the panel…
            </>
          ) : (
            <>
              Start the panel <ArrowRight aria-hidden className="size-4" strokeWidth={2.25} />
            </>
          )}
        </button>
        <p id="start-why" className={blocker ? "font-medium text-skeptic" : "text-sub"}>
          {blocker ?? "Takes about two minutes. You'll watch the debate live."}
        </p>
      </div>
      {banner && (
        <div className="mt-6">
          <Notice tone="error">{banner}</Notice>
        </div>
      )}
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
      <RunSteps current={1} />
      <div className="mt-8">{children}</div>
    </div>
  );
}

function BrandRow({
  row,
  splitB,
  aName,
  bName,
  onChange,
  onRemove,
}: {
  row: Row;
  splitB: boolean;
  aName: string;
  bName: string;
  onChange: (p: Partial<Row>) => void;
  onRemove: () => void;
}) {
  const id = useId();
  const n = Number(row.price);
  const priceErr =
    row.price.trim() === "" ? "Needed to place your price."
    : !Number.isFinite(n) ? "Enter a number, like 2.99."
    : !priceOk(row.price) ? "Enter a price from $0.01 to $10,000."
    : null;
  return (
    <li className="rounded-2xl border border-line-2 bg-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate pt-1 text-lg font-semibold">{row.name}</h3>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${row.name}`}
          className="flex size-9 shrink-0 items-center justify-center rounded-full border-2 border-transparent hover:border-text hover:bg-raise"
        >
          <X aria-hidden className="size-4" strokeWidth={2.5} />
        </button>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-[minmax(0,1fr)_8.5rem]">
        <div className="grid gap-3">
          <Slider id={`${id}-a`} label={splitB ? `How like ${aName}?` : "How like your product?"} value={row.weight} onChange={(v) => onChange({ weight: v })} />
          {splitB && <Slider id={`${id}-b`} label={`How like ${bName}?`} value={row.b} onChange={(v) => onChange({ b: v })} />}
        </div>
        <div>
          <label htmlFor={`${id}-p`} className="block text-xs text-sub">
            Typical price (USD)
          </label>
          <div className="relative mt-1.5">
            <span aria-hidden className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-sub">
              $
            </span>
            <input
              id={`${id}-p`}
              inputMode="decimal"
              value={row.price}
              onChange={(e) => onChange({ price: e.target.value })}
              placeholder="0.00"
              aria-invalid={!!priceErr}
              aria-describedby={priceErr ? `${id}-pe` : undefined}
              className="h-11 w-full rounded-xl border border-line-2 bg-raise pl-7 pr-3 tabular-nums hover:border-text focus:border-pop focus:outline-none focus:ring-4 focus:ring-pop/10 aria-[invalid=true]:border-skeptic"
            />
          </div>
          {priceErr && (
            <p id={`${id}-pe`} className="mt-1 text-xs font-medium text-skeptic">
              {priceErr}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function Slider({ id, label, value, onChange }: { id: string; label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="text-xs text-sub">
          {label}
        </label>
        <span className={`text-sm font-semibold ${value === 0 ? "text-faint" : ""}`}>{closeness(value)}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-valuetext={`${value.toFixed(1)}, ${closeness(value)}`}
        className="mt-1 w-full accent-pop"
      />
    </div>
  );
}

function AddBrand({ taken, onAdd }: { taken: Set<string>; onAdd: (b: { qloo_id: string; name: string }) => void }) {
  const [q, setQ] = useState("");
  const [found, setFound] = useState<{ term: string; results: { qloo_id: string; name: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const term = q.trim();

  useEffect(() => {
    if (term.length < 2) return;
    let live = true;
    const t = setTimeout(() => {
      searchQloo(term)
        .then((r) => {
          if (!live) return;
          setFound({ term, results: r.results });
          setError(null);
        })
        .catch((e) => live && setError((e as Error).message));
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [term]);

  const busy = term.length >= 2 && found?.term !== term && !error;
  const shown = term.length < 2 || found?.term !== term ? null : found.results.filter((r) => !taken.has(r.qloo_id));

  return (
    <div className="mt-6">
      <label htmlFor="add-brand" className="block font-semibold">
        Add a brand
      </label>
      <div className="relative mt-2">
        <Search aria-hidden className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-sub" />
        <input
          ref={input}
          id="add-brand"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setError(null);
          }}
          placeholder="Search Qloo, e.g. Olipop"
          maxLength={60}
          autoComplete="off"
          aria-describedby="add-brand-status"
          className="h-12 w-full rounded-xl border border-line-2 bg-raise pl-11 pr-10 hover:border-text focus:border-pop focus:outline-none focus:ring-4 focus:ring-pop/10"
        />
        {busy && <LoaderCircle aria-hidden className="absolute right-4 top-1/2 size-4 -translate-y-1/2 text-sub motion-safe:animate-spin" />}
      </div>
      <p id="add-brand-status" aria-live="polite" className={`mt-2 text-sm ${error ? "font-medium text-skeptic" : "text-sub"}`}>
        {error ??
          (term.length < 2
            ? "Type at least 2 letters. Check the name: Qloo returns its closest match."
            : busy
              ? "Searching…"
              : shown!.length === 0
                ? "No new matches. Try another spelling."
                : `${shown!.length} match${shown!.length > 1 ? "es" : ""}. Pick one to add it.`)}
      </p>
      {shown && shown.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2">
          {shown.map((r) => (
            <li key={r.qloo_id}>
              <button
                type="button"
                onClick={() => {
                  onAdd(r);
                  setQ("");
                  input.current?.focus();
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-line-2 bg-raise px-3 py-1.5 text-sm font-semibold hover:bg-mint"
              >
                <Plus aria-hidden className="size-3.5" strokeWidth={2.5} />
                {r.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
