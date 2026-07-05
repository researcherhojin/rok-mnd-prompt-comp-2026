interface Props {
  value: string
  onChange: (v: string) => void
  limit: number
  onPreview: () => void
  onSubmit: () => void
  onLoadExample: () => void
  busy: boolean
}

export function Editor({ value, onChange, limit, onPreview, onSubmit, onLoadExample, busy }: Props) {
  const len = value.length
  const over = len > limit
  const near = len > limit * 0.9

  return (
    <div className="card">
      <div className="card-head">
        <h2>행동 지침 작성</h2>
        <span className={`counter ${over ? 'over' : near ? 'near' : ''}`}>
          {len.toLocaleString()} / {limit.toLocaleString()}자
        </span>
      </div>
      <textarea
        className="editor-area"
        value={value}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        placeholder="예) 정비 횟수 5회 이상 또는 가동 4000 이상 또는 직전 고장 30일 이내면 HIGH …  출력은 `risk, cycle` 한 줄로."
      />
      <div className="editor-actions">
        <button className="btn ghost" onClick={onPreview} disabled={busy || over}>
          샘플 실행
        </button>
        <button className="btn primary" onClick={onSubmit} disabled={busy || over}>
          제출
        </button>
        {busy && <span className="busy" style={{ alignSelf: 'center' }}>채점 중…</span>}
      </div>
      <p className="hintline">
        규칙을 지침에 더 담을수록 정확도가 오릅니다. <button onClick={onLoadExample}>우수 예시 채우기</button>
      </p>
    </div>
  )
}
