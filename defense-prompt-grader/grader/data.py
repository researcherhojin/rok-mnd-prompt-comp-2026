"""데이터 로더 (읽기 전용, BOM-safe). 정답 접근은 이 모듈의 load_answers()로 격리."""

from __future__ import annotations

import csv
from pathlib import Path

from . import config

# user 템플릿 placeholder 순서와 정확히 일치 (22개 입력 컬럼, id·라벨 제외)
INPUT_COLUMNS = [
    "vehicle_id",
    "vehicle_model",
    "part_system",
    "operation_area",
    "mission_type",
    "load_condition",
    "observation_month",
    "repair_start_date",
    "repair_end_date",
    "maintenance_cost_krw",
    "last_maintenance_echelon",
    "emergency_repair_flag",
    "maintenance_count_1y",
    "days_since_last_maintenance",
    "mileage_total_km",
    "operation_hours_total",
    "vehicle_age_months",
    "part_age_months",
    "mileage_since_part_service_km",
    "hours_since_part_service",
    "days_since_last_fault",
    "spare_part_lead_time_days",
]


def _read_csv(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        raise FileNotFoundError(f"데이터 파일 없음: {path}")
    with path.open(encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


def load_split(name: str) -> list[dict[str, str]]:
    """split의 입력 행을 반환. id + 22개 입력 컬럼만.

    라벨(risk_grade·cycle_range)은 INPUT_COLUMNS 에 없어 자동 제외 → LLM 입력 누설 방지 가드.
    """
    if name not in config.SPLIT_FILES:
        raise ValueError(f"알 수 없는 split: {name} (택1: {list(config.SPLIT_FILES)})")
    rows = _read_csv(config.data_dir() / config.SPLIT_FILES[name])
    out = []
    for r in rows:
        row = {"id": r["id"]}
        for col in INPUT_COLUMNS:
            row[col] = r[col]
        out.append(row)
    return out


def load_answers(name: str) -> dict[str, dict[str, str]]:
    """id → {"risk_grade", "cycle_range"}. data/는 라벨이 각 split 파일에 인라인. 백엔드 전용."""
    rows = _read_csv(config.data_dir() / config.SPLIT_FILES[name])
    return {r["id"]: {"risk_grade": r["risk_grade"], "cycle_range": r["cycle_range"]} for r in rows}
