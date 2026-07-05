import { useStore } from '../store'
import { ErrorBox, Loading } from '../components/State'

const FILES = [
  ['train.csv', '15', '라벨 공개', '규칙을 추론하는 학습·이해용 예시'],
  ['test.csv', '30', '입력만 공개', '하네스가 지침을 재실행하는 채점 대상'],
  ['ground_truth', '30', '격리(비공개)', 'Public 12 / Private 18 분할, 채점 워커만 접근'],
  ['sample_prompt.json', '—', '공개', '행동 지침 제출 형식 예시'],
  ['problem_description.md', '—', '공개', '문제·스키마·라벨·FAQ·보안 유의'],
]

export function Data() {
  const { problem, problemError } = useStore()

  if (problemError)
    return (
      <div className="doc">
        <ErrorBox msg={problemError} />
      </div>
    )
  if (!problem)
    return (
      <div className="doc">
        <Loading label="데이터셋 불러오는 중…" />
      </div>
    )

  return (
    <div className="doc prose">
      <div className="page-head">
        <h1>데이터셋</h1>
        <p>장비 유지보수 이력을 모사한 합성 데이터 (실제 군 보안자료 아님)</p>
      </div>

      <h2>파일 구성</h2>
      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>파일</th>
              <th>행</th>
              <th>공개</th>
              <th>용도</th>
            </tr>
          </thead>
          <tbody>
            {FILES.map(([f, n, o, u]) => (
              <tr key={f}>
                <td className="mono">{f}</td>
                <td className="num">{n}</td>
                <td>{o}</td>
                <td>{u}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="callout">
        참가자는 test를 보지 않습니다. <b>train 15행에서 규칙을 추론</b>해 일반화된 지침을 쓰고, 하네스가 숨겨진
        test 30행에 적용합니다.
      </div>

      <h2>입력 컬럼</h2>
      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>컬럼</th>
              <th>타입</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            {(problem?.columns ?? []).map((c) => (
              <tr key={c.name}>
                <td className="mono">{c.name}</td>
                <td>{c.type}</td>
                <td>{c.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>라벨</h2>
      <p>
        <strong>고장위험등급</strong> (3-class) · <strong>정비주기 구간</strong> (4-class, 일). 두 라벨은 상호
        연관됩니다(위험↑ → 주기↓).
      </p>
      <ul>
        <li>위험등급: {problem?.labels.failure_risk_grade.join(' / ')}</li>
        <li>정비주기: {problem?.labels.maintenance_cycle_range.join(' / ')}</li>
      </ul>
      <div className="callout">
        판정 <b>규칙 자체는 비공개</b>입니다. train 예시의 (입력 → 정답)에서 규칙을 추론하는 것이 곧 프롬프트
        엔지니어링 역량 평가입니다.
      </div>

      <h2>학습 예시 (train)</h2>
      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>id</th>
              <th>장비</th>
              <th>정비횟수</th>
              <th>가동시간</th>
              <th>직전고장</th>
              <th>위험등급</th>
              <th>정비주기</th>
            </tr>
          </thead>
          <tbody>
            {(problem?.train ?? []).slice(0, 6).map((r) => (
              <tr key={r.id}>
                <td className="num">{r.id}</td>
                <td>{r.equipment_type}</td>
                <td className="num">{r.maintenance_count_1y}</td>
                <td className="num">{r.operating_hours.toLocaleString()}</td>
                <td className="num">{r.days_since_last_failure}</td>
                <td className="ans">{r.failure_risk_grade}</td>
                <td className="ans">{r.maintenance_cycle_range}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
