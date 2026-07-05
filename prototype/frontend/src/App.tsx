import { Route, Routes } from 'react-router-dom'
import { StoreProvider } from './store'
import { Nav } from './components/Nav'
import { StatusStrip } from './components/StatusStrip'
import { InfoLayout } from './components/InfoLayout'
import { Footer } from './components/Footer'
import { Overview } from './pages/Overview'
import { Data } from './pages/Data'
import { Rules } from './pages/Rules'
import { Timeline } from './pages/Timeline'
import { Prizes } from './pages/Prizes'
import { Faq } from './pages/Faq'
import { LeaderboardPage } from './pages/Leaderboard'
import { Console } from './pages/Console'

export default function App() {
  return (
    <StoreProvider>
      <header className="hero2">
        <div className="eyebrow">국방부 · 국방AI 프롬프트 경진대회</div>
        <h1>설비·고장 정비주기 예측형</h1>
        <p className="lede">
          정비 이력으로 고장위험등급과 다음 정비주기 구간을 분류하는 행동 지침을 설계하는 프롬프트 엔지니어링 대회
        </p>
        <StatusStrip />
      </header>

      <Nav />

      <main>
        <Routes>
          <Route element={<InfoLayout />}>
            <Route path="/" element={<Overview />} />
            <Route path="/data" element={<Data />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/timeline" element={<Timeline />} />
            <Route path="/prizes" element={<Prizes />} />
            <Route path="/faq" element={<Faq />} />
          </Route>
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/submit" element={<Console />} />
        </Routes>
      </main>

      <Footer />
    </StoreProvider>
  )
}
