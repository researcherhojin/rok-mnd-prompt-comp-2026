import type { LeaderRow, ProgressResponse, Split, Submission } from "./types";

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  if (!resp.ok) {
    let detail = `HTTP ${resp.status}`;
    try {
      const body = await resp.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* 본문 없음 */
    }
    throw new Error(detail);
  }
  return resp.json() as Promise<T>;
}

export interface SubmitBody {
  name: string;
  affiliation?: string | null;
  prompt: string;
  split: Split;
  runs: number;
  model?: string | null;
}

export interface ScoringConfig {
  model: string;
  temperature: number;
  char_cap: number;
}

export const api = {
  config: () => req<ScoringConfig>("/api/config"),
  submit: (body: SubmitBody) =>
    req<{ id: number; status: string }>("/api/submit", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  leaderboard: () => req<LeaderRow[]>("/api/submissions"),
  baselines: () => req<{ name: string; prompt: string; chars: number }[]>("/api/baselines"),
  detail: (id: number) => req<Submission>(`/api/submissions/${id}`),
  progress: (id: number) => req<ProgressResponse>(`/api/submissions/${id}/progress`),
  run: (id: number) =>
    req<{ id: number; status: string }>(`/api/submissions/${id}/run`, { method: "POST" }),
  cancel: (id: number) =>
    req<{ id: number; status: string }>(`/api/submissions/${id}/cancel`, { method: "POST" }),
  registerBaselines: () =>
    req<{ registered: { id: number; name: string }[] }>("/api/baselines/register", {
      method: "POST",
    }),
};
