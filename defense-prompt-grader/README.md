# defense-prompt-grader

**2026 국방AI 프롬프트 경진대회 — 출제안 04 (K-511 계통별 정비주기 예측형) 문제 B**의 **로컬 자동채점 시뮬레이터**.

참가자가 시스템 프롬프트(행동 지침)를 제출하면, 채점 엔진이 평가 데이터 각 행을 지정 LLM에 실행시켜 정답과 비교하고 점수·리더보드를 산출한다. 출제위원이 베이스라인 프롬프트(P0–P2)의 실제 점수를 실측하고 채점 파이프라인(파싱·산식)을 검증하는 것이 목적이다. 데이터 스키마 상세는 `data/README.md` 참조.

- **라벨(이중):** `risk_grade` ∈ {HIGH, MEDIUM, LOW} · `cycle_range` ∈ {0-30, 31-90, 91-180, 181+}. LLM은 행당 `risk_grade, cycle_range` 콤마 한 줄로 답한다.
- **평가 세트:** sample 10 / public 300 / private 700 (K-511 부품 계통별 정비 이력, 비-라벨 입력 23컬럼 = `id` + 특성 22개, + 라벨 2개). 데이터는 상위 repo `data/` (읽기 전용, 라벨 인라인).
- **채점:** `prediction_score = (risk Macro F1 + cycle Macro F1) / 2`, `리더보드 점수 = 0.9·prediction_score + 0.1·(3000−글자수)/3000`. 두 축은 독립 채점(한쪽에서 다른 쪽 추론 안 함). 정확도(두 축 모두 정답인 완전일치 행수)와 Macro F1은 **별개 지표**로 분리 보고.
- **라벨 중복(실측 1000/1000):** `cycle_range`가 `risk_grade`를 결정(0-30→HIGH, 31-90·91-180→MEDIUM, 181+→LOW) → 결합 F1은 HIGH/LOW 이중 계산(주최측 배점 재논의 flag).

## 요구 사항

- Python **3.12** (`.python-version`로 uv가 자동 설치)
- [uv](https://docs.astral.sh/uv/) 패키지 매니저

## 설치

```bash
uv sync            # .venv 생성 + 의존성 설치 (3.12 자동 fetch)
cp .env.example .env
```

`.env`에 **OpenAI API 키**를 넣는다. mock 백엔드는 없다 — 채점은 항상 실제 LLM을 재실행한다.

```ini
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=sk-...
LLM_MODEL=gpt-4o-mini     # 코드 기본값. 대회 확정 모델은 미정
MAX_CONCURRENCY=8
```

`LLM_BASE_URL`은 OpenAI 호환 엔드포인트면 무엇이든 받는다. 다만 **점수는 모델에 종속적이라, 모델을 바꾸면 이 저장소의 어떤 수치와도 비교할 수 없다.** 동일한 650자 프롬프트를 `public` 300행에 돌린 실측(`request/reference_prompts.md`):

| 모델 | prediction_score |
|---|---|
| `gpt-4o-mini` | 0.1766 |
| `gpt-4.1-nano` | 0.3131 |
| `gpt-5.4-nano` | 0.35 |
| `gpt-5.4-mini` | 0.54 |
| `gpt-5.4` | 0.81 |

즉 **모델이 점수 천장을 결정한다** — 규칙을 완전히 담은 프롬프트도 소형 모델에서는 상한이 낮고, 이는 프롬프트 글자수와 무관하다. 점수를 재현·비교하려면 `LLM_MODEL`을 실측 당시와 동일하게 맞춰야 한다.

⚠️ `gpt-4o-mini`의 0.1766은 다수클래스 상수 예측 **0.1711**(아래 §테스트의 검증 앵커)과 사실상 같다 — 이 모델에서는 규칙을 줘도 판정이 거의 이뤄지지 않는다. 이름의 `mini`로 `gpt-5.4-mini`(0.54)를 유추하지 말 것.

> **비용 주의:** 캐시가 비어 있을 때 1회 채점 = 행 수 × `--runs` 만큼의 API 호출이다(`public` 1회 = 300 호출, `--runs 2` = 600). 먼저 `--split sample`(10행)로 확인할 것. 응답은 `(프롬프트, 모델, split, 행 id, 실행 회차)` 단위로 `cache.db`에 저장돼 재실행 시 재호출하지 않는다(`--force`로 무시).

> ⚠️ **캐시 키에 `max_tokens`·`temperature`·`seed`는 포함되지 않는다.** 이 값들을 바꿔도 이전 응답이 그대로 재사용되므로, 파라미터 실험은 **별도 DB 파일 + `force=True`** 로 격리해야 한다. 그렇지 않으면 바꾼 적 없는 설정의 결과를 측정하게 된다.

## 빠른 시작

```bash
uv run pytest -q                                    # ① API 키 없이 파이프라인 검증 (LLM 경계는 스텁)
uv run grader run --prompt baselines/P0.txt --split sample    # ② 10행 실호출로 연결 확인
uv run grader run --prompt baselines/P1.txt --split public --runs 2   # ③ 본 실측
```

옵션: `--split {sample,public,private}` · `--runs {1,2,3}` · `--model <override>` · `--force`(캐시 무시).

## 채점 API

```bash
make dev            # → http://localhost:8080  (docs: /docs)
```

| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/submit` | 프롬프트 제출 → 백그라운드 채점 시작, submission_id 반환 |
| GET | `/api/submissions` | 리더보드용 전 제출 목록 (프론트에서 참가자별 최고점 집계) |
| GET | `/api/submissions/{id}` | 제출 상세 (혼동행렬·클래스별 지표·행별 결과) |
| GET | `/api/submissions/{id}/progress` | 실행 진행률(완료/유효/INVALID/ERROR) |
| POST | `/api/submissions/{id}/cancel` | 실행 중단 |
| POST | `/api/baselines/register` | `baselines/*.txt` 자동 등록 |

정답 라벨(`risk_grade`·`cycle_range`, 각 split 파일에 인라인)은 채점 모듈에서만 접근하며 리더보드·목록 payload에는 노출되지 않는다(누설 방지). 소속(`affiliation`)은 제출 시 선택 입력으로 저장·표시된다.

## 웹 콘솔

React(Vite+TS+Tailwind, 모바일 우선) UI. DACON식 페이지 구성. 상단 3탭 **대회 안내 / 제출 / 리더보드**, 대회 안내는 서브내비 **문제·데이터·평가·규칙**(참가자 안내, 운영자 판정 로직 비노출). 결과 **상세**는 리더보드에서 진입. 내부 **운영·개발**(`/ops`, 하네스·순위 산정 명세)은 푸터 링크(비노출). (게시판은 운영 플랫폼 몫이라 콘솔에서 제외 — 명세만 `request/harness_config_options.md` §6.2.)

```bash
make dev            # 터미널 1: 백엔드 (8080)
make web            # 터미널 2: 프론트 (5173, /api → 8080 프록시)
```

- **제출**: 제출자 이름·**소속(선택)**, 글자수/3000 실시간 카운터·효율성 미리보기, 베이스라인(P0–P2) 불러오기, 세트(sample/public/private) 선택, 예상 호출/시간, 행 단위 진행률·**경과·예상 잔여 시간**·중단, **세션 지속**(창 닫아도 서버 채점 계속, 재방문 시 이어서 표시). 적용 모델·temperature는 서버 `.env`(`LLM_MODEL`)를 `/api/config`로 받아 표시(seed는 서버 42 고정·비노출).
- **리더보드**: **참가자별 최고점 자동 집계**·누적 제출·최종 제출·소속·**이름 마스킹**·**내 위치 백분위·점수 히스토그램**, 순위 산정 기준 명시, 3초 폴링. (베이스라인 P0–P2는 참가자 리더보드에서 제외 — 측정은 CLI `make cli`.)
- **상세**: risk·cycle 축별 혼동행렬 히트맵·클래스별 P/R/F1, 결합 Macro F1, n_runs 변동성, 오답·INVALID 행 인스펙터(원문 응답), 프롬프트 접기.
- 라벨 색상: risk HIGH=적·MEDIUM=호박·LOW=녹 / cycle 0-30=적·31-90=호박·91-180=남색·181+=녹 · INVALID=회색. 숫자 tabular-nums.

### 화면 캡처

두 서버를 띄운 상태에서 headless Chromium으로 9개 화면(`/` · `/data` · `/evaluation` · `/rules` · `/submit` 초기·작성 후 · `/leaderboard` · `/detail/:id` · `/ops`)을 1440×900 전체 페이지로 캡처해 상위 repo `snap/`에 저장한다(git 미추적·재생성 가능). 캡처 절차는 `CLAUDE.md` §Diagrams & Playwright tooling 참조. 리더보드·상세는 `submissions.db`의 기존 제출을 그대로 렌더하므로 **제출 버튼을 누르지 않으면 LLM 호출 0회**로 전 화면을 얻는다.

## 테스트

```bash
uv run pytest -q            # 파서 + 스코어러 앵커 + 러너(LLM 스텁) + API + 캐시 격리
```

검증 앵커(public 300행): 다수클래스 상수 예측(risk=MEDIUM·cycle=91-180) 시 결합 Macro F1 = **0.1711** (risk 0.2328 · cycle 0.1094). 정답 그대로 예측 시 1.0.

## 아키텍처

```
grader/        순수 채점 코어 (웹 의존성 없음)
  config·data·template·parse·score·llm·cache·runner
  __main__.py  CLI
api/           FastAPI 채점 서버 + submissions SQLite (소속 컬럼 포함)
web/           React(Vite+TS+Tailwind) 프론트엔드
  views/info/  대회 안내 4페이지(문제·데이터·평가·규칙) + 서브내비
  views/       제출·리더보드·상세·운영(ops)
baselines/     P0–P2 시스템 프롬프트 (롤·형식·힌트 레이어링 · README 참조)
tests/         파서·스코어러·러너(LLM 스텁)·LLM 재시도·API·캐시 격리 테스트
```
