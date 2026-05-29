import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });
const mcpApi = axios.create({ baseURL: '/mcp/v1' });

export async function getRanking(windowDays = 60, topN = 50, industry?: string) {
  const params: Record<string, any> = { window_days: windowDays, top_n: topN };
  if (industry) params.industry = industry;
  const { data } = await api.get('/ranking', { params });
  return data;
}

export async function scanSingle(companyCode: string, windowDays = 60) {
  const { data } = await api.post('/scan/single', {
    company_code: companyCode,
    window_days: windowDays,
  });
  return data;
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

// MCP
export async function mcpListTools() {
  const { data } = await mcpApi.post('/tools/list');
  return data;
}

export async function mcpCallTool(name: string, args: Record<string, any>) {
  const { data } = await mcpApi.post('/tools/call', { name, arguments: args });
  return data;
}

export async function mcpToolStats(hours = 24) {
  const { data } = await mcpApi.get('/tools/stats', { params: { since_hours: hours } });
  return data;
}

// ML
export async function mlMetrics() {
  const { data } = await api.get('/ml/metrics');
  return data;
}

export async function mlFeatureImportance(topK = 20) {
  const { data } = await api.get('/ml/feature-importance', { params: { top_k: topK } });
  return data;
}

export async function mlTrain(nSamples = 200) {
  const { data } = await api.post('/ml/train', { n_samples: nSamples, async_mode: false });
  return data;
}

// Eval
export async function evalJudge(companyCode: string, windowDays = 60) {
  const { data } = await api.post('/eval/judge', {
    company_code: companyCode, window_days: windowDays,
  });
  return data;
}

export async function evalAblation() {
  const { data } = await api.post('/eval/ablation');
  return data;
}

export async function evalBaseline() {
  const { data } = await api.post('/eval/baseline');
  return data;
}

// History
export async function listScans(limit = 50) {
  const { data } = await api.get('/history/scans', { params: { limit } });
  return data;
}

export async function getScanTrace(scanId: string) {
  const { data } = await api.get(`/history/scans/${scanId}/trace`);
  return data;
}

// Report download
export function getReportDownloadUrl(companyCode: string, windowDays = 60) {
  return `/api/v1/report/${companyCode}/download?window_days=${windowDays}`;
}

// Trace export
export function getTraceExportUrl(scanId: string) {
  return `/api/v1/history/scans/${scanId}/trace/export`;
}

// Skill files
export async function listSkillFiles(skillName?: string) {
  const params: Record<string, any> = {};
  if (skillName) params.skill_name = skillName;
  const { data } = await api.get('/skills/files', { params });
  return data;
}

export async function getSkillFile(fileId: number) {
  const { data } = await api.get(`/skills/files/${fileId}`);
  return data;
}

export function getSkillFileDownloadUrl(fileId: number) {
  return `/api/v1/skills/files/${fileId}/download`;
}

export async function uploadSkillFile(
  file: File,
  skillName?: string,
  description?: string,
) {
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
