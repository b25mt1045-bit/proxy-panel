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
