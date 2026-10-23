"use client";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Interview, Love, Objections, PanelLine, PriceBands, Variants, VerdictHead } from "@/components/report";
import { Bar, btn, Notice } from "@/components/ui";
import { ApiError, getReport, getRun, Report, RunView } from "@/lib/api";

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [run, setRun] = useState<RunView | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getRun(id).then((r) => {
      setRun(r);
      if (r.run.status === "confirming") return router.replace(`/runs/${id}/confirm`);
      if (r.run.status === "running") return router.replace(`/runs/${id}/panel`);
      if (r.run.status === "failed") return setError(`This panel failed${r.warnings.length ? `: ${r.warnings.join(" ")}` : "."}`);
      getReport(id).then(setReport, (e: ApiError) => setError(e.message));
    }, (e: ApiError) => setError(e.status === 404 ? "Run not found." : e.message));
  }, [id, router]);

  if (error) return <Notice tone="negative" action={<Link href="/" className={btn.text}>New brief</Link>}>{error}</Notice>;
  if (!report || !run) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="Loading the report">
        <div className="space-y-3 rounded-lg border border-border bg-surface p-5"><Bar w="w-64" /><Bar w="w-full max-w-[720px]" h="h-8" /><Bar w="w-96" /></div>
        <div className="grid gap-3 lg:grid-cols-2"><Bar w="w-full" h="h-64" /><Bar w="w-full" h="h-64" /></div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <VerdictHead report={report} variantName={run.run.brief.variants.find((v) => v.key === report.verdict.variant)?.name ?? report.verdict.variant} />
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <PanelLine report={report} personas={run.personas} />
        <PriceBands report={report} />
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Objections report={report} personas={run.personas} />
        <Love report={report} />
      </div>
      <div className="grid items-start gap-3 lg:grid-cols-2">
        <Interview report={report} />
        <Variants report={report} />
      </div>
      <p className="text-[13px]">
        <Link href={`/runs/${id}/panel`} className={btn.text}>Read the full panel transcript</Link>
      </p>
    </div>
  );
}
