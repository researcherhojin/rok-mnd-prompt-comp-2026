"""응답 파싱: LLM 원문 한 줄 → (risk_grade, cycle_range) 코드 쌍. 임의 변경 금지 (엄밀 명세).

규칙:
  1. 한 줄을 콤마로 분리해 두 필드로 본다.
  2. risk 토큰(HIGH/MEDIUM/LOW)과 cycle 토큰(0-30/31-90/91-180/181+)은 알파벳이 겹치지 않으므로
     위치가 아니라 토큰 타입으로 축(axis)을 배정한다 ("0-30, HIGH" 도 올바르게 파싱).
  3. 각 축은 독립 검증한다. 한 축만 유효하면 나머지는 INVALID (부분 파싱 허용).
  4. 한 축에 서로 다른 코드가 2개 이상 등장하면 그 축은 INVALID.
"""

from __future__ import annotations

from .config import CYCLE_LABELS, INVALID, RISK_LABELS

_RISK_TOKENS = {lbl: lbl for lbl in RISK_LABELS}  # HIGH/MEDIUM/LOW
_CYCLE_TOKENS = {lbl: lbl for lbl in CYCLE_LABELS}  # 0-30/31-90/91-180/181+


def _match_axis(text: str, tokens: dict[str, str]) -> str:
    """text에서 해당 축 라벨을 추출. 정확히 하나만 등장하면 채택, 아니면 INVALID."""
    t = text.strip().upper()
    if t in tokens:
        return tokens[t]
    present = {code for token, code in tokens.items() if token in t}
    if len(present) == 1:
        return next(iter(present))
    return INVALID


def parse_line(raw: str | None) -> tuple[str, str]:
    """원문 한 줄 → (risk_code, cycle_code). 각 축 독립적으로 INVALID 가능."""
    if raw is None:
        return (INVALID, INVALID)
    text = raw.strip()

    # 규칙 1·2: 콤마로 분리하되, 각 조각을 두 축 모두에 시험해 타입으로 배정.
    # (콤마 없으면 split은 [text] 하나를 그대로 반환)
    parts = text.split(",")
    risk = INVALID
    cycle = INVALID
    for part in parts:
        r = _match_axis(part, _RISK_TOKENS)
        c = _match_axis(part, _CYCLE_TOKENS)
        if r != INVALID and risk == INVALID:
            risk = r
        if c != INVALID and cycle == INVALID:
            cycle = c

    # 콤마가 없거나 조각 배정이 실패한 경우: 전체 문자열에서 축별로 다시 스캔.
    if risk == INVALID:
        risk = _match_axis(text, _RISK_TOKENS)
    if cycle == INVALID:
        cycle = _match_axis(text, _CYCLE_TOKENS)
    return (risk, cycle)
