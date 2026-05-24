import axios from 'axios';

const api = axios.create({ baseURL: '/api/v1' });

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

export async function getCompanies() {
  const { data } = await api.get('/companies');
  return data;
}

export async function getIndustries() {
  const { data } = await api.get('/industries');
  return data;
}
