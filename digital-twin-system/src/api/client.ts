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