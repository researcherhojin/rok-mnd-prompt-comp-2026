import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: '개요', end: true },
  { to: '/data', label: '데이터셋' },
  { to: '/rules', label: '규칙·평가' },
  { to: '/timeline', label: '일정' },
  { to: '/prizes', label: '시상' },
  { to: '/faq', label: 'FAQ' },
  { to: '/leaderboard', label: '리더보드' },
]

export function Nav() {
  return (
    <nav className="nav">
      <div className="nav-tabs">
        {tabs.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            end={t.end}
            className={({ isActive }) => `nav-tab ${isActive ? 'active' : ''}`}
          >
            {t.label}
          </NavLink>
        ))}
      </div>
      <NavLink to="/submit" className={({ isActive }) => `nav-cta ${isActive ? 'active' : ''}`}>
        제출하기 →
      </NavLink>
    </nav>
  )
}
