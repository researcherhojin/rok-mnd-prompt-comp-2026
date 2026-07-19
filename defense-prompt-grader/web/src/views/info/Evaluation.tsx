// 평가 (evaluation) — 예측 성능 산식 · 종합 점수(운영안) · Public/Private · 동점.
import { Card } from "../../ui";
import { Code, H } from "./shared";

export function Evaluation() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <H>평가</H>
        <p className="mt-2 text-[15px] leading-8 text-sub">
          제출된 프롬프트는 숨겨진 데이터에 재실행되어 채점됩니다. 아래 배점은 운영안이며 정확 수치는 주최측 확정 사항입니다.
        </p>
      </div>

      <Card>
        <div className="text-sm font-semibold text-ink">예측 성능 (기본 점수)</div>
        <p className="mt-1.5 text-sm leading-7 text-sub">
          <code>risk_grade</code>와 <code>cycle_range</code>를 각각 Macro F1으로 계산한 뒤 평균합니다. Macro F1은 클래스별 F1의
          단순 평균이라, 데이터 개수 불균형이 있어도 각 클래스를 동일 비중으로 평가합니다. 한 구간으로만 몰아 답하면 점수가 크게 낮아집니다.
        </p>
        <Code>{`prediction_score = ( risk_grade Macro F1 + cycle_range Macro F1 ) / 2`}</Code>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-ink">종합 점수 <span className="text-xs font-normal text-muted">(운영안 · 미확정)</span></div>
        <Code>{`종합 = 예측 성능 85 + 프롬프트 품질 7 + 형식 안정성 3 + 간결성 5  (최대 100)`}</Code>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-muted"><tr><th className="py-1 font-semibold">항목</th><th className="py-1 font-semibold">배점</th><th className="py-1 font-semibold">기준</th></tr></thead>
            <tbody className="text-sub">
              <tr className="border-t border-line"><td className="py-1.5">프롬프트 품질</td><td className="tabular-nums">7</td><td>계통별 분리 판단·부품 사용 이력·운용 맥락·MEDIUM 세부 분기 반영</td></tr>
              <tr className="border-t border-line"><td className="py-1.5">형식 안정성</td><td className="tabular-nums">3</td><td>허용 라벨 준수·출력 행 수 일치·불필요한 설명 제거</td></tr>
              <tr className="border-t border-line"><td className="py-1.5">간결성</td><td className="tabular-nums">5</td><td>프롬프트가 짧을수록 높음 (3,000자 초과 시 제출 반려)</td></tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <div className="text-sm font-semibold text-ink">Public / Private · 동점</div>
        <p className="mt-1.5 text-sm leading-7 text-sub">
          대회 중 리더보드는 <b className="text-ink">Public 300행</b> 점수만 반영하고, 최종 순위는 <b className="text-ink">Private 700행</b>
          재채점으로 확정합니다. 동점 시 ① 예측 성능 → ② Private 성능 → ③ 최초 제출 시간 순으로 가립니다.
        </p>
      </Card>
    </div>
  );
}
