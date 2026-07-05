export function Loading({ label = '불러오는 중…' }: { label?: string }) {
  return (
    <div className="loading">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="banner">
      {msg} — 백엔드 실행 확인: <code>uv run uvicorn harness.api.main:app</code>
    </div>
  )
}
