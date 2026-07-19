import type { ReactNode } from "react";
import type { Confusion, Label, Pred, Status } from "./types";
import { CLASS_STYLE, predKo, predStyle } from "./lib/format";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`card p-4 ${className}`}>{children}</div>;
}

export function ClassBadge({ value }: { value: Pred | Label }) {
  const s = predStyle(value as Pred);
  return (
    <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${s.badge}`}>
      {predKo(value as Pred)}
    </span>
  );
}

const STATUS_KO: Record<Status, { label: string; cls: string }> = {
  pending: { label: "채점 대기", cls: "bg-line text-sub" },
  running: { label: "채점 중", cls: "bg-accent-soft text-accent animate-pulse" },
  done: { label: "채점 완료", cls: "bg-ok-soft text-ok-deep" },
  error: { label: "실패", cls: "bg-bad-soft text-bad" },
  cancelled: { label: "중단", cls: "bg-warn-soft text-warn" },
};

export function StatusPill({ status }: { status: Status }) {
  const s = STATUS_KO[status];
  return <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>;
}

export function Loading({ label = "불러오는 중…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="py-14 text-center text-sm text-muted">{children}</div>;
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-xl border border-bad/30 bg-bad-soft p-4 text-sm text-bad">
      <div className="break-anywhere">{message}</div>
      {onRetry && (
        <button onClick={onRetry} className="mt-2 rounded-md bg-card px-2 py-1 text-xs font-medium hover:brightness-95">
          다시 시도
        </button>
      )}
    </div>
  );
}

// 지표 바 (0~1)
export function MetricBar({ label, value, color = "var(--color-accent)" }: { label: string; value: number; color?: string }) {
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-sub">
        <span>{label}</span>
        <span className="tabular-nums font-medium text-ink">{value.toFixed(3)}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line">
        <div className="h-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

// 혼동행렬 히트맵 (라이트). labels = 해당 축의 정답 라벨 셋 (risk 3개 / cycle 4개)
export function ConfusionMatrix({ cm, labels }: { cm: Confusion; labels: Label[] }) {
  const max = Math.max(1, ...labels.flatMap((t) => Object.values(cm[t])));
  const cols: (Label | "__INVALID__")[] = [...labels, "__INVALID__"];
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-1 text-center text-sm">
        <thead>
          <tr className="text-xs text-muted">
            <th className="p-1 text-left font-normal">정답＼예측</th>
            {cols.map((c) => (
              <th key={c} className="p-1 font-normal">
                {c === "__INVALID__" ? "INVALID" : c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {labels.map((t) => (
            <tr key={t}>
              <td className="p-1 text-left text-xs text-sub">{t}</td>
              {cols.map((c) => {
                const v = cm[t][c];
                const diag = t === c;
                const intensity = v / max;
                return (
                  <td
                    key={c}
                    className="rounded-md p-2 font-medium tabular-nums"
                    style={{
                      color: v === 0 ? "var(--color-muted)" : diag ? "var(--color-ok-deep)" : c === "__INVALID__" ? "var(--color-sub)" : "var(--color-bad)",
                      backgroundColor: diag
                        ? `rgba(18,160,105,${0.06 + intensity * 0.28})`
                        : c === "__INVALID__"
                          ? `rgba(130,138,149,${0.05 + intensity * 0.2})`
                          : `rgba(216,58,72,${0.04 + intensity * 0.26})`,
                    }}
                  >
                    {v}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { CLASS_STYLE };
