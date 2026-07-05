const PRIZES = ['대상', '최우수상', '우수상', '장려상']

export function Prizes() {
  return (
    <div className="doc prose">
      <div className="page-head">
        <h1>시상</h1>
        <p>수상 규모 및 혜택</p>
      </div>

      <div className="itable-wrap">
        <table className="itable">
          <thead>
            <tr>
              <th>상격</th>
              <th>내용</th>
            </tr>
          </thead>
          <tbody>
            {PRIZES.map((k) => (
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
        시상 규모·부상은 <b>주최측 확정 후</b> 게시됩니다. 2단계 심사(예선 → 검증)를 통과한 참가자에게 수여됩니다.
      </div>
    </div>
  )
}
