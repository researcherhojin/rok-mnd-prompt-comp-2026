"""스코어러 앵커(이중 라벨): 정답=예측→1.0, 다수클래스 상수예측→public 결합 0.1711. INVALID 처리 고정."""

import pytest

from grader import data
from grader.config import CYCLE_LABELS, INVALID, RISK_LABELS
from grader.score import efficiency_score, leaderboard_score, macro_f1, score_predictions


def _public_truth():
    answers = data.load_answers("public")
    rows = data.load_split("public")
    yr = [answers[r["id"]]["risk_grade"] for r in rows]
    yc = [answers[r["id"]]["cycle_range"] for r in rows]
    return yr, yc


def test_perfect_prediction_is_one():
    yr, yc = _public_truth()
    s = score_predictions(yr, list(yr), yc, list(yc))
    assert s["macro_f1"] == 1.0
    assert s["risk"]["macro_f1"] == 1.0
    assert s["cycle"]["macro_f1"] == 1.0


def test_majority_class_public_anchor():
    yr, yc = _public_truth()
    n = len(yr)
    # 상수 예측: risk 다수클래스 MEDIUM, cycle 다수클래스 91-180 (측정값 고정)
    s = score_predictions(yr, ["MEDIUM"] * n, yc, ["91-180"] * n)
    assert s["risk"]["macro_f1"] == pytest.approx(0.23282718727404195, abs=1e-12)
    assert s["cycle"]["macro_f1"] == pytest.approx(0.109375, abs=1e-12)
    assert s["macro_f1"] == pytest.approx(0.17110109363702097, abs=1e-12)


def test_leaderboard_formula():
    # 결합 MacroF1=0.8, L=1000 → 0.9*0.8 + 0.1*(3000-1000)/3000 (하드캡 3000)
    expected = 0.9 * 0.8 + 0.1 * (2000 / 3000)
    assert leaderboard_score(0.8, 1000) == pytest.approx(expected)
    assert efficiency_score(3000) == 0.0
    assert efficiency_score(0) == 1.0


def test_hardcap_rejects():
    with pytest.raises(ValueError):
        leaderboard_score(1.0, 3001)


def test_invalid_counts_as_false_negative_not_dropped():
    yr = ["HIGH", "MEDIUM", "LOW", "HIGH"]
    pr = ["HIGH", INVALID, "LOW", "ERROR"]  # risk 2건 무효
    yc = ["0-30", "31-90", "181+", "0-30"]
    pc = ["0-30", "31-90", INVALID, "0-30"]  # cycle 1건 무효
    s = score_predictions(yr, pr, yc, pc)
    assert s["n"] == 4
    # 두 축 중 하나라도 무효인 행: idx1(risk INVALID), idx2(cycle INVALID), idx3(risk ERROR) = 3
    assert s["invalid_count"] == 3
    # 완전일치(둘 다 정답): idx0 (HIGH,0-30) 만 = 1
    assert s["exact_match_count"] == 1
    # INVALID/ERROR 예측이 recall을 떨어뜨림 (drop이 아니라 오답)
    assert s["risk"]["confusion"]["MEDIUM"][INVALID] == 1
    assert s["risk"]["confusion"]["HIGH"][INVALID] == 1  # ERROR도 INVALID 열로
    assert s["cycle"]["confusion"]["181+"][INVALID] == 1


def test_macro_f1_labels_arg():
    # 전 클래스가 등장하고 모두 정답이면 결합 macro = 1.0
    assert macro_f1(["HIGH", "MEDIUM", "LOW"], ["HIGH", "MEDIUM", "LOW"], RISK_LABELS) == 1.0
    assert (
        macro_f1(CYCLE_LABELS, list(CYCLE_LABELS), CYCLE_LABELS) == 1.0
    )
