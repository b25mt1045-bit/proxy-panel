"use client";

import { useEffect, useState } from "react";

import { API_URL, ApiError, getRun, type Moderator, type Persona, type Statement } from "@/lib/api";

export interface RunStream {
  step: { index: number; message: string } | null;
  personas: Persona[];
  statements: Statement[];
  moderator: Moderator | null;
  warnings: string[];
  done: boolean;
  error: string | null;
  reconnecting: boolean;
}

const START: RunStream = { step: null, personas: [], statements: [], moderator: null, warnings: [], done: false, error: null, reconnecting: false };

/** Live run events. The server replays stored events first, so this also rebuilds a finished run. */
export function useRunStream(id: string): RunStream {
  const [s, setS] = useState<RunStream>(START);

  useEffect(() => {
    const es = new EventSource(`${API_URL}/runs/${id}/stream`);
    const on = <T,>(type: string, apply: (prev: RunStream, data: T) => RunStream) =>
      es.addEventListener(type, (e) => {
        const raw = (e as MessageEvent).data;
        if (raw === undefined) return; // a connection error, not the server's `error` event
        setS((prev) => apply(prev, JSON.parse(raw)));
      });

    on<{ index: number; message: string }>("progress", (p, d) => ({ ...p, step: d }));
    // Keyed by id: a reconnect replays from Last-Event-ID, but a dedupe costs nothing.
    on<Persona>("persona", (p, d) => ({ ...p, personas: [...p.personas.filter((x) => x.id !== d.id), d] }));
    on<Statement>("statement", (p, d) => ({ ...p, statements: [...p.statements.filter((x) => x.id !== d.id), d] }));
    on<Moderator>("moderator", (p, d) => ({ ...p, moderator: d }));
    on<{ message: string }>("warning", (p, d) => (p.warnings.includes(d.message) ? p : { ...p, warnings: [...p.warnings, d.message] }));
    on<unknown>("done", (p) => {
      es.close();
      return { ...p, done: true };
    });
    on<{ message: string }>("error", (p, d) => {
      es.close();
      return { ...p, error: d.message || "The run stopped." };
    });
    // A dropped connection reconnects by itself. But a run that failed without an `error` event (server restart)
    // ends the stream with nothing to replay, so ask the run itself before EventSource retries forever.
    es.onerror = () => {
      getRun(id)
        .then((r) => {
          if (r.run.status === "failed") {
            es.close();
            setS((p) => ({ ...p, error: p.error ?? r.warnings.at(-1) ?? "The run stopped." }));
          } else if (r.run.status === "done") {
            es.close();
            setS((p) => ({ ...p, done: true }));
          }
        })
        .catch((e) => {
          if (!(e instanceof ApiError) || e.status !== 404) return setS((p) => ({ ...p, reconnecting: true })); // EventSource keeps retrying
          es.close();
          setS((p) => ({ ...p, error: "We couldn't find this run." }));
        });
    };
    es.onopen = () => setS((p) => (p.reconnecting ? { ...p, reconnecting: false } : p));
    return () => es.close();
  }, [id]);

  return s;
}
