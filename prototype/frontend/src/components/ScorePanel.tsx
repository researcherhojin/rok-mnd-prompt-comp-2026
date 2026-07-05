import type { SubmitResult } from '../types'

export function ScorePanel({ result }: { result: SubmitResult | null }) {
  if (!result) return null
  const s = result.score
  const items = [
    { k: '과제(정확도·간결성)', v: s.task_block, max: 45 },
    { k: '온라인 수강률', v: s.vod, max: 25 },
    { k: '결과값 유효성', v: s.validity, max: 10 },
    { k: '제출형식 준수', v: s.format, max: 10 },
    { k: '보안 적합성', v: s.security, max: 10 },
  ]

  return (
    <div className="card">
      <div className="card-head">
        <h2>채점 결과</h2>
        <span className="tag num">Public 12행 기준</span>
      </div>
      <div className="rankcard">
        <div className="rank-big num">
          {result.rank}
          <span>위</span>
        </div>
        <div className="rank-meta">
          <span className="pct num">상위 {result.percentile}%</span>
          <span className="tot num">
            {result.total_participants}명 중 · 총점 {s.total_public.toFixed(1)}
          </span>
        </div>
      </div>
      <div className="breakdown">
        {items.map((it) => (
          <div key={it.k} className="bd-row">
            <span className="bd-k">{it.k}</span>
            <div className="bd-bar">
              <div className="bd-fill" style={{ width: `${(it.v / it.max) * 100}%` }} />
            </div>
            <span className="bd-v">
              {it.v.toFixed(1)}/{it.max}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
