"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import BriefForm from "@/components/BriefForm";
import { Bar, Card, Notice } from "@/components/ui";
import { ApiError, Brief, Examples, getExamples, getPresets, money, Presets } from "@/lib/api";

const CAT: Record<string, string> = { beverage: "Beverage", personal_care: "Personal care", apparel: "Apparel", app: "Consumer app", other: "Other" };

export default function Home() {
  const [presets, setPresets] = useState<Presets | null>(null);
  const [examples, setExamples] = useState<Examples["examples"]>([]);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<Brief | null>(null);

  useEffect(() => {
    getPresets().then(setPresets, (e: ApiError) => setError(e.message));
    getExamples().then((r) => setExamples(r.examples), () => {});
  }, []);

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-[-0.01em]">New focus group</h1>
      <p className="mt-1 max-w-[640px] text-muted">
        Six panelists built from Qloo taste data react to your brief, cite the brands behind each opinion, and
        tell you which segment to launch to and at what price.
      </p>

      <div className="mt-6 grid items-start gap-3 lg:grid-cols-[1fr_340px]">
        <Card>
          {error ? <Notice tone="negative">{error}</Notice>
            : presets ? <BriefForm presets={presets.presets} example={picked} />
            : <div className="space-y-5" aria-busy="true"><Bar w="w-full" h="h-[86px]" /><Bar w="w-full" h="h-10" /><Bar w="w-full" h="h-10" /></div>}
        </Card>

        <div className="space-y-3">
          <Card title="Start from an example">
            {presets ? (
              <ul className="-mx-2">
                {presets.example_briefs.map((b) => (
                  <li key={b.variants[0].name}>
                    <button type="button" onClick={() => setPicked({ ...b })}
                            className="w-full rounded-md px-2 py-2.5 text-left transition-colors hover:bg-ground focus-visible:bg-ground">
                      <span className="flex justify-between gap-2">
                        <span className="font-medium">{b.variants[0].name}</span>
                        <span className="num text-muted">{money(b.price)}</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-muted">{CAT[b.category]} · {b.segments.length} segments</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : <Bar w="w-full" h="h-32" />}
            <p className="mt-2 text-xs text-muted">Fills the form; you can edit it before running.</p>
          </Card>

          <Card title="Finished panels">
            {examples.length ? (
              <ul className="space-y-3">
                {examples.map((x) => (
                  <li key={x.run_id}>
                    <Link href={`/runs/${x.run_id}/report`} className="font-medium hover:underline">{x.title}</Link>
                    <p className="text-xs text-muted">{x.verdict_sentence ?? "Report ready"}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="rounded-md border border-dashed border-control px-3 py-2.5 text-[13px] text-muted">
                No finished example panels yet. Run one from the examples above.
              </p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
