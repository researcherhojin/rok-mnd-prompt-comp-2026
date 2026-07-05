import type { Leaderboard as Lb } from '../types'

interface Props {
  data: Lb | null
  myScore?: number
  myRank?: number
  full?: boolean
}

export function Leaderboard({ data, myScore, myRank, full }: Props) {
  if (!data) return null
  const max = Math.max(...data.distribution, 1)
  const myBucket = myScore != null ? Math.min(10, Math.floor(myScore / 10)) : -1

  return (
    <div className="card">
      <div className="card-head">
        <h2>리더보드</h2>
        <span className="tag num">{data.count}명</span>
      </div>

      <div className="hist">
        {data.distribution.map((c, i) => (
          <div key={i} className="hbar-wrap">
            <div className={`hbar ${i === myBucket ? 'mine' : ''}`} style={{ height: `${(c / max) * 100}%` }} />
            <span className="hlab">{i * 10}</span>
          </div>
        ))}
      </div>
      <p className="hcap">
        점수 분포 {myScore != null && <>· 내 위치 <b>{myScore.toFixed(1)}점</b></>}
      </p>

      <div className="lb-list">
        {data.entries.slice(0, full ? 50 : 8).map((e) => (
          <div key={e.rank} className={`lb-row ${e.rank === myRank ? 'mine' : ''}`}>
            <span className="lb-rank num">{e.rank}</span>
            <span className="lb-name">{e.rank === myRank ? '나' : e.participant}</span>
            <span className="lb-score num">{e.total_public.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
