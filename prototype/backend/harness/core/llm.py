"""LLM 어댑터 — 채점 하네스가 참가자 지침을 재실행할 때 쓰는 모델 클라이언트.

두 구현:
- `MockClient`  : **오프라인 시뮬레이터** (데모 기본값). 실제 추론이 아니라, 지침이 정답
                  규칙을 얼마나 담았는지(coverage q)에 비례해 정답률을 흉내 낸다. 결정론·무지연·무비용.
                  "지침을 개선하면 점수가 오른다"(머니샷)를 오프라인에서 재현하기 위한 장치.
- `OpenAIClient`: **실호출** (P5·데모 경로 밖). gpt-4.1-nano · temperature 0 · seed 고정.

두 클라이언트 모두 `.run(instruction, serialized_row) -> str` 인터페이스만 노출한다.
"""
from __future__ import annotations

import hashlib
import json
import re

from .data import CYCLE_LABELS, RISK_LABELS

# 지침이 담은 '규칙 신호' — 많이 담을수록 mock 정답률↑
_RULE_SIGNALS = [
    "5회", "4000", "30일", "2회", "2000", "90일", "3000",
    "정비 횟수", "가동시간", "직전 고장", "수리기간", "정규화",
]
# 출력 계약을 지시했는지 판단하는 신호
_CONTRACT_SIGNALS = ["한 줄", "콤마", "형식", "HIGH", "0-30", "181", "risk", "cycle"]

_RULE_TARGET = 7.0   # 이만큼 신호를 담으면 coverage 만점 취급


def _coverage(instruction: str) -> float:
    # 천단위 콤마 제거('4,000'→'4000')해 숫자 신호가 표기 차이로 누락되지 않게.
    norm = re.sub(r"(?<=\d),(?=\d)", "", instruction)
    hit = sum(1 for s in _RULE_SIGNALS if s in norm)
    return min(1.0, hit / _RULE_TARGET)


def _mentions_contract(instruction: str) -> bool:
    return any(s in instruction for s in _CONTRACT_SIGNALS)


def _row_seed(row_id: int) -> float:
    """행 고유 난이도 ∈ [0,1). 지침 텍스트와 독립이므로 coverage q에 대해 점수가 단조.

    지침 전체를 시드로 쓰면 공백 하나만 바꿔도 정오가 뒤집혀(랭킹 역전·게이밍),
    '지침을 개선하면 점수가 오른다'는 불변식이 깨진다. 그래서 행 id만으로 시드한다.
    """
    h = hashlib.md5(f"row|{row_id}".encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def _confuse(true: str, order: list[str], u: float) -> str:
    """정답을 인접 클래스로 밀어 오분류를 흉내(경계 혼동)."""
    i = order.index(true)
    shift = 1 if int(u * 100) % 2 == 0 else -1
    j = i + shift
    if j < 0 or j >= len(order):
        j = i - shift
    return order[j]


class MockClient:
    """오프라인 채점 시뮬레이터 (데모 기본값)."""

    name = "mock-sim"

    def __init__(self, dataset: dict):
        # 시뮬레이터는 스탠드인 모델이므로 정답을 참조한다(실모델은 참조하지 않음).
        self.gt = {g["id"]: g for g in dataset["ground_truth"]}

    def run(self, instruction: str, serialized_row: str) -> str:
        row = json.loads(serialized_row)
        g = self.gt[row["id"]]
        true_r = g["failure_risk_grade"]
        true_c = g["maintenance_cycle_range"]

        # 출력 계약을 지시하지 않으면 산문으로 답(파싱 실패 유도 → 유효/형식 감점)
        if not _mentions_contract(instruction):
            tone = "높아" if true_r == "HIGH" else ("낮아" if true_r == "LOW" else "보통이")
            return f"이 장비는 정비 이력으로 볼 때 고장 위험이 {tone} 보입니다."

        q = _coverage(instruction)
        acc = 0.30 + 0.67 * q          # q=0 → 0.30, q=1 → 0.97
        d = _row_seed(row["id"])       # 행 고유 난이도(지침 텍스트와 무관 → q에 단조)
        if d < acc:
            r, c = true_r, true_c
        else:
            r = _confuse(true_r, RISK_LABELS, d)
            c = _confuse(true_c, CYCLE_LABELS, d)
        return f"{r}, {c}"


class OpenAIClient:
    """실호출 클라이언트 (P5). OPENAI_API_KEY 필요. import는 사용 시점까지 지연."""

    def __init__(self, model: str = "gpt-4.1-nano", seed: int = 7):
        from openai import OpenAI  # type: ignore  # 선택 의존성(P5): uv sync --group llm 후 설치

        self.client = OpenAI()
        self.model = model
        self.name = model
        self.seed = seed

    def run(self, instruction: str, serialized_row: str) -> str:
        resp = self.client.responses.create(
            model=self.model,
            temperature=0,
            seed=self.seed,
            max_output_tokens=64,
            input=[
                {"role": "system", "content": instruction},   # 캐시되는 안정 프리픽스
                {"role": "user", "content": serialized_row},   # 행마다 변하는 부분
            ],
        )
        return resp.output_text.strip()
