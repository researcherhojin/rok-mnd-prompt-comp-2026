import type { Label, Pred } from "../types";

// risk/cycle 라벨은 알파벳이 겹치지 않아 단일 조회 맵으로 표시·색상 처리 가능.
// 표시는 라벨 문자열 그대로 (risk: HIGH/MEDIUM/LOW, cycle: 0-30/31-90/91-180/181+).
export function predKo(p: Pred): string {
  if (p === "__INVALID__") return "INVALID";
  if (p === "ERROR") return "ERROR";
  return p;
}

// 클래스 색상 (Toss soft 팔레트). 짧은 주기·높은 위험일수록 적색 방향.
// risk: HIGH=적, MEDIUM=호박, LOW=녹 / cycle: 0-30=적, 31-90=호박, 91-180=남색, 181+=녹
export const CLASS_STYLE: Record<Label | "INVALID", { badge: string; bar: string }> = {
  HIGH: { badge: "bg-bad-soft text-bad", bar: "var(--color-bad)" },
  MEDIUM: { badge: "bg-warn-soft text-warn", bar: "var(--color-warn)" },
  LOW: { badge: "bg-ok-soft text-ok-deep", bar: "var(--color-ok)" },
  "0-30": { badge: "bg-bad-soft text-bad", bar: "var(--color-bad)" },
  "31-90": { badge: "bg-warn-soft text-warn", bar: "var(--color-warn)" },
  "91-180": { badge: "bg-accent-soft text-accent", bar: "var(--color-accent)" },
  "181+": { badge: "bg-ok-soft text-ok-deep", bar: "var(--color-ok)" },
  INVALID: { badge: "bg-line text-muted", bar: "var(--color-muted)" },
};

export function predStyle(p: Pred) {
  if (p === "__INVALID__" || p === "ERROR") return CLASS_STYLE.INVALID;
  return CLASS_STYLE[p];
}

export const fmt = {
  pct: (x: number | null | undefined, d = 1) => (x == null ? "—" : `${(x * 100).toFixed(d)}%`),
  f: (x: number | null | undefined, d = 4) => (x == null ? "—" : x.toFixed(d)),
  int: (x: number | null | undefined) => (x == null ? "—" : String(x)),
  time: (iso: string) => {
    const dt = new Date(iso);
    return dt.toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  },
};
