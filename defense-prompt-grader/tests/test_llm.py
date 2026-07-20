"""llm.complete 재시도 로직: 429는 backoff 재시도, 소진 시 LLMError, 401은 즉시 전파."""

import asyncio

import httpx
import pytest

from grader import llm
from grader.config import LLMConfig

CFG = LLMConfig(base_url="http://x/v1", api_key="k", model="gpt-4o-mini", max_concurrency=1)


def _ok_response() -> httpx.Response:
    return httpx.Response(200, json={"choices": [{"message": {"content": "MEDIUM, 91-180"}}]})


async def _call(handler):
    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        return await llm.complete(client, CFG, "sys", "user")


def test_retries_429_then_succeeds():
    calls = {"n": 0}

    def handler(request):
        calls["n"] += 1
        if calls["n"] < 3:  # 처음 2번 429, 3번째 성공
            return httpx.Response(429, headers={"retry-after": "0"}, json={})
        return _ok_response()

    assert asyncio.run(_call(handler)) == "MEDIUM, 91-180"
    assert calls["n"] == 3


def test_429_exhausts_to_llmerror():
    def handler(request):
        return httpx.Response(429, headers={"retry-after": "0"}, json={})

    with pytest.raises(llm.LLMError):
        asyncio.run(_call(handler))


def test_token_param_fallback_to_max_tokens():
    """max_completion_tokens 미지원(400) 서버면 max_tokens로 자동 폴백해 성공한다."""
    import json as _json

    def handler(request):
        body = _json.loads(request.content)
        if "max_completion_tokens" in body:
            return httpx.Response(
                400,
                json={
                    "error": {
                        "message": "Unsupported parameter: 'max_completion_tokens' is not supported.",
                        "code": "unsupported_parameter",
                        "param": "max_completion_tokens",
                    }
                },
            )
        assert "max_tokens" in body
        return _ok_response()

    assert asyncio.run(_call(handler)) == "MEDIUM, 91-180"


def test_non_retryable_4xx_raises_llmerror_with_detail():
    def handler(request):
        return httpx.Response(
            401, json={"error": {"message": "bad key", "code": "invalid_api_key"}}
        )

    with pytest.raises(llm.LLMError) as ei:
        asyncio.run(_call(handler))
    assert "401" in str(ei.value) and "bad key" in str(ei.value)
