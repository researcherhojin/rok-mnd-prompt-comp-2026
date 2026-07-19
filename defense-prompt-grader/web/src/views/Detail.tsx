import { useCallback, useEffect, useState } from "react";
import type { Nav } from "../App";
import { api } from "../api";
import type { AxisScore, RowResult, Submission } from "../types";
import { CYCLE_LABELS, RISK_LABELS } from "../types";
import { fmt, predStyle } from "../lib/format";
import { Card, ClassBadge, ConfusionMatrix, Empty, ErrorBlock, Loading, MetricBar, StatusPill } from "../ui";

type RowFilter = "wrong" | "invalid" | "all";
const score100 = (x: number) => (x * 100).toFixed(1);

export function Detail({ id, nav }: { id: number; nav: Nav }) {
  const [sub, setSub] = useState<Submission | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rowFilter, setRowFilter] = useState<RowFilter>("wrong");
  const [showPrompt, setShowPrompt] = useState(false);

  const load = useCallback(async () => {
    try {
      setSub(await api.detail(id));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (sub && (sub.status === "running" || sub.status === "pending")) {
      const t = window.setInterval(load, 1500);
      return () => window.clearInterval(t);
    }
  }, [sub, load]);

  if (error && sub == null) return <ErrorBlock message={error} onRetry={load} />;
  if (sub == null) return <Loading />;

  const r = sub.result;

  return (
    <div className="space-y-4">
      <button onClick={() => nav.go({ name: "leaderboard" })} className="text-xs text-muted hover:text-sub">
        ← 리더보드
      </button>

      <Card>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-base font-bold text-ink">{sub.name}</span>
              <StatusPill status={sub.status} />
            </div>
            <div className="mt-0.5 text-xs text-muted">
              {sub.split} · {sub.model} · {sub.runs}회 · {sub.prompt_len}자 · {fmt.time(sub.created_at)}
            </div>
          </div>
          {r && (
            <div className="text-right">
              <div className="tabular-nums text-2xl font-bold text-accent">{score100(r.leaderboard_score)}</div>
              <div className="text-[10px] text-muted">제출 점수</div>
            </div>
          )}
        </div>
      </Card>

      {sub.status === "error" && <ErrorBlock message={sub.error_msg ?? "채점 오류"} />}
      {(sub.status === "running" || sub.status === "pending") && (
        <Card>
          <Loading label="채점 진행 중… (자동 갱신)" />
        </Card>
      )}

      {r && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <Metric title="Macro F1 (결합)" value={fmt.f(r.macro_f1_mean, 4)} sub={`risk ${fmt.f(r.primary.risk.macro_f1, 3)} · cycle ${fmt.f(r.primary.cycle.macro_f1, 3)}`} />
            <Metric title="완전일치" value={`${r.primary.exact_match_count}/${r.primary.n}`} sub="두 축 모두 정답 (≠F1)" />
          </div>

          <AxisCard title="risk_grade" axis={r.primary.risk} labels={RISK_LABELS} />
          <AxisCard title="cycle_range" axis={r.primary.cycle} labels={CYCLE_LABELS} />

          {r.runs_agg && (
            <Card>
              <h3 className="mb-2 text-xs font-semibold text-sub">실행 간 변동성 ({r.runs_agg.n_runs}회)</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="tabular-nums text-sub">
                  F1 std <span className="font-medium text-ink">{r.runs_agg.macro_f1_std.toFixed(4)}</span>
                </div>
                <div className="tabular-nums text-sub">
                  판정 불일치율 <span className="font-medium text-ink">{fmt.pct(r.runs_agg.disagreement_rate)}</span>
                </div>
              </div>
            </Card>
          )}

          <RowInspector rows={r.rows} filter={rowFilter} setFilter={setRowFilter} />
        </>
      )}

      <Card>
        <button onClick={() => setShowPrompt((v) => !v)} className="flex w-full items-center justify-between text-xs font-semibold text-sub">
          <span>제출 프롬프트</span>
          <span>{showPrompt ? "접기 ▲" : "펼치기 ▼"}</span>
        </button>
        {showPrompt && (
          <pre className="mono mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-anywhere rounded-ctl bg-raise p-3 text-xs text-sub">
            {sub.prompt}
          </pre>
        )}
      </Card>
    </div>
  );
}

function Metric({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <Card className="text-center">
      <div className="tabular-nums text-lg font-bold text-ink">{value}</div>
      <div className="text-[10px] text-muted">{title}</div>
      {sub && <div className="text-[10px] text-muted">{sub}</div>}
    </Card>
  );
}

// 단일 축(risk 또는 cycle) 카드: 클래스별 F1 + 혼동행렬
function AxisCard({ title, axis, labels }: { title: string; axis: AxisScore; labels: string[] }) {
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-sub">
          {title} <span className="text-muted">· Macro F1 {axis.macro_f1.toFixed(4)}</span>
        </h3>
      </div>
      <div className="space-y-3">
        {labels.map((lbl) => {
          const pc = axis.per_class[lbl];
          return (
            <div key={lbl}>
              <div className="mb-1 flex items-center gap-2">
                <ClassBadge value={lbl as never} />
                <span className="text-xs tabular-nums text-sub">
                  P {pc.precision.toFixed(3)} · R {pc.recall.toFixed(3)}
                </span>
              </div>
              <MetricBar label="F1" value={pc.f1} color={predStyle(lbl as never).bar} />
            </div>
          );
        })}
      </div>
      <div className="mt-3">
        <ConfusionMatrix cm={axis.confusion} labels={labels as never} />
      </div>
    </Card>
  );
}

function RowInspector({ rows, filter, setFilter }: { rows: RowResult[]; filter: RowFilter; setFilter: (f: RowFilter) => void }) {
  const isInvalid = (r: RowResult) =>
    r.pred_risk === "__INVALID__" || r.pred_risk === "ERROR" || r.pred_cycle === "__INVALID__" || r.pred_cycle === "ERROR";
  const shown = rows.filter((r) => (filter === "wrong" ? !r.correct : filter === "invalid" ? isInvalid(r) : true));
  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold text-sub">행별 결과</h3>
        <div className="flex gap-1">
          {(["wrong", "invalid", "all"] as RowFilter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded px-1.5 py-0.5 text-[11px] ${filter === f ? "bg-accent-soft text-accent" : "text-muted"}`}
            >
              {f === "wrong" ? "오답" : f === "invalid" ? "INVALID" : "전체"}
            </button>
          ))}
        </div>
      </div>
      {shown.length === 0 ? (
        <Empty>해당 행 없음</Empty>
      ) : (
        <div className="max-h-96 space-y-1 overflow-auto">
          {shown.slice(0, 200).map((r) => (
            <div key={r.id} className="rounded-ctl bg-raise p-2.5 text-xs">
              <div className="mb-1.5 flex items-center gap-2">
                <span className="mono text-[11px] font-semibold text-sub">#{r.id}</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-9 shrink-0 text-[11px] font-medium text-muted">정답</span>
                  <ClassBadge value={r.true_risk} />
                  <ClassBadge value={r.true_cycle} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-9 shrink-0 text-[11px] font-medium text-muted">예측</span>
                  <ClassBadge value={r.pred_risk} />
                  <ClassBadge value={r.pred_cycle} />
                </div>
              </div>
              {r.raw != null && (
                <div className="mono mt-1.5 break-anywhere text-[11px] text-muted">원문: {r.raw}</div>
              )}
            </div>
          ))}
          {shown.length > 200 && <div className="py-2 text-center text-[11px] text-muted">…상위 200행만 표시</div>}
        </div>
      )}
    </Card>
  );
}
