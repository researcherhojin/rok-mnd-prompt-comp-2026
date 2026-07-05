"""합성 데이터셋·정답셋 생성 (결정론적).

기획서 `request/competition_design_brief.md` §1.2 입력 컬럼 · §1.3 라벨 규칙을
단일 소스로 구현한다. 같은 SEED면 몇 번을 실행해도 동일한 train/test/ground_truth가 나온다.

- train 15행: 라벨 공개 (참가자가 규칙을 추론하는 예시)
- test 30행: 입력만 공개, 정답은 ground_truth로 격리
- ground_truth 30행: Public 12 / Private 18 분할 (기획서 §4.2)
"""
from __future__ import annotations

import random
from datetime import date, timedelta

SEED = 20260704       # 데이터 생성 고정 시드
TRAIN_N = 15
TEST_N = 30
PUBLIC_N = 12         # test 30 = Public 12 / Private 18

EQUIPMENT_TYPES = ["발전기", "전술차량", "통신장비", "레이더", "화포"]

# 장비 유형별 정비 조치 자유 텍스트 후보 (라벨 규칙에는 쓰이지 않는 flavor)
MAINT_ACTIONS = {
    "발전기": ["엔진 오일 교환 및 냉각계통 점검", "발전 코일 절연 저항 측정", "연료 분사노즐 세척"],
    "전술차량": ["구동계 점검 및 브레이크 패드 교체", "변속기 오일 교환", "현가장치 부싱 교체"],
    "통신장비": ["안테나 급전선 교체", "전원 모듈 교정", "펌웨어 업데이트 및 채널 점검"],
    "레이더": ["송수신 모듈 교정", "도파관 기밀 점검", "냉각 팬 어셈블리 교체"],
    "화포": ["포신 마모 측정 및 세척", "주퇴복좌 유압 점검", "격발장치 정비"],
}

# 라벨 값 집합 (파서·채점과 공유하는 단일 소스)
RISK_LABELS = ["HIGH", "MEDIUM", "LOW"]
CYCLE_LABELS = ["0-30", "31-90", "91-180", "181+"]


def risk_grade(count_1y: int, operating_hours: int, days_since: int) -> str:
    """기획서 §1.3 ① 고장위험등급 결정 규칙 (경계 포함)."""
    if count_1y >= 5 or operating_hours >= 4000 or days_since <= 30:
        return "HIGH"
    if count_1y <= 2 and operating_hours < 2000 and days_since > 90:
        return "LOW"
    return "MEDIUM"


def cycle_range(risk: str, operating_hours: int) -> str:
    """기획서 §1.3 ② 다음 정비주기 구간 결정 규칙."""
    if risk == "HIGH":
        return "0-30"
    if risk == "LOW":
        return "181+"
    # MEDIUM
    return "31-90" if operating_hours >= 3000 else "91-180"


def label_row(row: dict) -> tuple[str, str]:
    """입력 행 → (위험등급, 정비주기) 정답."""
    r = risk_grade(
        row["maintenance_count_1y"], row["operating_hours"], row["days_since_last_failure"]
    )
    c = cycle_range(r, row["operating_hours"])
    return r, c


def _random_row(rng: random.Random) -> dict:
    """id 없는 입력 피처 1행 생성. id는 선택 후 부여."""
    eq = rng.choice(EQUIPMENT_TYPES)
    start = date(2026, 1, 1) + timedelta(days=rng.randint(0, 250))
    end = start + timedelta(days=rng.randint(1, 14))
    return {
        "equipment_type": eq,
        "repair_start_date": start.isoformat(),
        "repair_end_date": end.isoformat(),
        "maintenance_action": rng.choice(MAINT_ACTIONS[eq]),
        "cost": rng.randint(1, 30) * 100000,
        "maintenance_count_1y": rng.randint(0, 9),
        "operating_hours": rng.randint(300, 6000),
        "days_since_last_failure": rng.randint(5, 200),
    }


def generate(seed: int = SEED) -> dict:
    """결정론적 데이터셋 생성. {'train': [...], 'test': [...], 'ground_truth': [...]}"""
    from collections import defaultdict, deque

    rng = random.Random(seed)

    # 후보 풀 생성 후 cycle 4-class를 목표 개수만큼 정확히 추출(클래스 균형 확보)
    pool: list[tuple[dict, str, str]] = []
    for _ in range(800):
        row = _random_row(rng)
        r, c = label_row(row)
        pool.append((row, r, c))

    used: set[int] = set()

    # cycle 클래스별 목표 개수 (합 = TEST_N / TRAIN_N)
    TEST_TARGETS = {"0-30": 8, "31-90": 7, "91-180": 8, "181+": 7}
    TRAIN_TARGETS = {"0-30": 4, "31-90": 4, "91-180": 4, "181+": 3}

    def take(targets: dict[str, int]) -> list[int]:
        chosen: list[int] = []
        for cls, k in targets.items():
            got = 0
            for i, (_, _, c) in enumerate(pool):
                if i in used or c != cls:
                    continue
                chosen.append(i)
                used.add(i)
                got += 1
                if got >= k:
                    break
        return chosen

    test_idx = take(TEST_TARGETS)                   # test 우선 확보
    train_idx = take(TRAIN_TARGETS)                 # 나머지에서 train
    # 풀 고갈로 목표 개수를 못 채우면 조용히 축소되지 않도록 loud-fail
    assert len(test_idx) == sum(TEST_TARGETS.values()), "cycle 클래스 풀 부족(test)"
    assert len(train_idx) == sum(TRAIN_TARGETS.values()), "cycle 클래스 풀 부족(train)"
    rng.shuffle(test_idx)                           # 클래스 뭉침 방지(결정론적)
    rng.shuffle(train_idx)

    # Public/Private 분할: 클래스 라운드로빈으로 양쪽 모두 커버되게
    groups: dict[str, deque] = defaultdict(deque)
    for i in test_idx:
        groups[pool[i][2]].append(i)
    classes = [c for c in CYCLE_LABELS if groups[c]]
    public_set: set[int] = set()
    while len(public_set) < PUBLIC_N:
        for c in classes:
            if groups[c]:
                public_set.add(groups[c].popleft())
                if len(public_set) >= PUBLIC_N:
                    break

    train = []
    for new_id, i in enumerate(train_idx, 1):
        row, r, c = pool[i]
        train.append({"id": new_id, **row, "failure_risk_grade": r, "maintenance_cycle_range": c})

    test = []
    ground_truth = []
    for new_id, i in enumerate(test_idx, 1):
        row, r, c = pool[i]
        test.append({"id": new_id, **row})
        ground_truth.append(
            {
                "id": new_id,
                "failure_risk_grade": r,
                "maintenance_cycle_range": c,
                "split": "PUBLIC" if i in public_set else "PRIVATE",
            }
        )

    return {"train": train, "test": test, "ground_truth": ground_truth}


if __name__ == "__main__":
    from collections import Counter

    ds = generate()
    gt = ds["ground_truth"]
    print(f"train={len(ds['train'])}  test={len(ds['test'])}  ground_truth={len(gt)}")
    print("risk 분포 :", dict(Counter(g["failure_risk_grade"] for g in gt)))
    print("cycle 분포:", dict(Counter(g["maintenance_cycle_range"] for g in gt)))
    print("split 분포:", dict(Counter(g["split"] for g in gt)))
