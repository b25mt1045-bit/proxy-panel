// Types mirror the backend JSON exactly (snake_case), see backend/app/models.py and main.py.

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Category = "beverage" | "personal_care" | "apparel" | "app" | "other";

export interface Variant {
  key: "A" | "B";
  name: string;
  positioning?: string;
  price?: number | null;
  comparable_weights?: Record<string, number> | null;
}

export interface Segment {
  preset_id?: string | null;
  text?: string | null;
}

export interface Brief {
  description: string;
  category: Category;
  price: number;
  variants: Variant[];
  segments: Segment[];
  market?: "US";
}

export interface Comparable {
  id: number;
  qloo_id: string;
  name: string;
  weight: number;
  price: number;
  resolved: boolean;
}

export interface CreateRunResponse {
  run_id: string;
  status: "confirming";
  comparables: Comparable[];
  dropped: string[];
  warnings: string[];
}

export interface Preset {
  id: string;
  label: string;
}

export interface PresetsResponse {
  presets: Preset[];
  sample_briefs: Brief[];
}

export interface Example {
  run_id: string;
  title: string;
  category: Category;
  verdict_sentence: string | null;
  grounding_rate: number | null;
}

export interface ExamplesResponse {
  examples: Example[];
  backtest: unknown[];
}

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: init?.body ? { "Content-Type": "application/json", ...init.headers } : init?.headers,
    });
  } catch {
    throw new ApiError(0, "network", "Can't reach the Proxy Panel server. Check your connection and try again.");
  }
  if (res.ok) return (await res.json()) as T;
  const body = await res.json().catch(() => null);
  throw new ApiError(res.status, body?.error?.code ?? "unknown", body?.error?.message ?? `Request failed (${res.status}).`);
}

export const createRun = (brief: Brief) =>
  api<CreateRunResponse>("/runs", { method: "POST", body: JSON.stringify(brief) });
export const getPresets = () => api<PresetsResponse>("/presets");
export const getExamples = () => api<ExamplesResponse>("/examples");

// Run pages: backend/app/main.py, pipeline.py (SSE events) and report.py.
export type RunStatus = "confirming" | "running" | "done" | "failed";
export type Stance = "enthusiast" | "conditional" | "skeptic";

export interface Receipt {
  label: string; // R1… for tastes, C1… for comparables
  qloo_id: string;
  entity_name: string;
  entity_type: string; // brand | artist | tv_show | podcast | comparable
  lift: number; // persona affinity minus the baseline's
}

export interface Persona {
  id: number;
  segment: number;
  segment_label: string;
  name: string;
  bio: string;
  top: Record<string, string[]>;
  receipts: Receipt[];
  stance_scaled: number;
  stance_label: Stance;
  price_lo: number; // tiers 1–4
  price_hi: number;
  price_weak: boolean;
}

export interface Statement {
  id: number;
  persona_id: number;
  round: number;
  text: string;
  receipt_labels: string[];
  preferred_variant: "A" | "B" | null;
  passed: boolean;
  flags: string[];
}

export interface Moderator {
  persona_ids: number[];
  focus: string;
  questions: string[];
}

export interface RunView {
  run: { id: string; status: RunStatus; mode: string; brief: Brief; created_at: string; parent_id: string | null; child_id: string | null };
  comparables: Comparable[];
  personas: Persona[];
  statements: Statement[];
  moderator: Moderator | null;
  warnings: string[];
}

export interface ComparableIn {
  qloo_id: string;
  name: string;
  weight: number;
  price: number;
}

export type NameLift = { name: string; lift: number };

export interface Report {
  run_id: string;
  mode: string;
  verdict: { segment_index: number; segment_label: string; variant: string; tier: number; confidence: "strong" | "mixed" | "weak"; sentence: string };
  segments: { index: number; label: string; mean_stance: number; mean_scaled: number; price_fit_share: number; top_comparables: NameLift[] }[];
  objections: {
    text: string;
    persona_ids: number[];
    statement_ids: number[];
    receipts: { persona_id: number; label: string; entity_name: string; lift: number }[];
  }[];
  price_bands: { concept_tier: number; personas: { persona_id: number; name: string; lo: number; hi: number; weak: boolean; fit: boolean }[] };
  variants: { key: string; tier: number; by_segment: { index: number; mean_stance: number; price_fit_share: number; preferred_count: number }[] }[];
  love: Record<string, NameLift[]>;
  sensitivity: { robust: boolean; change: string };
  interview: { recruit: string; markers: string[]; questions: string[] };
  grounding: { rate: number; passed: number; total: number; qloo_calls: number; qloo_cache_hits: number; warnings: string[] };
  disclaimer: string;
}

export const getRun = (id: string) => api<RunView>(`/runs/${id}`);
export const putComparables = (id: string, comparables: ComparableIn[], variant_weights: Record<string, Record<string, number>> = {}) =>
  api<{ run_id: string; status: "running"; stream_url: string }>(`/runs/${id}/comparables`, {
    method: "PUT",
    body: JSON.stringify({ comparables, variant_weights }),
  });
export const getReport = (id: string) => api<Report>(`/runs/${id}/report`);
export const searchQloo = (q: string) =>
  api<{ results: { qloo_id: string; name: string }[] }>(`/qloo/search?q=${encodeURIComponent(q)}`);
