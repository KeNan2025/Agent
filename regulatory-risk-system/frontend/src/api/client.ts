import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import type {
  AblationResult, AsyncTaskRow, AuthTokenResponse, BacktestReport,
  BaselineResult, CaseTopKResult, CompetitionMetricsReport,
  EvidenceRecallResult, FeatureImportance, FocusClassificationResult,
  JudgeResult, McpTool, McpToolStat, MlMetricsData, RankingResponse,
  RegulationFocusVocab, ScanRecord, ScanResult, SkillFile,
  SkillFileUploadResponse, WsTicket,
} from '../types';

const TOKEN_KEY = 'rr-access-token';

export function getAccessToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setAccessToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* ignore */ }
}

const api = axios.create({ baseURL: '/api/v1' });
const mcpApi = axios.create({ baseURL: '/mcp/v1' });

// Inject bearer token on every request
const authInterceptor = (config: InternalAxiosRequestConfig) => {
  const t = getAccessToken();
  if (t) {
    config.headers = config.headers ?? {};
    (config.headers as any).Authorization = `Bearer ${t}`;
  }
  return config;
};
api.interceptors.request.use(authInterceptor);
mcpApi.interceptors.request.use(authInterceptor);

// 401 -> wipe token (let UI redirect to login)
const onAuthError = (err: AxiosError) => {
  if (err.response?.status === 401) setAccessToken(null);
  return Promise.reject(err);
};
api.interceptors.response.use((r) => r, onAuthError);
mcpApi.interceptors.response.use((r) => r, onAuthError);

// ──────── Ranking / Scan ────────

export async function getRanking(
  windowDays = 60, topN = 50, industry?: string,
): Promise<RankingResponse> {
  const params: Record<string, any> = { window_days: windowDays, top_n: topN };
  if (industry) params.industry = industry;
  const { data } = await api.get('/ranking', { params });
  return data;
}

export async function scanSingle(
  companyCode: string, windowDays = 60,
): Promise<ScanResult> {
  const { data } = await api.post('/scan/single', {
    company_code: companyCode,
    window_days: windowDays,
  });
  return data;
}

/** Phase 4: 入队异步扫描，返回 task_id 占位（响应中包含 report_markdown 暗示 task_id） */
export async function scanSingleAsync(
  companyCode: string, windowDays = 60,
): Promise<{ task_id: string }> {
  const { data } = await api.post(
    '/scan/single',
    { company_code: companyCode, window_days: windowDays },
    { params: { async_mode: true } },
  );
  // backend places task_id into the placeholder report_markdown text
  const md: string = data?.report_markdown ?? '';
  const m = md.match(/task_id=([\w-]+)/);
  return { task_id: m ? m[1] : '' };
}

export async function scanBatch(companyCodes: string[], windowDays = 60) {
  const { data } = await api.post('/scan/batch', {
    company_codes: companyCodes,
    window_days: windowDays,
  });
  return data;
}

export async function getReport(companyCode: string, windowDays = 60) {
  const { data } = await api.get(`/report/${companyCode}`, {
    params: { window_days: windowDays },
  });
  return data;
}

export async function getTrace(companyCode: string, windowDays = 60) {
  const { data } = await api.get(`/trace/${companyCode}`, {
    params: { window_days: windowDays },
  });
  return data;
}

export async function getFinancial(companyCode: string, windowDays = 60) {
  const { data } = await api.get(`/financial/${companyCode}`, {
    params: { window_days: windowDays },
  });
  return data;
}

export async function getCompanies() {
  const { data } = await api.get('/companies');
  return data;
}

export async function getIndustries() {
  const { data } = await api.get('/industries');
  return data;
}

export async function getGraph(companyCode: string, k = 1, maxNodes = 30) {
  const { data } = await api.get(`/graph/${companyCode}`, {
    params: { k, max_nodes: maxNodes },
  });
  return data;
}

// ──────── MCP ────────

export async function mcpListTools() {
  const { data } = await mcpApi.post('/tools/list');
  return data as { tools: McpTool[] };
}

export async function mcpCallTool(name: string, args: Record<string, any>) {
  const { data } = await mcpApi.post('/tools/call', { name, arguments: args });
  return data;
}

export async function mcpToolStats(hours = 24) {
  const { data } = await mcpApi.get('/tools/stats', { params: { since_hours: hours } });
  return data as { stats: Record<string, McpToolStat> };
}

// ──────── ML ────────

export async function mlMetrics(): Promise<MlMetricsData> {
  const { data } = await api.get('/ml/metrics');
  return data;
}

/** Phase 3: 赛题指标接口 */
export async function mlMetricsCompetition(
  trainCutoff = '2023-12-31',
): Promise<CompetitionMetricsReport> {
  const { data } = await api.get('/ml/metrics/competition', {
    params: { train_cutoff: trainCutoff },
  });
  return data;
}

export async function mlFeatureImportance(topK = 20) {
  const { data } = await api.get('/ml/feature-importance', { params: { top_k: topK } });
  return data as { top_k: number; features: FeatureImportance[] };
}

export async function mlTrain(nSamples = 200) {
  const { data } = await api.post('/ml/train', { n_samples: nSamples, async_mode: false });
  return data;
}

// ──────── Eval ────────

export async function evalJudge(companyCode: string, windowDays = 60): Promise<JudgeResult> {
  const { data } = await api.post('/eval/judge', {
    company_code: companyCode, window_days: windowDays,
  });
  return data;
}

export async function evalAblation(): Promise<AblationResult> {
  const { data } = await api.post('/eval/ablation');
  return data;
}

export async function evalBaseline(): Promise<BaselineResult> {
  const { data } = await api.post('/eval/baseline');
  return data;
}

/** Phase 3: 滚动回测 — 一次性输出 AUC / F1 / Top-10% 召回 + pass_status */
export async function evalBacktest(
  windowDays = 60, topKFrac = 0.1, maxSamples?: number,
): Promise<BacktestReport> {
  const { data } = await api.post('/eval/backtest', null, {
    params: {
      window_days: windowDays,
      top_k_frac: topKFrac,
      ...(maxSamples ? { max_samples: maxSamples } : {}),
    },
  });
  return data;
}

export async function evalEvidenceRecall(
  predictions: Array<{ evidence_quote: string }>,
  gold: Array<{ evidence_quote: string }>,
  jaccardThreshold = 0.5,
): Promise<EvidenceRecallResult> {
  const { data } = await api.post('/eval/evidence-recall', {
    predictions, gold, jaccard_threshold: jaccardThreshold,
  });
  return data;
}

export async function evalFocusAccuracy(
  predictions: Array<{ category: string; subcategory: string }>,
  gold: Array<{ category: string; subcategory: string }>,
): Promise<FocusClassificationResult> {
  const { data } = await api.post('/eval/focus-accuracy', {
    predictions, gold,
  });
  return data;
}

export async function evalCaseTopK(
  predictedCaseCodes: string[],
  goldCaseCodes: string[],
  k = 5,
): Promise<CaseTopKResult> {
  const { data } = await api.post('/eval/case-topk', {
    predicted_case_codes: predictedCaseCodes,
    gold_case_codes: goldCaseCodes,
    k,
  });
  return data;
}

export async function getRegulationFocusVocab(): Promise<RegulationFocusVocab> {
  const { data } = await api.get('/eval/regulation-focus-vocab');
  return data;
}

// ──────── History ────────

export async function listScans(limit = 50) {
  const { data } = await api.get('/history/scans', { params: { limit } });
  return data as { scans: ScanRecord[] };
}

export async function getScanTrace(scanId: string) {
  const { data } = await api.get(`/history/scans/${scanId}/trace`);
  return data;
}

export function getReportDownloadUrl(companyCode: string, windowDays = 60) {
  return `/api/v1/report/${companyCode}/download?window_days=${windowDays}`;
}

export function getTraceExportUrl(scanId: string) {
  return `/api/v1/history/scans/${scanId}/trace/export`;
}

// ──────── Skill files ────────

export async function listSkillFiles(skillName?: string) {
  const params: Record<string, any> = {};
  if (skillName) params.skill_name = skillName;
  const { data } = await api.get('/skills/files', { params });
  return data as { total: number; files: SkillFile[] };
}

export async function getSkillFile(fileId: number) {
  const { data } = await api.get(`/skills/files/${fileId}`);
  return data as SkillFile;
}

export function getSkillFileDownloadUrl(fileId: number) {
  return `/api/v1/skills/files/${fileId}/download`;
}

export async function uploadSkillFile(
  file: File,
  skillName?: string,
  description?: string,
): Promise<SkillFileUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  if (skillName) formData.append('skill_name', skillName);
  if (description) formData.append('description', description);
  const { data } = await api.post('/skills/files/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return data;
}

export async function updateSkillFile(fileId: number, content: string, description = '') {
  const formData = new FormData();
  formData.append('content', content);
  if (description) formData.append('description', description);
  const { data } = await api.put(`/skills/files/${fileId}`, formData);
  return data;
}

export async function deleteSkillFile(fileId: number) {
  const { data } = await api.delete(`/skills/files/${fileId}`);
  return data;
}

// ──────── Auth (Phase 5) ────────

export async function authLogin(
  username: string, password: string,
): Promise<AuthTokenResponse> {
  const { data } = await api.post('/auth/login', { username, password });
  setAccessToken(data.access_token);
  return data;
}

export async function authRegister(
  username: string, password: string, role = 'user',
): Promise<AuthTokenResponse> {
  const { data } = await api.post('/auth/register', { username, password, role });
  setAccessToken(data.access_token);
  return data;
}

export function authLogout(): void {
  setAccessToken(null);
}

export async function getWsTicket(scanId: string): Promise<WsTicket> {
  const { data } = await api.get(`/auth/ws-ticket/${scanId}`);
  return data;
}

// ──────── Async task (Phase 4) ────────

export async function getTaskStatus(taskId: string): Promise<AsyncTaskRow> {
  const { data } = await api.get(`/tasks/${taskId}`);
  return data;
}

// ──────── Health ────────

export async function healthz() {
  const { data } = await axios.get('/healthz');
  return data as {
    ok: boolean;
    version: string;
    llm_mode: 'mock' | 'real';
    data_mode: 'mock' | 'local';
  };
}
