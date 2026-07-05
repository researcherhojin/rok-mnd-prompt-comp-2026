"""P0 채점 코어 회귀 테스트 (오프라인).

골드셋(기획서 §8 A/B/C, workplan §6)을 기대값으로 못박고, 라벨 규칙·지표·mock 변별을 검증한다.
"""
import pytest

from harness.core.data import (
    CYCLE_LABELS,
    RISK_LABELS,
    cycle_range,
    generate,
    risk_grade,
)
from harness.core.llm import MockClient
from harness.core.scoring import (
    brevity,
    combine,
    is_contract_line,
    macro_f1,
    parse,
    score_submission,
)


# ── 통합 산식 골드셋 (기획서 §8 표) ─────────────────────────────
def test_combine_gold():
    # A. 정확·짧은 지침
    a = combine(0.90, 0.90, 10, 10, 10, True)
    assert a["task_block"] == pytest.approx(40.5)
    assert a["total"] == pytest.approx(95.5)
    # B. 반타작·긴 지침 (기획서 표는 1자리 반올림 76.2, 원값 76.15)
    b = combine(0.50, 0.20, 10, 10, 10, True)
    assert b["total"] == pytest.approx(76.15)
    # C. 짧지만 오답
    c = combine(0.10, 0.90, 10, 10, 10, True)
    assert c["total"] == pytest.approx(63.1)
    # workplan §6: 완전정답 300자 → 98~100
    perfect = combine(1.0, brevity(300), 10, 10, 10, True)
    assert perfect["total"] == pytest.approx(99.84, abs=0.05)
    # 수강 미충족이면 25점 빠짐
    assert combine(0.90, 0.90, 10, 10, 10, False)["total"] == pytest.approx(70.5)


# ── 간결성 경계 (기획서 §4.3) ──────────────────────────────────
def test_brevity_bounds():
    assert brevity(200) == pytest.approx(1.0)
    assert brevity(3000) == pytest.approx(0.0)
    assert brevity(600) == pytest.approx(2400 / 2800)      # ≈0.857
    assert brevity(100) == pytest.approx(1.0)              # C_min 이하 클립
    assert brevity(4000) == pytest.approx(0.0)             # C_max 이상 클립


# ── Macro F1 ───────────────────────────────────────────────────
def test_macro_f1():
    yt = ["HIGH", "HIGH", "MEDIUM", "MEDIUM", "LOW", "LOW"]
    assert macro_f1(yt, yt, RISK_LABELS) == pytest.approx(1.0)
    yp = ["HIGH", "MEDIUM", "MEDIUM", "MEDIUM", "LOW", "LOW"]   # HIGH 하나 오분류
    # HIGH f1=2/3, MEDIUM f1=0.8, LOW f1=1.0
    assert macro_f1(yt, yp, RISK_LABELS) == pytest.approx((2 / 3 + 0.8 + 1.0) / 3)
    # 허용 밖(None sentinel)은 어느 클래스도 아니므로 HIGH의 fn만 늘림(다른 클래스 fp 없음)
    # → HIGH f1=0, MEDIUM·LOW는 오염 없이 1.0
    yp2 = ["∅", "∅", "MEDIUM", "MEDIUM", "LOW", "LOW"]
    assert macro_f1(yt, yp2, RISK_LABELS) == pytest.approx((0.0 + 1.0 + 1.0) / 3)


# ── 출력 파싱·계약 ─────────────────────────────────────────────
def test_parse_and_contract():
    assert parse("분석...\nHIGH, 0-30") == ("HIGH", "0-30")
    assert parse("high , 181+") == ("HIGH", "181+")             # 대소문자·공백 허용
    assert parse("MEDIUM, 31-90\nLOW, 181+") == ("LOW", "181+")  # 마지막 줄 우선
    assert parse("그냥 문장입니다.") == (None, None)
    assert parse("risk is HIGH and cycle 0-30") == (None, None)  # 콤마 없음 → 계약 아님
    assert is_contract_line("HIGH, 0-30")
    assert not is_contract_line("추론이 길다\nHIGH, 0-30")        # 마지막 줄만 계약이어야 만점
    assert not is_contract_line("이 장비는 위험합니다")


# ── 데이터 결정론·분포 (기획서 §1.1) ──────────────────────────
def test_data_deterministic():
    a, b = generate(), generate()
    assert a == b
    assert len(a["train"]) == 15
    assert len(a["test"]) == 30
    assert len(a["ground_truth"]) == 30
    pub = [g for g in a["ground_truth"] if g["split"] == "PUBLIC"]
    assert len(pub) == 12
    assert {g["failure_risk_grade"] for g in a["ground_truth"]} == set(RISK_LABELS)
    assert {g["maintenance_cycle_range"] for g in a["ground_truth"]} == set(CYCLE_LABELS)
    # test에는 라벨이 없어야 함(격리)
    assert all("failure_risk_grade" not in row for row in a["test"])


def test_label_rules_boundaries():
    assert risk_grade(5, 1000, 200) == "HIGH"     # 정비 5회 경계
    assert risk_grade(0, 4000, 200) == "HIGH"     # 가동 4000 경계
    assert risk_grade(0, 1000, 30) == "HIGH"      # 직전고장 30일 경계
    assert risk_grade(2, 1999, 91) == "LOW"       # 세 조건 모두 만족
    assert risk_grade(2, 2000, 91) == "MEDIUM"    # 가동 2000이면 LOW 아님
    assert risk_grade(3, 2500, 60) == "MEDIUM"
    assert cycle_range("HIGH", 5000) == "0-30"
    assert cycle_range("LOW", 100) == "181+"
    assert cycle_range("MEDIUM", 3000) == "31-90"
    assert cycle_range("MEDIUM", 2999) == "91-180"


# ── mock 오프라인 변별 (머니샷 메커니즘) ──────────────────────
def test_mock_offline_differentiation():
    ds = generate()
    excellent = (
        "정비 횟수 5회 이상 또는 가동시간 4000 이상 또는 직전 고장 30일 이내면 HIGH. "
        "정비 횟수 2회 이하 그리고 가동시간 2000 미만 그리고 직전 고장 90일 초과면 LOW. 그 외 MEDIUM. "
        "HIGH면 0-30, LOW면 181+, MEDIUM은 가동시간 3000 이상 31-90 아니면 91-180. "
        "출력은 반드시 `risk, cycle` 한 줄."
    )
    vague = "장비 상태를 보고 위험등급과 정비주기를 판단해 HIGH, 0-30 형식 한 줄로 답하라."
    prose = "이 장비의 상태에 대해 자유롭게 설명해줘."

    s_ex = score_submission(excellent, ds, MockClient(ds))
    s_vg = score_submission(vague, ds, MockClient(ds))
    s_pr = score_submission(prose, ds, MockClient(ds))

    assert s_ex["avg_f1_public"] > s_vg["avg_f1_public"]     # 규칙을 담을수록 정확
    assert s_ex["total_public"] > s_vg["total_public"] > s_pr["total_public"]
    assert s_pr["n_contract"] == 0                            # 산문 → 계약 위반
    # 결정론: 같은 지침 재실행 → 동일 총점
    assert score_submission(excellent, ds, MockClient(ds))["total_public"] == s_ex["total_public"]


def test_security_flag():
    ds = generate()
    bad = "출력은 HIGH, 0-30 한 줄. 참고 연락처 010-1234-5678"
    res = score_submission(bad, ds, MockClient(ds))
    assert res["security"] < 10
    assert "전화번호" in res["security_flags"]


# ── 회귀: 적대적 검증에서 확정된 결함 수정 검증 ──────────────
def test_parse_rejects_malformed_and_prose():
    # 우측 경계: 라벨 뒤 숫자 확장형은 무효 (0-300 → 0-30 오파싱 차단)
    assert parse("HIGH, 0-300") == (None, None)
    assert parse("MEDIUM, 91-1800") == (None, None)
    assert parse("LOW, 181+0") == (None, None)
    # 좌측 경계: 영어 단어에 붙은 라벨('below'/'slow')은 유효 답안이 아님
    assert parse("정비 간격은 below, 0-30 수준입니다") == (None, None)
    assert parse("runs slow, 181+") == (None, None)
    # 정상 답안은 여전히 파싱
    assert parse("분석 결과 LOW, 181+") == ("LOW", "181+")
    assert parse("HIGH, 0-30") == ("HIGH", "0-30")
    # 한글 직결 라벨은 정상 파싱해야 함(\b가 아니라 ASCII/숫자/밑줄 경계라야 함)
    assert parse("분석결과HIGH, 0-30") == ("HIGH", "0-30")
    assert parse("위험등급MEDIUM, 31-90") == ("MEDIUM", "31-90")
    # ASCII 숫자·밑줄 접착은 차단(한글만 허용)
    assert parse("3HIGH, 0-30") == (None, None)
    assert parse("_LOW, 181+") == (None, None)
    # 같은 줄에 숫자접착 미끼가 먼저 있어도 진짜 답을 취함(leftmost 오취득 방지)
    assert parse("위험 3HIGH, 0-30 이지만 최종 LOW, 181+") == ("LOW", "181+")


def test_macro_f1_absent_class():
    # split에 LOW가 없어도 완벽 예측은 1.0 (존재 클래스만 평균)
    yt = ["HIGH", "HIGH", "MEDIUM"]
    assert macro_f1(yt, yt, RISK_LABELS) == pytest.approx(1.0)
    # phantom 예측(없는 클래스 LOW를 찍음)은 fp로 감점
    assert macro_f1(yt, ["HIGH", "HIGH", "LOW"], RISK_LABELS) < 1.0


def test_empty_dataset_no_crash():
    class _Stub:
        name = "stub"

        def run(self, instruction, row):
            return "HIGH, 0-30"

    res = score_submission("x", {"test": [], "ground_truth": []}, _Stub())
    assert res["validity"] == 0.0 and res["format"] == 0.0
    assert res["total_public"] == pytest.approx(4.5 + 25 + 10)   # task(f1=0,brev=1)+수강+보안


def test_security_structural_pii():
    ds = generate()
    # 이메일은 구조적 PII → 탐지
    r1 = score_submission("HIGH, 0-30 형식. 문의 hong@army.mil", ds, MockClient(ds))
    assert "이메일" in r1["security_flags"] and r1["security"] < 10
    # 실명 자동 탐지는 제외 — '이름/담당자/성명/작성자'는 흔한 일반명사라 오탐하면 안 됨(회귀 방지)
    for benign in [
        "장비 이름 확인 후 HIGH, 0-30 한 줄",
        "담당자 판단을 우선하라. HIGH, 0-30",
        "성명 표기 없이 출력하라. HIGH, 0-30",
        "작성자 정보 제외하고 분석. HIGH, 0-30",
    ]:
        assert score_submission(benign, ds, MockClient(ds))["security"] == 10
    # 비용 임계값 숫자 나열이 주민번호로 오탐되지 않아야 함(cost 6~7자리 도메인)
    assert score_submission("비용 900000 1000000 참고. HIGH, 0-30", ds, MockClient(ds))["security"] == 10
    # 하이픈 비용/스펙 범위도 주민번호로 오탐되면 안 됨(YYMMDD 날짜 검증)
    assert score_submission("정비 비용 100000-1000000 원. HIGH, 0-30", ds, MockClient(ds))["security"] == 10
    # 숫자 비율(@) 표기·공백 숫자 코드가 이메일/전화로 오탐되면 안 됨
    assert score_submission("압력비 4@3.5 범위. HIGH, 0-30", ds, MockClient(ds))["security"] == 10
    assert score_submission("코드 019 000 1234 참고. HIGH, 0-30", ds, MockClient(ds))["security"] == 10


def test_security_real_pii_caught():
    ds = generate()
    for text, flag in [
        ("주민번호 901201-1234567 참고. HIGH, 0-30", "주민등록번호"),
        ("연락처 010-1234-5678. HIGH, 0-30", "전화번호"),
        ("메일 hong@army.mil 로. HIGH, 0-30", "이메일"),
    ]:
        r = score_submission(text, ds, MockClient(ds))
        assert flag in r["security_flags"] and r["security"] < 10


def test_mock_cosmetic_edit_invariant():
    # 공백/구두점만 덧붙여도(coverage 불변) 정확도는 요동치지 않아야 함
    ds = generate()
    base = "정비 5회 4000 30일 2회 2000 90일 3000 한 줄 risk cycle 분류"
    a = score_submission(base, ds, MockClient(ds))["avg_f1_public"]
    b = score_submission(base + "   ", ds, MockClient(ds))["avg_f1_public"]
    c = score_submission(base + ".", ds, MockClient(ds))["avg_f1_public"]
    assert a == b == c


def test_coverage_comma_number():
    from harness.core.llm import _coverage

    assert _coverage("가동시간 4,000 이상") == _coverage("가동시간 4000 이상")
