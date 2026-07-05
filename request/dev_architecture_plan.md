# 개발 아키텍처 계획 — 프로토타입 → 프로덕션 (Front / Back / DB)

> **목적.** 자동채점·리더보드를 실제로 굴리기 위한 **DB 우선** 개발 계획. 프로토타입(코어 엔진+CLI)에서
> 프로덕션(1만 명·동시 500)까지, 그리고 이후 확장(2차 PBL·다문제·다회차)까지 고려한 구조.
> 관련: `dev_workplan_scoring_leaderboard.md`(채점 구현), `system_functional_spec.md`(기능 명세).

---

## 0. 설계 원칙

1. **DB 먼저.** 스키마가 시스템의 뼈대 — 제출/재실행/채점/리더보드가 모두 여기서 만난다. 스키마·접근 경계(특히 `ground_truth` 격리)를 먼저 확정하고 그 위에 API를 얹는다.
2. **채점은 비동기.** 재실행(OpenAI 호출)은 느리고 비싸다 → 웹 접수와 **분리된 큐+워커**. 웹 tier는 무상태·수평 확장.
3. **확장 가능하게 추상화.** 문제·모델·하네스·metric을 **데이터/플러그인**으로 두어 2차 대회·신규 출제안·모델 교체가 코드 수정 없이 붙게 한다.
4. **비용은 1급 관심사.** API 예산 가드·캐싱·(선택) Batch API를 처음부터 설계에 반영.

---

## 1. 전체 아키텍처 (레이어)

```
[Frontend · React SPA]  안내/신청 · 참가자 콘솔(제출·미리보기) · 리더보드 · 관리자
        │ HTTPS (REST/JSON)
[API · FastAPI] (무상태, LB 뒤 수평 확장)
   · 인증/신청 · 제출 접수(동기 검증) · 조회 · 리더보드 API · 관리자 API
        │ enqueue
[Queue · Redis]  채점 작업 큐 · 제출 카운터 · rate limit · 리더보드 캐시
        │
[Scoring Workers · Python] (워커 수로 스케일)
   · 하네스 재실행(OpenAI gpt-4.1-nano) · 파싱 · Macro F1·간결성·통합 · 예산 가드
        │  read/write
[Data]  PostgreSQL(트랜잭션) · Redis(핫 상태) · Object Storage(원출력) · skillflo(LMS 연동)
[Batch · cron]  매일 자정 리더보드 스냅샷
```

- **웹 tier ↔ 워커 tier 분리**가 핵심: 마감 직전 폭주에도 접수는 즉시 응답, 채점은 큐에서 워커가 소화.
- `ground_truth`·OpenAI 키는 **워커 tier에서만** 접근(웹/프론트에 절대 노출 안 함).

---

## 2. DB 설계 (먼저 확정)

**RDBMS = PostgreSQL** (관계형 스키마·트랜잭션·JSONB). 핫 상태는 **Redis**, 대용량 원출력은 **Object Storage(S3 등)**.

### 2.1 핵심 테이블 (명세서 §4 → DDL 스켈레톤)
| 테이블 | 요점 | 인덱스/비고 |
|---|---|---|
| `competitions` | **다회차 확장용** — 회차·문제·기간·모델·규칙 참조 | 모든 하위 테이블이 FK |
| `participants` | 신청·인증·동의 | email/google 유니크 |
| `vod_progress` | skillflo 수강률 | (participant, content) |
| `submissions` | `instruction_json`, `instruction_chars`, status | idx(participant, status, submitted_at) |
| `model_runs` | 재실행 **원출력**(30행) | 대용량 → **Object Storage 참조 또는 JSONB, 날짜 파티셔닝** |
| `scores` | 항목별·total_public/private | idx(submission) |
| `ground_truth` | 정답(PUBLIC/PRIVATE) | **별도 스키마·워커 role만 접근** |
| `leaderboard_snapshots` | rank·tier·percentile·submit_count | idx(competition, snapshot_at, rank) |
| `review_flags` · `awards` · `audit_log` · `api_budget` | 검수·수상·감사·비용 | |

### 2.2 DB 작업 원칙
- **마이그레이션**: Alembic로 버전 관리(스키마가 계속 진화).
- **격리**: `ground_truth`는 별도 스키마/역할(또는 별도 DB), 워커 서비스 계정만 SELECT. 웹 role은 권한 없음.
- **대용량 대비**: 최대 제출 30만 건 × 30행 = 900만 `model_runs` 행 → **원출력은 Object Storage**에 두고 DB엔 메타+파싱결과만. 또는 JSONB + 월별 파티션.
- **읽기 확장**: 리더보드 조회는 **Redis 캐시 + 자정 스냅샷 테이블**로 흡수(원본 무거운 조인 회피). 필요 시 read replica.
- **동시성**: 제출 카운터(1일 3회)·rate limit은 **Redis 원자 연산**(DB 락 회피).

---

## 3. 백엔드 (FastAPI + 큐 + 워커)

- **프레임워크: FastAPI(Python)** — 채점 엔진이 Python(F1·OpenAI SDK)이라 **언어 통일**, async로 동시 500 처리 유리, 타입/문서 자동화.
  - *대안:* 스킬플로가 Node 기반이면 **Node API 게이트웨이 + Python 채점 마이크로서비스**로 분리(권장 조합).
- **큐/워커: Redis + Celery(또는 Arq)** — 제출 → 큐 → 워커 풀이 재실행·채점. 워커 수로 처리량 조절, 재시도·타임아웃·rate limit 내장.
- **채점 워커 = 프로토타입 코어 엔진 재사용.** Phase 0에서 만든 Python 채점 패키지를 워커가 그대로 import → 프로토타입이 곧 프로덕션 코어.
- **미리보기**: 동기 경량 경로(train 5행, rate limit) — 별도 저지연 엔드포인트.
- **배치**: Celery beat(또는 k8s cron)로 자정 리더보드 스냅샷.

**주요 서비스 경계**
| 서비스 | 책임 | 스케일 |
|---|---|---|
| API(web) | 인증·접수·조회·admin | 무상태 수평 |
| Scoring worker | 재실행·채점 | 워커 수 |
| Batch | 자정 리더보드 | 단일/락 |
| (선택) Preview worker | 미리보기 전용 풀 | 분리 스케일 |

---

## 4. 프론트엔드 (React SPA)

- **React(Next.js 권장)** — 콘솔(에디터+실행+결과), 리더보드, 관리자 대시보드가 상태·인터랙션이 있어 SPA 적합. **이미 만든 `flow.html`의 디자인 시스템(네이비·토스 톤)을 컴포넌트로 이식**.
  - *스킬플로 임베드 제약* 있으면 iframe/위젯 또는 서버 렌더 템플릿으로 축소 가능.
- **화면 3영역**: ① 참가자(안내·신청·콘솔·리더보드) ② 관리자(현황·검수·재채점·엑셀·API 예산) ③ 공용(리더보드 공개).
- **콘솔 = 코딩테스트 UX**: 지침 에디터(글자수 카운터 3000자) · [샘플 실행](미리보기) · [제출](공식) · 결과 테이블. (`flow.html` §참가자 제출·검증 환경이 목업)

---

## 5. 확장성 · 비용 레버

**확장성(이후 대비)**
- **다회차/다문제:** `competitions` 테이블 + 문제를 데이터로 → 2차 PBL·신규 출제안이 코드 없이 추가.
- **하네스 플러그인:** 채점 파이프라인을 `steps=[serialize, run, parse, score]` 추상화 → **Shape A(단일) ↔ Shape B(다단계 전처리)** 교체.
- **모델 어댑터:** `LLMClient` 인터페이스(OpenAI/Ollama/mock) + `SCORING_MODEL` config → 모델 교체·A/B.
- **metric 플러그인:** Macro F1 ↔ QWK 등 교체.

**비용(gpt-4.1-nano)**
- **프롬프트 캐싱**(system=지침 고정) → 입력비 60~80%↓.
- **동일 지침 중복 제거** + 미리보기 rate limit·일 예산 상한(`api_budget`).
- **(선택) OpenAI Batch API** — 공식 채점은 실시간이 아니어도 됨("채점 중" 표시) → **Batch(약 50%↓)** 로 대량 재실행 비용 절감. 미리보기만 동기.

---

## 6. 개발 단계 (Phase)

| Phase | 내용 | 산출/검증 |
|---|---|---|
| **0 · 프로토타입** | **코어 채점 엔진(Python) + 데이터/정답셋 생성 + 회귀 골드셋 + CLI** · OpenAI 실호출(gpt-4.1-nano) | 지침 1개 → 실제 점수 산출, 골드셋 통과 |
| **1 · MVP 백엔드** | Postgres 스키마·마이그레이션 · FastAPI(/submit /preview /leaderboard) · Redis·워커 · 엔진 연결 | 제출→비동기 채점→점수 저장 E2E |
| **2 · 프론트엔드** | React 콘솔·리더보드(디자인 시스템 이식) · API 연동 | 브라우저에서 제출·미리보기·순위 확인 |
| **3 · 운영 기능** | 관리자 콘솔·검수·재채점 · 자정 배치·본인 백분위 · skillflo 연동 · API 예산 모니터 | 관리자 전 기능·단계적 공개 |
| **4 · 스케일·하드닝** | 동시 500 부하·Batch API·캐싱·모니터링·보안 리뷰·파일럿 리허설 | 부하/비용 목표 달성 |

> **DB 우선 순서:** Phase 0에서 채점 로직을 먼저 확정하되, **Phase 1의 첫 작업은 스키마·마이그레이션·`ground_truth` 격리**. 나머지 API/프론트는 그 위에 얹는다.

---

## 7. 기술 스택 요약 · 협의 항목

**권장 스택**
- Front: **React/Next.js** (또는 스킬플로 임베드 위젯)
- Back: **FastAPI(Python)** + **Celery/Arq + Redis** (또는 Node 게이트웨이 + Python 채점 마이크로서비스)
- DB: **PostgreSQL** + **Redis** + **Object Storage**(원출력)
- LLM: **OpenAI gpt-4.1-nano**(config·어댑터), (선택) Batch API
- 인프라: 컨테이너(도커) + LB + 워커 오토스케일, Alembic 마이그레이션

**협의 필요**
- 스킬플로 스택(Node/PHP/…)과의 통합 방식 → 백엔드 언어·임베드 방식 결정
- 프론트 임베드 제약(iframe/위젯 vs 독립 SPA)
- 공식 채점에 **Batch API** 채택 여부(비용↓ vs 지연↑)
- 인프라 호스팅(온프레미스/클라우드·데이터 residency — 국방 보안 요건)
- `model_runs` 원출력 보관 위치·기간(감사 vs 비용)
