# data/ — K-511 계통별 정비주기 데이터셋 (데이터 사전)

경진대회 **출제안 4 / 문제 B**(K-511 계열 군용 트럭 부품 계통별 이중 라벨 예측)의 실데이터.
Codex V2 합성 데이터(seed 20260717). **한 행 = 특정 차량의 특정 부품 계통 1건**의 운용·정비 이력이며,
동일 차량이라도 엔진 계통과 냉각 계통은 별도 행으로 분리되어 각각 예측 대상이 된다.

> 합성 데이터다. 실제 차량·부대·정비 기록을 포함하지 않으며 수치를 실제 정비 판단에 사용할 수 없다.

## 파일 구성

| 파일 | 행 수 | 라벨 | git | 용도 |
|---|---|---|---|---|
| `sample.csv` | 10 | 공개(인라인) | **추적** | 참가자가 라벨 규칙을 추론하는 샘플 데이터 |
| `public.csv` | 300 | 인라인(서버 보관) | 미추적 | 대회 중 리더보드 채점(Public) |
| `private.csv` | 700 | 인라인(서버 보관) | 미추적 | 마감 후 최종 순위(Private) |
| `all.csv` | 1,000 | 인라인 | 미추적 | 전체 참조용(= public ∪ private) |

- **비공개 정답 키(`public.csv`·`private.csv`·`all.csv`)는 `.gitignore`로 저장소에서 제외**한다(로컬 보관).
  참가자 공개 `sample.csv`만 추적. 세 파일에는 정답 라벨이 인라인으로 들어 있으므로 커밋 금지.
- `sample` 10행에 8개 부품 계통과 4개 정비주기 구간이 모두 포함된다.
- Public/Private은 라벨·계통 기준 층화 분할로 편차 0.6%p 이내.

## 스키마 (총 25컬럼)

`id` + **특성 22개** + **라벨 2개** = 25컬럼. 채점 하네스에 주어지는 **비-라벨 입력은 23컬럼**(id + 특성 22).
LLM 프롬프트에 실제 렌더되는 것은 **특성 22개**(`id`는 렌더 제외, 라벨 2개는 누설 방지로 제외).

### 식별
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `id` | int | 행 식별자. 모델 입력에서 제외 | 1 |

### 차량 · 운용
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `vehicle_id` | str | 익명화된 차량 식별자 | 차량 K-042 |
| `vehicle_model` | str | 차량 모델 | K-511 / K-511A1 |
| `part_system` | str | 부품 계통(8종) | 엔진 · 냉각 · 제동 · 전기 · 변속및구동 · 조향및현가 · 타이어및휠 · 차체및적재 |
| `operation_area` | str | 운용지역 | 전방 · 후방 · 산악 · 해안 · 도심 |
| `mission_type` | str | 임무유형 | 수송 · 훈련 · 작전지원 · 보급 |
| `load_condition` | str | 적재 조건 | 경량 · 보통 · 고하중 |
| `observation_month` | int | 관측 월 | 1 ~ 12 |

### 정비 이력
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `repair_start_date` | date | 최근 정비 시작일 | 2025-11-12 |
| `repair_end_date` | date | 최근 정비 종료일 | 2025-11-15 |
| `maintenance_cost_krw` | int | 정비 조치비용(원) | 850000 |
| `last_maintenance_echelon` | int | 최근 정비 계단(1 사용자 · 2 부대 · 3 직접지원 · 4 일반지원 · 5 창정비) | 3 |
| `emergency_repair_flag` | int | 긴급 정비 여부(0 계획 · 1 긴급) | 1 |
| `maintenance_count_1y` | int | 최근 1년 부품 계통 정비횟수 | 4 |
| `days_since_last_maintenance` | int | 마지막 정비 이후 경과일 | 62 |

### 누적 · 노후
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `mileage_total_km` | int | 차량 누적 주행거리(km) | 82000 |
| `operation_hours_total` | int | 차량 누적 가동시간(h) | 3200 |
| `vehicle_age_months` | int | 차량 운용 경과(개월) | 132 |
| `part_age_months` | int | 부품 장착 후 경과(개월) | 28 |

### 부품 사용 · 고장 · 조달
| 컬럼 | 타입 | 설명 | 예시 |
|---|---|---|---|
| `mileage_since_part_service_km` | int | 부품 정비 후 주행거리(km) | 8500 |
| `hours_since_part_service` | int | 부품 정비 후 가동시간(h) | 320 |
| `days_since_last_fault` | int | 부품 직전고장 경과일 | 45 |
| `spare_part_lead_time_days` | int | 부품 조달 예상 일수 | 21 |

### 라벨 (예측 대상 2개)
| 컬럼 | 값 | 설명 |
|---|---|---|
| `risk_grade` | HIGH · MEDIUM · LOW | 고장위험등급 |
| `cycle_range` | 0-30 · 31-90 · 91-180 · 181+ | 다음 정비주기(일) 구간 |

## 라벨 분포 (전체 1,000행 실측)

- `risk_grade`: MEDIUM 535 (53.5%) · HIGH 254 (25.4%) · LOW 211 (21.1%)
- `cycle_range`: 91-180 279 (27.9%) · 31-90 256 (25.6%) · 0-30 254 (25.4%) · 181+ 211 (21.1%)

### ⚠️ 라벨 상호결정성 (실측 1,000/1,000)

`cycle_range`가 `risk_grade`를 결정한다: **`0-30`→HIGH · `31-90`→MEDIUM · `91-180`→MEDIUM · `181+`→LOW**.
두 라벨의 평균 Macro F1은 HIGH/LOW 경계를 이중 계산하므로 배점 재논의 대상(주최측 flag).
**단, 채점 코드는 두 축을 모델의 리터럴 출력에서 독립 채점하며 한 축에서 다른 축을 추론하지 않는다.**

## 로드 (grader)

그레이더는 기본적으로 이 폴더를 읽는다(`grader/config.py`의 `_default_data_dir() → REPO_ROOT/data`).
다른 경로를 쓰려면 환경변수 `GRADER_DATA_DIR`로 override. `load_split(name)`은 `id` + 특성 22개만
복사하므로 라벨 2개는 자동 제외(누설 방지 가드). 정답은 `load_answers(name)`이 같은 파일의 인라인
라벨에서 읽는다.

```bash
uv run grader run --prompt baselines/P1.txt --split sample --runs 1   # 연습(10행)
uv run grader run --prompt baselines/P1.txt --split public --runs 1   # 기준(300행)
```

## 보안 · 누설 주의

- `public.csv`·`private.csv`·`all.csv`는 정답 인라인 → **커밋 금지**(`.gitignore` 처리됨).
- 참가자에게는 라벨 값과 출력 형식만 공개하고, 정답 생성 규칙(계통별 임계·함정 보정)은 비공개.
- 참가자용 서술은 웹 콘솔 **데이터 페이지**(`defense-prompt-grader/web/src/views/info/Data.tsx`),
  개발팀 전달용 상세 설계는 `request/competition_design_brief.md` §1을 참조.
