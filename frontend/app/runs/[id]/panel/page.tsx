"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PersonaCard, ProgressSteps } from "@/components/panel";
import { Bar, btn, Card, Notice } from "@/components/ui";
import { ApiError, Brief, getRun } from "@/lib/api";
import { useRunStream } from "@/lib/useRunStream";

export default function Panel() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [live, setLive] = useState(false); // auto-open the report only when we watched the run finish
  const s = useRunStream(id);

  useEffect(() => {
    getRun(id).then((r) => {
      if (r.run.status === "confirming") router.replace(`/runs/${id}/confirm`);
      else { setBrief(r.run.brief); setLive(r.run.status === "running"); }
    }, (e: ApiError) => setLoadError(e.status === 404 ? "Run not found." : e.message));
  }, [id, router]);

  useEffect(() => {
    if (!s.done || !live) return;
    const t = setTimeout(() => router.push(`/runs/${id}/report`), 2000);
    return () => clearTimeout(t);
  }, [s.done, live, id, router]);

  if (loadError) return <Notice tone="negative">{loadError}</Notice>;
  const names = Object.fromEntries((brief?.variants ?? []).map((v) => [v.key, v.name]));
  const current = s.steps.at(-1);
  const byPersona = (pid: number) => s.statements.filter((x) => x.persona_id === pid).sort((a, b) => a.round - b.round || a.id - b.id);
  const probed = new Set(s.moderator?.persona_ids ?? []);
  const nameOf = (pid: number) => s.personas.find((p) => p.id === pid)?.name ?? "a panelist";

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.01em]">
            {brief ? `Panel on ${brief.variants.map((v) => v.name).join(" vs. ")}` : <Bar w="w-72" h="h-8" />}
          </h1>
          <p className="mt-1 text-muted" aria-live="polite">
            {s.error ? "The panel stopped." : s.done ? `Done. ${Math.round(s.done.grounding_rate * 100)}% of statements cite real receipts.${live ? " Opening the report…" : ""}`
              : current?.message ?? "Connecting…"}
          </p>
        </div>
        {s.done && <Link href={`/runs/${id}/report`} className={btn.primary}>See the report</Link>}
      </div>

      <div className="mt-5 rounded-lg border border-border bg-surface px-5 py-3.5">
        <ProgressSteps steps={s.steps} done={!!s.done} />
      </div>

      <div className="mt-3 space-y-3">
        {s.error && (
          <Notice tone="negative" action={<Link href="/" className={btn.text}>Start over</Link>}>{s.error}</Notice>
        )}
        {s.warnings.length > 0 && <Notice>{s.warnings.join(" ")}</Notice>}

        {s.moderator && (
          <Card title="Moderator" aside={`Probing ${s.moderator.persona_ids.map(nameOf).join(" and ")}`}>
            <p className="font-medium">{s.moderator.focus}</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
              {s.moderator.questions.map((q) => <li key={q}>{q}</li>)}
            </ul>
          </Card>
        )}

        {s.personas.length ? (
          <div className="grid items-start gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[...s.personas].sort((a, b) => a.segment - b.segment || a.id - b.id).map((p) => (
              <PersonaCard key={p.id} p={p} statements={byPersona(p.id)} variantNames={names} highlight={probed.has(p.id)} />
            ))}
          </div>
        ) : !s.error && (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" aria-busy="true" aria-label="Building personas">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-3 rounded-lg border border-border bg-surface p-5">
                <div className="flex gap-3"><Bar w="w-9" h="h-9" /><div className="space-y-1.5"><Bar w="w-28" /><Bar w="w-40" h="h-3" /></div></div>
                <Bar w="w-full" h="h-10" /><Bar w="w-full" h="h-2" />
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
