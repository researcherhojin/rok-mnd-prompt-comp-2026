// 운영/개발 전달 (ops) — 내부용. 하네스 파라미터·순위 산정 로직·재현성. 참가자 내비 비노출.
import { useEffect, useState } from "react";
import { api, type ScoringConfig } from "../api";
import { CHAR_HARDCAP } from "../types";
import { Card } from "../ui";

function KV({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-[11px] text-muted">
          <tr><th className="py-1.5 pr-3 font-semibold">항목</th><th className="py-1.5 pr-3 font-semibold">값</th><th className="py-1.5 font-semibold">비고</th></tr>
        </thead>
        <tbody className="text-sub">
          {rows.map(([k, v, note]) => (
            <tr key={k} className="border-t border-line align-top">
              <td className="py-2 pr-3 font-medium text-ink">{k}</td>
              <td className="mono py-2 pr-3 text-accent">{v}</td>
              <td className="py-2 leading-6">{note}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Ops() {
  const [cfg, setCfg] = useState<ScoringConfig | null>(null);
  useEffect(() => {
    api.config().then(setCfg).catch(() => setCfg(null));
  }, []);
  const model = cfg?.model ?? "…";
  const cap = cfg?.char_cap ?? CHAR_HARDCAP;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h2 className="text-base font-bold text-ink">운영 · 개발 전달</h2>
        <div className="mt-3 rounded-ctl border border-line bg-raise px-3 py-2 text-xs leading-6 text-sub">
          <b className="text-ink">내부 운영·개발팀용</b> — 참가자에게 노출되지 않는 하네스 설정과 순위 산정 로직입니다. 상세 명세는
          <code> request/harness_config_options.md</code>를 정본으로 합니다.
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-base font-bold text-ink">순위 산정 로직</h3>
        <Card>
          <ul className="space-y-2.5 text-sm leading-7 text-sub">
            <li>• <b className="text-ink">최고점 자동 선택</b>: 동일 참가자(name)의 제출 중 최고 리더보드 점수 1건만 순위에 반영. 나머지는 누적 제출 수로만 집계.</li>
            <li>• <b className="text-ink">리더보드 점수</b> = 0.9 · 예측 성능(Macro F1) + 0.1 · 프롬프트 효율성. (가중치 주최측 미확정 · 잠정)</li>
            <li>• <b className="text-ink">토탈 점수</b> = 리더보드 점수 + 온라인 수강률 + 제출형식 준수 + 보안 적합성 (최종·수상, 별도 공지).</li>
            <li>• <b className="text-ink">동점</b>: 예측 성능 → Private → 최초 제출 순. (프롬프트 효율성 반영은 배점 확정 시)</li>
            <li>• <b className="text-ink">채점 소스</b>: 대회 중 Public(300) → 마감 후 Private(700) 재채점.</li>
          </ul>
        </Card>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold text-ink">하네스 파라미터</h3>
        <Card>
          {/* seed·max_tokens·동시 호출 리터럴은 grader/config.py가 정본 (표시용 미러) */}
          <KV rows={[
            ["채점 모델", model, "LLM_MODEL(.env). non-reasoning 소형. 검증 후 확정(미확정)"],
            ["temperature", String(cfg?.temperature ?? 0), "재현성 위해 고정"],
            ["seed", "42", "재현성 고정. 참가자 비노출(UI엔 temperature만 표시)"],
            ["max_tokens", "50", "정답-only 한 줄 출력에 맞춤"],
            ["동시 호출", "8", "MAX_CONCURRENCY. API 세션 점유가 병목 → 배치·큐"],
            ["글자수 하드캡", String(cap), "초과 시 제출 반려"],
          ]} />
        </Card>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold text-ink">데이터 · 채점</h3>
        <Card>
          <KV rows={[
            ["데이터 경로", "data/", "GRADER_DATA_DIR로 override. 정답 키(public·private·all)는 git 미추적"],
            ["스플릿", "10 / 300 / 700", "sample(공개) / Public(리더보드) / Private(최종)"],
            ["예측 점수", "(risk F1 + cycle F1)/2", "두 축 독립 채점, 한쪽에서 다른 쪽 추론 금지"],
            ["효율성", `(${cap} − 글자수)/${cap}`, "하드캡과 연동"],
          ]} />
        </Card>
      </section>

      <section>
        <h3 className="mb-3 text-base font-bold text-ink">재현성 · 감사</h3>
        <Card>
          <p className="text-sm leading-7 text-sub">
            LLM 출력은 완전 결정적이지 않으므로 raw 출력 / 파싱 / 점수를 모두 저장합니다. 동일 프롬프트 재실행 시 seed·temperature 고정으로
            재현성을 확보하며, 분쟁 시 저장된 원문으로 감사합니다.
          </p>
        </Card>
      </section>
    </div>
  );
}
