import { useEffect, useState } from 'react'
import { api } from '../api'
import { useStore } from '../store'
import { Editor } from '../components/Editor'
import { Preview } from '../components/Preview'
import { ScorePanel } from '../components/ScorePanel'
import { Leaderboard } from '../components/Leaderboard'
import { Loading } from '../components/State'
import type { Leaderboard as Lb, PreviewResult, SubmitResult, TrainRow } from '../types'

const VAGUE = '장비 상태를 보고 고장위험등급과 정비주기를 판단해 `risk, cycle` 한 줄로 답하라.'
const EXCELLENT =
  '정비 이력을 분석해 고장위험등급과 다음 정비주기를 분류하라.\n' +
  '규칙: 정비 횟수 5회 이상 또는 가동시간 4000 이상 또는 직전 고장 30일 이내면 HIGH. ' +
  '정비 2회 이하 그리고 가동 2000 미만 그리고 직전 고장 90일 초과면 LOW. 그 외 MEDIUM.\n' +
  '주기: HIGH면 0-30, LOW면 181+, MEDIUM은 가동 3000 이상이면 31-90 아니면 91-180.\n' +
  '출력은 반드시 `risk, cycle` 한 줄로만.'

export function Console() {
  const { problem, problemError, setLastSubmit, refreshParticipants } = useStore()
  const [instruction, setInstruction] = useState(VAGUE)
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [submitRes, setSubmitRes] = useState<SubmitResult | null>(null)
  const [lb, setLb] = useState<Lb | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api.leaderboard().then(setLb).catch(() => {})
  }, [])

  async function runPreview() {
    setBusy(true)
    setError(null)
    try {
      setPreview(await api.preview(instruction))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function runSubmit() {
    setBusy(true)
    setError(null)
    try {
      const r = await api.submit(instruction, '나')
      setSubmitRes(r)
      setLastSubmit(r)
      setLb(await api.leaderboard())
      refreshParticipants()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const ex: TrainRow | undefined = problem?.train[0]
  const err = error ?? problemError

  return (
    <>
      <div className="page-head" style={{ marginBottom: 16 }}>
        <h1>제출 · 참가자 콘솔</h1>
        <p>행동 지침을 작성하고 학습셋에 미리 실행해 본 뒤 제출하세요. 채점은 지정 모델 재실행으로 이뤄집니다.</p>
      </div>

      {err && (
        <div className="banner">
          {err} — 백엔드 실행 확인: <code>uv run uvicorn harness.api.main:app</code>
        </div>
      )}

      <div className="grid">
        <div className="col">
          {!problem && !err && (
            <div className="card">
              <Loading label="문제 불러오는 중…" />
            </div>
          )}
          {problem && (
            <div className="card">
              <div className="card-head">
                <h2>문제 · 라벨</h2>
                <span className="tag">학습 {problem.train.length}행 공개</span>
              </div>
              <p className="summary">{problem.summary}</p>
              <div className="labels">
                <div className="lblrow">
                  <span className="k">위험등급</span>
                  {problem.labels.failure_risk_grade.map((l) => (
                    <span key={l} className="chip">
                      {l}
                    </span>
                  ))}
                </div>
                <div className="lblrow">
                  <span className="k">정비주기</span>
                  {problem.labels.maintenance_cycle_range.map((l) => (
                    <span key={l} className="chip">
                      {l}
                    </span>
                  ))}
                </div>
              </div>
              {ex && (
                <div className="example">
                  <div className="cap">학습 예시 #{ex.id}</div>
                  <div className="kv">
                    <span className="kk">장비</span>
                    <span className="vv">{ex.equipment_type}</span>
                    <span className="kk">정비횟수 · 가동</span>
                    <span className="vv num">
                      {ex.maintenance_count_1y}회 · {ex.operating_hours.toLocaleString()}h
                    </span>
                    <span className="kk">직전 고장</span>
                    <span className="vv num">{ex.days_since_last_failure}일 전</span>
                    <span className="kk">정답</span>
                    <span className="ans">
                      {ex.failure_risk_grade}, {ex.maintenance_cycle_range}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          <Editor
            value={instruction}
            onChange={setInstruction}
            limit={problem?.char_limit ?? 3000}
            onPreview={runPreview}
            onSubmit={runSubmit}
            onLoadExample={() => setInstruction(EXCELLENT)}
            busy={busy}
          />
        </div>

        <div className="col">
          <Preview result={preview} />
          <ScorePanel result={submitRes} />
          <Leaderboard data={lb} myScore={submitRes?.score.total_public} myRank={submitRes?.rank} />
        </div>
      </div>
    </>
  )
}
