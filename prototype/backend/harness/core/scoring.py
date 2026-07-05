"""자동채점 엔진 (고정 하네스).

`request/dev_workplan_scoring_leaderboard.md` §3 그대로 구현한다.
직렬화 → (LLM 재실행) → 파싱 → Macro F1·간결성·유효/형식/보안 → 통합 산식.

이 모듈은 LLM을 직접 호출하지 않는다. `llm` 객체(`.run(instruction, serialized_row)`)를
주입받아 결정론적 배관만 담당한다 = 기획서 §2 "분석이냐 배관이냐"의 배관 쪽.
"""
from __future__ import annotations

import json
import re

from .data import CYCLE_LABELS, RISK_LABELS

C_MIN, C_MAX = 200, 3000                 # 간결성 정규화 상수 (기획서 §4.3)
ALLOWED_RISK = set(RISK_LABELS)
ALLOWED_CYCLE = set(CYCLE_LABELS)

_LABEL_KEYS = ("failure_risk_grade", "maintenance_cycle_range", "split")


def serialize(row: dict) -> str:
    """test 레코드를 raw JSON 1줄로 직렬화 (라벨·split 제외, 파생값 없음)."""
    payload = {k: v for k, v in row.items() if k not in _LABEL_KEYS}
    return json.dumps(payload, ensure_ascii=False)


# 마지막 줄에서 `위험, 주기` 추출 (앞선 추론 텍스트 허용).
# 좌측 (?<![0-9A-Za-z_]): 'below,0-30'·'3HIGH'·'_HIGH'처럼 ASCII 문자·숫자·밑줄에 붙은
#   라벨을 차단하되, 한글 직결('분석결과HIGH')은 허용(한글은 이 클래스에 없음).
#   \b는 한글도 \w라 유효 답안까지 버리므로 쓰지 않는다.
# 우측 (?![-\d+]): '0-300'·'91-1800'처럼 라벨 뒤 숫자 확장형을 무효 처리.
_PARSE_RE = re.compile(
    r"(?<![0-9A-Za-z_])(HIGH|MEDIUM|LOW)\s*,\s*(0-30|31-90|91-180|181\+)(?![-\d+])", re.I
)
# 출력 계약(한 줄) 엄격 판정: 마지막 비어있지 않은 줄이 통째로 계약과 일치
_CONTRACT_RE = re.compile(r"^\s*(HIGH|MEDIUM|LOW)\s*,\s*(0-30|31-90|91-180|181\+)\s*$", re.I)


def parse(text: str) -> tuple[str | None, str | None]:
    """모델 출력 → (risk, cycle). 실패 시 (None, None)."""
    for line in reversed(text.strip().splitlines()):
        m = _PARSE_RE.search(line)
        if m:
            return m.group(1).upper(), m.group(2)
    return None, None


def is_contract_line(text: str) -> bool:
    """출력이 계약(단일 라인)을 정확히 준수하는가.

    파싱(parse)은 앞선 추론을 허용하지만, 형식 점수는 '한 줄' 계약(기획서 §3.1)을
    엄격히 본다 → 추론을 덧붙이면 정확도는 살되 형식 점수는 깎인다.
    """
    lines = [ln for ln in text.strip().splitlines() if ln.strip()]
    return len(lines) == 1 and bool(_CONTRACT_RE.match(lines[0]))


def macro_f1(y_true: list, y_pred: list, labels: list) -> float:
    """클래스별 F1의 단순 평균 (Macro F1). 허용 밖/None 예측은 어느 클래스도 아니므로 오분류.

    정답·예측 어디에도 없는 클래스는 평균에서 제외한다(sklearn 기본·DACON 관례).
    → 특정 split에 클래스가 없어도 완벽 예측은 1.0. phantom 예측은 fp로 이미 감점되어 게이밍 이득 없음.
    """
    present = [c for c in labels if c in y_true or c in y_pred]
    if not present:
        return 0.0
    f1s = []
    for c in present:
        tp = sum(t == c and p == c for t, p in zip(y_true, y_pred))
        fp = sum(t != c and p == c for t, p in zip(y_true, y_pred))
        fn = sum(t == c and p != c for t, p in zip(y_true, y_pred))
        prec = tp / (tp + fp) if tp + fp else 0.0
        rec = tp / (tp + fn) if tp + fn else 0.0
        f1s.append(2 * prec * rec / (prec + rec) if prec + rec else 0.0)
    return sum(f1s) / len(f1s)


def brevity(instruction_chars: int, c_min: int = C_MIN, c_max: int = C_MAX) -> float:
    """간결성 점수(0~1). C_min 이하 1.0, C_max 이상 0.0."""
    return max(0.0, min(1.0, (c_max - instruction_chars) / (c_max - c_min)))


# 보안 스캔 — 구조적 개인정보·군 보안 표현·금지어 정규식 (기획서 §4.4 / workplan §3.4).
# 실명 같은 자유텍스트 이름은 정규식으로 신뢰성 있게 탐지 불가(일반 명사 '이름/담당자/성명…'과
#   구분 안 돼 정상 제출을 오탐·감점) → 자동 스캔에서 제외하고, 상위권 사후심사(§5 2단계)·
#   프로덕션 NER에 위임. 숫자 패턴은 앞뒤 (?<!\d)/(?!\d)로 더 긴 숫자열 속 우연 매칭을 차단.
# RRN: 하이픈/무구분 + 앞 6자리 YYMMDD 검증 → 비용/스펙 범위('100000-1000000') 오탐 차단.
# 전화: 하이픈/무구분만(공백 제거) → '019 000 1234' 같은 공백 숫자 나열 오탐 차단.
# 이메일: TLD를 [a-zA-Z]{2,}로 강제 → '압력 4@3.5' 같은 숫자 비율 표기 오탐 차단.
# (숫자가 많은 도메인이라 정규식 PII는 오탐 꼬리가 길다 → 실질 방어선은 §5 사후 검토 플래그.)
_FORBIDDEN = [
    ("주민등록번호", re.compile(r"(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])-?[1-8]\d{6}(?!\d)")),
    ("전화번호", re.compile(r"(?<!\d)01[016789]-?\d{3,4}-?\d{4}(?!\d)")),
    ("이메일", re.compile(r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}")),
    ("군보안표현", re.compile(r"군사기밀|대외비|비인가|기밀문서")),
]


def security_score(instruction: str, outputs: list[str]) -> tuple[int, list[str]]:
    """금지 패턴 0건이면 10, 매칭 시 건당 -5(하한 0) + 위반 항목 목록."""
    text = instruction + "\n" + "\n".join(outputs)
    flags = [name for name, pat in _FORBIDDEN if pat.search(text)]
    return max(0, 10 - 5 * len(flags)), flags


def combine(
    avg_f1: float,
    brevity_score: float,
    validity: float,
    format_: float,
    security: float,
    vod_ok: bool,
) -> dict:
    """통합 산식 (총 100). 기획서 §4.1 / workplan §3.5.

    task = 45 × (0.9·평균F1 + 0.1·간결성)
    total = task + 25·수강 + 유효 + 형식 + 보안
    """
    task = 45 * (0.9 * avg_f1 + 0.1 * brevity_score)
    vod = 25 if vod_ok else 0
    total = task + vod + validity + format_ + security
    return {
        "task_block": task,
        "vod": vod,
        "validity": validity,
        "format": format_,
        "security": security,
        "total": total,
    }


def score_submission(instruction: str, dataset: dict, llm, vod_ok: bool = True) -> dict:
    """행동 지침 1개를 test 30행에 재실행해 채점. 대회 중 총점은 Public 기준."""
    test = dataset["test"]
    gt = {g["id"]: g for g in dataset["ground_truth"]}
    n = len(test)

    outputs: list[str] = []
    preds: dict[int, tuple[str | None, str | None]] = {}
    for row in test:
        raw = llm.run(instruction, serialize(row))
        outputs.append(raw)
        preds[row["id"]] = parse(raw)

    def split_f1(split: str) -> tuple[float, float]:
        ids = [g["id"] for g in dataset["ground_truth"] if g["split"] == split]
        rt = [gt[i]["failure_risk_grade"] for i in ids]
        ct = [gt[i]["maintenance_cycle_range"] for i in ids]
        rp = [preds[i][0] or "∅" for i in ids]      # None → 어느 클래스도 아닌 sentinel
        cp = [preds[i][1] or "∅" for i in ids]
        return macro_f1(rt, rp, RISK_LABELS), macro_f1(ct, cp, CYCLE_LABELS)

    f1r_pub, f1c_pub = split_f1("PUBLIC")
    f1r_pri, f1c_pri = split_f1("PRIVATE")
    avg_pub = (f1r_pub + f1c_pub) / 2
    avg_pri = (f1r_pri + f1c_pri) / 2

    n_valid = sum(
        1 for i in preds if preds[i][0] in ALLOWED_RISK and preds[i][1] in ALLOWED_CYCLE
    )
    n_contract = sum(1 for o in outputs if is_contract_line(o))
    validity = 10 * n_valid / n if n else 0.0
    format_ = 10 * n_contract / n if n else 0.0
    security, flags = security_score(instruction, outputs)
    brev = brevity(len(instruction))

    pub = combine(avg_pub, brev, validity, format_, security, vod_ok)
    pri = combine(avg_pri, brev, validity, format_, security, vod_ok)

    return {
        "model": getattr(llm, "name", "?"),
        "chars": len(instruction),
        "brevity": brev,
        "f1_risk_public": f1r_pub,
        "f1_cycle_public": f1c_pub,
        "avg_f1_public": avg_pub,
        "avg_f1_private": avg_pri,
        "validity": validity,
        "format": format_,
        "security": security,
        "security_flags": flags,
        "vod": pub["vod"],
        "task_block": pub["task_block"],
        "total_public": pub["total"],
        "total_private": pri["total"],
        "n_valid": n_valid,
        "n_contract": n_contract,
        "n_test": n,
        # 행별 예측 (프론트 콘솔의 행별 pill용)
        "rows": [
            {
                "id": row["id"],
                "pred_risk": preds[row["id"]][0],
                "pred_cycle": preds[row["id"]][1],
                "true_risk": gt[row["id"]]["failure_risk_grade"],
                "true_cycle": gt[row["id"]]["maintenance_cycle_range"],
                "split": gt[row["id"]]["split"],
                "correct": (
                    preds[row["id"]][0] == gt[row["id"]]["failure_risk_grade"]
                    and preds[row["id"]][1] == gt[row["id"]]["maintenance_cycle_range"]
                ),
            }
            for row in test
        ],
    }
