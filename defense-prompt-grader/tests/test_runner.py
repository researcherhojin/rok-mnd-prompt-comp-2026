"""러너 end-to-end: LLM 경계(llm.complete)를 스텁으로 대체해 오프라인에서 파이프라인 검증.

실제 HTTP 클라이언트(재시도 등)는 test_llm.py가 httpx.MockTransport로 별도 검증한다.
"""

import asyncio
import hashlib

import pytest

from grader import runner
from grader.config import LLMConfig

CFG = LLMConfig(base_url="http://x", api_key="EMPTY", model="gpt-4.1-nano", max_concurrency=4)

_PAIRS = [("HIGH", "0-30"), ("MEDIUM", "31-90"), ("MEDIUM", "91-180"), ("LOW", "181+")]


async def _fake_complete(client, cfg, system_prompt, user_message):
    """user 메시지(=행 내용) 내용에 결정적으로 의존하는 스텁. 행마다 다른 유효 라벨 쌍."""
    h = int(hashlib.sha256(user_message.encode()).hexdigest(), 16)
    r, c = _PAIRS[h % len(_PAIRS)]
    return f"{r}, {c}"


@pytest.fixture(autouse=True)
def _patch_llm(monkeypatch):
    monkeypatch.setattr("grader.llm.complete", _fake_complete)


def test_run_reproduces_formula(tmp_path):
    prompt = "K-511 정비 판단 지침"
    result = asyncio.run(
        runner.run(prompt, split="sample", runs=1, cfg=CFG, db_path=tmp_path / "c.db")
    )
    assert result.primary["n"] == 10  # sample 10행, INVALID/ERROR 있어도 행 제거 안 함
    from grader import score

    expected = score.leaderboard_score(result.macro_f1_mean, len(prompt))
    assert result.leaderboard_score == expected


def test_multi_run_has_aggregate(tmp_path):
    result = asyncio.run(
        runner.run("x", split="sample", runs=2, cfg=CFG, db_path=tmp_path / "c.db")
    )
    assert result.runs_agg is not None
    assert result.runs_agg["n_runs"] == 2


def test_cache_not_contaminated_across_splits(tmp_path):
    """data/는 split이 id를 공유(sample 1~10 ⊂ public/private) → 캐시 키에 split 포함 필수.

    같은 프롬프트를 public 먼저 채점한 뒤 sample을 채점해도, sample 결과가 sample 단독 실행과
    동일해야 한다(캐시 오염 없음).
    """
    shared = tmp_path / "shared.db"
    solo = tmp_path / "solo.db"
    asyncio.run(runner.run("동일", split="public", runs=1, cfg=CFG, db_path=shared))
    after = asyncio.run(runner.run("동일", split="sample", runs=1, cfg=CFG, db_path=shared))
    fresh = asyncio.run(runner.run("동일", split="sample", runs=1, cfg=CFG, db_path=solo))
    assert [r["raw"] for r in after.rows] == [r["raw"] for r in fresh.rows]


def test_cache_resume_returns_same(tmp_path):
    db = tmp_path / "c.db"
    kw = dict(split="sample", runs=1, cfg=CFG, db_path=db)
    r1 = asyncio.run(runner.run("prompt A", **kw))
    r2 = asyncio.run(runner.run("prompt A", **kw))  # 캐시 사용
    assert [row["raw"] for row in r1.rows] == [row["raw"] for row in r2.rows]
