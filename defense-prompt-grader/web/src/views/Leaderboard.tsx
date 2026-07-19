import { useCallback, useEffect, useMemo, useState } from "react";
import type { Nav } from "../App";
import { api } from "../api";
import type { LeaderRow } from "../types";
import { fmt } from "../lib/format";
import { Empty, ErrorBlock, Loading, StatusPill } from "../ui";

type Filter = "all" | "done";

// 리더보드 점수 0~1 → 100점 환산 표시
const score100 = (x: number | null) => (x == null ? "—" : (x * 100).toFixed(1));

// 이름 마스킹: 가운데를 ○로. 2자 "이준"→"이○", 3자+ "홍길동"→"홍○동".
function mask(name: string): string {
  const s = [...name];
  if (s.length <= 1) return name;
  if (s.length === 2) return s[0] + "○";
  return s[0] + "○".repeat(s.length - 2) + s[s.length - 1];
}

// 참가자별 집계: 최고점 1건(대표) + 누적 제출 수 + 최종 제출 시각
interface Agg {
  rep: LeaderRow; // 대표(최고점) 제출 — 점수 없으면 최신 제출
  scored: boolean;
  count: number;
  lastAt: string;
}
function aggregate(rows: LeaderRow[]): Agg[] {
  const byName = new Map<string, LeaderRow[]>();
  for (const r of rows) {
    const arr = byName.get(r.name);
    if (arr) arr.push(r);
    else byName.set(r.name, [r]);
  }
  const out: Agg[] = [];
  for (const rs of byName.values()) {
    const done = rs.filter((r) => r.status === "done" && r.leaderboard_score != null);
    const rep = done.length
      ? done.reduce((a, b) => (b.leaderboard_score! > a.leaderboard_score! ? b : a))
      : rs.reduce((a, b) => (b.created_at > a.created_at ? b : a));
    const lastAt = rs.reduce((a, b) => (b.created_at > a.created_at ? b : a)).created_at;
    out.push({ rep, scored: done.length > 0, count: rs.length, lastAt });
  }
  return out;
}

const BUCKETS: [string, number, number][] = [
  ["~60", -Infinity, 60],
  ["60-70", 60, 70],
  ["70-80", 70, 80],
  ["80-90", 80, 90],
  ["90-100", 90, Infinity],
];
function bucketOf(score100val: number): number {
  return BUCKETS.findIndex(([, lo, hi]) => score100val >= lo && score100val < hi);
}

export function Leaderboard({ nav }: { nav: Nav }) {
  const [rows, setRows] = useState<LeaderRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [reveal, setReveal] = useState(false);
  const [showAffil, setShowAffil] = useState(true);
  const [myName, setMyName] = useState("");

  const load = useCallback(async () => {
    try {
      setRows(await api.leaderboard());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 3000);
    return () => window.clearInterval(t);
  }, [load]);

  // 베이스라인(P0–P3)은 출제위원 참조용 — 참가자 리더보드에서는 제외(측정은 CLI: make cli)
  const aggs = useMemo(() => (rows ? aggregate(rows.filter((r) => !r.is_baseline)) : []), [rows]);
  // 점수 있는 참가자를 점수 내림차순으로 순위 매김 (동점은 최초 제출 우선)
  const ranked = useMemo(
    () =>
      aggs.filter((a) => a.scored).sort((a, b) => {
        const d = b.rep.leaderboard_score! - a.rep.leaderboard_score!;
        return d !== 0 ? d : a.rep.created_at < b.rep.created_at ? -1 : 1;
      }),
    [aggs],
  );

  // 히스토그램 (점수 있는 참가자의 대표 점수 분포)
  const hist = useMemo(() => {
    const counts = BUCKETS.map(() => 0);
    for (const a of ranked) counts[bucketOf(a.rep.leaderboard_score! * 100)]++;
    return counts;
  }, [ranked]);

  // 내 위치
  const me = useMemo(() => {
    const q = myName.trim();
    if (!q) return null;
    const idx = ranked.findIndex((a) => a.rep.name === q);
    if (idx < 0) return null;
    const rank = idx + 1;
    const total = ranked.length;
    const pct = Math.round((rank / total) * 100);
    return { rank, total, pct, agg: ranked[idx] };
  }, [ranked, myName]);

  if (error && rows == null) return <ErrorBlock message={error} onRetry={load} />;
  if (rows == null) return <Loading />;

  const shown = aggs
    .filter((a) => (filter === "done" ? a.scored : true))
    .sort((a, b) => {
      if (a.scored !== b.scored) return a.scored ? -1 : 1;
      if (a.scored) return b.rep.leaderboard_score! - a.rep.leaderboard_score!;
      return a.rep.created_at < b.rep.created_at ? -1 : 1;
    });
  const rankOf = new Map(ranked.map((a, i) => [a.rep.name, i + 1]));
  const maxHist = Math.max(1, ...hist);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-ink">리더보드</h2>
        <p className="mt-0.5 text-xs text-sub">동일 참가자의 여러 제출 중 최고점이 자동으로 대표가 됩니다.</p>
      </div>

      {/* 내 위치 + 점수 분포 */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-ink">내 위치</span>
          <input
            value={myName}
            onChange={(e) => setMyName(e.target.value)}
            placeholder="내 이름 입력"
            className="inp h-8 w-40 py-1 text-xs"
          />
          {me && (
            <span className="text-xs text-sub">
              <b className="text-accent">{me.rank.toLocaleString()}등</b> · {me.total.toLocaleString()}명 중 · 상위 {me.pct}% ·{" "}
              <b className="text-ink tabular-nums">{score100(me.agg.rep.leaderboard_score)}점</b>
            </span>
          )}
          {myName.trim() && !me && <span className="text-xs text-muted">순위에 없음 (미채점 또는 이름 불일치)</span>}
        </div>
        <div className="mt-3 flex items-end gap-1.5">
          {BUCKETS.map(([label], i) => {
            const mine = me ? bucketOf(me.agg.rep.leaderboard_score! * 100) === i : false;
            return (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <span className="text-[10px] tabular-nums text-muted">{hist[i] || ""}</span>
                <div className="flex h-16 w-full items-end">
                  <div
                    className={`w-full rounded-t ${mine ? "bg-accent" : "bg-line"}`}
                    style={{ height: `${(hist[i] / maxHist) * 100}%`, minHeight: hist[i] ? 3 : 0 }}
                  />
                </div>
                <span className={`text-[10px] ${mine ? "font-bold text-accent" : "text-muted"}`}>{label}</span>
              </div>
            );
          })}
        </div>
        {me && <p className="mt-2 text-[11px] text-accent">▲ 내 점수 {score100(me.agg.rep.leaderboard_score)} — {BUCKETS[bucketOf(me.agg.rep.leaderboard_score! * 100)][0]} 구간 (상위 {me.pct}%)</p>}
      </div>

      {/* 필터 + 표시 토글 */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1">
          {(["all", "done"] as Filter[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-md px-2 py-1 text-xs font-medium ${filter === f ? "bg-accent-soft text-accent" : "text-muted"}`}
            >
              {f === "all" ? "전체" : "완료"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[11px] text-muted">
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> 이름 공개</label>
          <label className="flex items-center gap-1 cursor-pointer"><input type="checkbox" checked={showAffil} onChange={(e) => setShowAffil(e.target.checked)} /> 소속 공개</label>
        </div>
      </div>

      {error && <ErrorBlock message={error} />}

      {shown.length === 0 ? (
        <Empty>아직 제출이 없습니다. ‘제출’ 탭에서 첫 제출을 채점해 보세요.</Empty>
      ) : (
        <div className="card divide-y divide-line overflow-hidden">
          {shown.map((a) => {
            const r = a.rep;
            const rank = rankOf.get(r.name);
            const isMe = me != null && r.name === myName.trim();
            return (
              <div key={r.name} className={`px-3 py-2.5 ${isMe ? "bg-accent-soft/40" : ""}`}>
                <div className="flex cursor-pointer items-center gap-3" onClick={() => nav.go({ name: "detail", id: r.id })}>
                  <span className={`w-7 shrink-0 text-center text-sm font-bold tabular-nums ${rank && rank <= 3 ? "text-accent" : "text-muted"}`}>
                    {a.scored && rank ? rank : "·"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate font-semibold text-ink">{reveal ? r.name : mask(r.name)}</span>
                      {isMe && <span className="rounded bg-accent px-1 text-[10px] text-white">나</span>}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-2.5 text-[11px] text-muted">
                      {showAffil && r.affiliation && <span className="text-sub">{r.affiliation}</span>}
                      <span className="tabular-nums">F1 {fmt.f(r.macro_f1, 3)}</span>
                      <span className="tabular-nums">누적 {a.count}회</span>
                      <span className="tabular-nums">최종 {fmt.time(a.lastAt)}</span>
                      {!a.scored && <StatusPill status={r.status} />}
                    </div>
                  </div>
                  <span className="tabular-nums text-xl font-bold text-accent">{score100(r.leaderboard_score)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 순위 산정 기준 */}
      <div className="rounded-ctl border border-line bg-raise p-3 text-[11px] leading-6 text-muted">
        <div><b className="text-sub">리더보드 점수</b> = 결과값 유효성(예측 성능 Macro F1) + 프롬프트 효율성 · 참가자별 최고점 자동 선택</div>
        <div><b className="text-sub">토탈 점수</b> = 리더보드 점수 + 온라인 수강률 + 제출형식 준수 + 보안 적합성 (최종·수상, 별도 공지)</div>
        <div><b className="text-sub">동점</b> = 예측 성능 → Private → 최초 제출 (프롬프트 효율성 반영은 배점 확정 시)</div>
        <div><b className="text-sub">누적 제출</b> = 1일 3회 · 대회 기간 누적 제출 수 표시 · 점수는 100점 환산(원값 0~1)</div>
      </div>
    </div>
  );
}
