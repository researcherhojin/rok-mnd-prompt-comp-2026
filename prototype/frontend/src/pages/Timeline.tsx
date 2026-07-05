const ROWS = [
  '참가 접수',
  '온라인 강의 수강',
  '예선 (자동 리더보드)',
  '최종 제출 마감',
  '검증 · 수상자 발표',
]

export function Timeline() {
  return (
    <div className="doc prose">
      <div className="page-head">
        <h1>일정</h1>
        <p>단계별 진행 일정</p>
      </div>

      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>단계</th>
              <th>일자</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((k) => (
              <tr key={k}>
                <td>{k}</td>
                <td>
                  <span className="tbd">확정 예정</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="callout">
        구체 일정은 <b>주최측(국방부 · 데이원컴퍼니) 확정 후</b> 게시됩니다.
      </div>
    </div>
  )
}
