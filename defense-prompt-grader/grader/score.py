"""채점 산식. 정확도(완전일치 행수) ≠ Macro F1 — 둘은 별개 지표로 분리해 보고.

이중 라벨: risk_grade·cycle_range 를 각각 Macro F1 으로 계산하고 결합 점수는 두 값의 평균.
두 축은 모델 출력에서 독립적으로 채점한다 (한 축에서 다른 축을 추론하지 않는다).
"""

from __future__ import annotations

import statistics

from sklearn.metrics import f1_score, precision_recall_fscore_support

from .config import CHAR_HARDCAP, CYCLE_LABELS, INVALID, RISK_LABELS


def macro_f1(y_true: list[str], y_pred: list[str], labels: list[str]) -> float:
    """클래스 F1의 단순 평균. INVALID/ERROR 예측은 해당 정답 클래스의 오답으로 반영."""
    return float(
        f1_score(y_true, y_pred, labels=labels, average="macro", zero_division=0)
    )


def efficiency_score(prompt_len: int) -> float:
    """프롬프트 효율성 = (CHAR_HARDCAP − L) / CHAR_HARDCAP. L은 공백 포함 글자 수."""
    return (CHAR_HARDCAP - prompt_len) / CHAR_HARDCAP


def leaderboard_score(mf1: float, prompt_len: int) -> float:
    """리더보드 점수 = 0.9·MacroF1 + 0.1·효율성. L > CHAR_HARDCAP이면 제출 거부.

    이중 라벨에서 mf1 은 (risk_mf1 + cycle_mf1) / 2 결합 평균을 받는다.
    """
    if prompt_len > CHAR_HARDCAP:
        raise ValueError(f"프롬프트 {prompt_len}자 > {CHAR_HARDCAP}자 하드캡 → 제출 거부")
    return 0.9 * mf1 + 0.1 * efficiency_score(prompt_len)


def _pred_col(label: str, labels: list[str]) -> str:
    return label if label in labels else INVALID


def confusion(
    y_true: list[str], y_pred: list[str], labels: list[str]
) -> dict[str, dict[str, int]]:
    """혼동행렬 + INVALID 열. rows=정답, cols=예측(+INVALID)."""
    cols = [*labels, INVALID]
    mat = {t: {c: 0 for c in cols} for t in labels}
    for t, p in zip(y_true, y_pred):
        mat[t][_pred_col(p, labels)] += 1
    return mat


def _axis_score(y_true: list[str], y_pred: list[str], labels: list[str]) -> dict:
    """단일 축(risk 또는 cycle) 채점 묶음."""
    n = len(y_true)
    prec, rec, f1, _ = precision_recall_fscore_support(
        y_true, y_pred, labels=labels, average=None, zero_division=0
    )
    per_class = {
        lbl: {"precision": float(prec[i]), "recall": float(rec[i]), "f1": float(f1[i])}
        for i, lbl in enumerate(labels)
    }
    invalid = sum(1 for p in y_pred if p not in labels)
    return {
        "macro_f1": macro_f1(y_true, y_pred, labels),
        "per_class": per_class,
        "confusion": confusion(y_true, y_pred, labels),
        "invalid_count": invalid,
        "invalid_rate": invalid / n if n else 0.0,
    }


def score_predictions(
    y_true_risk: list[str],
    y_pred_risk: list[str],
    y_true_cycle: list[str],
    y_pred_cycle: list[str],
) -> dict:
    """단일 실행 채점 결과 묶음 (이중 라벨)."""
    n = len(y_true_risk)
    risk = _axis_score(y_true_risk, y_pred_risk, RISK_LABELS)
    cycle = _axis_score(y_true_cycle, y_pred_cycle, CYCLE_LABELS)
    # 완전일치 행수: 두 축 모두 정답인 행 (정확도 개념) — Macro F1과 별개
    exact = sum(
        1
        for tr, pr, tc, pc in zip(y_true_risk, y_pred_risk, y_true_cycle, y_pred_cycle)
        if tr == pr and tc == pc
    )
    # INVALID 행: 두 축 중 하나라도 무효
    invalid = sum(
        1
        for pr, pc in zip(y_pred_risk, y_pred_cycle)
        if pr not in RISK_LABELS or pc not in CYCLE_LABELS
    )
    return {
        "n": n,
        "macro_f1": (risk["macro_f1"] + cycle["macro_f1"]) / 2,  # 결합 = 리더보드 입력
        "risk": risk,
        "cycle": cycle,
        "invalid_count": invalid,
        "invalid_rate": invalid / n if n else 0.0,
        "exact_match_count": exact,
    }


def aggregate_runs(run_scores: list[dict], row_preds: list[list[tuple[str, str]]]) -> dict:
    """n_runs ≥ 2일 때 실행 간 결합 MacroF1 평균·표준편차·행 단위 판정 불일치율."""
    f1s = [s["macro_f1"] for s in run_scores]
    n_runs = len(f1s)
    disagree = 0
    n_rows = len(row_preds[0]) if row_preds else 0
    for i in range(n_rows):
        # 한 축이라도 실행 간 달라지면 불일치로 카운트
        if len({row_preds[r][i] for r in range(n_runs)}) > 1:
            disagree += 1
    return {
        "n_runs": n_runs,
        "macro_f1_mean": statistics.fmean(f1s),
        "macro_f1_std": statistics.stdev(f1s) if n_runs >= 2 else 0.0,
        "disagreement_rate": disagree / n_rows if n_rows else 0.0,
    }
