# 개발자 작업 지시서 — 자동채점 & 리더보드 구현

> **목적.** `competition_design_brief.md`(무엇을)와 `system_functional_spec.md`(어떤 구조)를 받아,
> **개발팀이 바로 구현**할 수 있도록 자동채점 엔진과 리더보드를 의사코드·API·비용·티켓 수준으로 구체화한다.
> 대상: 데이원컴퍼니 플랫폼 개발팀.
>
> **한 줄 요약.** 참가자는 데이터 분석 강의에서 배운 대로 **프롬프트(행동 지침)로 데이터 분석**을 설계하고,
> 하네스가 그 지침을 **gpt-4.1-nano에 재실행**해 숨겨진 test로 채점 → 자정 배치로 리더보드에 반영한다.

---

## 1. 채점 모델 확정

| 용도 | 모델 | 파라미터 |
|---|---|---|
| **실제 채점(공식)** | **gpt-4.1-nano** | `temperature=0`, `seed` 고정, `max_output_tokens=64`, tools 없음 |
| **미리보기(테스트)** | **gpt-4.1-nano** (동일) | 동일 |

- 단가(OpenAI 공식): `gpt-4.1-nano` 입력 **$0.10**/1M · **캐시 입력 $0.025**/1M · 출력 **$0.40**/1M.
- 대안: `gpt-4o-mini`($0.15/$0.075/$0.60, 품질 유사·조금 비쌈). 더 저렴: `gpt-5-nano`($0.05/$0.005/$0.40). 이 과제(소량 정형 분류)는 nano급으로 충분.
- **모델은 config 값**(`SCORING_MODEL`)으로 교체 가능. 검증에서 정확도 부족 시 `gpt-4o-mini` 또는 `gpt-4.1-mini`로 승급.
- **공정성:** 모든 참가자·모든 제출에 **동일 모델·동일 파라미터**. 채점 시점의 모델 버전을 `scores`에 기록.

---

## 2. 시스템 개요 (프롬프트 데이터 분석 하네스)

```
참가자 행동 지침(프롬프트)  ──►  [고정 하네스]  ──►  점수 ──► 리더보드
                                  1 직렬화
                                  2 gpt-4.1-nano 재실행 (지침이 전처리·분석·분류 수행)
                                  3 파싱
                                  4 채점
```

- **참가자 = 분석 로직(지침)만.** "수리기간=종료−시작 계산 → 가동시간 정규화 → 규칙 적용" 같은 **전처리·분석을 프롬프트로** 지시. 강의(데이터 분석)에서 배운 사고를 프롬프트로 구현하는 것이 과제의 본질.
- **하네스 = 결정론적 배관.** 아래 §3.

---

## 3. 자동채점 엔진 — 구현

### 3.1 입력 직렬화 (고정)
각 test 레코드를 **raw JSON 1줄**로 직렬화. 파생값(수리기간 등)은 **만들지 않음** — 파생은 지침이 결정.
```python
def serialize(row) -> str:
    return json.dumps(row, ensure_ascii=False)   # {"id":1,"equipment_type":"발전기",...}
```

### 3.2 모델 호출 (OpenAI API) — 캐싱·재시도·예산
**주입 방식(권장): system = 참가자 지침, user = 레코드.** 지침이 30행 내내 동일하므로 **프롬프트 캐싱**으로 입력비가 급감(캐시 입력 $0.02/1M). (`{{input}}` 인라인 치환도 가능하나 캐싱 효율↓)

```python
def run_agent(instruction: str, row: dict) -> str:
    resp = openai.responses.create(
        model=SCORING_MODEL,               # "gpt-4.1-nano"
        temperature=0, seed=SEED, max_output_tokens=64,
        input=[
            {"role": "system", "content": instruction},   # 캐시되는 안정 프리픽스
            {"role": "user",   "content": serialize(row)}, # 행마다 변하는 부분
        ],
    )
    return resp.output_text.strip()
```
- **재시도:** 429/5xx/timeout → 지수 백오프 재시도(≤3). 초과 시 제출 `FAILED` + 관리자 알림.
- **캐싱/중복 제거:** 동일 (정규화된) 지침+행 조합은 결과 재사용(`api_budget.cache_hits`).
- **예산 가드:** `api_budget` 일 상한 근접 시 신규 채점 큐 지연·경고(§8).
- **원출력 저장:** 응답 원문을 `model_runs.raw_output`에 저장(재현·감사·이의 대응).

### 3.3 출력 파싱 (고정)
```python
ALLOWED_RISK = {"HIGH","MEDIUM","LOW"}
ALLOWED_CYCLE = {"0-30","31-90","91-180","181+"}

def parse(text: str):
    # 마지막 줄에서 `위험, 주기` 추출 (앞선 추론 허용)
    for line in reversed(text.splitlines()):
        m = re.search(r"(HIGH|MEDIUM|LOW)\s*,\s*(0-30|31-90|91-180|181\+)", line, re.I)
        if m:
            return m.group(1).upper(), m.group(2)
    return None, None   # 파싱 실패 → 무효 행
```
- 파싱 실패·허용 밖·빈값 → 해당 행 **정확도 오분류 + 유효성 감점**.

### 3.4 지표 계산

**① 정확도 — 평균 Macro F1**
```python
def macro_f1(y_true: list, y_pred: list, labels: set) -> float:
    f1s = []
    for c in labels:
        tp = sum(t==c and p==c for t,p in zip(y_true,y_pred))
        fp = sum(t!=c and p==c for t,p in zip(y_true,y_pred))
        fn = sum(t==c and p!=c for t,p in zip(y_true,y_pred))
        prec = tp/(tp+fp) if tp+fp else 0.0
        rec  = tp/(tp+fn) if tp+fn else 0.0
        f1s.append(2*prec*rec/(prec+rec) if prec+rec else 0.0)
    return sum(f1s)/len(f1s)

avg_f1 = (macro_f1(risk_true, risk_pred, ALLOWED_RISK)
        + macro_f1(cycle_true, cycle_pred, ALLOWED_CYCLE)) / 2   # 0~1
```
> 순서형 `cycle_range`는 Macro F1(A·기본). QWK(B)로 바꿀 경우 `sklearn.metrics.cohen_kappa_score(..., weights="quadratic")`, 음수는 0 클리핑. (기획서 §7)

**② 간결성 — 지침 글자 수**
```python
def brevity(instruction_chars: int, C_MIN=200, C_MAX=3000) -> float:
    return max(0.0, min(1.0, (C_MAX - instruction_chars)/(C_MAX - C_MIN)))
```

**③ 유효성/형식/보안**
```python
validity = 10 * (valid_rows / 30)                 # 허용 라벨/구간으로 파싱된 비율
format_  = 10 * (contract_rows / 30)              # 출력 계약(한 줄) 준수 비율
security = 10 if no_forbidden(instruction, outputs) else penalize()   # 정규식: 주민번호·전화·실명·군보안·금지어 → 위반 시 감점 + review_flag
```

### 3.5 통합 산식 (총 100)
```python
task = 45 * (0.9*avg_f1 + 0.1*brevity_score)      # 과제 수행 45
total = task + 25*vod_ok + validity + format_ + security   # vod_ok∈{0,1}
```

### 3.6 end-to-end 의사코드
```python
def score_submission(sub):
    inst = sub.instruction
    runs = [run_agent(inst, row) for row in TEST_ROWS]      # 30회 (캐싱)
    preds = [parse(t) for t in runs]                        # 파싱
    save_model_runs(sub.id, TEST_ROWS, runs, preds)
    # Public/Private 분리 채점
    for split in ("PUBLIC","PRIVATE"):
        gt = ground_truth(split)                            # 12 / 18행
        avg_f1 = mean_macro_f1(preds, gt)
        ...
    brevity_s = brevity(len(inst))
    task = 45*(0.9*avg_f1 + 0.1*brevity_s)
    total = task + 25*vod(sub.participant) + validity + format_ + security
    save_scores(sub.id, ...); mark(sub, "SCORED")
```
- **멱등:** 동일 제출 재채점 = 동일 점수(온도0·시드·원출력 재사용). 재채점은 overwrite + `audit_log`.

---

## 4. 리더보드 — 구현 (자정 배치)

```python
def nightly_leaderboard(snapshot_at):                       # 00:00 KST 크론
    rows = []
    for p in participants_with_scored_submissions():
        best = max(p.submissions, key=lambda s: s.total_public)   # 최고점 자동 선택
        rows.append((p.id, best.id, best.total_public))
    rows.sort(key=lambda r: (-r[2], tiebreak(r)))           # 동점: 수강률→제출시간→유효성
    N = len(rows)
    for rank, (pid, sid, total) in enumerate(rows, 1):
        pct  = round(100*rank/N, 1)                         # 상위 백분위
        tier = "상위" if pct<=33 else "중위" if pct<=66 else "하위"
        upsert_snapshot(snapshot_at, pid, sid, total, rank, tier, pct, submit_count)
    swap_public_table()                                     # 무중단 교체(실패 시 직전 유지)
```
- **단계적 공개(§6 명세):** 초반=구간만 / 진행중=자정 갱신 / 마지막날=실등수 / 마감후=**Private 재채점**.
- **본인 뷰:** `percentile` + 점수 분포 히스토그램(버킷 카운트) + 본인 버킷 강조.
- 최종 순위 = 마감 후 `total_private` 재정렬.

---

## 5. DB 스키마 (핵심 — 명세서 §4 발췌)
`submissions`(instruction_json, instruction_chars, status) · `model_runs`(raw_output, parsed_*) ·
`scores`(f1_risk, f1_cycle, avg_f1_public/private, brevity, task_block, validity, format, security, vod, total_public/private) ·
`ground_truth`(risk_grade, cycle_range, split) · `leaderboard_snapshots`(rank, tier, percentile, submit_count) ·
`api_budget`(date, model, calls, cost, cache_hits) · `review_flags` · `audit_log`.

---

## 6. 회귀 골드셋 (반드시 먼저 구현·고정)
채점 엔진을 만들기 전에 **오프라인 회귀 테스트**로 기대값을 못박는다.

| 케이스 | 지침 | 기대 |
|---|---|---|
| 완전 정답·짧은 지침 | 정답 규칙을 정확히 담은 300자 | avg_f1≈1.0, brevity≈0.96, total≈98~100 |
| 반타작·긴 지침 | 절반만 맞는 2500자 | avg_f1≈0.5, brevity≈0.18, total≈76 |
| 짧지만 오답 | 아무 규칙 없는 100자 | avg_f1↓, total 하위권 |
| 출력 계약 이탈 | 문장으로만 답 | 파싱 실패 → 유효/형식 감점 |
| 보안 위반 | 금지 표현 포함 | 보안 감점 + review_flag |
- **재현성 테스트:** 온도0으로 동일 지침 10회 실행 → 점수 변동 폭 측정, 허용 오차(예: ±1점) 확정. 초과 시 **행당 k=3 다수결** 도입.

---

## 7. 작업 분해 (마일스톤 · 완료조건)

| # | 작업 | 완료조건(AC) |
|---|---|---|
| M1 | **데이터·정답셋 생성** (train15/test30/ground_truth, 규칙 스크립트) | 규칙 재실행 시 동일 정답 재현 · 라벨 분포 확인 |
| M2 | **채점 엔진(오프라인)** — §3 전체 | 골드셋 5케이스 기대 총점 일치(회귀 통과) |
| M3 | **모델 연동** — OpenAI API·캐싱·재시도·예산 | 30행 1제출 채점 <수초 · 캐시 적중률 로깅 |
| M4 | **제출 서비스** — 스키마·3000자·1일3회·큐 | 잘못된 제출 정확 반려(횟수 미차감) |
| M5 | **미리보기** — train 5행·1일50회 rate limit | test 미접근 검증 · 캐시 동작 |
| M6 | **리더보드 배치** — §4 | 자정 스냅샷·백분위·본인뷰·단계 공개 |
| M7 | **관리자 콘솔** — 현황·검수·재채점·API 예산·엑셀 | model_runs 열람·재채점 멱등 |
| M8 | **부하·비용·파일럿** | 동시500 부하 · 일 예산 시뮬 · 내부 전과정 리허설 |

---

## 8. 비용 추정 & 통제 (gpt-4.1-nano)

**가정:** 호출당 입력 ~800토큰·출력 ~100토큰. 캐싱·중복 제거 **미적용 상한**.

| 항목 | 호출/일(최악) | 입력비 | 출력비 | 일 합계(최악) |
|---|---|---|---|---|
| 공식 채점 (1만×3×30행) | 900,000 | 720M×$0.10=$72 | 90M×$0.40=$36 | **≈ $108/일** |
| 미리보기 (1만×50×5행) | 2,500,000 | 2000M×$0.10=$200 | 250M×$0.40=$100 | **≈ $300/일** |

- **이는 "모두가 매일 상한까지" 최악치.** 실제는 참여 곡선상 훨씬 낮음.
- **비용 통제 (필수):**
  1. **프롬프트 캐싱** — system=지침 고정 → 30행 중 29행 캐시 입력($0.02/1M). 입력비 **~60–80%↓**.
  2. **동일 지침 중복 제거** — 미리보기·재제출 캐시 재사용.
  3. **미리보기 억제** — 샘플 5행·1일 50회 rate limit·일 예산 상한.
  4. **행당 1회**(분산 크면 k=3, 비용 3×).
- 캐싱 적용 시 공식 채점 실질 **~$40–70/일 이하**로 추정. 대회 기간(약 1개월) 총액은 **일 예산 상한**으로 확정.

> **협의:** 예상 참여율(동시성 곡선)·일 예산 상한·미리보기 횟수(50 유지 여부)를 정하면 총 비용이 확정된다.
