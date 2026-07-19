// 문제 안내 (description) — 배경·주제·참가자 역할·진행 방식·판단 요령·주최/일정·리더보드 미리보기.
import { useEffect, useState } from "react";
import type { Nav } from "../../App";
import { api } from "../../api";
import type { LeaderRow } from "../../types";
import { fmt } from "../../lib/format";
import { Card } from "../../ui";
import { Bracket, Code, LinkedSec } from "./shared";

const STEPS = [
  { n: 1, t: "프롬프트 작성", d: "부품 계통별 정비 판단 기준을 자연어로 설명 (3,000자 이내)." },
  { n: 2, t: "제출·재실행", d: "AI가 숨겨진 정비 이력에 자동 적용됩니다." },
  { n: 3, t: "순위 확인", d: "정답과 대조해 리더보드에 점수가 오릅니다." },
];

const HINTS = [
  "부품 계통별로 소모 특성이 다르므로 같은 차량 상태라도 엔진·냉각·제동·전기·타이어및휠 계통의 판단 기준은 달라집니다.",
  "최근 1년 정비횟수, 누적 가동시간, 직전고장 경과일이 고장위험등급 판단의 주요 근거입니다.",
  "부품 장착 후 경과 개월 수, 부품 정비 후 주행거리·가동시간은 부품 단위 정비주기 판단에 필요합니다.",
  "산악·전방·해안 운용과 고하중 조건은 부품 부담을 높이는 요인으로 해석합니다.",
  "관측 월이 여름인 냉각 계통, 겨울인 전기 계통에서는 계절 조건을 함께 고려합니다.",
  "정비비용이 크거나 수리 기간이 긴 사례는 정비 규모가 컸던 이력으로 보는 것이 자연스럽습니다.",
  "정비 계단이 높았는데 직전고장이 다시 짧은 기간 안에 발생한 경우는 위험 신호입니다.",
  "부품 조달 예상 일수가 긴 경우에는 예방 정비 관점에서 보수적으로 판단합니다.",
  "긴급 정비가 반복된 부품 계통은 계획 정비보다 더 높은 위험 신호로 해석합니다.",
  "MEDIUM 상태에서도 누적 가동시간과 부품 사용 이력에 따라 다음 정비주기 구간이 달라집니다.",
];

const INPUT_EXAMPLE = `vehicle_id: 차량 K-042
vehicle_model: K-511
part_system: 엔진
operation_area: 전방
mission_type: 작전지원
load_condition: 고하중
observation_month: 8
last_maintenance_echelon: 3
emergency_repair_flag: 1
maintenance_count_1y: 4
mileage_total_km: 82000
operation_hours_total: 3200
part_age_months: 28
mileage_since_part_service_km: 8500
hours_since_part_service: 320
days_since_last_fault: 45
spare_part_lead_time_days: 21`;

export function Description({ nav }: { nav: Nav }) {
  const [top, setTop] = useState<LeaderRow[] | null>(null);
  useEffect(() => {
    api
      .leaderboard()
      .then((rows) => setTop(rows.filter((r) => r.status === "done" && !r.is_baseline).slice(0, 3)))
      .catch(() => setTop([]));
  }, []);

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      {/* 대회 헤더 */}
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap gap-1.5">
          {["국방AI", "프롬프트 엔지니어링", "분류·예측", "K-511"].map((t) => (
            <span key={t} className="rounded-full bg-accent-soft px-2.5 py-1 text-[11px] font-semibold text-accent">#{t}</span>
          ))}
        </div>
        <h1 className="mt-3 text-2xl font-extrabold leading-snug tracking-tight text-ink sm:text-[28px]">
          K-511 계통별 고장위험·정비주기 예측
        </h1>
        <p className="mt-1.5 text-sm text-sub">2026 국방AI 기반 프롬프트 경진대회 · 출제 04</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["주최 / 주관", "국방부 / IITP·데이원"],
            ["참가 규모", "약 1만 명"],
            ["제출물", "시스템 프롬프트 1개"],
            ["상태", "준비 중"],
          ].map(([k, v]) => (
            <div key={k}>
              <div className="text-[11px] text-muted">{k}</div>
              <div className="mt-0.5 text-sm font-bold text-ink">{v}</div>
            </div>
          ))}
        </div>
        <button onClick={() => nav.go({ name: "submit" })} className="btn btn-primary mt-5 w-full py-3 text-sm sm:w-auto sm:px-8">
          프롬프트 제출하기 →
        </button>
      </section>

      <Bracket label="배경">
        K-511은 군 수송의 근간이 되는 차량입니다. 엔진·냉각·제동·전기 등 부품 계통마다 소모 특성이 달라, 정비 시점을 잘못 잡으면 가동률
        저하와 긴급 정비 비용으로 이어집니다. 사람마다 판단이 갈리는 이 결정을 AI가 일관되게 내리도록 만드는 것이 이 대회의 과제입니다.
      </Bracket>

      <Bracket label="주제">
        K-511 계열 군용 트럭의 <b className="text-ink">부품 계통별 고장위험등급·다음 정비주기 예측</b>을 위한 시스템 프롬프트 엔지니어링.
      </Bracket>

      <Bracket label="참가자 역할">
        참가자는 정비 데이터를 직접 분류하지 않습니다. AI에게 판단 기준을 설명하는 <b className="text-ink">시스템 프롬프트 1개</b>를
        제출하면, 채점 시스템이 이를 숨겨진 정비 이력에 적용해 LLM을 재실행하고 결과를 정답과 대조합니다. 작성한 프롬프트는
        리더보드 채점용(Public)과 최종 순위용(Private) 데이터에 동일하게 적용됩니다.
      </Bracket>

      {/* 진행 방식 */}
      <section>
        <h2 className="text-[15px] font-bold text-ink"><span className="text-accent">[</span>진행 방식<span className="text-accent">]</span></h2>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {STEPS.map((s) => (
            <Card key={s.n}>
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-extrabold text-white">{s.n}</div>
                <h3 className="text-sm font-bold text-ink">{s.t}</h3>
              </div>
              <p className="mt-2 text-xs leading-6 text-sub">{s.d}</p>
            </Card>
          ))}
        </div>
      </section>

      <LinkedSec label="AI가 받는 입력" linkLabel="컬럼 23개 전체 · 데이터 →" onLink={() => nav.go({ name: "data" })}>
        AI는 K-511 부품 계통별 정비 이력 <b className="text-ink">1건</b>을 입력으로 받습니다. 차량 모델·부품 계통·운용지역·임무·적재
        조건·관측 월, 정비 이력(비용·정비 계단·긴급 여부·최근 1년 정비횟수), 누적 주행/가동시간, 부품 사용 이력, 직전고장 경과일,
        부품 조달 예상 일수 등이 포함됩니다.
        <Code>{INPUT_EXAMPLE}</Code>
      </LinkedSec>

      <Bracket label="AI가 출력하는 값">
        각 입력 행에 대해 <code>risk_grade</code>와 <code>cycle_range</code>를 한 줄로 출력합니다.
        <div className="mt-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-ctl border border-line bg-raise p-3">
              <div className="text-xs font-semibold text-ink"><code>risk_grade</code> 고장위험등급</div>
              <div className="mt-1 text-xs text-sub">HIGH · MEDIUM · LOW</div>
            </div>
            <div className="rounded-ctl border border-line bg-raise p-3">
              <div className="text-xs font-semibold text-ink"><code>cycle_range</code> 다음 정비주기(일)</div>
              <div className="mt-1 text-xs text-sub">0-30 · 31-90 · 91-180 · 181+</div>
            </div>
          </div>
          <Code>{`행마다 한 줄:  risk_grade, cycle_range
예)  HIGH, 0-30
     MEDIUM, 31-90
     LOW, 181+`}</Code>
        </div>
        <p className="mt-3 text-xs leading-6 text-muted">출력은 입력 순서와 같은 줄 수여야 하며, 허용 라벨 외의 설명 문장·오타가 있으면 오답 처리될 수 있습니다. 자세한 파싱 규칙은 규칙 페이지를 참고하세요.</p>
      </Bracket>

      <Bracket label="판단 요령">
        정확한 판정 기준은 공개하지 않습니다. 좋은 프롬프트는 다음 관점을 함께 반영합니다.
        <ol className="mt-3 space-y-2.5">
          {HINTS.map((h, i) => (
            <li key={i} className="flex gap-2.5 text-[15px] leading-7 text-sub">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold tabular-nums text-accent">{i + 1}</span>
              <span>{h}</span>
            </li>
          ))}
        </ol>
      </Bracket>

      <LinkedSec label="평가 방식" linkLabel="배점 자세히 · 평가 →" onLink={() => nav.go({ name: "evaluation" })}>
        <code>risk_grade</code>와 <code>cycle_range</code>를 각각 Macro F1으로 계산한 뒤 평균이 기본 예측 점수입니다.
        <Code>{`prediction_score = ( risk_grade Macro F1 + cycle_range Macro F1 ) / 2`}</Code>
        <p className="mt-2 text-xs leading-6 text-muted">
          운영안 종합 점수 = 예측 성능 85 + 프롬프트 품질 7 + 형식 안정성 3 + 간결성 5 (최대 100). 정확 배점은 주최측 확정 사항입니다.
        </p>
      </LinkedSec>

      <LinkedSec label="제공 데이터" linkLabel="컬럼·미리보기 · 데이터 →" onLink={() => nav.go({ name: "data" })}>
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            ["sample.csv", "10행", "라벨 공개 · 프롬프트 테스트"],
            ["Public", "300행", "대회 중 리더보드 채점"],
            ["Private", "700행", "종료 후 최종 순위"],
          ].map(([f, n, d]) => (
            <div key={f} className="rounded-ctl border border-line bg-raise p-3">
              <div className="text-sm font-bold text-ink">{f} <span className="text-accent">{n}</span></div>
              <div className="mt-0.5 text-[11px] text-muted">{d}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs leading-6 text-sub">
          부품 계통 8종(엔진·냉각·제동·전기·변속및구동·조향및현가·타이어및휠·차체및적재)과 4개 정비주기 구간을 포함한 합성 데이터입니다.
          sample 10행에 8개 계통이 모두 들어 있습니다.
        </p>
      </LinkedSec>

      <div className="grid gap-6 sm:grid-cols-2">
        <Bracket label="주최 / 주관">
          <ul className="space-y-0.5">
            <li>주최 · 국방부</li>
            <li>주관 · IITP / KAIST · 데이원컴퍼니</li>
            <li>참가자격 · 군 장병 (세부 확정 후 공지)</li>
          </ul>
        </Bracket>
        <Bracket label="일정">
          <ul className="space-y-1.5">
            {[["온라인 사전교육", "추후 공지"], ["대회 시작", "추후 공지"], ["대회 종료", "추후 공지"]].map(([k, v]) => (
              <li key={k} className="flex items-center justify-between border-b border-line pb-1.5 last:border-0">
                <span>{k}</span><span className="font-semibold text-ink">{v}</span>
              </li>
            ))}
          </ul>
        </Bracket>
      </div>

      {/* 리더보드 미리보기 */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-ink"><span className="text-accent">[</span>리더보드<span className="text-accent">]</span></h2>
          <button onClick={() => nav.go({ name: "leaderboard" })} className="text-xs font-medium text-accent hover:underline">전체 보기 →</button>
        </div>
        <Card className="divide-y divide-line p-0">
          {top == null ? (
            <div className="p-6 text-center text-sm text-muted">불러오는 중…</div>
          ) : top.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted">아직 제출이 없습니다 — 첫 제출자가 되세요.</div>
          ) : (
            top.map((r, i) => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-6 text-center text-sm font-extrabold text-accent tabular-nums">{i + 1}</span>
                <span className="flex-1 truncate text-sm font-semibold text-ink">{r.name}</span>
                <span className="text-xs tabular-nums text-muted">F1 {fmt.f(r.macro_f1, 3)}</span>
                <span className="text-lg font-extrabold text-accent tabular-nums">
                  {r.leaderboard_score == null ? "—" : (r.leaderboard_score * 100).toFixed(1)}
                </span>
              </div>
            ))
          )}
        </Card>
      </section>
    </div>
  );
}
