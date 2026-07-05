"""P0 코어 데모 CLI.

기본 실행: 우수/평범/엉터리 지침 3개를 mock으로 채점해 점수 차이를 표로 보여준다.
= 머니샷의 채점 근거("지침을 개선하면 점수가 오른다")를 터미널에서 먼저 확인.

    python -m harness.cli                      # 3개 샘플 지침 비교
    python -m harness.cli --instruction f.txt  # 파일에 담긴 지침 1개 채점
"""
from __future__ import annotations

import argparse

from harness.core.data import generate
from harness.core.llm import MockClient
from harness.core.scoring import score_submission

EXCELLENT = (
    "너는 국방 설비 정비 분석가다. 아래 정비 이력으로 고장위험등급과 다음 정비주기 구간을 분류하라.\n"
    "규칙: 정비 횟수 5회 이상 또는 가동시간 4000 이상 또는 직전 고장 30일 이내면 HIGH. "
    "정비 횟수 2회 이하 그리고 가동시간 2000 미만 그리고 직전 고장 90일 초과면 LOW. 그 외 MEDIUM.\n"
    "주기: HIGH면 0-30, LOW면 181+, MEDIUM은 가동시간 3000 이상이면 31-90 아니면 91-180.\n"
    "출력은 반드시 `risk, cycle` 한 줄로만."
)
VAGUE = "장비 상태를 보고 고장 위험등급과 정비주기를 판단해 `HIGH, 0-30` 형식 한 줄로 답하라."
PROSE = "이 장비의 상태에 대해 자유롭게 설명해줘."


def _fmt(res: dict) -> str:
    return (
        f"  총점(Public) {res['total_public']:6.2f} | "
        f"평균F1 {res['avg_f1_public']:.2f} | 간결성 {res['brevity']:.2f} | "
        f"유효 {res['validity']:4.1f} | 형식 {res['format']:4.1f} | 보안 {res['security']:2d} | "
        f"글자 {res['chars']:4d} | 계약 {res['n_contract']}/{res['n_test']}"
    )


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--instruction", help="채점할 지침이 담긴 텍스트 파일")
    args = ap.parse_args()

    ds = generate()
    llm = MockClient(ds)

    if args.instruction:
        with open(args.instruction, encoding="utf-8") as f:
            inst = f.read()
        res = score_submission(inst, ds, llm)
        print(f"[{res['model']}] 채점 결과")
        print(_fmt(res))
        return

    print(f"채점 모델: {llm.name} (오프라인 시뮬레이터)\n")
    for name, inst in [("① 우수 지침", EXCELLENT), ("② 평범 지침", VAGUE), ("③ 엉터리 지침", PROSE)]:
        res = score_submission(inst, ds, llm)
        print(name)
        print(_fmt(res))
        print()
    print("→ 우수 > 평범 > 엉터리 순으로 총점이 벌어지면 채점 엔진이 지침 품질을 변별하는 것.")


if __name__ == "__main__":
    main()
