import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { useStore } from '../store'

export function Sidebar() {
  const { participants } = useStore()

  const rows: [string, ReactNode][] = [
    ['상태', <span className="tbd">준비 중</span>],
    ['기간', <span className="tbd">확정 예정</span>],
    ['주최', '국방부'],
    ['주관', 'IITP · KAIST · 데이원컴퍼니'],
    ['채점 모델', <span className="mono13">gpt-4.1-nano</span>],
    ['참가자 (현재)', participants != null ? `${participants.toLocaleString()}명` : '—'],
    ['예상 규모', '약 1만 명'],
  ]

  return (
    <aside className="sidecard">
      <h3>대회 정보</h3>
      {rows.map(([k, v]) => (
        <div className="siderow" key={k}>
          <span className="sk">{k}</span>
          <span className="sv">{v}</span>
        </div>
      ))}
      <NavLink to="/submit" className="sidecta">
        제출하기 →
      </NavLink>
    </aside>
  )
}
