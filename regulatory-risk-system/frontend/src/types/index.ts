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
