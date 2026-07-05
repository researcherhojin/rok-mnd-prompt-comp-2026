# backend — 프로토타입 채점 하네스 (FastAPI)

기획서(`request/`)의 자동채점 하네스를 **오프라인·결정론**으로 구현한 백엔드.
채점 코어는 라이브 API 없이 mock 시뮬레이터로 돌아가며(P5에서 OpenAI 실호출로 교체),
골드셋 + 다회 적대적 검증으로 확인됨.

## 구조 (레이어드 패키지)

```
harness/
├─ core/       도메인 — 프로덕션 워커가 그대로 재사용(아키텍처 §3)
│  ├─ data.py       합성 데이터·라벨 규칙(기획서 §1.3, 단일 소스)
│  ├─ scoring.py    채점 엔진(직렬화·파싱·Macro F1·간결성·유효/형식/보안·산식)
│  └─ llm.py        LLM 어댑터 — MockClient(기본) · OpenAIClient(P5)
├─ api/        웹 계층 (FastAPI)
│  ├─ main.py       앱·4개 엔드포인트
│  └─ schemas.py    요청/응답 Pydantic 모델
├─ storage/    저장소
│  └─ db.py         SQLite(→Postgres 이관)
└─ cli.py      3개 지침 채점 비교 데모
tests/         test_scoring · test_api  (20)
```

## 실행 (uv)

```bash
uv sync                                          # 최초 1회 — .venv + 의존성
uv run pytest -q                                 # 회귀 테스트 (20)
uv run python -m harness.cli                      # 3개 샘플 지침 채점 비교
uv run python -m harness.core.data                # 데이터 분포 확인
uv run uvicorn harness.api.main:app --reload      # API 서버 (localhost:8000)
```

실호출(P5)은 `uv sync --group llm`으로 openai 설치 후 `prototype/backend/.env`에 `OPENAI_API_KEY`.

## API 엔드포인트

| 메서드·경로 | 기능 |
|---|---|
| `GET /problem` | 문제·입력 스키마·train 예시·라벨 |
| `POST /preview` | 지침 → train 5행 재실행 → 행별 정오·추정 정확도 |
| `POST /submit` | 지침 → test 30행 채점 → 총점·순위·백분위 (SQLite 저장) |
| `GET /leaderboard` | 순위 + 분포 히스토그램 |

## 채점 산식 (기획서 §4.1)

```
task  = 45 × (0.9·평균 Macro F1 + 0.1·간결성)
total = task + 25·수강 + 유효(10) + 형식(10) + 보안(10)   # 총 100
```

## 경계 = "분석이냐 배관이냐"

- **하네스(core) = 결정론적 배관**: 직렬화 → 모델 호출 → 파싱 → 채점.
- **행동 지침(참가자) = 모든 분석**: 전처리·피처 유도·추론·분류를 in-context로 지시.

`MockClient`는 실제 추론 대신 지침의 규칙 신호(coverage)에 비례해 정답률을 흉내 내
"지침을 개선하면 점수가 오른다"를 오프라인에서 재현한다. 실제 품질 검증은 P5의
`OpenAIClient`(gpt-4.1-nano) 배선 후 수행한다.
