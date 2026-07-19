"""파서 케이스(이중 라벨, 명세). 각 축 독립 검증·부분 파싱·토큰 타입 배정 확인."""

import pytest

from grader.config import INVALID
from grader.parse import parse_line


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("HIGH, 0-30", ("HIGH", "0-30")),
        ("MEDIUM, 91-180", ("MEDIUM", "91-180")),
        ("LOW, 181+", ("LOW", "181+")),
        ("HIGH,", ("HIGH", INVALID)),  # 부분 파싱: cycle 없음
        (", 31-90", (INVALID, "31-90")),  # 부분 파싱: risk 없음
        ("0-30, HIGH", ("HIGH", "0-30")),  # 위치가 아니라 토큰 타입으로 배정
        ("판정: MEDIUM 이고 주기는 31-90 입니다", ("MEDIUM", "31-90")),  # 산문 속 토큰
        ("", (INVALID, INVALID)),
    ],
)
def test_parse_cases(raw, expected):
    assert parse_line(raw) == expected


def test_whitespace_and_none():
    assert parse_line("  low , 0-30 ") == ("LOW", "0-30")  # 소문자·공백 허용
    assert parse_line(None) == (INVALID, INVALID)
