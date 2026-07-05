"""프로토타입 채점 API (FastAPI).

P0 코어(`data`/`scoring`/`llm`)를 감싸 4개 엔드포인트로 노출한다. 채점 기본값은 mock(오프라인·결정론).
실행: `uv sync` 후 `uv run uvicorn harness.api.main:app --reload`

- GET  /problem      문제·입력 스키마·train 예시·라벨 정의
- POST /preview      지침 → train 5행 재실행 → 행별 정오 + 추정 정확도
- POST /submit       지침 → test 30행 채점 → 총점·항목별·순위·백분위 (SQLite 저장)
- GET  /leaderboard  순위·분포 히스토그램
"""
from __future__ import annotations

import random
from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from harness.api.schemas import InstructionIn
from harness.core import data, scoring
from harness.core.data import CYCLE_LABELS, RISK_LABELS
from harness.core.llm import MockClient
from harness.storage import db

CHAR_LIMIT = 3000
PREVIEW_SAMPLE = 5

# 데이터셋은 프로세스 시작 시 1회 생성(결정론)
DATASET = data.generate()
# 미리보기용 정답셋: train 라벨로 구성(MockClient는 dataset["ground_truth"]만 참조 → 코어 수정 불필요)
_TRAIN_GT = [
    {
        "id": r["id"],
        "failure_risk_grade": r["failure_risk_grade"],
        "maintenance_cycle_range": r["maintenance_cycle_range"],
    }
    for r in DATASET["train"]
]

# 입력 컬럼 스키마(기획서 §1.2) — 프론트 안내용
_COLUMNS = [
    {"name": "id", "type": "int", "desc": "제출 대상 ID"},
    {"name": "equipment_type", "type": "str", "desc": "장비 유형(발전기/전술차량/통신장비/레이더/화포)"},
    {"name": "repair_start_date", "type": "date", "desc": "수리 시작일"},
    {"name": "repair_end_date", "type": "date", "desc": "수리 종료일"},
    {"name": "maintenance_action", "type": "str", "desc": "정비 조치(자유 텍스트)"},
    {"name": "cost", "type": "int", "desc": "투입 비용(원)"},
    {"name": "maintenance_count_1y", "type": "int", "desc": "최근 1년 정비 횟수"},
    {"name": "operating_hours", "type": "int", "desc": "누적 가동시간"},
    {"name": "days_since_last_failure", "type": "int", "desc": "직전 고장 후 경과일"},
]


def _seed_rows() -> list[dict]:
    """리더보드가 비어 보이지 않도록 결정론적 가짜 제출 50건(점수 분포 형성)."""
    rng = random.Random(42)
    rows = []
    for i in range(1, 51):
        f1 = max(0.0, min(1.0, rng.gauss(0.55, 0.22)))
        brev = max(0.0, min(1.0, rng.gauss(0.60, 0.25)))
        validity = 10.0 if rng.random() > 0.10 else round(rng.uniform(4, 9), 1)
        fmt = 10.0 if rng.random() > 0.15 else round(rng.uniform(3, 9), 1)
        sec = 10 if rng.random() > 0.05 else 5
        vod = 25
        total = 45 * (0.9 * f1 + 0.1 * brev) + vod + validity + fmt + sec
        rows.append(
            {
                "participant": f"참가자{i:03d}",
                "instruction": "(시드 데이터)",
                "chars": rng.randint(200, 2800),
                "created_at": f"2026-07-0{1 + (i % 7)}T09:00:00Z",
                "avg_f1_public": round(f1, 4),
                "brevity": round(brev, 4),
                "validity": validity,
                "format": fmt,
                "security": sec,
                "vod": vod,
                "total_public": round(total, 2),
            }
        )
    return rows


db.init_db(seed_rows=_seed_rows())

app = FastAPI(title="설비 정비주기 예측형 — 프로토타입 채점 API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 프로토타입: 프론트 dev 서버 허용
    allow_methods=["*"],
    allow_headers=["*"],
)


def _validate(instruction: str) -> None:
    if not instruction.strip():
        raise HTTPException(status_code=400, detail="지침이 비어 있습니다.")
    if len(instruction) > CHAR_LIMIT:
        raise HTTPException(
            status_code=400,
            detail=f"지침이 {CHAR_LIMIT}자를 초과했습니다(현재 {len(instruction)}자).",
        )


def _mask(name: str) -> str:
    return name[0] + "*" * (len(name) - 1) if len(name) > 1 else name


@app.get("/problem")
def get_problem() -> dict:
    return {
        "title": "설비·고장 정비주기 예측형",
        "summary": "정비 이력으로 고장위험등급과 다음 정비주기 구간을 분류하는 행동 지침을 작성하세요.",
        "columns": _COLUMNS,
        "labels": {
            "failure_risk_grade": RISK_LABELS,
            "maintenance_cycle_range": CYCLE_LABELS,
        },
        "output_contract": "각 행에 `risk_grade, cycle_range` 한 줄로 출력",
        "char_limit": CHAR_LIMIT,
        "train": DATASET["train"],
    }


@app.post("/preview")
def preview(body: InstructionIn) -> dict:
    _validate(body.instruction)
    mock = MockClient({"ground_truth": _TRAIN_GT})
    sample = DATASET["train"][:PREVIEW_SAMPLE]
    rows, correct = [], 0
    for r in sample:
        pr, pc = scoring.parse(mock.run(body.instruction, scoring.serialize(r)))
        ok = pr == r["failure_risk_grade"] and pc == r["maintenance_cycle_range"]
        correct += ok
        rows.append(
            {
                "id": r["id"],
                "pred_risk": pr,
                "pred_cycle": pc,
                "true_risk": r["failure_risk_grade"],
                "true_cycle": r["maintenance_cycle_range"],
                "correct": ok,
            }
        )
    return {
        "chars": len(body.instruction),
        "sample_size": len(sample),
        "estimated_accuracy": round(correct / len(sample), 3),
        "rows": rows,
    }


@app.post("/submit")
def submit(body: InstructionIn) -> dict:
    _validate(body.instruction)
    res = scoring.score_submission(body.instruction, DATASET, MockClient(DATASET))
    sub_id = db.insert_submission(
        {
            "participant": body.participant,
            "instruction": body.instruction,
            "chars": res["chars"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "avg_f1_public": res["avg_f1_public"],
            "brevity": res["brevity"],
            "validity": res["validity"],
            "format": res["format"],
            "security": res["security"],
            "vod": res["vod"],
            "total_public": res["total_public"],
        }
    )
    board = db.leaderboard()
    total = res["total_public"]
    rank = 1 + sum(1 for r in board if r["total_public"] > total)
    percentile = round(100 * rank / len(board), 1)
    return {
        "submission_id": sub_id,
        "score": res,
        "rank": rank,
        "total_participants": len(board),
        "percentile": percentile,
        "rows": res["rows"],
    }


@app.get("/leaderboard")
def get_leaderboard() -> dict:
    board = db.leaderboard()
    buckets = [0] * 11  # 0~100점 10점 버킷(마지막 버킷은 100 포함)
    for r in board:
        buckets[min(10, int(r["total_public"] // 10))] += 1
    entries = [
        {
            "rank": i + 1,
            "participant": _mask(r["participant"]),
            "total_public": r["total_public"],
            "chars": r["chars"],
        }
        for i, r in enumerate(board[:50])
    ]
    return {"count": len(board), "entries": entries, "distribution": buckets}
