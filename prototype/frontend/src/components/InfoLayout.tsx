import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

// 정보 페이지(개요·데이터셋·규칙·일정·시상) 공용 레이아웃: 본문 + 우측 대회 정보 사이드바
export function InfoLayout() {
  return (
    <div className="infogrid">
      <Outlet />
      <Sidebar />
    </div>
  )
}
