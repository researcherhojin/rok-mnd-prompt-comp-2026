// 규칙 (rules) — 제출 형식 · 세부 규칙 · 출력 파싱 · 유의 사항 · 문의·공지.
import { Card } from "../../ui";
import { Code, H, NumSec } from "./shared";

export function Rules() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <H>규칙</H>
        <p className="mt-2 text-[15px] leading-8 text-sub">
          제출물은 예측 파일이 아니라 <b className="text-ink">시스템 프롬프트 1개</b>입니다. 아래 형식·규칙을 지키지 않으면 해당 행이 오답
          처리되거나 제출이 반려될 수 있습니다.
        </p>
      </div>

      <NumSec n={1} title="제출 형식">
        <Card>
          <p className="text-sm leading-7 text-sub">각 입력 행에 대해 AI가 아래 형식으로만 답하도록 프롬프트를 작성하세요.</p>
          <Code>{`행마다 한 줄:  risk_grade, cycle_range
허용  risk_grade  = HIGH · MEDIUM · LOW
허용  cycle_range = 0-30 · 31-90 · 91-180 · 181+
예)  HIGH, 0-30`}</Code>
          <p className="mt-2 text-xs leading-6 text-muted">출력 줄 수는 입력 행 수와 같아야 하며, 허용 라벨 외의 설명·오타·빈 줄은 오답으로 처리됩니다.</p>
        </Card>
      </NumSec>

      <NumSec n={2} title="세부 규칙">
        <Card>
          <ul className="space-y-2.5 text-[15px] leading-7 text-sub">
            <li>• 제출물은 <b className="text-ink">시스템 프롬프트 1개</b>(행동 지침)이며, 예측 파일·코드는 제출하지 않습니다.</li>
            <li>• 프롬프트는 <b className="text-ink">3,000자 이내</b>. 초과 시 제출이 반려됩니다.</li>
            <li>• 여러 번 제출한 경우 <b className="text-ink">최고점이 자동으로 대표 제출</b>이 됩니다.</li>
            <li>• 출력은 행마다 <code>risk_grade, cycle_range</code> 콤마 한 줄이어야 합니다.</li>
            <li>• 샘플 데이터는 프롬프트에 자유롭게 활용할 수 있습니다.</li>
          </ul>
        </Card>
      </NumSec>

      <NumSec n={3} title="유의 사항">
        <Card>
          <ul className="space-y-2.5 text-[15px] leading-7 text-sub">
            <li>• 출력 파싱: 콤마 2개 필드가 아니거나 허용 라벨이 아니면 해당 속성 오답 처리, 행 수가 부족하면 부족분은 오답, 초과분은 무시됩니다.</li>
            <li>• 실제 부대명·작전 정보·개인정보를 프롬프트에 입력하지 마세요. 군 보안 표현·금지어는 검토 대상입니다.</li>
            <li>• 채점 산식 악용, 정답 유출, 자동화된 반복 제출은 실격 사유가 될 수 있습니다.</li>
          </ul>
        </Card>
      </NumSec>

      <NumSec n={4} title="문의 · 공지">
        <Card>
          <p className="text-[15px] leading-7 text-sub">
            대회 관련 공지와 문의는 운영 채널(별도 안내)을 통해 이뤄집니다. 규칙 해석·데이터 관련 질문에는 운영팀이 답변하되,
            정답·채점 로직에 대한 개별 문의에는 답하지 않습니다.
          </p>
        </Card>
      </NumSec>
    </div>
  );
}
