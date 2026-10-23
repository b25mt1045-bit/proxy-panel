// Types mirror the backend JSON exactly (design §3–§9, §F). snake_case on purpose.

export const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Category = "beverage" | "personal_care" | "apparel" | "app" | "other";
export type Variant = { key: "A" | "B"; name: string; positioning?: string; price?: number | null;
  comparable_weights?: Record<string, number> | null };
export type Segment = { preset_id?: string | null; text?: string | null };
export type Brief = { description: string; category: Category; price: number; variants: Variant[];
  segments: Segment[]; market?: "US" };

export type Comparable = { id?: number; qloo_id: string; name: string; weight: number; price: number; resolved?: boolean };
export type Receipt = { label: string; qloo_id: string; entity_name: string; entity_type: string; lift: number };
export type StanceLabel = "enthusiast" | "conditional" | "skeptic";
export type Persona = { id: number; segment: number; segment_label: string; name: string; bio: string;
  top: Record<string, string[]>; receipts: Receipt[]; stance_scaled: number; stance_label: StanceLabel;
  price_lo: number; price_hi: number; price_weak: boolean };
export type Statement = { id: number; persona_id: number; round: number; text: string; receipt_labels: string[];
  preferred_variant: string | null; passed: boolean; flags: string[] };
export type Moderator = { persona_ids: number[]; focus: string; questions: string[] };
export type Progress = { step: string; message: string; index: number; total: number };

export type RunStatus = "confirming" | "running" | "done" | "failed";
export type RunView = {
  run: { id: string; status: RunStatus; mode: string; brief: Brief; created_at: string; parent_id: string | null;
    child_id: string | null };
  comparables: Comparable[]; personas: Persona[]; statements: Statement[]; moderator: Moderator | null; warnings: string[];
};
export type Created = { run_id: string; status: RunStatus; comparables: Comparable[]; dropped: string[]; warnings: string[] };

export type Report = {
  run_id: string; mode: string;
  verdict: { segment_index: number; segment_label: string; variant: string; tier: number;
    confidence: "strong" | "mixed" | "weak"; sentence: string };
  segments: { index: number; label: string; mean_stance: number; mean_scaled: number; price_fit_share: number;
    top_comparables: { name: string; lift: number }[] }[];
  objections: { text: string; persona_ids: number[]; statement_ids: number[];
    receipts: { persona_id: number; label: string; entity_name: string; lift: number }[] }[];
  price_bands: { concept_tier: number; personas: { persona_id: number; name: string; lo: number; hi: number;
    weak: boolean; fit: boolean }[] } | null;
  variants: { key: string; tier: number; by_segment: { index: number; mean_stance: number; price_fit_share: number;
    preferred_count: number }[] }[];
  love: Record<string, { name: string; lift: number }[]> | null;
  sensitivity: { robust: boolean; change: string } | null;
  interview: { recruit: string; markers: string[]; questions: string[] };
  grounding: { rate: number; passed: number; total: number; qloo_calls: number; qloo_cache_hits: number; warnings: string[] };
  disclaimer: string;
};
export type Presets = { presets: { id: string; label: string }[]; example_briefs: Brief[] };
export type Examples = { examples: { run_id: string; title: string; category: string; verdict_sentence: string | null;
  grounding_rate: number | null }[] };

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let r: Response;
  try {
    r = await fetch(API + path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(0, "network", "Can't reach the server. Is the backend running?");
  }
  if (!r.ok) {
    const e = await r.json().catch(() => null);
    throw new ApiError(r.status, e?.error?.code ?? "unknown", e?.error?.message ?? `Request failed (${r.status})`);
  }
  return r.json();
}

export const createRun = (b: Brief) => api<Created>("/runs", { method: "POST", body: JSON.stringify(b) });
export const putComparables = (id: string, comparables: Comparable[], variant_weights: Record<string, Record<string, number>>) =>
  api<{ run_id: string; status: RunStatus; stream_url: string }>(`/runs/${id}/comparables`,
    { method: "PUT", body: JSON.stringify({ comparables, variant_weights }) });
export const getRun = (id: string) => api<RunView>(`/runs/${id}`);
export const getReport = (id: string) => api<Report>(`/runs/${id}/report`);
export const getPresets = () => api<Presets>("/presets");
export const getExamples = () => api<Examples>("/examples");
export const searchQloo = (q: string) =>
  api<{ results: { qloo_id: string; name: string }[] }>(`/qloo/search?q=${encodeURIComponent(q)}`);

export const TIER_WORDS: Record<number, string> = { 1: "budget", 2: "mid", 3: "premium", 4: "luxury" };
export const money = (n: number) => `$${n.toFixed(2)}`;
