"use client";

import { Check, Copy, Download, Link2, X } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { Avatar, panelLook, PersonaCard } from "@/components/PersonaCard";
import { CitedText, joinNames, likesHowMuch, Loading, Notice, RunSteps, STANCE, TIER, tierRange, typeLabel } from "@/components/run";
import { ApiError, getReport, getRun, type Persona, type Report, type RunView } from "@/lib/api";

const CONFIDENCE = {
  strong: { label: "Strong signal", why: "This segment clearly leads, and its panelists agree with each other.", cls: "bg-mint" },
  mixed: { label: "Mixed signal", why: "This segment leads, but its panelists disagree or the lead is small.", cls: "bg-raise" },
  weak: { label: "Weak signal", why: "The top segments are close. Treat this as a coin toss and test both.", cls: "bg-peach" },
};

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [rep, setRep] = useState<Report | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRun(id)
      .then(setRun)
      .catch(() => {}); // without it the report still reads; it just loses the panel strip and quotes
    getReport(id)
      .then(setRep)
      .catch((e) => {
        if (e instanceof ApiError && e.code === "bad_status") return router.replace(`/runs/${id}/panel`); // not finished yet
        setError(e instanceof ApiError && e.status === 404 ? "We couldn't find this run." : (e as Error).message);
      });
  }, [id, router]);

  // Printing (or "Download PDF") opens every collapsed section so the PDF holds the whole report.
  useEffect(() => {
    let opened: HTMLDetailsElement[] = [];
    const before = () => {
      opened = [...document.querySelectorAll<HTMLDetailsElement>("details:not([open])")];
      opened.forEach((d) => (d.open = true));
    };
    const after = () => opened.forEach((d) => (d.open = false));
    window.addEventListener("beforeprint", before);
    window.addEventListener("afterprint", after);
    return () => {
      window.removeEventListener("beforeprint", before);
      window.removeEventListener("afterprint", after);
    };
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 print:max-w-none print:p-0">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <RunSteps current={3} />
        {rep && (
          <div className="flex flex-wrap gap-2">
            <CopyButton text={() => window.location.href} idle="Copy share link" done="Link copied" icon={<Link2 aria-hidden className="size-4" />} />
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line-2 bg-raise px-4 py-2 text-sm font-semibold hover:bg-sun"
            >
              <Download aria-hidden className="size-4" />
              Download PDF
            </button>
          </div>
        )}
      </div>
      <div className="mt-8 print:mt-0">
        {error ? (
          <Notice tone="error">
            {error}{" "}
            <Link href="/#brief" className="font-semibold underline">
              Start a new brief
            </Link>
          </Notice>
        ) : !rep ? (
          <Loading label="Loading the report…" />
        ) : (
          <ReportBody rep={rep} id={id} run={run} />
        )}
      </div>
    </div>
  );
}

function ReportBody({ rep, id, run }: { rep: Report; id: string; run: RunView | null }) {
  const v = rep.verdict;
  const conf = CONFIDENCE[v.confidence];
  const segLabel = (i: number) => rep.segments.find((s) => s.index === i)?.label ?? `Segment ${i + 1}`;
  const names: Record<number, string> = Object.fromEntries(rep.price_bands.personas.map((p) => [p.persona_id, p.name]));
  const segments = [...rep.segments].sort((a, b) => b.mean_scaled - a.mean_scaled);
  const g = rep.grounding;
  const love = Object.entries(rep.love).filter(([, items]) => items.length > 0);
  const hasVariants = rep.variants.length > 1;
  let n = 0; // section numbers, since two sections are optional
  const look = panelLook(run?.personas ?? []);
  const byId = new Map((run?.personas ?? []).map((p) => [p.id, p]));
  const stById = new Map((run?.statements ?? []).map((st) => [st.id, st]));
  const [who, setWho] = useState<Persona | null>(null);
  const brief = run?.run.brief;
  const variantName = (k: string | null) => (k && brief && brief.variants.length > 1 ? brief.variants.find((x) => x.key === k)?.name : undefined);
  const quoteFor = (pid: number, o: Report["objections"][number]) => {
    const said = o.statement_ids.map((sid) => stById.get(sid)).filter((st) => st?.persona_id === pid);
    return said.length ? bestSentence(said.map((st) => st!.text).join(" "), o.text) : null;
  };

  return (
    <div className="grid gap-14 print:gap-10">
      <section aria-labelledby="verdict" className="sticker rounded-3xl bg-sun p-6 text-center sm:p-10">
        <p className="font-hand text-4xl sm:text-5xl">The Verdict</p>
        <h1 id="verdict" className="mt-1 font-serif text-[clamp(2rem,5vw,3.4rem)] leading-[1.05] tracking-[-0.02em]">
          {v.sentence}
        </h1>
        <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
          <Pill className={conf.cls}>{conf.label}</Pill>
          <Pill className="bg-raise">
            {g.passed} of {g.total} statements backed by Qloo data ({Math.round(g.rate * 100)}%)
          </Pill>
        </div>
        <p className="mx-auto mt-4 max-w-[62ch] leading-relaxed">
          {conf.why}{" "}
          {rep.sensitivity.robust ? "It holds up: removing any one comparable brand doesn't change the pick." : `Watch out: ${rep.sensitivity.change}`}
        </p>
      </section>

      {look.of > 0 && (
        <section aria-labelledby="panel-strip">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 id="panel-strip" className="font-serif text-2xl">
              Your panel
            </h2>
            <p className="text-sm text-sub print:hidden">Tap anyone to see who they are and what they said.</p>
          </div>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {look.ordered.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setWho(p)}
                  className="flex h-full w-full items-center gap-2.5 rounded-2xl border border-line-2 bg-raise p-3 text-left transition-transform hover:-translate-y-0.5"
                >
                  <Avatar name={p.name} fill={look.fill(p.id)} />
                  <span className="min-w-0 leading-tight">
                    <span className="block font-semibold">{p.name}</span>
                    <span className="block truncate text-xs text-sub">{p.segment_label}</span>
                    <span className={`block text-[11px] font-bold uppercase tracking-wide ${STANCE[p.stance_label].text}`}>{STANCE[p.stance_label].label}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <PersonDialog
            p={who}
            onClose={() => setWho(null)}
            render={(p) => (
              <PersonaCard
                p={p}
                fill={look.fill(p.id)}
                r1={run?.statements.find((st) => st.persona_id === p.id && st.round === 1)}
                r2={run?.statements.find((st) => st.persona_id === p.id && st.round === 2)}
                inRound2={false}
                variantName={variantName}
                waiting={false}
                rank={look.rank(p.id)}
                of={look.of}
              />
            )}
          />
        </section>
      )}

      <Section
        n={++n}
        id="segments"
        title="Who's most interested"
        hint="Groups ranked against each other, by how much their panelists already like your comparable brands. The bar is relative: the warmest panelist on this panel sets the top."
      >
        <ol className="grid gap-4">
          {segments.map((s) => {
            const win = s.index === v.segment_index;
            return (
              <li key={s.index} className={`rounded-2xl border border-line-2 p-4 sm:p-5 ${win ? "bg-mint/50" : "bg-raise"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h3 className="text-lg font-semibold">
                    {s.label}
                    {win && (
                      <span className="ml-2 rounded-full border border-line-2 bg-sun px-2 py-0.5 align-middle text-xs font-bold uppercase tracking-wide">Launch here</span>
                    )}
                  </h3>
                  <p className="text-sm text-sub">
                    <span className="font-semibold text-text">{s.mean_scaled >= 0.67 ? "High" : s.mean_scaled >= 0.34 ? "Some" : "Low"} interest</span> ·{" "}
                    Your price{" "}
                    <b className="text-text">
                      {s.price_fit_share === 0
                        ? "is outside what they usually pay"
                        : s.price_fit_share === 1
                          ? "suits all of them"
                          : `suits ${Math.round(s.price_fit_share * 100)}% of them`}
                    </b>
                  </p>
                </div>
                <div className="mt-3 h-4 overflow-hidden rounded-full border border-line-2 bg-bg" aria-hidden>
                  <div className={`h-full ${win ? "bg-enthusiast" : "bg-sky"}`} style={{ width: `${Math.max(3, s.mean_scaled * 100)}%` }} />
                </div>
                {s.top_comparables.length > 0 && (
                  <p className="mt-3 text-sm text-sub">
                    Of your comparable brands, they like <span className="font-semibold text-text">{s.top_comparables[0].name}</span>{" "}
                    {likesHowMuch(s.top_comparables[0].lift)}
                    {s.top_comparables.length > 1 && (
                      <>
                        , then <span className="font-semibold text-text">{joinNames(s.top_comparables.slice(1).map((c) => c.name))}</span>
                      </>
                    )}
                    .
                  </p>
                )}
              </li>
            );
          })}
        </ol>
      </Section>

      <Section
        n={++n}
        id="objections"
        title="What puts people off"
        hint="Grouped from what the skeptical and on-the-fence panelists said, in their own words."
      >
        {rep.objections.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line-2 px-4 py-6 text-sub">No objections raised. Every panelist leaned in.</p>
        ) : (
          <ol className="grid gap-4">
            {rep.objections.map((o, i) => (
              <li key={i} className="flex gap-4 rounded-2xl border border-line-2 bg-raise p-4 sm:p-5">
                <span aria-hidden className="flex size-9 shrink-0 items-center justify-center rounded-full border border-line-2 bg-peach font-serif">
                  {i + 1}
                </span>
                <div className="min-w-0">
                  <p className="text-lg font-semibold leading-snug">{o.text}</p>
                  {byId.size === 0 ? (
                    <>
                      <p className="mt-1 text-sm text-sub">Raised by {joinNames(o.persona_ids.map((pid) => names[pid] ?? "a panelist"))}</p>
                      {o.receipts.length > 0 && <WhyTheySaidIt receipts={o.receipts} names={names} />}
                    </>
                  ) : (
                    <>
                      <ul className="mt-3 grid gap-3">
                        {o.persona_ids.map((pid) => {
                          const p = byId.get(pid);
                          if (!p) return null;
                          const q = quoteFor(pid, o);
                          return (
                            <li key={pid} className="flex gap-3">
                              <button type="button" onClick={() => setWho(p)} aria-label={`About ${p.name}`} className="h-fit rounded-full">
                                <Avatar name={p.name} fill={look.fill(pid)} />
                              </button>
                              <div className="min-w-0">
                                <p className="text-sm">
                                  <button type="button" onClick={() => setWho(p)} className="font-semibold underline decoration-dotted underline-offset-4 hover:text-pop">
                                    {p.name}
                                  </button>
                                  <span className="text-sub">
                                    , {p.segment_label} · {STANCE[p.stance_label].label.toLowerCase()}
                                  </span>
                                </p>
                                {q && (
                                  <blockquote className="mt-0.5 text-[15px] leading-relaxed">
                                    “<CitedText text={q} receipts={p.receipts} />”
                                  </blockquote>
                                )}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                      {o.receipts.length > 0 && (
                        <details className="mt-3 text-sm text-sub">
                          <summary className="cursor-pointer font-medium text-text hover:text-pop">Why they feel this way: what they like (Qloo data)</summary>
                          <WhyTheySaidIt receipts={o.receipts} names={names} plain />
                        </details>
                      )}
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>

      <Section
        n={++n}
        id="price"
        title="What they'd pay"
        hint={`Next to your comparable brands, your price counts as ${TIER[rep.price_bands.concept_tier]}. Each bar is the price range of a panelist's favourite brands.`}
      >
        <PriceBands bands={rep.price_bands} fill={look.of ? look.fill : undefined} />
      </Section>

      {hasVariants && (
        <Section n={++n} id="variants" title="Which version wins" hint="How each version did in every segment.">
          <div className="grid gap-4 sm:grid-cols-2">
            {rep.variants.map((vr) => (
              <div key={vr.key} className={`rounded-2xl border border-line-2 p-5 ${vr.key === v.variant ? "bg-mint/50" : "bg-raise"}`}>
                <h3 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
                  Version {vr.key}
                  {vr.key === v.variant && <span className="rounded-full border border-line-2 bg-sun px-2 py-0.5 text-xs font-bold uppercase tracking-wide">The pick</span>}
                </h3>
                <p className="text-sm text-sub">Priced as {TIER[vr.tier]}</p>
                <ul className="mt-3 grid gap-2 text-sm">
                  {vr.by_segment.map((b) => (
                    <li key={b.index} className="flex flex-wrap justify-between gap-x-3 border-t border-line pt-2">
                      <span className="font-medium">{segLabel(b.index)}</span>
                      <span className="text-sub">
                        picked by {b.preferred_count} · price fits {Math.round(b.price_fit_share * 100)}%
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>
      )}

      {love.length > 0 && (
        <Section
          n={++n}
          id="love"
          title={`What ${v.segment_label} loves`}
          hint="What they like far more than most people, strongest first. Useful for ads, partnerships and where to show up."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {love.map(([type, items]) => (
              <div key={type} className="rounded-2xl border border-line-2 bg-raise p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide">{typeLabel(type)}</h3>
                <ol className="mt-2 grid list-decimal gap-1 pl-5 text-sm">
                  {items.map((it) => (
                    <li key={it.name} className="truncate">
                      {it.name}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section n={++n} id="interview" title="Check it with real people" hint="A recruiting brief and five questions to test the objections above.">
        <Interview iv={rep.interview} />
      </Section>

      <footer className="grid gap-3 border-t border-line pt-6 text-sm text-sub">
        <p>
          Built from {g.qloo_calls + g.qloo_cache_hits} lookups of Qloo taste data: what people like each panelist buy, watch and listen to, compared with
          people in general.{" "}
          <Link href={`/runs/${id}/panel`} className="font-semibold text-text underline hover:text-pop print:hidden">
            Replay the debate
          </Link>
        </p>
        <p className="hidden print:block">
          Full interactive report, with each panelist&apos;s answers: <span className="font-semibold text-text">{window.location.href}</span>
        </p>
      </footer>
    </div>
  );
}

/** One entry per cited brand or show, most-shared first: the reason several panelists agree beats one person's niche taste. */
function byEntity(receipts: Report["objections"][number]["receipts"]) {
  const m = new Map<string, { name: string; pids: number[]; lift: number }>();
  for (const r of receipts) {
    const e = m.get(r.entity_name) ?? { name: r.entity_name, pids: [], lift: r.lift };
    if (!e.pids.includes(r.persona_id)) e.pids.push(r.persona_id);
    e.lift = Math.max(e.lift, r.lift);
    m.set(r.entity_name, e);
  }
  return [...m.values()].sort((a, b) => b.pids.length - a.pids.length || b.lift - a.lift);
}

const SHOWN = 3;

/** The Qloo evidence under an objection, as sentences: "Maya and Sarah like Olipop much more than most people." */
function WhyTheySaidIt({ receipts, names, plain = false }: { receipts: Report["objections"][number]["receipts"]; names: Record<number, string>; plain?: boolean }) {
  const all = byEntity(receipts);
  const line = (e: (typeof all)[number]) => (
    <li key={e.name}>
      {joinNames(e.pids.map((pid) => names[pid] ?? "a panelist"))} {e.pids.length > 1 ? "like" : "likes"} <span className="font-semibold text-text">{e.name}</span> {likesHowMuch(e.lift)}.
    </li>
  );
  if (plain) return <ul className="mt-2 grid gap-1 rounded-xl bg-bg px-4 py-3">{all.map(line)}</ul>;
  return (
    <div className="mt-3 rounded-xl bg-bg px-4 py-3 text-sm text-sub">
      <p className="text-xs font-bold uppercase tracking-wide text-text">What these panelists like (Qloo data)</p>
      <ul className="mt-1.5 grid gap-1">{all.slice(0, SHOWN).map(line)}</ul>
      {all.length > SHOWN && (
        <details className="mt-1.5">
          <summary className="cursor-pointer font-medium text-text hover:text-pop">Show {all.length - SHOWN} more</summary>
          <ul className="mt-1.5 grid gap-1">{all.slice(SHOWN).map(line)}</ul>
        </details>
      )}
    </div>
  );
}

/** The sentence of a statement that shares the most words with the objection, so the quote is on topic. */
function bestSentence(text: string, topic: string): string {
  // First 5 letters as a cheap stem, so "budget" matches "budgets" and "pricey" matches "price".
  const words = (t: string) => (t.toLowerCase().match(/[a-z]{4,}/g) ?? []).map((w) => w.slice(0, 5));
  const want = new Set(words(topic));
  const priceTopic = /pric|cost|expens|afford|budget|\$/i.test(topic);
  // Split at sentence ends, but not after "Dr." or "vs." or inside "$3.0," (no space follows that dot).
  const sentences = text.split(/(?<!\b(?:Dr|Mr|Mrs|Ms|St|Jr|vs)\.)(?<=[.!?])\s+(?=[A-Z])/);
  let best = sentences[0];
  let score = -1;
  for (const s of sentences) {
    const sc = words(s).filter((w) => want.has(w)).length + (priceTopic && /\$\d|pric|cost|expens|budget/i.test(s) ? 2 : 0);
    if (sc > score) [best, score] = [s, sc];
  }
  return best.trim();
}

/** A native modal: Esc and the backdrop close it, and the browser traps and returns focus. */
function PersonDialog({ p, onClose, render }: { p: Persona | null; onClose: () => void; render: (p: Persona) => ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (p && !ref.current?.open) ref.current?.showModal();
  }, [p]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && ref.current?.close()}
      aria-label={p ? `${p.name}, panelist` : undefined}
      className="m-auto max-h-[90vh] w-[min(30rem,calc(100%-2rem))] overflow-y-auto bg-transparent p-2 backdrop:bg-text/50"
    >
      {p && (
        <div className="relative">
          <button
            type="button"
            autoFocus
            onClick={() => ref.current?.close()}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex size-9 items-center justify-center rounded-full border border-line-2 bg-raise hover:bg-sun"
          >
            <X aria-hidden className="size-4" strokeWidth={2.5} />
          </button>
          {render(p)}
        </div>
      )}
    </dialog>
  );
}

function Section({ n, id, title, hint, children }: { n: number; id: string; title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <div className="mb-5 flex items-start gap-3">
        <span aria-hidden className="mt-1 font-hand text-3xl leading-none text-pop">
          {n}.
        </span>
        <div>
          <h2 id={id} className="font-serif text-[clamp(1.6rem,3.5vw,2.2rem)] leading-tight">
            {title}
          </h2>
          <p className="mt-1 max-w-[62ch] text-sub">{hint}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
  return <span className={`rounded-full border border-line-2 px-3 py-1 font-semibold ${className}`}>{children}</span>;
}

/** One row per panelist: their band across the four tiers, with your price as a vertical line. */
function PriceBands({ bands, fill }: { bands: Report["price_bands"]; fill?: (id: number) => string }) {
  const pos = (tier: number) => ((tier - 1) / 3) * 100; // tier 1..4 → 0..100%
  const fits = bands.personas.filter((p) => p.fit).length;
  return (
    <div className="rounded-2xl border border-line-2 bg-raise p-4 sm:p-6">
      <p className="mb-5 font-semibold">
        Your price fits {fits} of {bands.personas.length} panelists.
      </p>
      <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-x-3 sm:grid-cols-[9rem_minmax(0,1fr)_6rem]">
        <span />
        <div className="relative mb-1 h-5 text-[11px] text-sub sm:text-xs" aria-hidden>
          {[1, 2, 3, 4].map((t) => (
            <span
              key={t}
              className={`absolute whitespace-nowrap ${t === 1 ? "" : t === 4 ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${pos(t)}%` }}
            >
              {TIER[t]}
            </span>
          ))}
        </div>
        <span />
        {bands.personas.map((p) => (
          <div key={p.persona_id} className="contents">
            <span className="flex min-w-0 items-center gap-2 py-2 text-sm font-medium">
              {fill && <Avatar name={p.name} fill={fill(p.persona_id)} size="sm" />}
              <span className="truncate">{p.name}</span>
            </span>
            <div className="relative h-6 rounded-full bg-bg">
              <div className="absolute -inset-y-1 w-0.5 bg-text" style={{ left: `${pos(bands.concept_tier)}%` }} aria-hidden />
              <div
                className={`absolute inset-y-1 rounded-full border border-line-2 ${p.weak ? "border-dashed" : p.fit ? "bg-mint" : "bg-peach"}`}
                style={{ left: `${pos(p.lo)}%`, width: `max(${pos(p.hi) - pos(p.lo)}%, 0.75rem)` }}
                aria-hidden
              />
              <span className="sr-only">
                {p.weak ? "No clear price signal." : `Pays ${tierRange(p.lo, p.hi)}.`} Your price {p.fit ? "fits" : "is outside"}.
              </span>
            </div>
            <span aria-hidden className={`text-xs font-semibold ${p.weak ? "text-sub" : p.fit ? "text-enthusiast" : "text-skeptic"}`}>
              {p.weak ? "no signal" : p.fit ? "fits" : "outside"}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-4 flex items-center gap-2 text-xs text-sub">
        <span aria-hidden className="inline-block h-4 w-0.5 bg-text" /> your price
      </p>
    </div>
  );
}

function Interview({ iv }: { iv: Report["interview"] }) {
  const text = `Who to recruit: ${iv.recruit}\nScreen for: ${iv.markers.join(", ")}\n\n${iv.questions.map((q, i) => `${i + 1}. ${q}`).join("\n")}`;
  return (
    <div className="rounded-2xl border border-line-2 bg-lilac/40 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-[62ch]">
          <h3 className="text-xs font-bold uppercase tracking-wide">Who to recruit</h3>
          <p className="mt-1 leading-relaxed">{iv.recruit}</p>
        </div>
        <span className="print:hidden">
          <CopyButton text={() => text} idle="Copy script" done="Copied" icon={<Copy aria-hidden className="size-4" />} />
        </span>
      </div>
      {iv.markers.length > 0 && (
        <p className="mt-4 text-sm">
          <span className="font-semibold">Screen for:</span> {iv.markers.join(", ")}
        </p>
      )}
      <ol className="mt-4 grid list-decimal gap-2 pl-5 leading-relaxed">
        {iv.questions.map((q) => (
          <li key={q}>{q}</li>
        ))}
      </ol>
    </div>
  );
}

function CopyButton({ text, idle, done, icon }: { text: () => string; idle: string; done: string; icon: ReactNode }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => navigator.clipboard.writeText(text()).then(() => setCopied(true), () => {})}
      className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line-2 bg-raise px-4 py-2 text-sm font-semibold hover:bg-sun"
    >
      {copied ? <Check aria-hidden className="size-4" /> : icon}
      <span aria-live="polite">{copied ? done : idle}</span>
    </button>
  );
}
