import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import { Leaderboard } from '../components/Leaderboard'
import { ErrorBox, Loading } from '../components/State'
import type { Leaderboard as Lb } from '../types'

export function LeaderboardPage() {
  const { lastSubmit } = useStore()
  const [lb, setLb] = useState<Lb | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .leaderboard()
      .then(setLb)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  return (
    <div>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <h1>리더보드</h1>
        <p>대회 중 Public(12행) 기준 · 최종 순위는 마감 후 Private(18행) 재채점</p>
      </div>

      <div className="lbpage">
        {error ? (
          <ErrorBox msg={error} />
        ) : !lb ? (
          <div className="card">
            <Loading label="리더보드 불러오는 중…" />
          </div>
        ) : (
          <Leaderboard
            data={lb}
            myScore={lastSubmit?.score.total_public}
            myRank={lastSubmit?.rank}
            full
          />
        )}
        <div className="card">
          <div className="card-head">
            <h2>운영 안내</h2>
          </div>
          <ul className="prose" style={{ margin: 0, paddingLeft: 18 }}>
            <li>매일 자정 배치로 갱신됩니다.</li>
            <li>단계적 공개: 초반 구간 → 진행 중 자정 갱신 → 마지막날 실등수 → 마감 후 Private 최종.</li>
            <li>동점 처리: 수강률 → 최종 제출시간 → 유효성.</li>
            <li>상위권은 마감 후 보안·표절·산식 악용 검증을 거쳐 수상이 확정됩니다.</li>
          </ul>
          {!lastSubmit && (
            <div className="callout" style={{ marginTop: 14, marginBottom: 0 }}>
              아직 제출 전입니다. <b>제출하기</b>에서 지침을 제출하면 여기 분포에 내 위치가 표시됩니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
