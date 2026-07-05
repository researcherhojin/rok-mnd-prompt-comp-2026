const SCORE: [string, string, string][] = [
  ['온라인 수강률', '25', '필수 VOD 3개 각 30%↑ 충족 시 만점'],
  ['과제 수행 (정확도·간결성)', '45', '45 × (0.9·평균 Macro F1 + 0.1·간결성)'],
  ['결과값 유효성', '10', '모델 답변이 허용 라벨/구간으로 파싱되는 비율'],
  ['제출형식 준수', '10', '지침 스키마 + 출력 계약(한 줄) 준수율'],
  ['보안 적합성', '10', '개인정보·군 보안 표현·금지어 미포함'],
]

export function Rules() {
  return (
    <div className="doc prose">
      <div className="page-head">
        <h1>규칙 · 평가</h1>
        <p>제출 형식과 100점 배점 체계</p>
      </div>

      <h2>제출 형식</h2>
      <ul>
        <li>
          예측 파일이 아니라 <strong>행동 지침(프롬프트)</strong>을 제출합니다.
        </li>
        <li>
          하네스 주입 자리 <code>{'{{input}}'}</code>를 포함하고, 지정 출력 계약으로 답하도록 지시해야 합니다.
        </li>
        <li>
          출력 계약: 각 행에 <code>risk_grade, cycle_range</code> 콤마 한 줄. 두 라벨 중 하나라도 비거나 허용 밖이면
          해당 행 정확도 0점.
        </li>
        <li>
          지침 <strong>최대 3,000자</strong>. 초과 시 제출 반려.
        </li>
      </ul>

      <h2>배점 (총 100점)</h2>
      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>항목</th>
              <th>배점</th>
              <th>방식</th>
            </tr>
          </thead>
          <tbody>
            {SCORE.map(([k, v, m]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="num">{v}</td>
                <td>{m}</td>
              </tr>
            ))}
            <tr>
              <td>
                <strong>합계</strong>
              </td>
              <td className="num">
                <strong>100</strong>
              </td>
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <h2>정확도 — 평균 Macro F1</h2>
      <p>두 라벨 각각 Macro F1(클래스별 F1 평균)을 구해 평균합니다. 클래스 불균형에 강건합니다.</p>
      <ul>
        <li>
          <strong>Public / Private 분할</strong> — test 30행 = Public 12 / Private 18(비공개).
        </li>
        <li>대회 중 리더보드는 Public 기준, 최종 순위는 Private 재채점 → 역추적·과적합 차단.</li>
      </ul>

      <h2>간결성</h2>
      <p>
        지침 글자 수 L에 대해 <code>clip((3000 − L) / (3000 − 200), 0, 1)</code>. 짧을수록 높지만 최대 기여는 4.5점
        → 정확도(40.5점)를 이기지 못합니다.
      </p>

      <h2>2단계 심사</h2>
      <ul>
        <li>
          <strong>예선</strong> — 자동 리더보드(Private 재채점)로 상위권 선별
        </li>
        <li>
          <strong>검증</strong> — 상위권 보안·표절·산식 악용 검수 후 수상 확정(탈락 시 차순위 승계)
        </li>
      </ul>

      <h2>부정 방지</h2>
      <ul>
        <li>1일 3회 제출 상한 · 동일/유사 지침 대량 제출 탐지</li>
        <li>Private 셋·정답 비공개 · 재실행으로 하드코딩 무력화</li>
      </ul>
    </div>
  )
}
