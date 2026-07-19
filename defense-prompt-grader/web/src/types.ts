// API 응답 타입 (api/main.py·store.py와 정합)

export type Split = "sample" | "public" | "private";
export type RiskLabel = "HIGH" | "MEDIUM" | "LOW";
export type CycleLabel = "0-30" | "31-90" | "91-180" | "181+";
export type Label = RiskLabel | CycleLabel; // 두 축 라벨은 알파벳이 겹치지 않아 단일 조회 가능
export type Pred = Label | "__INVALID__" | "ERROR";
export type Status = "pending" | "running" | "done" | "error" | "cancelled";

export const RISK_LABELS: RiskLabel[] = ["HIGH", "MEDIUM", "LOW"];
export const CYCLE_LABELS: CycleLabel[] = ["0-30", "31-90", "91-180", "181+"];

export const SPLIT_ROWS: Record<Split, number> = { sample: 10, public: 300, private: 700 };
export const CHAR_HARDCAP = 3000;

export interface PerClass {
  precision: number;
  recall: number;
  f1: number;
}

// 축별 혼동행렬: 정답 라벨 → 예측 라벨(+INVALID) 카운트 (라벨 셋에 무관하게 문자열 키)
export type Confusion = Record<string, Record<string, number>>;

// 단일 축(risk 또는 cycle) 채점 묶음
export interface AxisScore {
  macro_f1: number;
  per_class: Record<string, PerClass>;
  confusion: Confusion;
  invalid_count: number;
  invalid_rate: number;
}

export interface Primary {
  n: number;
  macro_f1: number; // 결합 평균 (risk + cycle) / 2
  risk: AxisScore;
  cycle: AxisScore;
  invalid_count: number;
  invalid_rate: number;
  exact_match_count: number;
}

export interface RunsAgg {
  n_runs: number;
  macro_f1_mean: number;
  macro_f1_std: number;
  disagreement_rate: number;
}

export interface RowResult {
  id: string;
  true_risk: RiskLabel;
  true_cycle: CycleLabel;
  raw: string | null;
  pred_risk: Pred;
  pred_cycle: Pred;
  correct: boolean;
  runs_pred: [Pred, Pred][];
}

export interface Result {
  split: Split;
  model: string;
  runs: number;
  prompt_len: number;
  macro_f1_mean: number;
  leaderboard_score: number;
  primary: Primary;
  runs_agg: RunsAgg | null;
  rows: RowResult[];
}

export interface Submission {
  id: number;
  name: string;
  created_at: string;
  split: Split;
  model: string;
  runs: number;
  prompt: string;
  prompt_len: number;
  is_baseline: boolean;
  status: Status;
  error_msg: string | null;
  result: Result | null;
}

export interface LeaderRow {
  id: number;
  name: string;
  affiliation: string | null;
  created_at: string;
  split: Split;
  model: string;
  runs: number;
  prompt_len: number;
  is_baseline: boolean;
  status: Status;
  leaderboard_score: number | null;
  macro_f1: number | null;
  risk_f1: Record<string, number> | null;
  cycle_f1: Record<string, number> | null;
  invalid_rate: number | null;
  exact_match_count: number | null;
  n: number | null;
}

export interface Progress {
  total: number;
  done: number;
  valid: number;
  invalid: number;
  error: number;
}

export interface ProgressResponse {
  id: number;
  status: Status;
  progress: Progress | null;
  error_msg: string | null;
}
