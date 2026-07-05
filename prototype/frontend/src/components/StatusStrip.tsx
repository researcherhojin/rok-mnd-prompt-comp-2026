import { useStore } from '../store'

export function StatusStrip() {
  const { participants } = useStore()
  return (
    <div className="statstrip">
      <span className="statuschip">
        <span className="dot" />
        준비 중
      </span>
      <div className="stat">
        <span className="sl">참가자 (현재)</span>
        <span className="sv">{participants != null ? participants.toLocaleString() : '—'}명</span>
      </div>
      <div className="stat">
        <span className="sl">예상 규모</span>
        <span className="sv">약 1만 명</span>
      </div>
      <div className="stat">
        <span className="sl">제출</span>
        <span className="sv">1일 3회</span>
      </div>
      <div className="stat">
        <span className="sl">지침 한도</span>
        <span className="sv">3,000자</span>
      </div>
    </div>
  )
}
