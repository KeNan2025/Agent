import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

export async function getRanking(windowDays = 60, topN = 200, industry?: string) {
  const params: Record<string, any> = { window_days: windowDays, top_n: topN };
  if (industry) params.industry = industry;
  const { data } = await api.get('/ranking', { params });
  return data;
}

export async function scanSingle(companyCode: string, windowDays = 60) {
  const { data } = await api.post('/scan/single', { company_code: companyCode, window_days: windowDays });
  return data;
}

export async function getFinancial(companyCode: string, windowDays = 60) {
  const { data } = await api.get(`/financial/${companyCode}`, { params: { window_days: windowDays } });
  return data;
}

export async function getGraph(companyCode: string, k = 1, maxNodes = 30) {
  const { data } = await api.get(`/graph/${companyCode}`, { params: { k, max_nodes: maxNodes } });
  return data;
}

export async function getTrace(companyCode: string, windowDays = 60) {
  const { data } = await api.get(`/trace/${companyCode}`, { params: { window_days: windowDays } });
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

export async function getMarketOverview(windowDays = 60) {
  const { data } = await api.get('/twin/market-overview', { params: { window_days: windowDays } });
  return data;
}

export async function getPipelineStatus(limit = 5) {
  const { data } = await api.get('/twin/pipeline-status', { params: { limit } });
  return data;
}

export async function getScanTrace(scanId: string) {
  const { data } = await api.get(`/history/scans/${scanId}/trace`);
  return data;
}

export async function listScans(limit = 10) {
  const { data } = await api.get('/history/scans', { params: { limit } });
  return data;
}

export function getReportDownloadUrl(companyCode: string, windowDays = 60) {
  return `/api/v1/report/${companyCode}/download?window_days=${windowDays}`;
}

/* ═══════════ Digital Twin API ═══════════ */

const twinApi = axios.create({ baseURL: '/api/twin' });

export async function getTwinState() {
  const { data } = await twinApi.get('/state');
  return data;
}

export async function getTwinEntity(entityId: string) {
  const { data } = await twinApi.get(`/entity/${entityId}`);
  return data;
}

export async function updateTwinEntity(entityId: string, updates: Record<string, any>) {
  const { data } = await twinApi.put(`/entity/${entityId}`, updates);
  return data;
}

export async function addTwinEntity(entity: Record<string, any>) {
  const { data } = await twinApi.post('/entity', entity);
  return data;
}

export async function deleteTwinEntity(entityId: string) {
  const { data } = await twinApi.delete(`/entity/${entityId}`);
  return data;
}

export async function sendTwinCommand(entityId: string, command: string, params: Record<string, any> = {}) {
  const { data } = await twinApi.post('/command', { entityId, command, params });
  return data;
}

export async function getTwinHistory(entityId?: string, startTime?: number, endTime?: number, limit = 100) {
  const params: Record<string, any> = { limit };
  if (entityId) params.entityId = entityId;
  if (startTime) params.startTime = startTime;
  if (endTime) params.endTime = endTime;
  const { data } = await twinApi.get('/history', { params });
  return data;
}

export async function requestTwinPrediction(entityId: string, horizonMs: number) {
  const { data } = await twinApi.post('/predict', { entityId, horizonMs });
  return data;
}