import { useEffect, useRef, useState } from "react";
import type { Nav } from "../App";
import { api, type ScoringConfig } from "../api";
import { CHAR_HARDCAP, SPLIT_ROWS, type LeaderRow, type Progress, type Split, type Status } from "../types";
import { fmt } from "../lib/format";
import { Card, ErrorBlock, StatusPill } from "../ui";

const ACTIVE_KEY = "dpg.activeSubmission"; // 세션 지속: 콘솔 닫아도 재개
const START_KEY = "dpg.activeStartedAt"; // 진행 경과 시간 계산용 시작 시각

// ETA 추정용 상수 (grader/config.py가 정본 · 여기선 표시 추정치)
const EST_CONCURRENCY = 8; // 서버 MAX_CONCURRENCY 기본값
const EST_SEC_PER_CALL = 0.8; // 셀당 대략 소요 시간(초)

// 초 → "12초" / "1분 5초"
function fmtDur(s: number): string {
  const t = Math.max(0, Math.round(s));
  return t < 60 ? `${t}초` : `${Math.floor(t / 60)}분 ${t % 60}초`;
}
// 채점 모델·파라미터는 서버 설정(.env의 LLM_MODEL)에서 /api/config로 받아 표시한다.
// (주최측 고정 · 참가자가 바꿀 수 없음. seed는 서버에서 42로 고정하되 비노출.)

const SPLITS: { key: Split; label: string; note: string }[] = [
  { key: "sample", label: "샘플", note: "10행 · 연습" },
  { key: "public", label: "Public", note: "300행" },
  { key: "private", label: "Private", note: "700행" },
];

export function Submit({ nav }: { nav: Nav }) {
  const [name, setName] = useState("");
  const [affiliation, setAffiliation] = useState("");
  const [prompt, setPrompt] = useState("");
  const [split, setSplit] = useState<Split>("public");
  const [error, setError] = useState<string | null>(null);
  const [baselines, setBaselines] = useState<{ name: string; prompt: string }[]>([]);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mySubs, setMySubs] = useState<LeaderRow[]>([]);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());
  const [scoring, setScoring] = useState<ScoringConfig | null>(null);
  const timer = useRef<number | null>(null);

  function loadMySubs(who: string) {
    const q = who.trim();
    if (!q) { setMySubs([]); return; }
    api
      .leaderboard()
      .then((rows) => setMySubs(rows.filter((r) => r.name === q).sort((a, b) => b.id - a.id)))
      .catch(() => setMySubs([]));
  }

  const len = prompt.length;
  const over = len > CHAR_HARDCAP;
  const efficiency = Math.max(0, (CHAR_HARDCAP - len) / CHAR_HARDCAP);
  const calls = SPLIT_ROWS[split];
  const estSec = Math.ceil((calls / EST_CONCURRENCY) * EST_SEC_PER_CALL);

  function startPolling(id: number) {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = window.setInterval(async () => {
      try {
        const p = await api.progress(id);
        setStatus(p.status);
        setProgress(p.progress);
        setErrorMsg(p.error_msg ?? null);
        if (["done", "error", "cancelled"].includes(p.status)) {
          if (timer.current) window.clearInterval(timer.current);
          localStorage.removeItem(ACTIVE_KEY);
          localStorage.removeItem(START_KEY);
          loadMySubs(name);
        }
      } catch {
        /* 다음 tick 재시도 */
      }
    }, 1000);
  }

  useEffect(() => {
    api.baselines().then(setBaselines).catch(() => setBaselines([]));
    api.config().then(setScoring).catch(() => setScoring(null));
    const saved = localStorage.getItem(ACTIVE_KEY);
    if (saved) {
      const id = Number(saved);
      const savedStart = localStorage.getItem(START_KEY);
      setStartedAt(savedStart ? Number(savedStart) : Date.now());
      setActiveId(id);
      setStatus("running");
      startPolling(id);
    }
    return () => {
      if (timer.current) window.clearInterval(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 채점 중일 때 1초마다 경과 시간 갱신
  useEffect(() => {
    if (status !== "running") return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [status]);

  async function onSubmit() {
    setError(null);
    try {
      const { id } = await api.submit({ name: name.trim(), affiliation: affiliation.trim() || null, prompt, split, runs: 1 });
      const t = Date.now();
      localStorage.setItem(ACTIVE_KEY, String(id));
      localStorage.setItem(START_KEY, String(t));
      setStartedAt(t);
      setNow(t);
      setActiveId(id);
      setStatus("running");
      setProgress(null);
      setErrorMsg(null);
      startPolling(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  async function onCancel() {
    if (activeId == null) return;
    try {
      await api.cancel(activeId);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  const running = status === "running";
  const elapsedSec = startedAt != null ? (now - startedAt) / 1000 : 0;
  const etaSec =
    progress && progress.done > 0 && progress.total
      ? (elapsedSec * (progress.total - progress.done)) / progress.done
      : null;
  const disabledReason = !name.trim()
    ? "제출자 이름을 입력하세요"
    : len === 0
      ? "행동 지침을 입력하세요"
      : over
        ? `${CHAR_HARDCAP.toLocaleString()}자를 초과했습니다 — 줄여주세요`
        : null;
  const canSubmit = disabledReason == null && !running;
  const lines = prompt.split("\n").length;

  return (
    <div className="space-y-4">
      {error && <ErrorBlock message={error} />}

      {/* 제출 형식 · 규칙 안내 (Kaggle Submission File 패턴) */}
      <div className="card p-4">
        <div className="text-sm font-bold text-ink">무엇을 제출하나요</div>
        <p className="mt-1 text-xs leading-6 text-sub">
          예측 파일이 아니라 <b className="text-ink">행동 지침(시스템 프롬프트) 1개</b>를 제출합니다. 채점 시스템이 이 지침을 숨겨진 정비
          이력에 적용해 LLM을 재실행하고, 모델이 각 행에 대해 아래 형식으로 답하도록 유도해야 합니다.
        </p>
        <pre className="mono mt-2 overflow-x-auto rounded-ctl border border-line bg-raise p-3 text-xs leading-6 text-sub">{`행마다 한 줄:  risk_grade, cycle_range
예)  HIGH, 0-30
     MEDIUM, 31-90
     LOW, 181+`}</pre>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted">
          <span>• 허용 <b className="text-sub">HIGH·MEDIUM·LOW</b> / <b className="text-sub">0-30·31-90·91-180·181+</b></span>
          <span>• 지침 <b className="text-sub">{CHAR_HARDCAP.toLocaleString()}자</b> 이내</span>
          <span>• 채점 <b className="text-sub">risk·cycle Macro F1 평균</b></span>
          <span>• 리더보드 <b className="text-sub">Public 300</b> · 최종 <b className="text-sub">Private 700</b></span>
        </div>
      </div>

      <Card className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="제출자 이름">
            <input value={name} onChange={(e) => { setName(e.target.value); loadMySubs(e.target.value); }} placeholder="예: 홍길동" maxLength={100} className="inp" />
          </Field>
          <Field label="소속 (선택)">
            <input value={affiliation} onChange={(e) => setAffiliation(e.target.value)} placeholder="예: 육군훈련소" maxLength={100} className="inp" />
          </Field>
        </div>

        {baselines.length > 0 && (
          <div>
            <span className="mb-1 block text-xs font-semibold text-sub">베이스라인 불러오기</span>
            <div className="flex flex-wrap gap-2">
              {baselines.map((b) => (
                <button
                  key={b.name}
                  onClick={() => {
                    setPrompt(b.prompt);
                    if (!name.trim()) setName(b.name);
                  }}
                  className="rounded-ctl border border-line px-3 py-1.5 text-xs font-medium text-sub hover:border-accent hover:text-accent"
                >
                  {b.name} 불러오기
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="행동 지침 (시스템 프롬프트)">
          {/* site의 IDE형 에디터 */}
          <div className="overflow-hidden rounded-ctl border border-line">
            <div className="flex items-center gap-2 bg-raise px-3 py-2">
              <span className="flex gap-1">
                <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              </span>
              <span className="mono text-xs text-sub">agent_instructions.txt</span>
              <span className="mono ml-auto text-xs text-muted">{lines}줄</span>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="모델에게 줄 지침을 입력하세요…"
              rows={9}
              className={`w-full resize-y bg-card px-3 py-2 font-mono text-xs leading-6 text-ink outline-none ${
                over ? "ring-1 ring-inset ring-bad" : ""
              }`}
            />
            <div className="flex items-center justify-between border-t border-line bg-raise px-3 py-2 text-xs">
              <span className={over ? "font-medium text-bad" : "text-sub"}>
                {len.toLocaleString()} / {CHAR_HARDCAP.toLocaleString()}자{over && " · 하드캡 초과 → 반려"}
              </span>
              <span className="text-muted">
                효율성 <span className="tabular-nums font-medium text-ink">{efficiency.toFixed(3)}</span>
              </span>
            </div>
          </div>
        </Field>

        <Field label="평가 세트">
          <div className="grid grid-cols-3 gap-2">
            {SPLITS.map((s) => (
              <button
                key={s.key}
                onClick={() => setSplit(s.key)}
                className={`rounded-ctl border px-2 py-2 text-sm transition ${
                  split === s.key ? "border-accent bg-accent-soft font-semibold text-accent" : "border-line text-sub"
                }`}
              >
                {s.label}
                <span className="block text-[11px] font-normal text-muted">{s.note}</span>
              </button>
            ))}
          </div>
        </Field>

        <Field label="적용 모델">
          <div className="flex items-center justify-between rounded-ctl border border-line bg-raise px-3 py-2.5">
            <div>
              <div className="mono text-sm font-semibold text-ink">{scoring?.model ?? "불러오는 중…"}</div>
              <div className="text-[11px] text-muted">temperature {scoring?.temperature ?? 0}</div>
            </div>
            <span className="rounded-md bg-line px-2 py-0.5 text-[10px] font-medium text-sub">주최측 고정</span>
          </div>
        </Field>

        <div className="rounded-ctl bg-accent-soft px-3 py-2 text-xs text-accent">
          예상 호출 <span className="tabular-nums font-semibold">{calls.toLocaleString()}</span>회 · 대략{" "}
          <span className="tabular-nums font-semibold">{estSec}</span>초
        </div>

        <button onClick={onSubmit} disabled={!canSubmit} className="btn btn-primary w-full py-3 text-sm">
          {running ? "채점 중…" : "제출하고 채점 시작"}
        </button>
        {disabledReason && !running && (
          <p className="-mt-1 text-center text-xs text-muted">{disabledReason}</p>
        )}
      </Card>

      {/* 진행 상황 — 제출 직후 폼 아래에 표시 */}
      {activeId != null && (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="text-sm font-semibold text-ink">
              제출 #{activeId} · <span className="text-accent">{statusKo(status)}</span>
              {startedAt != null && <span className="font-normal text-muted"> · 경과 {fmtDur(elapsedSec)}</span>}
            </span>
            {running && (
              <button onClick={onCancel} className="rounded-md bg-bad-soft px-2 py-1 text-xs font-medium text-bad hover:brightness-95">
                중단
              </button>
            )}
          </div>
          <div className="px-4 pb-4">
            {progress ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-line">
                  <div
                    className="h-full bg-accent transition-all"
                    style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
                  />
                </div>
                {running && etaSec != null && (
                  <div className="mt-1.5 text-right text-[11px] text-muted">예상 잔여 ~{fmtDur(etaSec)}</div>
                )}
                <div className="mt-2 grid grid-cols-4 gap-1 text-center text-xs">
                  <Stat label="완료" v={`${progress.done}/${progress.total}`} />
                  <Stat label="유효" v={progress.valid} color="var(--color-ok-deep)" />
                  <Stat label="INVALID" v={progress.invalid} color="var(--color-muted)" />
                  <Stat label="ERROR" v={progress.error} color="var(--color-bad)" />
                </div>
              </>
            ) : running || status === "pending" ? (
              <div className="text-xs text-muted">접수됨 · 채점 대기 중…</div>
            ) : null}
            {status === "error" && errorMsg && (
              <div className="mt-2 rounded-ctl border border-bad/30 bg-bad-soft p-2.5 text-xs leading-6 text-bad break-anywhere">
                <b>실패 사유</b> · {errorMsg}
              </div>
            )}
            {(status === "done" || status === "cancelled" || status === "error") && (
              <button onClick={() => nav.go({ name: "detail", id: activeId })} className="btn btn-ghost mt-3 w-full py-2 text-sm">
                결과 상세 보기 →
              </button>
            )}
            <p className="mt-2 text-[11px] text-muted">채점은 백그라운드에서 진행됩니다. 창을 닫아도 서버에서 계속되며, 다시 열면 이어서 표시됩니다.</p>
          </div>
        </div>
      )}

      {/* 내 제출 목록 (DACON 내 제출) */}
      <div>
        <h3 className="mb-2 px-1 text-sm font-bold text-ink">내 제출 내역</h3>
        {!name.trim() ? (
          <Card><p className="py-2 text-center text-xs text-muted">제출자 이름을 입력하면 내 제출 내역이 표시됩니다.</p></Card>
        ) : mySubs.length === 0 ? (
          <Card><p className="py-2 text-center text-xs text-muted">제출 내역이 없습니다.</p></Card>
        ) : (
          <Card className="divide-y divide-line p-0">
            {mySubs.map((s) => (
              <button
                key={s.id}
                onClick={() => nav.go({ name: "detail", id: s.id })}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-raise"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-ink">#{s.id}</span>
                    <StatusPill status={s.status} />
                    <span className="text-[11px] text-muted">{s.split}</span>
                  </div>
                  <div className="mt-0.5 text-[11px] text-muted">{fmt.time(s.created_at)} · {s.model}</div>
                </div>
                <span className="text-xs tabular-nums text-muted">F1 {fmt.f(s.macro_f1, 3)}</span>
                <span className="w-12 text-right text-base font-extrabold text-accent tabular-nums">
                  {s.leaderboard_score == null ? "—" : (s.leaderboard_score * 100).toFixed(1)}
                </span>
              </button>
            ))}
          </Card>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-sub">{label}</span>
      {children}
    </label>
  );
}

function Stat({ label, v, color = "var(--color-ink)" }: { label: string; v: string | number; color?: string }) {
  return (
    <div className="rounded-md bg-raise py-1">
      <div className="tabular-nums font-semibold" style={{ color }}>
        {v}
      </div>
      <div className="text-[10px] text-muted">{label}</div>
    </div>
  );
}

function statusKo(s: Status | null): string {
  return s == null ? "대기" : { pending: "채점 대기", running: "채점 중", done: "채점 완료", error: "실패", cancelled: "중단" }[s];
}
