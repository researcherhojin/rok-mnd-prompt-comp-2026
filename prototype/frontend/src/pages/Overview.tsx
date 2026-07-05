export function Overview() {
  return (
    <div className="doc prose">
      <div className="page-head">
        <h1>대회 개요</h1>
        <p>국방 설비 정비 데이터를 활용한 프롬프트 엔지니어링 경진대회</p>
      </div>

      <h2>주최 · 주관</h2>
      <ul>
        <li>
          <strong>주최</strong> 국방부
        </li>
        <li>
          <strong>주관</strong> IITP · KAIST · 데이원컴퍼니
        </li>
        <li>
          <strong>교육</strong> skillflo.io 온라인 강의 수강 후 참가
        </li>
      </ul>

      <h2>과제</h2>
      <p>
        설비·장비의 <strong>정비 이력 데이터</strong>로부터 두 가지를 분류하는 행동 지침(프롬프트)을 설계합니다.
      </p>
      <ul>
        <li>
          <strong>고장위험등급</strong> — HIGH / MEDIUM / LOW
        </li>
        <li>
          <strong>다음 정비주기 구간</strong> — 0-30 / 31-90 / 91-180 / 181+ (일)
        </li>
      </ul>

      <h2>핵심 — "재실행" 패러다임</h2>
      <p>
        기존 대회(DACON·Kaggle)는 참가자가 <strong>예측 파일</strong>을 제출합니다. 본 대회는 다릅니다. 참가자는{' '}
        <strong>행동 지침(프롬프트)</strong>만 제출하고, 채점 하네스가 그 지침을{' '}
        <strong>지정 모델(gpt-4.1-nano)로 숨겨진 test 30행에 재실행</strong>해 정답과 대조합니다.
      </p>
      <div className="callout">
        참가자는 결과값이 아니라 <b>"모델에게 줄 행동 지침" 하나</b>만 작성합니다. 전처리·피처 유도·추론·분류를 모두
        그 지침으로 지시합니다 → 하드코딩·정답 역추적 원천 차단.
      </div>

      <h2>경계 — 무엇을 고정하고, 무엇을 참가자가 정하나</h2>
      <div className="boundary">
        <div className="bx fixed">
          <h4>고정 하네스 (운영진)</h4>
          <ul>
            <li>레코드 직렬화</li>
            <li>지침 주입 → 모델 호출 (온도 0)</li>
            <li>출력 파싱 · 정답 대조</li>
            <li>Macro F1 · 간결성 · 통합 산식</li>
          </ul>
        </div>
        <div className="bx slot">
          <h4>행동 지침 (참가자)</h4>
          <ul>
            <li>필드 해석 · 전처리 지시</li>
            <li>피처 유도 (예: 수리기간=종료−시작)</li>
            <li>추론 단계 · 분류 규칙</li>
            <li>출력 형식 규율</li>
          </ul>
        </div>
      </div>

      <h2>운영 규모</h2>
      <ul>
        <li>
          참가 약 <strong>1만 명</strong> · 실시간 동시접속 500명
        </li>
        <li>
          제출 <strong>1일 3회</strong> · 제출 전 미리보기 약 50회/일
        </li>
        <li>
          지침 길이 <strong>최대 3,000자</strong>
        </li>
      </ul>
    </div>
  )
}
