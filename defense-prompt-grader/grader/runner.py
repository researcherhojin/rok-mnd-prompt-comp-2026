"""실행 오케스트레이터: 프롬프트 → 행별 LLM 실행 → 파싱 → 채점."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Callable

import httpx

from . import data, llm, parse, score, template
from .cache import Cache, cache_key
from .config import CHAR_HARDCAP, CYCLE_LABELS, RISK_LABELS, LLMConfig, load_llm_config

ERROR = "ERROR"  # LLM 호출 최종 실패 셀의 sentinel 예측값
_FAIL_ABORT_RATE = 0.05  # 전체 실패율 초과 시 중단


class RunAborted(RuntimeError):
    """실패율 초과 또는 사용자 취소로 중단됨."""


@dataclass
class Progress:
    total: int
    done: int = 0
    valid: int = 0
    invalid: int = 0
    error: int = 0


@dataclass
class RunResult:
    split: str
    model: str
    runs: int
    prompt_len: int
    macro_f1_mean: float
    leaderboard_score: float
    primary: dict  # run 0의 score_predictions (혼동행렬·상세용)
    runs_agg: dict | None
    rows: list[dict] = field(default_factory=list)


async def run(
    system_prompt: str,
    split: str,
    runs: int = 1,
    cfg: LLMConfig | None = None,
    progress_cb: Callable[[Progress], None] | None = None,
    cancel: asyncio.Event | None = None,
    force: bool = False,
    db_path=None,
) -> RunResult:
    prompt_len = len(system_prompt)
    if prompt_len > CHAR_HARDCAP:
        raise ValueError(f"프롬프트 {prompt_len}자 > {CHAR_HARDCAP}자 하드캡 → 제출 거부")
    if not 1 <= runs <= 3:
        raise ValueError("runs는 1~3")

    cfg = cfg or load_llm_config()
    rows = data.load_split(split)
    answers = data.load_answers(split)
    y_true_risk = [answers[r["id"]]["risk_grade"] for r in rows]
    y_true_cycle = [answers[r["id"]]["cycle_range"] for r in rows]
    key = cache_key(system_prompt, cfg.model, split)
    cache = Cache(db_path)

    n = len(rows)
    total_cells = n * runs
    fail_limit = max(1, int(_FAIL_ABORT_RATE * total_cells))  # 초과 시 전체 중단
    raw_grid: list[list[str | None]] = [[None] * n for _ in range(runs)]
    prog = Progress(total=total_cells)
    sem = asyncio.Semaphore(cfg.max_concurrency)
    abort = cancel or asyncio.Event()
    first_error: list[str] = []  # 첫 셀 오류 메시지 (중단 사유 구체화용)

    async def one(client, run_idx: int, i: int, row: dict) -> None:
        if abort.is_set():
            return
        rid = row["id"]
        raw = None if force else cache.get(key, rid, run_idx)
        status_error = False
        if raw is None:
            try:
                raw = await llm.complete(
                    client, cfg, system_prompt, template.render_user_message(row)
                )
            except (llm.LLMError, httpx.HTTPError) as exc:
                # 재시도 소진·비재시도 4xx 모두 셀 단위 ERROR로 격리.
                # 체계적 실패(예: 400 파라미터·401 인증)는 실패율>5% 게이트가 전체를 중단시킴.
                if not first_error:
                    first_error.append(str(exc)[:300])
                raw = ERROR
                status_error = True
            if not status_error:  # 실패 셀은 캐시하지 않음 → 재개 시 재시도
                cache.set(key, rid, run_idx, raw)
        raw_grid[run_idx][i] = raw

        # 진행률 집계
        prog.done += 1
        if raw == ERROR:
            prog.error += 1
            if prog.error > fail_limit:
                abort.set()
        else:
            risk, cycle = parse.parse_line(raw)
            if risk in RISK_LABELS and cycle in CYCLE_LABELS:
                prog.valid += 1
            else:
                prog.invalid += 1
        if progress_cb:
            progress_cb(prog)

    async def guarded(client, *a) -> None:
        async with sem:
            await one(client, *a)

    async with httpx.AsyncClient() as client:
        tasks = [
            guarded(client, run_idx, i, row)
            for run_idx in range(runs)
            for i, row in enumerate(rows)
        ]
        await asyncio.gather(*tasks)

    cache.close()
    if abort.is_set() and prog.error > fail_limit:
        reason = f" · 원인: {first_error[0]}" if first_error else ""
        raise RunAborted(f"실패율 {prog.error}/{total_cells} > {_FAIL_ABORT_RATE:.0%} 중단{reason}")

    # 파싱 & 채점 — 각 셀을 (risk, cycle) 튜플로
    pred_grid: list[list[tuple[str, str]]] = [
        [(ERROR, ERROR) if raw == ERROR else parse.parse_line(raw) for raw in raw_grid[r]]
        for r in range(runs)
    ]
    run_scores = [
        score.score_predictions(
            y_true_risk,
            [pred_grid[r][i][0] for i in range(n)],
            y_true_cycle,
            [pred_grid[r][i][1] for i in range(n)],
        )
        for r in range(runs)
    ]
    primary = run_scores[0]
    mf1_mean = sum(s["macro_f1"] for s in run_scores) / runs
    runs_agg = score.aggregate_runs(run_scores, pred_grid) if runs >= 2 else None

    result_rows = []
    for i, row in enumerate(rows):
        pred_risk, pred_cycle = pred_grid[0][i]
        result_rows.append(
            {
                "id": row["id"],
                "true_risk": y_true_risk[i],
                "true_cycle": y_true_cycle[i],
                "raw": raw_grid[0][i],
                "pred_risk": pred_risk,
                "pred_cycle": pred_cycle,
                "correct": pred_risk == y_true_risk[i] and pred_cycle == y_true_cycle[i],
                "runs_pred": [pred_grid[r][i] for r in range(runs)],
            }
        )

    return RunResult(
        split=split,
        model=cfg.model,
        runs=runs,
        prompt_len=prompt_len,
        macro_f1_mean=mf1_mean,
        leaderboard_score=score.leaderboard_score(mf1_mean, prompt_len),
        primary=primary,
        runs_agg=runs_agg,
        rows=result_rows,
    )
