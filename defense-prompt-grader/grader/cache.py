"""행 단위 응답 캐시 (SQLite). 중단·재개(resume) 지원. 키 = sha256(prompt+model+split).

split을 키에 포함하는 이유: data/는 sample/public/private가 id 네임스페이스를 공유하므로
(sample id 1~10이 public/private에도 존재), split을 빼면 같은 프롬프트를 여러 split에 돌릴 때
서로 다른 행의 응답이 (key, record_id) 충돌로 오염된다.
"""

from __future__ import annotations

import hashlib
import sqlite3
from pathlib import Path

from .config import PROJECT_ROOT

DEFAULT_DB = PROJECT_ROOT / "cache.db"


def cache_key(system_prompt: str, model: str, split: str) -> str:
    return hashlib.sha256(
        (system_prompt + "\x00" + model + "\x00" + split).encode("utf-8")
    ).hexdigest()


class Cache:
    """(key, record_id, run_idx) → 원문 응답. run_idx를 키에 포함해 n_runs 반복 실행의
    실행별 응답을 구분(재개 시 같은 run_idx 셀만 재사용, 실행 간 변동성 측정은 보존)."""

    def __init__(self, db_path: Path | str | None = None):
        self.db_path = Path(db_path) if db_path else DEFAULT_DB
        self._conn = sqlite3.connect(self.db_path)
        self._conn.execute(
            "CREATE TABLE IF NOT EXISTS responses ("
            "  key TEXT, record_id TEXT, run_idx INTEGER, raw TEXT,"
            "  PRIMARY KEY (key, record_id, run_idx))"
        )
        self._conn.commit()

    def get(self, key: str, record_id: str, run_idx: int) -> str | None:
        cur = self._conn.execute(
            "SELECT raw FROM responses WHERE key=? AND record_id=? AND run_idx=?",
            (key, record_id, run_idx),
        )
        row = cur.fetchone()
        return row[0] if row else None

    def set(self, key: str, record_id: str, run_idx: int, raw: str) -> None:
        self._conn.execute(
            "INSERT OR REPLACE INTO responses VALUES (?,?,?,?)",
            (key, record_id, run_idx, raw),
        )
        self._conn.commit()

    def close(self) -> None:
        self._conn.close()
