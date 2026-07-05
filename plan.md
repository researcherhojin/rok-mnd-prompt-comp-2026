# 프로토타입 개발 계획 (plan.md)

> **한 줄 목표.** 정적 `flow.html`을 넘어, **실제 동작하는 React + FastAPI 데모**를 만들어
> "우리는 DACON·Kaggle·AIfactory보다 나은 참가자 UI/UX를 낼 수 있다"를 증명한다.
> 스킬플로 통합·인증·스케일은 프로토타입 범위 밖(프로덕션 계획은 `request/dev_architecture_plan.md`).

---

## 1. 왜 — UX 차별화 포인트 (증명 대상)

| 기존 플랫폼 | 우리 프로토타입 |
|---|---|
| CSV 파일 업로드 | **코딩테스트식 콘솔** — 에디터에서 지침 작성 → [샘플 실행] |
| 제출 후 숫자만 | **즉각 피드백 루프** — 행별 통과/실패·추정 정확도 바로 |
| 건조한 순위 테이블 | **내 위치** — 상위 %·점수 분포에서 본인 위치 시각화 |
| DS 전문가용 | **초급 친화 온보딩** — 비유·예시·실시간 글자수 가이드 |
| 딱딱한 UI | **토스풍 친근·모던 · 국방 네이비** |

---

## 2. 범위 — 참가자 1명의 완결된 경험 (vertical slice)

1. **문제 이해** (온보딩) — 예측 과제·데이터 예시·라벨 정의
2. **콘솔** — 행동 지침 작성(글자수 카운터) → **[샘플 실행]** → 행별 결과·추정 정확도
3. **제출** → 채점 → **리더보드 + 내 위치**(상위 %·점수 분포)

> **머니샷(데모의 결정적 한 장면).** 지침에 규칙 한 줄을 더 넣고 **[샘플 실행]** → 행별 pill이 빨강→초록으로 바뀌고 추정 정확도 게이지가 차오른다 → 제출 시 **내 위치가 분포에서 위로 점프**. "지침을 개선하면 점수가 오른다"를 눈으로 보여주는 것이 이 데모의 목표.
>
> **채점 경로.** 데모 기본값은 **오프라인 mock 시뮬레이터**(결정론·무지연·무비용). OpenAI `gpt-4.1-nano` 실호출은 **선택 배선**으로 두어, 발표 무대의 지연·비용·네트워크 리스크를 데모 경로에서 분리한다(§8 P5).
>
> 관리자·신청·수강 게이트·다회차는 **프로토타입 제외**(§9).

---

## 3. 기술 스택

| 레이어 | 선택 | 이유 |
|---|---|---|
| Front | **React + Vite** + TypeScript | 빠른 SPA 데모 · flow.html 디자인 이식 |
| 스타일 | CSS 변수(네이비/토스 토큰) 이식 | flow.html과 일관 |
| Back | **FastAPI** (Python) | 채점 엔진·OpenAI SDK와 언어 통일 |
| LLM | **OpenAI `gpt-4.1-nano`** (실호출) | 확정 채점 모델, config 교체 가능 |
| DB | **SQLite** (파일 1개) | 프로토타입 경량, 스키마는 Postgres 이관 가능 |
| 채점 | 자체 Python 엔진 (Macro F1·간결성·통합) | `dev_workplan_scoring_leaderboard.md` §3 구현 |

---

## 4. 아키텍처 (프로토타입)

```
[React SPA (Vite)]  온보딩 · 콘솔 · 리더보드
      │ REST/JSON
[FastAPI]  /problem  /preview  /submit  /leaderboard  /me
      │
[채점 엔진(Python)]  직렬화 → OpenAI gpt-4.1-nano 재실행 → 파싱 → F1·간결성·통합
      │
[SQLite]  submissions · scores · ground_truth · (seed 데이터)
```
- 미리보기/제출 모두 **동기 호출**(프로토타입은 큐 생략, test 30행·train 5행 소량이라 수 초 내).
- OpenAI 키 없으면 **mock 어댑터**로 폴백(오프라인 시연).

---

## 5. 디렉토리 구조 (제안)

```
prototype/
├─ backend/
│  ├─ app.py            # FastAPI 엔드포인트
│  ├─ scoring.py        # 채점 엔진(파싱·F1·간결성·통합)
│  ├─ llm.py            # LLMClient(OpenAI / mock)
│  ├─ data.py           # train/test/ground_truth 생성(결정론 규칙)
│  ├─ db.py             # SQLite 스키마·접근
│  └─ requirements.txt  # (uv)
└─ frontend/
   ├─ index.html
   ├─ src/
   │  ├─ main.tsx
   │  ├─ theme.css       # 네이비/토스 토큰 이식
   │  ├─ pages/ Onboarding.tsx  Console.tsx  Leaderboard.tsx
   │  └─ components/ Editor, ResultTable, MyPosition, ...
   └─ package.json (Vite)
```

---

## 6. 백엔드 설계

**엔드포인트**
| 메서드·경로 | 기능 | 응답 |
|---|---|---|
| `GET /problem` | 문제·train 예시·라벨 정의 | JSON |
| `POST /preview` | 지침 → **train 5행** 재실행 | 행별 정오·추정 정확도 |
| `POST /submit` | 지침 → **test 30행** 채점 | 총점·항목별·순위 |
| `GET /leaderboard` | 리더보드(시드 + 내 제출) | 순위·백분위·분포 |

**채점 엔진 (dev_workplan §3 그대로)**
- 직렬화 → `run_agent(instruction, row)`(OpenAI gpt-4.1-nano, temp 0) → 파싱(정규식)
- `avg_f1` = 두 라벨 Macro F1 평균 · `brevity` = 글자수 · `total = 45·(0.9·f1+0.1·brevity) + 유효/형식/보안 + 수강(프로토는 25 고정)`
- **정답셋** = `data.py` 결정론 규칙 생성(train 15·test 30). ground_truth는 서버만.
- **회귀 골드셋** 3케이스로 엔진 검증 후 UI 연결.

---

## 7. 프론트엔드 설계

**화면**
1. **Onboarding** — 문제 비유·발전기 예시·라벨 표 (flow.html §문제 이식)
2. **Console** — 지침 에디터(줄번호·3000자 카운터) · [샘플 실행]/[제출] 버튼 · 결과 테이블(통과/실패 pill) · 추정 정확도
3. **Leaderboard** — 순위 표 + **내 위치 카드**(상위 %·분포 히스토그램, 네이비 그라디언트)

**디자인**: flow.html의 CSS 변수(`--blue:#1c4270` 네이비, 둥근 카드, 소프트 그림자, pill)를 `theme.css`로 이식 → 일관된 토스풍.

**차별화 인터랙션**: 실행 중 로딩·행별 결과가 순차 채워지는 애니메이션, 제출 후 내 위치가 분포에서 강조되는 모션.

---

## 8. 빌드 단계 · 완료조건

| Phase | 내용 | 완료조건(AC) |
|---|---|---|
| **P0** | backend 코어: `data.py`·`scoring.py`·`llm.py`(mock)·골드셋 — **오프라인, 실호출 없음** | CLI로 지침 1개 → 점수 산출 · 골드셋 A/B/C(95.5·76.2·63.1) 통과 |
| **P1** | backend API: FastAPI(`/problem` `/preview` `/submit` `/leaderboard`) + SQLite · **mock 채점 기본** | `curl`로 4개 엔드포인트 동작 |
| **P2** | frontend Console (**머니샷**): 에디터 → [샘플 실행] → 행별 pill·추정 정확도 | 지침 수정 → 실행 → 점수 변화가 화면에 |
| **P3** | frontend Leaderboard + 내 위치(분포·백분위) | 제출 → 순위·분포 시각화 |
| **P4** | Onboarding + 폴리싱(모션·반응형·카피) | 완결 데모 흐름, 발표 가능 수준 |
| **P5** | OpenAI `gpt-4.1-nano` 실호출 배선 + nano 분별력 spike — **데모 경로 밖** | 우수/평범/엉터리 지침의 F1 스프레드 확인 |

---

## 9. 프로토타입 제외 (프로덕션 이관)

인증·신청·수강 게이트(skillflo) · 큐/워커·동시성 · 관리자 콘솔 · 자정 배치 · Public/Private 분리 · 비용 예산 가드 · 다회차. → `request/` 문서에 이미 설계됨.

---

## 10. 미정 · 확인

- **React**: Vite(권장·빠름) vs Next.js(추후 SSR) — 기본 Vite로 진행 예정
- **채점 경로**: **mock 시뮬레이터가 데모 기본값**(오프라인·결정론). OpenAI `gpt-4.1-nano` 실호출은 `! export OPENAI_API_KEY=...` 준비 시 P5에서 선택 배선.
- **nano 분별력 spike (P5)**: 우수/평범/엉터리 지침으로 실제 F1 스프레드가 벌어지는지 1차 확인 후 실호출 채택. 미달 시 `gpt-4o-mini` 승급.
- **정답셋 규칙**: 기획서 §1.3 그대로 사용
