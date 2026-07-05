"""SQLite 저장소 — 제출·리더보드 (프로토타입).

프로덕션은 PostgreSQL(`request/dev_architecture_plan.md` §2)로 이관. 스키마 형태는 그대로 옮길 수 있게 유지.
"""
from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parents[2] / "prototype.db"  # backend/ 루트에 생성

# 저장 컬럼(순서 고정) — insert/seed 공통
_COLS = (
    "participant", "instruction", "chars", "created_at",
    "avg_f1_public", "brevity", "validity", "format", "security", "vod",
    "total_public", "is_seed",
)


def connect() -> sqlite3.Connection:
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con


def init_db(seed_rows: list[dict] | None = None) -> None:
    """스키마 생성 + (최초 1회) 시드 데이터 주입."""
    con = connect()
    con.execute(
        """
        CREATE TABLE IF NOT EXISTS submissions (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            participant   TEXT    NOT NULL,
            instruction   TEXT    NOT NULL,
            chars         INTEGER NOT NULL,
            created_at    TEXT    NOT NULL,
            avg_f1_public REAL,
            brevity       REAL,
            validity      REAL,
            format        REAL,
            security      INTEGER,
            vod           INTEGER,
            total_public  REAL,
            is_seed       INTEGER DEFAULT 0
        )
        """
    )
    con.commit()
    already = con.execute("SELECT COUNT(*) AS n FROM submissions WHERE is_seed=1").fetchone()["n"]
    if seed_rows and already == 0:
        con.executemany(
            f"INSERT INTO submissions ({','.join(_COLS)}) "
            f"VALUES ({','.join(':' + c for c in _COLS)})",
            [{**r, "is_seed": 1} for r in seed_rows],
        )
        con.commit()
    con.close()


def insert_submission(row: dict) -> int:
    """실제 제출 1건 저장 → id 반환."""
    con = connect()
    cur = con.execute(
        f"INSERT INTO submissions ({','.join(_COLS)}) "
        f"VALUES ({','.join(':' + c for c in _COLS)})",
        {**row, "is_seed": 0},
    )
    con.commit()
    sub_id = cur.lastrowid
    con.close()
    return sub_id


def leaderboard() -> list[dict]:
    """총점 내림차순 정렬(동점 시 먼저 제출한 순). 프로토타입은 전 제출을 순위화."""
    con = connect()
    rows = con.execute(
        "SELECT participant, chars, total_public, created_at, is_seed "
        "FROM submissions ORDER BY total_public DESC, created_at ASC"
    ).fetchall()
    con.close()
    return [dict(r) for r in rows]
