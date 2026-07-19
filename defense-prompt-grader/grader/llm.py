"""OpenAI 호환 LLM 클라이언트 (async httpx). temp0/top_p1/출력토큰50 고정, 백오프 재시도.

출력 토큰 파라미터는 최신 OpenAI 모델(`max_completion_tokens`)과 구형/로컬 서버(`max_tokens`)가
다르므로, 미지원 400을 만나면 다른 이름으로 자동 폴백한다. 모든 실패는 본문을 로깅하고 사유를
LLMError 메시지에 담아 러너·리더보드에서 원인이 보이도록 한다."""

from __future__ import annotations

import asyncio
import logging

import httpx

from .config import LLMConfig

logger = logging.getLogger("grader.llm")

MAX_ATTEMPTS = 4  # 최초 1회 + 재시도 3회
RETRY_AFTER_CAP = 20.0  # Retry-After 헤더 상한(초)
# 출력 토큰 파라미터: 최신 OpenAI는 max_completion_tokens, 구형/로컬은 max_tokens.
_TOKEN_PARAMS = ("max_completion_tokens", "max_tokens")


class LLMError(RuntimeError):
    """재시도 소진 후에도 실패한 호출. 메시지에 상태·본문 사유를 담는다."""


class _ParamFallback(Exception):
    """출력 토큰 파라미터 이름이 미지원 → 다른 이름으로 재시도하라는 내부 신호."""


def _retry_after(resp: httpx.Response) -> float | None:
    """429/503의 Retry-After 헤더(초)를 파싱. 없거나 형식 이상이면 None."""
    raw = resp.headers.get("retry-after")
    try:
        return min(float(raw), RETRY_AFTER_CAP) if raw is not None else None
    except ValueError:
        return None  # HTTP-date 형식은 무시하고 지수 백오프로 폴백


def _error_detail(resp: httpx.Response) -> str:
    """4xx 응답 본문에서 사람이 읽을 오류 사유를 뽑는다."""
    try:
        err = resp.json().get("error") or {}
        msg = err.get("message") or resp.text
        code = err.get("code")
        return f"{msg} (code={code})" if code else str(msg)
    except Exception:
        return resp.text[:300]


def _is_token_param_error(detail: str) -> bool:
    return "unsupported_parameter" in detail and (
        "max_tokens" in detail or "max_completion_tokens" in detail
    )


async def _run(client: httpx.AsyncClient, cfg: LLMConfig, payload: dict, token_param: str) -> str:
    """단일 payload로 호출 + 429/5xx 백오프 재시도. 4xx는 본문 로깅 후 LLMError."""
    headers = {"Authorization": f"Bearer {cfg.api_key}"}
    url = f"{cfg.base_url}/chat/completions"
    last_exc: Exception | None = None
    for attempt in range(MAX_ATTEMPTS):
        retry_after: float | None = None
        try:
            resp = await client.post(url, json=payload, headers=headers, timeout=60.0)
            if resp.status_code == 429 or resp.status_code >= 500:
                retry_after = _retry_after(resp)
                raise LLMError(f"재시도 대상 상태 {resp.status_code}")
            if resp.status_code >= 400:
                detail = _error_detail(resp)
                logger.error("LLM %s (%s): %s", resp.status_code, cfg.model, detail)
                if resp.status_code == 400 and _is_token_param_error(detail):
                    raise _ParamFallback(detail)  # 토큰 파라미터명 폴백 신호
                raise LLMError(f"{resp.status_code}: {detail}")  # 그 외 4xx는 셀 ERROR
            return resp.json()["choices"][0]["message"]["content"]
        except (httpx.TransportError, LLMError) as exc:
            last_exc = exc
            if isinstance(exc, httpx.TransportError):
                logger.warning("LLM 네트워크 오류(%s) 시도 %d: %s", cfg.model, attempt + 1, exc)
            if attempt < MAX_ATTEMPTS - 1:
                delay = retry_after if retry_after is not None else 0.5 * (2**attempt)
                await asyncio.sleep(delay)
    raise LLMError(f"재시도 소진({token_param}): {last_exc}")


async def complete(client: httpx.AsyncClient, cfg: LLMConfig, system: str, user: str) -> str:
    """단일 chat completion. 429/5xx/네트워크 오류는 백오프 재시도, 4xx는 사유를 담은 LLMError.

    출력 토큰 파라미터가 미지원(400)이면 `max_completion_tokens` ↔ `max_tokens` 로 1회 폴백한다."""
    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ]
    last_exc: Exception | None = None
    for token_param in _TOKEN_PARAMS:
        payload = {
            "model": cfg.model,
            "messages": messages,
            "temperature": cfg.temperature,
            "top_p": cfg.top_p,
            token_param: cfg.max_tokens,
            "seed": cfg.seed,
        }
        try:
            return await _run(client, cfg, payload, token_param)
        except _ParamFallback as exc:
            logger.warning("출력 토큰 파라미터 '%s' 미지원 → 다른 이름으로 폴백", token_param)
            last_exc = LLMError(str(exc))
            continue
    raise LLMError(f"출력 토큰 파라미터 폴백 실패: {last_exc}")
