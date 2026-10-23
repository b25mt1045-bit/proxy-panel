"use client";
import { useEffect, useState } from "react";
import { API, Moderator, Persona, Progress, Statement } from "./api";

export type StreamState = {
  steps: Progress[]; personas: Persona[]; statements: Statement[]; moderator: Moderator | null;
  warnings: string[]; done: { report_url: string; grounding_rate: number } | null; error: string | null;
};

const EMPTY: StreamState = { steps: [], personas: [], statements: [], moderator: null, warnings: [], done: null, error: null };

const upsert = <T extends { id: number }>(xs: T[], x: T) => [...xs.filter((y) => y.id !== x.id), x];

export function useRunStream(id: string): StreamState {
  const [s, set] = useState<StreamState>(EMPTY);

  useEffect(() => {
    set(EMPTY);
    // EventSource reconnects by itself with Last-Event-ID and the server replays from there; keying by id dedupes.
    const es = new EventSource(`${API}/runs/${id}/stream`);
    const on = <T,>(type: string, f: (d: T, prev: StreamState) => Partial<StreamState>) =>
      es.addEventListener(type, (e) => {
        const d = JSON.parse((e as MessageEvent).data) as T;
        set((prev) => ({ ...prev, ...f(d, prev) }));
      });
    on<Progress>("progress", (d, p) => ({ steps: [...p.steps.filter((x) => x.step !== d.step), d] }));
    on<Persona>("persona", (d, p) => ({ personas: upsert(p.personas, d) }));
    on<Statement>("statement", (d, p) => ({ statements: upsert(p.statements, d) }));
    on<Moderator>("moderator", (d) => ({ moderator: d }));
    on<{ message: string }>("warning", (d, p) => ({ warnings: [...p.warnings, d.message] }));
    on<StreamState["done"]>("done", (d) => { es.close(); return { done: d }; });
    // "error" is both the server's event and EventSource's own network error; only the former carries data.
    es.addEventListener("error", (e) => {
      const data = (e as MessageEvent).data;
      if (data) {
        es.close();
        set((prev) => ({ ...prev, error: JSON.parse(data).message }));
      } else if (es.readyState === EventSource.CLOSED) {
        set((prev) => ({ ...prev, error: prev.error ?? "Lost the connection to the server." }));
      }
    });
    return () => es.close();
  }, [id]);

  return s;
}
