"use client";

import { ArrowRight, Check, MessagesSquare, RotateCcw, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { panelLook, PersonaCard } from "@/components/PersonaCard";
import { Notice, PageHead, RunSteps } from "@/components/run";
import { ApiError, getRun, resumeRun, type Brief, type Persona } from "@/lib/api";
import { useRunStream } from "@/lib/useRunStream";

// Mirrors the six progress steps in backend/app/pipeline.py.
const STEPS = ["Matching segments to Qloo", "Building six panelists", "Round 1: first reactions", "Moderator picks a clash", "Round 2: the clash", "Writing the report"];

export default function PanelPage() {
  // A new key after "Try again" remounts the panel, so its stream starts over and replays the resumed run.
  const [attempt, setAttempt] = useState(0);
  return <Panel key={attempt} onResumed={() => setAttempt((n) => n + 1)} />;
}

function Panel({ onResumed }: { onResumed: () => void }) {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const s = useRunStream(id);
  const [brief, setBrief] = useState<Brief | null>(null);
  const [resuming, setResuming] = useState(false);
  const [resumeError, setResumeError] = useState<string | null>(null);

  const resume = () => {
    setResuming(true);
    setResumeError(null);
    resumeRun(id)
      .then(onResumed)
      .catch((e) => {
        setResuming(false);
        setResumeError(e instanceof ApiError ? e.message : "Couldn't reach the server. Try again in a moment.");
      });
  };

  useEffect(() => {
    getRun(id)
      .then((r) => (r.run.status === "confirming" ? router.replace(`/runs/${id}/confirm`) : setBrief(r.run.brief)))
      .catch(() => {}); // the stream reports a missing run as an error
  }, [id, router]);

  const look = panelLook(s.personas);
  const personas = look.ordered;
  const said = (p: Persona, round: number) => s.statements.find((x) => x.persona_id === p.id && x.round === round);
  const inRound2 = new Set(s.moderator?.persona_ids ?? []);
  const nameOf = (pid: number) => personas.find((p) => p.id === pid)?.name ?? "A panelist";
  const current = s.done ? STEPS.length + 1 : (s.step?.index ?? 0); // 1-based index of the running step
  const variantName = (k: string | null) => (k && brief && brief.variants.length > 1 ? brief.variants.find((v) => v.key === k)?.name : undefined);

  return (
    <div className="mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8">
      <RunSteps current={2} reached={s.done ? 3 : 2} />
      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end">
        <PageHead kicker="Step Three" title={s.done ? "The panel has spoken." : s.error ? "The panel stopped." : "The panel is talking."}>
          {brief ? <span className="line-clamp-2">“{brief.description}”</span> : "Six shoppers built from Qloo taste data react to your product."}
        </PageHead>
        <ol aria-label="Run progress" className="grid gap-1.5 text-sm">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const state = n < current ? "done" : n === current && !s.error ? "now" : "next";
            return (
              <li key={label} aria-current={state === "now" ? "step" : undefined} className={`flex items-center gap-2 ${state === "next" ? "text-faint" : ""}`}>
                <span
                  aria-hidden
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    state === "done" ? "border-text bg-mint" : state === "now" ? "border-text bg-sun motion-safe:animate-pulse" : "border-line-2"
                  }`}
                >
                  {state === "done" && <Check className="size-3" strokeWidth={3} />}
                </span>
                <span className={state === "now" ? "font-semibold" : ""}>{label}</span>
                {state === "done" && <span className="sr-only">(done)</span>}
              </li>
            );
          })}
        </ol>
      </div>

      <div aria-live="polite" className="mt-8 grid gap-4">
        {s.done && (
          <div className="sticker flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-mint px-6 py-5">
            <p className="text-lg">
              <span className="font-serif text-2xl">Your report is ready.</span>{" "}
              <span className="text-sub">Who to launch to, what puts people off, and what they&apos;d pay.</span>
            </p>
            <Link
              href={`/runs/${id}/report`}
              className="sticker inline-flex h-12 items-center gap-2 rounded-full bg-sun px-6 font-semibold transition-transform hover:-translate-y-0.5"
            >
              See the report <ArrowRight aria-hidden className="size-4" strokeWidth={2.25} />
            </Link>
          </div>
        )}
        {s.error && (
          <Notice tone="error">
            <p>
              <span className="font-semibold">The panel stopped: </span>
              {s.error}
            </p>
            <p className="mt-1 text-sub">Everything the panel already said is saved. Try again to pick up where it stopped.</p>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
              <button
                type="button"
                onClick={resume}
                disabled={resuming}
                className="sticker inline-flex h-10 items-center gap-2 rounded-full bg-sun px-5 font-semibold transition-transform hover:-translate-y-0.5 disabled:cursor-progress disabled:opacity-60"
              >
                <RotateCcw aria-hidden className={`size-4 ${resuming ? "motion-safe:animate-spin" : ""}`} strokeWidth={2.25} />
                {resuming ? "Picking up…" : "Try again"}
              </button>
              <Link href="/#brief" className="text-sm underline">
                or start a new brief
              </Link>
            </div>
            {resumeError && <p className="mt-2 text-sm font-semibold">{resumeError}</p>}
          </Notice>
        )}
        {s.reconnecting && !s.done && !s.error && <Notice>Lost the connection to the server. Reconnecting…</Notice>}
        {s.warnings.length > 0 && (
          <details className="rounded-2xl border-2 border-line-2 bg-raise px-4 py-3 text-sm">
            <summary className="flex cursor-pointer items-center gap-2 font-semibold">
              <TriangleAlert aria-hidden className="size-4 text-conditional" />
              {s.warnings.length} note{s.warnings.length > 1 ? "s" : ""} on the data
            </summary>
            <ul className="mt-2 grid gap-1 pl-6 text-sub">
              {s.warnings.map((w) => (
                <li key={w} className="list-disc">
                  {w}
                </li>
              ))}
            </ul>
          </details>
        )}
        {s.moderator && (
          <section aria-label="Moderator" className="flex gap-4 rounded-3xl border border-line-2 bg-lilac/60 p-5">
            <MessagesSquare aria-hidden className="mt-1 size-6 shrink-0" />
            <div>
              <p className="font-semibold">
                The moderator put {nameOf(s.moderator.persona_ids[0])} and {nameOf(s.moderator.persona_ids[1])} head to head on{" "}
                <span className="font-serif italic">{s.moderator.focus}</span>.
              </p>
              <ul className="mt-2 grid gap-1 text-sub">
                {s.moderator.questions.map((q) => (
                  <li key={q}>“{q}”</li>
                ))}
              </ul>
            </div>
          </section>
        )}
      </div>

      <ul className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {personas.map((p) => (
          <li key={p.id}>
            <PersonaCard
            p={p}
            fill={look.fill(p.id)}
            r1={said(p, 1)}
            r2={said(p, 2)}
            inRound2={inRound2.has(p.id)}
            variantName={variantName}
            waiting={!s.done && !s.error}
            rank={look.rank(p.id)}
            of={look.of}
            />
          </li>
        ))}
        {!s.error &&
          !s.done &&
          Array.from({ length: Math.max(0, 6 - personas.length) }, (_, i) => (
            <li key={`seat-${i}`} aria-hidden className="flex min-h-64 items-center justify-center rounded-3xl border-2 border-dashed border-line-2 font-hand text-2xl text-faint">
              {current >= 2 ? "taking a seat…" : "empty seat"}
            </li>
          ))}
      </ul>
    </div>
  );
}
