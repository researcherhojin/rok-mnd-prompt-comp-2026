import { BrowserRouter, Link, Navigate, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import { Submit } from "./views/Submit";
import { Leaderboard } from "./views/Leaderboard";
import { Detail } from "./views/Detail";
import { Ops } from "./views/Ops";
import { InfoLayout } from "./views/info/shared";
import { Description } from "./views/info/Description";
import { Data } from "./views/info/Data";
import { Evaluation } from "./views/info/Evaluation";
import { Rules } from "./views/info/Rules";

export type View =
  | { name: "description" }
  | { name: "data" }
  | { name: "evaluation" }
  | { name: "rules" }
  | { name: "submit" }
  | { name: "leaderboard" }
  | { name: "ops" }
  | { name: "detail"; id: number };

export interface Nav {
  go: (v: View) => void;
}

// 대회 안내 그룹(문제·데이터·평가·규칙)의 경로 — 상단 "대회 안내" 탭 활성 판정에 사용
const INFO_PATHS = ["/", "/data", "/evaluation", "/rules"];

// View → URL 경로 (라우터 단일 소스)
export function pathFor(v: View): string {
  if (v.name === "description") return "/";
  if (v.name === "detail") return `/detail/${v.id}`;
  return `/${v.name}`;
}

// 뷰 코드가 쓰던 nav.go(...)를 실제 라우터 네비게이션으로 연결
function useNav(): Nav {
  const navigate = useNavigate();
  return { go: (v) => navigate(pathFor(v)) };
}

// 상단 1차 내비 (모바일 우선). 대회 안내는 부모 — 하위 4페이지는 서브내비(InfoLayout)에서.
const TABS: { path: string; label: string }[] = [
  { path: "/", label: "대회 안내" },
  { path: "/submit", label: "제출" },
  { path: "/leaderboard", label: "리더보드" },
];

function Shell() {
  const nav = useNav();
  const { pathname } = useLocation();
  const isActive = (path: string) => {
    if (path === "/") return INFO_PATHS.includes(pathname);
    if (path === "/leaderboard") return pathname.startsWith("/leaderboard") || pathname.startsWith("/detail");
    return pathname.startsWith(path);
  };

  return (
    <div className="flex min-h-full flex-col">
      {/* 상단 네비 — 모바일에서는 타이틀 아래 가로 스크롤 탭바 */}
      <header className="sticky top-0 z-10 border-b border-line bg-canvas/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-3">
          <Link to="/" className="shrink-0 text-sm font-bold text-ink">
            문제 B · 자동채점 <span className="font-medium text-muted">시뮬레이터</span>
          </Link>
          <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 scrollbar-none [&::-webkit-scrollbar]:hidden">
            {TABS.map((t) => (
              <Link
                key={t.path}
                to={t.path}
                aria-current={isActive(t.path) ? "page" : undefined}
                className={`shrink-0 whitespace-nowrap rounded-ctl px-3 py-1.5 text-sm transition ${
                  isActive(t.path) ? "bg-accent-soft font-semibold text-accent" : "text-sub hover:bg-raise hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-6">
        <Routes>
          {/* 대회 안내 그룹 — 서브내비(문제·데이터·평가·규칙) */}
          <Route element={<InfoLayout />}>
            <Route path="/" element={<Description nav={nav} />} />
            <Route path="/data" element={<Data />} />
            <Route path="/evaluation" element={<Evaluation />} />
            <Route path="/rules" element={<Rules />} />
          </Route>
          <Route path="/submit" element={<Submit nav={nav} />} />
          <Route path="/leaderboard" element={<Leaderboard nav={nav} />} />
          <Route path="/detail/:id" element={<DetailRoute nav={nav} />} />
          <Route path="/ops" element={<Ops />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4 text-[11px] text-muted">
          <span>2026 국방AI 기반 프롬프트 경진대회 · 출제 04 (문제 B)</span>
          <Link to="/ops" className="hover:text-sub">운영·개발</Link>
        </div>
      </footer>
    </div>
  );
}

function DetailRoute({ nav }: { nav: Nav }) {
  const { id } = useParams();
  return <Detail id={Number(id)} nav={nav} />;
}

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
