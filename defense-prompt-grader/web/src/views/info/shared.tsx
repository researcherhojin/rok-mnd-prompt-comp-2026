// 대회 안내 4개 페이지(문제·데이터·평가·규칙) 공유 헬퍼 + 서브내비 레이아웃.
// 운영자 전용 판정 로직(임계값·함정·계통별 분포)은 절대 노출 금지.
import type { ReactNode } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Card } from "../../ui";

export function H({ children }: { children: ReactNode }) {
  return <h2 className="text-base font-bold text-ink">{children}</h2>;
}

export function Code({ children }: { children: ReactNode }) {
  return (
    <pre className="mono overflow-x-auto rounded-ctl bg-raise p-3 text-xs leading-6 text-sub">{children}</pre>
  );
}

// [label] 대괄호 헤딩 + 카드 본문
export function Bracket({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2.5 text-base font-bold text-ink">
        <span className="text-accent">[</span>{label}<span className="text-accent">]</span>
      </h2>
      <Card className="p-5">
        <div className="text-[15px] leading-8 text-sub">{children}</div>
      </Card>
    </section>
  );
}

// 라벨 + "자세히 →" 링크가 있는 섹션 (다른 페이지로 연결)
export function LinkedSec({ label, linkLabel, onLink, children }: { label: string; linkLabel: string; onLink: () => void; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-ink">
          <span className="text-accent">[</span>{label}<span className="text-accent">]</span>
        </h2>
        <button onClick={onLink} className="shrink-0 text-xs font-medium text-accent hover:underline">{linkLabel}</button>
      </div>
      <Card className="p-5">
        <div className="text-[15px] leading-8 text-sub">{children}</div>
      </Card>
    </section>
  );
}

// 번호 매긴 섹션 (평가·규칙 페이지)
export function NumSec({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="flex items-center gap-2 text-base font-bold text-ink">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-xs text-white">{n}</span>
        {title}
      </h2>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

// 대회 안내 서브내비 (문제·데이터·평가·규칙) + 하위 페이지 Outlet
const SUB_TABS: { path: string; label: string }[] = [
  { path: "/", label: "문제" },
  { path: "/data", label: "데이터" },
  { path: "/evaluation", label: "평가" },
  { path: "/rules", label: "규칙" },
];

export function InfoLayout() {
  const { pathname } = useLocation();
  const active = (p: string) => (p === "/" ? pathname === "/" : pathname.startsWith(p));
  return (
    <div className="space-y-6">
      <nav className="-mx-1 flex gap-1 overflow-x-auto border-b border-line px-1 pb-2.5 scrollbar-none [&::-webkit-scrollbar]:hidden">
        {SUB_TABS.map((t) => (
          <Link
            key={t.path}
            to={t.path}
            aria-current={active(t.path) ? "page" : undefined}
            className={`shrink-0 whitespace-nowrap rounded-ctl px-3 py-1.5 text-sm transition ${
              active(t.path) ? "bg-accent-soft font-semibold text-accent" : "text-sub hover:bg-raise hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
