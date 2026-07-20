"""설정: LLM 백엔드, 동시성, 데이터 경로. .env에서 로드하되 임의 하드코딩 금지."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

# 프로젝트 루트 = 이 파일의 상위 2단계 (grader/ → defense-prompt-grader/)
PROJECT_ROOT = Path(__file__).resolve().parents[1]
# 상위 repo 루트 (defense-prompt-grader/ 의 부모) — data/ 데이터가 여기 있음
REPO_ROOT = PROJECT_ROOT.parent

load_dotenv(PROJECT_ROOT / ".env")

# 라벨: K-511 이중 라벨. 신규 라벨이 곧 영문 출력 토큰이라 한글 매핑 불필요.
RISK_LABELS = ["HIGH", "MEDIUM", "LOW"]  # risk_grade Macro F1 클래스 순서 고정
CYCLE_LABELS = ["0-30", "31-90", "91-180", "181+"]  # cycle_range 클래스 순서 고정
INVALID = "__INVALID__"  # 파싱 실패/무효 응답의 예측값 (어느 클래스에도 속하지 않음)

CHAR_HARDCAP = 3000  # 시스템 프롬프트 글자 수 하드캡

# split 이름 → 입력 파일. data/ 는 sample/public/private 모두 라벨 인라인.
SPLIT_FILES = {
    "sample": "sample.csv",  # 10행, 입력+라벨 (참가자 공개)
    "public": "public.csv",  # 300행
    "private": "private.csv",  # 700행
}


def _default_data_dir() -> Path:
    return REPO_ROOT / "data"


@dataclass(frozen=True)
class LLMConfig:
    base_url: str
    api_key: str
    model: str
    max_concurrency: int
    temperature: float = 0.0
    top_p: float = 1.0
    max_tokens: int = 50
    seed: int = 42  # 재현성 고정 seed. 참가자에게는 비노출, 서버에서만 사용.


def load_llm_config() -> LLMConfig:
    return LLMConfig(
        base_url=os.getenv("LLM_BASE_URL", "https://api.openai.com/v1").rstrip("/"),
        api_key=os.getenv("LLM_API_KEY", "EMPTY"),
        model=os.getenv("LLM_MODEL", "gpt-4o-mini"),
        max_concurrency=int(os.getenv("MAX_CONCURRENCY", "8")),
        seed=int(os.getenv("LLM_SEED", "42")),
    )


def data_dir() -> Path:
    override = os.getenv("GRADER_DATA_DIR")
    return Path(override) if override else _default_data_dir()
