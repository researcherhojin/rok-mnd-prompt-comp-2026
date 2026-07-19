"""제출 저장소 (SQLite). 제출 메타 + 채점 결과 JSON. 정답 원본은 저장하지 않음."""

from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from grader.config import PROJECT_ROOT

DEFAULT_DB = PROJECT_ROOT / "submissions.db"

# status: pending → running → done | error | cancelled
_COLUMNS = (
    "id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, affiliation TEXT, created_at TEXT,"
    " split TEXT, model TEXT, runs INTEGER, prompt TEXT, prompt_len INTEGER,"
    " is_baseline INTEGER, status TEXT, error_msg TEXT, result_json TEXT"
)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class Store:
    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else DEFAULT_DB

    def _conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute(f"CREATE TABLE IF NOT EXISTS submissions ({_COLUMNS})")
        # 기존 DB에 소속 컬럼이 없으면 추가 (CREATE IF NOT EXISTS는 컬럼을 추가하지 않음)
        cols = {r[1] for r in conn.execute("PRAGMA table_info(submissions)")}
        if "affiliation" not in cols:
            conn.execute("ALTER TABLE submissions ADD COLUMN affiliation TEXT")
        return conn

    def create(
        self, name, split, model, runs, prompt, is_baseline=False, status="pending",
        affiliation=None,
    ) -> int:
        with self._conn() as c:
            cur = c.execute(
                "INSERT INTO submissions"
                " (name, affiliation, created_at, split, model, runs, prompt, prompt_len,"
                "  is_baseline, status, error_msg, result_json)"
                " VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                (name, affiliation, _now(), split, model, runs, prompt, len(prompt),
                 int(is_baseline), status, None, None),
            )
            return int(cur.lastrowid)

    def set_status(self, sid: int, status: str, error_msg: str | None = None) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE submissions SET status=?, error_msg=? WHERE id=?",
                (status, error_msg, sid),
            )

    def set_model(self, sid: int, model: str) -> None:
        """실행에 실제 쓰인 모델을 기록 (표시상 'default' 대신 gpt-4.1-nano 등)."""
        with self._conn() as c:
            c.execute("UPDATE submissions SET model=? WHERE id=?", (model, sid))

    def set_result(self, sid: int, result: dict) -> None:
        with self._conn() as c:
            c.execute(
                "UPDATE submissions SET status='done', result_json=? WHERE id=?",
                (json.dumps(result, ensure_ascii=False), sid),
            )

    def get(self, sid: int) -> dict | None:
        with self._conn() as c:
            row = c.execute("SELECT * FROM submissions WHERE id=?", (sid,)).fetchone()
        return _row_to_dict(row) if row else None

    def list(self) -> list[dict]:
        with self._conn() as c:
            rows = c.execute("SELECT * FROM submissions ORDER BY id").fetchall()
        return [_row_to_dict(r) for r in rows]


def _row_to_dict(row: sqlite3.Row) -> dict:
    d = dict(row)
    d["is_baseline"] = bool(d["is_baseline"])
    d["result"] = json.loads(d.pop("result_json")) if d.get("result_json") else None
    return d
