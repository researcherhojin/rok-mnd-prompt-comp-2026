"""FastAPI 채점 서버. 제출 → 백그라운드 채점 → 리더보드/상세/진행률/취소."""

from __future__ import annotations

import asyncio
import logging
from dataclasses import asdict
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from grader import runner
from grader.config import CHAR_HARDCAP, PROJECT_ROOT, load_llm_config

from .store import Store

app = FastAPI(title="문제 B 로컬 자동채점", version="0.1.0")


@app.on_event("startup")
def _wire_logging() -> None:
    """grader.* 로그(LLM 4xx 본문·폴백 등)를 uvicorn 콘솔 핸들러로 출력."""
    uvi = logging.getLogger("uvicorn.error")
    gl = logging.getLogger("grader")
    if uvi.handlers:
        gl.handlers = uvi.handlers
    gl.setLevel(logging.INFO)
    gl.propagate = False


app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

store = Store()
# 실행 중 제출: sid → {progress, cancel, task}
_active: dict[int, dict] = {}


class SubmitBody(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    affiliation: str | None = Field(default=None, max_length=100)
    prompt: str
    split: str = "public"
    runs: int = Field(default=1, ge=1, le=3)
    model: str | None = None


def _cfg(model: str | None):
    cfg = load_llm_config()
    return cfg.__class__(**{**cfg.__dict__, "model": model}) if model else cfg


def _result_to_dict(r: runner.RunResult) -> dict:
    return {
        "split": r.split,
        "model": r.model,
        "runs": r.runs,
        "prompt_len": r.prompt_len,
        "macro_f1_mean": r.macro_f1_mean,
        "leaderboard_score": r.leaderboard_score,
        "primary": r.primary,
        "runs_agg": r.runs_agg,
        "rows": r.rows,
    }


async def _execute(sid: int, prompt: str, split: str, runs: int, model: str | None):
    cancel = asyncio.Event()
    state = {"progress": None, "cancel": cancel, "task": None}
    _active[sid] = state
    store.set_model(sid, _cfg(model).model)  # 실제 실행 모델 기록 (표시용)
    store.set_status(sid, "running")

    def on_progress(p: runner.Progress) -> None:
        state["progress"] = asdict(p)

    try:
        result = await runner.run(
            prompt,
            split=split,
            runs=runs,
            cfg=_cfg(model),
            progress_cb=on_progress,
            cancel=cancel,
        )
        if cancel.is_set():
            store.set_status(sid, "cancelled")
        else:
            store.set_result(sid, _result_to_dict(result))
    except runner.RunAborted as exc:
        store.set_status(sid, "error", str(exc))
    except Exception as exc:  # noqa: BLE001 — 채점 실패를 제출 상태로 기록
        store.set_status(sid, "error", str(exc))
    finally:
        _active.pop(sid, None)


_pending_tasks: set[asyncio.Task] = set()

# 명시적 모델 미지정 시 저장하는 센티널 (제출 시 → DB → 재실행 시 None 복원)
DEFAULT_MODEL_SENTINEL = "default"


def _start(sid: int, prompt: str, split: str, runs: int, model: str | None) -> None:
    task = asyncio.create_task(_execute(sid, prompt, split, runs, model))
    # task 참조 유지 (GC 방지)
    _pending_tasks.add(task)
    task.add_done_callback(_pending_tasks.discard)


@app.post("/api/submit")
async def submit(body: SubmitBody):
    if len(body.prompt) > CHAR_HARDCAP:
        raise HTTPException(422, f"프롬프트 {len(body.prompt)}자 > {CHAR_HARDCAP}자 하드캡 → 반려")
    sid = store.create(
        body.name,
        body.split,
        body.model or DEFAULT_MODEL_SENTINEL,
        body.runs,
        body.prompt,
        affiliation=(body.affiliation or None),
    )
    _start(sid, body.prompt, body.split, body.runs, body.model)
    return {"id": sid, "status": "running"}


@app.post("/api/submissions/{sid}/run")
async def run_pending(sid: int):
    sub = store.get(sid)
    if not sub:
        raise HTTPException(404, "제출 없음")
    if sub["status"] == "running":
        raise HTTPException(409, "이미 실행 중")
    model = sub["model"] if sub["model"] != DEFAULT_MODEL_SENTINEL else None
    _start(sid, sub["prompt"], sub["split"], sub["runs"], model)
    return {"id": sid, "status": "running"}


@app.post("/api/submissions/{sid}/cancel")
async def cancel(sid: int):
    state = _active.get(sid)
    if not state:
        raise HTTPException(409, "실행 중이 아님")
    state["cancel"].set()
    return {"id": sid, "status": "cancelling"}


@app.get("/api/submissions/{sid}/progress")
async def progress(sid: int):
    sub = store.get(sid)
    if not sub:
        raise HTTPException(404, "제출 없음")
    state = _active.get(sid)
    return {
        "id": sid,
        "status": sub["status"],
        "progress": state["progress"] if state else None,
        "error_msg": sub["error_msg"],
    }


@app.get("/api/submissions/{sid}")
async def detail(sid: int):
    sub = store.get(sid)
    if not sub:
        raise HTTPException(404, "제출 없음")
    return sub


@app.get("/api/submissions")
async def leaderboard():
    subs = store.list()
    out = []
    for s in subs:
        r = s.get("result")
        out.append(
            {
                "id": s["id"],
                "name": s["name"],
                "affiliation": s.get("affiliation"),
                "created_at": s["created_at"],
                "split": s["split"],
                "model": s["model"],
                "runs": s["runs"],
                "prompt_len": s["prompt_len"],
                "is_baseline": s["is_baseline"],
                "status": s["status"],
                "leaderboard_score": r["leaderboard_score"] if r else None,
                "macro_f1": r["macro_f1_mean"] if r else None,
                "risk_f1": {k: v["f1"] for k, v in r["primary"]["risk"]["per_class"].items()}
                if r
                else None,
                "cycle_f1": {k: v["f1"] for k, v in r["primary"]["cycle"]["per_class"].items()}
                if r
                else None,
                "invalid_rate": r["primary"]["invalid_rate"] if r else None,
                "exact_match_count": r["primary"]["exact_match_count"] if r else None,
                "n": r["primary"]["n"] if r else None,
            }
        )
    # 채점 완료(점수 있음)를 점수 내림차순 먼저, 그다음 미완료
    out.sort(
        key=lambda x: (x["leaderboard_score"] is not None, x["leaderboard_score"] or 0),
        reverse=True,
    )
    return out


@app.get("/api/config")
async def config():
    """참가자·운영 화면 표시용 채점 설정. seed는 비노출."""
    cfg = load_llm_config()
    return {"model": cfg.model, "temperature": cfg.temperature, "char_cap": CHAR_HARDCAP}


@app.get("/api/baselines")
async def list_baselines():
    """baselines/*.txt 원문 목록 (에디터에 불러오기용)."""
    base_dir: Path = PROJECT_ROOT / "baselines"
    out = []
    for f in sorted(base_dir.glob("*.txt")):
        prompt = f.read_text(encoding="utf-8")
        out.append({"name": f.stem, "prompt": prompt, "chars": len(prompt)})
    return out


@app.post("/api/baselines/register")
async def register_baselines():
    base_dir: Path = PROJECT_ROOT / "baselines"
    created = []
    existing = {s["name"] for s in store.list() if s["is_baseline"]}
    for f in sorted(base_dir.glob("*.txt")):
        name = f.stem
        if name in existing:
            continue
        prompt = f.read_text(encoding="utf-8")
        sid = store.create(name, "public", "default", 1, prompt, is_baseline=True)
        created.append({"id": sid, "name": name})
    return {"registered": created}
