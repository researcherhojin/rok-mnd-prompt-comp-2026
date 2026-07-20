"""API 스모크: 제출→채점→리더보드→상세, 베이스라인 등록, 하드캡 반려.

LLM 경계(llm.complete)는 스텁으로 대체해 실제 API 호출 없이 파이프라인만 검증한다.
"""

import time

import pytest
from fastapi.testclient import TestClient

from api.main import app
from grader.config import CHAR_HARDCAP


async def _fake_complete(client, cfg, system_prompt, user_message):
    return "MEDIUM, 91-180"


@pytest.fixture(autouse=True)
def _patch_llm(monkeypatch):
    monkeypatch.setattr("grader.llm.complete", _fake_complete)


def _wait_done(client, sid, timeout=10.0):
    end = time.time() + timeout
    while time.time() < end:
        s = client.get(f"/api/submissions/{sid}").json()
        if s["status"] in ("done", "error", "cancelled"):
            return s
        time.sleep(0.05)
    raise AssertionError("timeout")


def test_submit_score_leaderboard_detail():
    with TestClient(app) as client:
        r = client.post(
            "/api/submit",
            json={
                "name": "t1",
                "prompt": "K-511 판단 지침",
                "split": "sample",
                "runs": 1,
            },
        )
        assert r.status_code == 200
        sid = r.json()["id"]
        sub = _wait_done(client, sid)
        assert sub["status"] == "done"
        res = sub["result"]
        assert res["primary"]["n"] == 10
        assert res["leaderboard_score"] == pytest.approx(
            0.9 * res["macro_f1_mean"] + 0.1 * (CHAR_HARDCAP - res["prompt_len"]) / CHAR_HARDCAP
        )

        lb = client.get("/api/submissions").json()
        assert any(x["id"] == sid and x["leaderboard_score"] is not None for x in lb)


def test_hardcap_rejected():
    with TestClient(app) as client:
        r = client.post(
            "/api/submit",
            json={
                "name": "big",
                "prompt": "가" * (CHAR_HARDCAP + 1),
                "split": "sample",
            },
        )
        assert r.status_code == 422


def test_baseline_register():
    with TestClient(app) as client:
        r = client.post("/api/baselines/register")
        assert r.status_code == 200
        registered = {b["name"] for b in r.json()["registered"]}
        # 신규 등록분은 3개 베이스라인의 부분집합 (이미 등록된 건 제외되므로)
        assert registered <= {"P0", "P1", "P2"}
        # 등록 후에는 P0~P2 3개가 모두 베이스라인으로 존재
        lb = client.get("/api/submissions").json()
        base_names = {x["name"] for x in lb if x["is_baseline"]}
        assert base_names >= {"P0", "P1", "P2"}


def test_affiliation_roundtrip():
    with TestClient(app) as client:
        r = client.post(
            "/api/submit",
            json={
                "name": "소속테스트",
                "affiliation": "육군훈련소",
                "prompt": "지침",
                "split": "sample",
                "runs": 1,
            },
        )
        assert r.status_code == 200
        sid = r.json()["id"]
        _wait_done(client, sid)
        row = next(x for x in client.get("/api/submissions").json() if x["id"] == sid)
        assert row["affiliation"] == "육군훈련소"


def test_store_migrates_legacy_db(tmp_path):
    """소속 컬럼이 없는 구 DB에 Store가 ALTER로 컬럼을 추가하고 정상 동작한다."""
    import sqlite3

    from api.store import Store

    db = tmp_path / "legacy.db"
    legacy = (
        "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, split TEXT,"
        " model TEXT, runs INTEGER, prompt TEXT, prompt_len INTEGER, is_baseline INTEGER,"
        " status TEXT, error_msg TEXT, result_json TEXT"
    )
    with sqlite3.connect(db) as c:
        c.execute(f"CREATE TABLE submissions ({legacy})")
        c.execute("INSERT INTO submissions (name, status) VALUES ('구제출', 'done')")
    store = Store(db_path=db)
    sid = store.create("신제출", "sample", "gpt-4o-mini", 1, "지침", affiliation="공군")
    assert store.get(sid)["affiliation"] == "공군"
    # 구 행은 소속이 NULL로 조회
    old = next(r for r in store.list() if r["name"] == "구제출")
    assert old["affiliation"] is None
