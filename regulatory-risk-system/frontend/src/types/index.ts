/* ═══════════════════════════════════════════════════════════════════
   TypeScript Interfaces — API Data Types
   ═══════════════════════════════════════════════════════════════════ */

// ── Company ──
export interface Company {
  code: string;
  name: string;
  industry: string;
  market_cap: number;
}

// ── Ranking ──
export interface RankingItem {
  rank: number;
  company: Company;
  inquiry_probability: number;
  risk_level: '高风险' | '中风险' | '低风险';
  top_risk_factor: string;
}

export interface RankingResponse {
  items: RankingItem[];
  total: number;
}

// ── Evidence (Phase 2 强契约) ──
export interface Evidence {
  source_type: 'announcement' | 'financial' | 'case' | 'graph' | 'regulatory_filing';
  source_id: string;
  source?: string;
  snippet: string;
  line_range?: [number, number];
}

// ── Scan ──
export interface ScanResult {
  company: Company;
  inquiry_probability: number;
  risk_level: string;
  confidence: number;
  shap_features: ShapFeature[];
  risk_factors: RiskFactor[];
  similar_cases: SimilarCase[];
  agent_trace: TraceStep[];
  analysis_time_ms: number;
  llm_calls: number;
  total_tokens: number;
  report_markdown: string;
}

export interface ShapFeature {
  feature_name: string;
  shap_value: number;
  feature_value: string;
  description: string;
}

export interface RiskFactor {
  severity: '高' | '中' | '低';
  category: string;
  subcategory: string;
  description: string;
  evidence_quote: string;
  evidence_source: string;
  confidence: number;
  evidence?: Evidence[];
}

export interface SimilarCase {
  company_code: string;
  company_name: string;
  inquiry_date: string;
  inquiry_type: string;
  similarity: number;
  match_dimensions: string;
  key_difference: string;
}

export interface TraceStep {
  agent_name: string;
  action: string;
  duration_ms: number;
  tokens_used: number;
  input_summary: string;
  output_summary: string;
  skills_called?: string[];
}

// ── Batch Scan ──
export interface BatchScanResult {
  company_code: string;
  company_name: string;
  inquiry_probability: number;
  risk_level: string;
  top_risk_factor: string;
}

export interface BatchScanResponse {
  total: number;
  results: BatchScanResult[];
}

// ── Financial ──
export interface FinancialData {
  roe: number;
  roa: number;
  gross_margin: number;
  net_margin: number;
  debt_ratio: number;
  current_ratio: number;
  receivable_turnover: number;
  inventory_turnover: number;
  ocf_to_profit: number;
  revenue_growth: number;
  profit_growth: number;
  receivable_growth: number;
  beneish_m_score: number;
  altman_z_score: number;
  pledge_ratio: number;
  exec_turnover_count: number;
}

// ── Graph ──
export interface GraphNode {
  id: string;
  name: string;
  category: string;
  is_target: boolean;
  is_inquired: boolean;
}

export interface GraphLink {
  source: string;
  target: string;
  relation: string;
  weight: number;
}

export interface GraphMetrics {
  pagerank: number;
  degree_centrality: number;
  related_inquired_count_1deg: number;
  related_inquired_count_2deg: number;
  same_controller_inquired_ratio: number;
  supplier_avg_risk: number;
  customer_avg_risk: number;
  same_auditor_inquired_ratio: number;
}

// ── ML Metrics ──
export interface MlMetricsData {
  n_features: number;
  metrics: {
    auc_roc: number;
    auc_pr: number;
    f1: number;
    threshold: number;
    per_model_auc: Record<string, number>;
  };
  model_path: string;
}

export interface FeatureImportance {
  name: string;
  importance: number;
}

// ── Competition metrics (Phase 3) ──
export interface CompetitionMetricsReport {
  model_path: string;
  n_features: number;
  train_cutoff: string;
  train_size: number;
  test_size: number;
  elapsed_sec: number;
  optimal_threshold: number;
  metrics: {
    auc_roc: number;
    f1: number;
    f1_optimal_threshold: number;
    optimal_threshold: number;
    top_10pct_recall: number;
  };
}

export interface BacktestReport {
  ok: boolean;
  error?: string;
  window_days: number;
  n_samples: number;
  n_failed: number;
  n_positive: number;
  metrics: {
    auc_roc: number;
    f1: number;
    f1_optimal_threshold: number;
    optimal_threshold: number;
    top_10pct_recall: number;
  };
  thresholds: {
    auc_target: number;
    f1_target: number;
    top_k_recall_target: number;
    top_k_frac: number;
  };
  pass_status: {
    auc: boolean;
    f1: boolean;
    top_k_recall: boolean;
  };
}

export interface EvidenceRecallResult {
  recall: number;
  matched: number;
  total_gold: number;
  threshold: number;
  detail: Array<{
    gold_quote: string;
    best_match_idx: number;
    best_jaccard: number;
    hit: boolean;
  }>;
}

export interface FocusClassificationResult {
  accuracy: number;
  matched: number;
  total_gold: number;
  detail: Array<{ gold_pair: [string, string]; hit: boolean }>;
}

export interface CaseTopKResult {
  top_k: number;
  hit: number;
  predicted: string[];
  gold: string[];
}

export interface RegulationFocusVocab {
  categories: string[];
  vocab: Array<{
    category: string;
    subcategory: string;
    description: string;
  }>;
}

// ── History ──
export interface ScanRecord {
  scan_id: string;
  company_code: string;
  window_days: number;
  probability: number;
  risk_level: string;
  created_at: string;
}

// ── MCP ──
export interface McpTool {
  name: string;
  description: string;
  inputSchema?: {
    type: string;
    properties?: Record<string, any>;
    required?: string[];
  };
}

export interface McpToolStat {
  count: number;
  success_rate: number;
  avg_ms: number;
}

// ── Skill Files ──
export interface SkillFile {
  id: number;
  filename: string;
  description: string;
  skill_name: string;
  size: number;
  updated_at: string;
  content?: string;
}

export interface SkillFileUploadResponse {
  id: number;
  filename: string;
  skill_name: string | null;
  registered_as_skill: boolean;
  register_error: string | null;
  message: string;
}

// ── Eval ──
export interface AblationResult {
  full_model: {
    auc_roc: number;
    auc_pr: number;
    f1: number;
  };
  ablations: Array<{
    name: string;
    auc_roc: number;
    auc_pr: number;
    f1: number;
    expected: string;
  }>;
  summary: {
    positive_rate: number;
  };
}

export interface BaselineResult {
  full_model: {
    auc_roc: number;
    auc_pr: number;
    f1: number;
  };
  baselines: Array<{
    name: string;
    auc_roc: number;
    auc_pr: number;
    f1: number;
  }>;
}

export interface JudgeResult {
  scores: Record<string, number>;
  weighted_total: number;
  issues: string[];
  suggestions: string[];
}

// ── Auth (Phase 5) ──
export interface AuthUser {
  user_id: number;
  role: string;
  username?: string;
}

export interface AuthTokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: string;
}

export interface WsTicket {
  ticket: string;
  scan_id: string;
  ttl_sec: number;
}

// ── Async task (Phase 4) ──
export type AsyncTaskStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface AsyncTaskRow {
  task_id: string;
  kind: string;
  status: AsyncTaskStatus;
  input: Record<string, any>;
  output: Record<string, any>;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

// ── WebSocket trace messages ──
export interface WsTraceEvent {
  type: 'trace' | 'scan_complete';
  scan_id: string;
  node_name?: string;
  action?: string;
  output_summary?: string;
  duration_ms?: number;
  tokens_used?: number;
  ts?: string;
  risk_level?: string;
  probability?: number;
}
