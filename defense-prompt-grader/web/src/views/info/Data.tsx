// 데이터 (data) — 파일 구성 · 미리보기 · 데이터 사전 · 정답 라벨 분포 · 계통별 판단 관점.
import { Card } from "../../ui";
import { H } from "./shared";

const LAB_CLS: Record<string, string> = {
  HIGH: "bg-bad-soft text-bad", MEDIUM: "bg-warn-soft text-warn", LOW: "bg-ok-soft text-ok-deep",
  "0-30": "bg-bad-soft text-bad", "31-90": "bg-warn-soft text-warn", "91-180": "bg-accent-soft text-accent", "181+": "bg-ok-soft text-ok-deep",
};
function Lab({ v }: { v: string }) {
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[11px] font-bold ${LAB_CLS[v] ?? "bg-line text-muted"}`}>{v}</span>;
}

const PREVIEW_COLS = ["id", "part_system", "operation_area", "mission_type", "정비비용(원)", "정비횟수", "누적가동h", "부품후주행km", "직전고장일", "risk_grade", "cycle_range"];
const PREVIEW_ROWS: (string | number)[][] = [
  [1, "엔진", "전방", "보급", "2,010,000", 0, 2785, 6349, 6, "HIGH", "0-30"],
  [2, "냉각", "후방", "훈련", "130,000", 0, 3287, 38830, 142, "MEDIUM", "31-90"],
  [3, "제동", "산악", "작전지원", "700,000", 2, 1621, 26648, 250, "MEDIUM", "91-180"],
  [4, "전기", "전방", "작전지원", "680,000", 2, 4110, 48716, 93, "HIGH", "0-30"],
  [5, "변속및구동", "도심", "훈련", "460,000", 0, 3375, 40875, 185, "MEDIUM", "31-90"],
  [6, "조향및현가", "도심", "훈련", "1,150,000", 0, 1187, 19182, 342, "LOW", "181+"],
];

const DICT: { title: string; rows: [string, string, string][] }[] = [
  { title: "차량 · 운용", rows: [
    ["vehicle_id", "익명화된 차량 식별자", "차량 K-042"],
    ["vehicle_model", "차량 모델", "K-511 / K-511A1"],
    ["part_system", "부품 계통 (8종)", "엔진·냉각·제동·전기·변속및구동·조향및현가·타이어및휠·차체및적재"],
    ["operation_area", "운용지역", "전방·후방·산악·해안·도심"],
    ["mission_type", "임무유형", "수송·훈련·작전지원·보급"],
    ["load_condition", "적재 조건", "경량·보통·고하중"],
    ["observation_month", "관측 월", "1 ~ 12"],
  ]},
  { title: "정비 이력", rows: [
    ["repair_start_date · repair_end_date", "최근 정비 시작일 · 종료일", "2025-11-12 · 2025-11-15"],
    ["maintenance_cost_krw", "정비 조치비용 (원)", "850000"],
    ["last_maintenance_echelon", "최근 정비 계단", "1 사용자 · 2 부대 · 3 직접지원 · 4 일반지원 · 5 창정비"],
    ["emergency_repair_flag", "긴급 정비 여부", "0 계획 · 1 긴급"],
    ["maintenance_count_1y", "최근 1년 부품 계통 정비횟수", "4"],
    ["days_since_last_maintenance", "마지막 정비 이후 경과일", "62"],
  ]},
  { title: "누적 · 노후", rows: [
    ["mileage_total_km", "차량 누적 주행거리 (km)", "82000"],
    ["operation_hours_total", "차량 누적 가동시간 (h)", "3200"],
    ["vehicle_age_months", "차량 운용 경과 (개월)", "132"],
    ["part_age_months", "부품 장착 후 경과 (개월)", "28"],
  ]},
  { title: "부품 사용 · 고장 · 조달", rows: [
    ["mileage_since_part_service_km", "부품 정비 후 주행거리 (km)", "8500"],
    ["hours_since_part_service", "부품 정비 후 가동시간 (h)", "320"],
    ["days_since_last_fault", "부품 직전고장 경과일", "45"],
    ["spare_part_lead_time_days", "부품 조달 예상 일수", "21"],
  ]},
];

const RISK_DIST: [string, number][] = [["HIGH", 25.4], ["MEDIUM", 53.5], ["LOW", 21.1]];
const CYCLE_DIST: [string, number][] = [["0-30", 25.4], ["31-90", 25.6], ["91-180", 27.9], ["181+", 21.1]];
const BAR_COLOR: Record<string, string> = { HIGH: "var(--color-bad)", MEDIUM: "var(--color-warn)", LOW: "var(--color-ok)", "0-30": "var(--color-bad)", "31-90": "var(--color-warn)", "91-180": "var(--color-accent)", "181+": "var(--color-ok)" };

const PERSP: [string, string][] = [
  ["엔진", "누적 가동시간, 작전지원 임무, 고하중 조건, 정비비용, 부품 사용 이력"],
  ["냉각", "여름철 관측 월, 누적 가동시간, 해안·전방 운용, 부품 사용 이력"],
  ["제동", "정비횟수, 수리기간, 고하중 조건, 부품 사용 이력"],
  ["전기", "겨울철 관측 월, 긴급 정비 여부, 부품 장착 기간, 부품 사용 이력"],
  ["변속및구동", "누적 주행거리, 고하중 조건, 정비비용, 부품 사용 이력"],
  ["조향및현가", "산악 운용, 고하중 조건, 부품 정비 후 사용 이력"],
  ["타이어및휠", "산악 운용, 주행거리, 부품 정비 후 사용 이력"],
  ["차체및적재", "적재 조건, 수리기간, 정비비용, 부품 사용 이력"],
];

function DistBar({ items }: { items: [string, number][] }) {
  return (
    <div className="space-y-1.5">
      {items.map(([lbl, pct]) => (
        <div key={lbl} className="flex items-center gap-2">
          <span className="w-16 shrink-0"><Lab v={lbl} /></span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: BAR_COLOR[lbl] }} />
          </div>
          <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted">{pct}%</span>
        </div>
      ))}
    </div>
  );
}

export function Data() {
  return (
    <div className="space-y-10">
      <div>
        <H>데이터</H>
        <p className="mt-2 text-[15px] leading-8 text-sub">
          K-511 계열 군용 트럭의 부품 계통별 정비 이력 합성 데이터입니다. <b className="text-ink">한 행 = 특정 차량의 특정 부품 계통 1건</b>의
          운용·정비 이력이며, 동일 차량이라도 엔진 계통과 냉각 계통은 별도 행으로 분리되어 각각 예측 대상이 됩니다.
        </p>
      </div>

      {/* Files */}
      <section>
        <h3 className="mb-3 text-base font-bold text-ink">파일 구성</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { f: "sample.csv", n: "10", d: "문제 이해·프롬프트 테스트", tag: "라벨 공개", cls: "bg-ok-soft text-ok-deep" },
            { f: "Public", n: "300", d: "대회 기간 리더보드 채점", tag: "라벨 비공개", cls: "bg-line text-muted" },
            { f: "Private", n: "700", d: "종료 후 최종 순위", tag: "라벨 비공개", cls: "bg-line text-muted" },
          ].map((x) => (
            <Card key={x.f}>
              <div className="flex items-center justify-between">
                <span className="mono text-sm font-semibold text-ink">{x.f}</span>
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${x.cls}`}>{x.tag}</span>
              </div>
              <div className="mt-2 text-2xl font-extrabold text-accent tabular-nums">{x.n}<span className="text-sm font-medium text-muted"> 행</span></div>
              <div className="mt-1 text-xs text-sub">{x.d}</div>
            </Card>
          ))}
        </div>
        <p className="mt-3 text-sm leading-6 text-sub">sample 10행에는 8개 부품 계통과 4개 정비주기 구간이 모두 포함됩니다. 입력은 23컬럼(정답 라벨 2개 제외).</p>
      </section>

      {/* 데이터 미리보기 */}
      <section>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-base font-bold text-ink">데이터 미리보기</h3>
          <span className="text-xs text-muted">sample.csv 6행 · 주요 컬럼만</span>
        </div>
        <Card className="p-0">
          <div className="w-full max-w-full overflow-x-auto rounded-2xl">
            <table className="w-max min-w-full whitespace-nowrap text-left text-xs">
              <thead>
                <tr className="border-b border-line bg-raise text-[11px] text-muted">
                  {PREVIEW_COLS.map((c) => (
                    <th key={c} className="px-3 py-2 font-semibold first:sticky first:left-0 first:bg-raise">{c}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-sub">
                {PREVIEW_ROWS.map((row) => (
                  <tr key={row[0]} className="border-b border-line last:border-0">
                    {row.map((v, i) => (
                      <td key={i} className={`px-3 py-2 tabular-nums ${i === 0 ? "sticky left-0 bg-card font-semibold text-ink" : ""}`}>
                        {i >= 9 ? <Lab v={String(v)} /> : v}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="mt-3 text-sm leading-6 text-sub">정답 라벨 <code>risk_grade</code>·<code>cycle_range</code>는 sample에만 공개되며, Public·Private 채점 입력에서는 제거되어 제공됩니다.</p>
      </section>

      {/* 데이터 사전 */}
      <section>
        <h3 className="mb-3 text-base font-bold text-ink">데이터 사전 (입력 23컬럼)</h3>
        <div className="space-y-3">
          {DICT.map((g) => (
            <Card key={g.title} className="p-0">
              <div className="border-b border-line px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-accent">
                {g.title}
              </div>
              <div className="divide-y divide-line">
                {g.rows.map(([c, d, ex]) => (
                  <div key={c} className="grid gap-x-4 gap-y-1 px-4 py-3.5 sm:grid-cols-[34%_1fr]">
                    <code className="mono text-[13px] font-semibold text-ink wrap-anywhere">{c}</code>
                    <div>
                      <div className="text-sm leading-6 text-sub">{d}</div>
                      {ex && (
                        <div className="mt-1.5 text-xs leading-5 text-muted">
                          <span className="rounded bg-raise px-1 py-0.5 text-[10px] font-medium text-muted">예시</span> {ex}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* 정답 라벨 + 분포 */}
      <section>
        <h3 className="mb-3 text-base font-bold text-ink">정답 라벨</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <div className="text-sm font-semibold text-ink"><code>risk_grade</code> · 고장위험등급</div>
            <div className="mt-3"><DistBar items={RISK_DIST} /></div>
          </Card>
          <Card>
            <div className="text-sm font-semibold text-ink"><code>cycle_range</code> · 다음 정비주기(일)</div>
            <div className="mt-3"><DistBar items={CYCLE_DIST} /></div>
          </Card>
        </div>
        <p className="mt-3 text-sm leading-6 text-sub">전체 1,000행 기준 분포. Public·Private은 라벨·계통 기준 층화 분할로 편차 0.6%p 이내입니다.</p>
      </section>

      {/* 부품 계통별 판단 관점 */}
      <section>
        <h3 className="mb-2 text-base font-bold text-ink">부품 계통별 판단 관점</h3>
        <p className="text-[15px] leading-8 text-sub">
          8종은 소모 특성이 서로 다릅니다. 엔진·타이어및휠처럼 부담이 큰 계통은 안정 등급(LOW) 판정이 상대적으로 적고, 냉각·변속및구동·차체및적재는
          안정 등급 여지가 넓습니다. 프롬프트에 계통별 차이를 반영하는 것이 중요합니다.
        </p>
        <Card className="mt-3 p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <tbody className="text-sub">
                {PERSP.map(([s, v]) => (
                  <tr key={s} className="border-t border-line first:border-0">
                    <td className="w-28 py-3 pl-4 pr-3 align-top font-semibold text-ink">{s}</td>
                    <td className="py-3 pr-4 leading-6">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <p className="text-xs leading-6 text-muted wrap-anywhere">
        본 데이터는 경진대회 운영을 위한 합성 데이터이며 실제 차량·부대·정비 기록을 포함하지 않습니다. <code>mileage_since_part_service_km</code>·
        <code>hours_since_part_service</code>는 부품 계통별 임계값 기준의 기본 소모 신호로, 대부분의 판단에서 근간이 됩니다.
      </p>
    </div>
  );
}
