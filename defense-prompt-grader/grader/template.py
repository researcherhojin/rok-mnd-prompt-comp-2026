"""user 메시지 템플릿 렌더러. 템플릿은 한 글자도 바꾸지 않는다. id는 절대 미포함."""

from __future__ import annotations

USER_TEMPLATE = """다음은 K-511 계열 군용 트럭의 부품 계통 1건에 대한 운용·정비 이력입니다.

차량 ID: {vehicle_id}
차량 모델: {vehicle_model}
부품 계통: {part_system}
운용 지역: {operation_area}
임무 유형: {mission_type}
적재 조건: {load_condition}
관측 월: {observation_month}
정비 시작일: {repair_start_date}
정비 종료일: {repair_end_date}
정비 비용(원): {maintenance_cost_krw}
최근 정비 계단(1 사용자정비·2 부대정비·3 직접지원·4 일반지원·5 창정비): {last_maintenance_echelon}
긴급 정비 여부(0 계획·1 긴급): {emergency_repair_flag}
최근 1년 정비 횟수(회): {maintenance_count_1y}
마지막 정비 후 경과일(일): {days_since_last_maintenance}
차량 누적 주행거리(km): {mileage_total_km}
차량 누적 가동시간(시간): {operation_hours_total}
차량 운용 경과(개월): {vehicle_age_months}
부품 장착 후 경과(개월): {part_age_months}
부품 정비 후 주행거리(km): {mileage_since_part_service_km}
부품 정비 후 가동시간(시간): {hours_since_part_service}
부품 직전고장 경과일(일): {days_since_last_fault}
부품 조달 예상 일수(일): {spare_part_lead_time_days}"""


def render_user_message(row: dict[str, str]) -> str:
    """행 값으로 user 메시지 렌더. id는 템플릿에 없으므로 자동 제외."""
    from .data import INPUT_COLUMNS

    return USER_TEMPLATE.format(**{col: row[col] for col in INPUT_COLUMNS})
