import type { Leaderboard, PreviewResult, Problem, SubmitResult } from './types'

async function get<T>(path: string): Promise<T> {
  const r = await fetch(path)
  if (!r.ok) throw new Error(`요청 실패 (${r.status})`)
  return r.json()
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!r.ok) {
    const j = await r.json().catch(() => null)
    throw new Error(j?.detail ?? `요청 실패 (${r.status})`)
  }
  return r.json()
}

export const api = {
  problem: () => get<Problem>('/api/problem'),
  preview: (instruction: string) => post<PreviewResult>('/api/preview', { instruction }),
  submit: (instruction: string, participant: string) =>
    post<SubmitResult>('/api/submit', { instruction, participant }),
  leaderboard: () => get<Leaderboard>('/api/leaderboard'),
}
