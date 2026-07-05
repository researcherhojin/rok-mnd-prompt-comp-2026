import type { PreviewResult } from '../types'

export function Preview({ result }: { result: PreviewResult | null }) {
  if (!result) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>미리보기</h2>
          <span className="tag">학습셋</span>
        </div>
        <div className="empty">
          <div className="big">▶</div>
          <strong>[샘플 실행]</strong>을 누르면 학습셋에 지침을 돌려
          <br />
          행별 정오와 추정 정확도를 즉시 보여줍니다.
        </div>
      </div>
    )
  }

  const pct = Math.round(result.estimated_accuracy * 100)
  const hit = result.rows.filter((r) => r.correct).length

  return (
    <div className="card">
      <div className="card-head">
        <h2>미리보기 · 학습 {result.sample_size}행</h2>
        <span className="tag num">
          {hit}/{result.rows.length} 통과
        </span>
      </div>
      <div className="gauge">
        <div className="gauge-track">
          <div className="gauge-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="gauge-label">추정 정확도 {pct}%</span>
      </div>
      <div className="rows">
        {result.rows.map((r, i) => (
          <div
            key={r.id}
            className={`prow ${r.correct ? 'ok' : 'no'}`}
            style={{ animationDelay: `${i * 55}ms` }}
          >
            <span className="pid">#{r.id}</span>
            <span className="ppred">
              {r.pred_risk ?? '—'}, {r.pred_cycle ?? '—'}
            </span>
            <span className="ptrue">
              정답 {r.true_risk}, {r.true_cycle}
            </span>
            <span className="ppill">{r.correct ? '통과' : '오답'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
