"""P1 API 스모크 테스트 — FastAPI TestClient (라이브 서버 불필요, 임시 DB 격리)."""
import importlib
import sys

import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def client(tmp_path_factory):
    # 테스트용 임시 DB로 격리 후 app을 새로 임포트(모듈 로드 시 init_db 실행됨)
    from harness.storage import db

    db.DB_PATH = tmp_path_factory.mktemp("apidb") / "test.db"
    sys.modules.pop("harness.api.main", None)
    from harness.api import main

    return TestClient(main.app)


def test_problem(client):
    r = client.get("/problem")
    assert r.status_code == 200
    j = r.json()
    assert len(j["train"]) == 15
    assert j["labels"]["failure_risk_grade"] == ["HIGH", "MEDIUM", "LOW"]
    assert j["char_limit"] == 3000
    assert len(j["columns"]) == 9


def test_preview(client):
    r = client.post("/preview", json={"instruction": "규칙대로 판단해 risk, cycle 한 줄"})
    assert r.status_code == 200
    j = r.json()
    assert j["sample_size"] == 5
    assert len(j["rows"]) == 5
    assert 0.0 <= j["estimated_accuracy"] <= 1.0


def test_submit_and_leaderboard(client):
    good = (
        "정비 5회 이상 또는 가동 4000 이상 또는 직전 30일 이내면 HIGH; "
        "정비 2회 이하 그리고 가동 2000 미만 그리고 직전 90일 초과면 LOW; 그 외 MEDIUM. "
        "HIGH면 0-30, LOW면 181+, MEDIUM은 가동 3000 이상 31-90 아니면 91-180. risk, cycle 한 줄"
    )
    r = client.post("/submit", json={"instruction": good, "participant": "테스터"})
    assert r.status_code == 200
    j = r.json()
    assert j["submission_id"] > 0
    assert j["rank"] >= 1
    assert 0.0 <= j["percentile"] <= 100.0
    assert len(j["rows"]) == 30
    assert "total_public" in j["score"]

    lb = client.get("/leaderboard").json()
    assert lb["count"] >= 51                 # 시드 50 + 방금 제출 1
    assert len(lb["distribution"]) == 11
    assert lb["entries"][0]["total_public"] >= lb["entries"][-1]["total_public"]  # 내림차순


def test_char_limit_rejected(client):
    r = client.post("/submit", json={"instruction": "x" * 3001})
    assert r.status_code == 400


def test_empty_instruction_rejected(client):
    r = client.post("/preview", json={"instruction": "   "})
    assert r.status_code == 400
