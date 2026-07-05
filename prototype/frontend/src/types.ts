export interface Column {
  name: string
  type: string
  desc: string
}

export interface TrainRow {
  id: number
  equipment_type: string
  repair_start_date: string
  repair_end_date: string
  maintenance_action: string
  cost: number
  maintenance_count_1y: number
  operating_hours: number
  days_since_last_failure: number
  failure_risk_grade: string
  maintenance_cycle_range: string
}

export interface Problem {
  title: string
  summary: string
  columns: Column[]
  labels: { failure_risk_grade: string[]; maintenance_cycle_range: string[] }
  output_contract: string
  char_limit: number
  train: TrainRow[]
}

export interface PreviewRow {
  id: number
  pred_risk: string | null
  pred_cycle: string | null
  true_risk: string
  true_cycle: string
  correct: boolean
}

export interface PreviewResult {
  chars: number
  sample_size: number
  estimated_accuracy: number
  rows: PreviewRow[]
}

export interface Score {
  model: string
  chars: number
  brevity: number
  avg_f1_public: number
  avg_f1_private: number
  validity: number
  format: number
  security: number
  vod: number
  task_block: number
  total_public: number
  total_private: number
  n_valid: number
  n_contract: number
  n_test: number
}

export interface SubmitResult {
  submission_id: number
  score: Score
  rank: number
  total_participants: number
  percentile: number
}

export interface LbEntry {
  rank: number
  participant: string
  total_public: number
  chars: number
}

export interface Leaderboard {
  count: number
  entries: LbEntry[]
  distribution: number[]
}
