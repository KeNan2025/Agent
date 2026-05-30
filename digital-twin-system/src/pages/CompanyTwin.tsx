import { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Select,
  Spin,
  Statistic,
  Tag,
  Space,
  Empty,
  Button,
  message,
  Timeline,
} from 'antd';
import {
  AimOutlined,
  ThunderboltOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { scanSingle, getGraph, getCompanies, getFinancial } from '../api/client';
import { getReportDownloadUrl } from '../api/client';

/* ── Types ── */

interface CompanyOption {
  code: string;
  name: string;
  industry?: string;
}

interface ShapFeature {
  feature: string;
  shap_value: number;
}

interface RiskFactor {
  name: string;
  evidence: string;
  importance?: number;
}

interface ScanResult {
  probability: number;
  risk_level: string;
  confidence: number;
  elapsed_ms: number;
  shap_features: ShapFeature[];
  risk_factors: RiskFactor[];
}

interface GraphData {
  egonet: {
    nodes: Array<{
      id: string;
      name: string;
      category: string;
      symbolSize?: number;
      market_cap?: number;
      risk_score?: number;
      [key: string]: any;
    }>;
    links: Array<{
      source: string;
      target: string;
      name?: string;
      relation?: string;
      [key: string]: any;
    }>;
  };
}

/* ── Constants ── */

const WINDOW_OPTIONS = [
  { value: 30, label: '30 天' },
  { value: 60, label: '60 天' },
  { value: 90, label: '90 天' },
];

const RADAR_DIMENSIONS = ['财务异常', '公告风险', '图谱关联', '历史监管', '市场异动', '时序趋势'];

const CATEGORY_COLORS: Record<string, string> = {
  company: '#1a5cff',
  controller: '#7c3aed',
  auditor: '#0891b2',
  shareholder: '#d97706',
  subsidiary: '#059669',
};

const RISK_LEVEL_MAP: Record<string, { color: string; label: string }> = {
  high: { color: 'red', label: '高风险' },
  medium: { color: 'orange', label: '中风险' },
  low: { color: 'green', label: '低风险' },
};

/* ── Helpers ── */

function deriveRadarValues(shapFeatures: ShapFeature[]): number[] {
  if (!shapFeatures || shapFeatures.length === 0) {
    return [0, 0, 0, 0, 0, 0];
  }

  const dimKeywords: Record<string, string[]> = {
    '财务异常': [
      '资产', '负债', '利润', '收入', '财务', '现金流', '毛利', '应收',
      '应付', '存货', '净资产', 'roe', 'roa', '资产负债', '净利润', '营收',
      '费用', '成本', '周转', '偿债',
    ],
    '公告风险': [
      '公告', '披露', '年报', '问询', '更正', '补充', '延期', '业绩预告',
      '快报', '说明会', '关注函', '警示函',
    ],
    '图谱关联': [
      '关联', '股东', '控制', '担保', '质押', '持股', '子公司', '实控',
      '一致行动', '关联交易', '股权', '穿透', '受益人',
    ],
    '历史监管': [
      '监管', '处罚', '违规', '诉讼', '警示', '通报', '调查', '立案',
      '处分', '处罚记录', '失信', '限制',
    ],
    '市场异动': [
      '市场', '股价', '波动', '成交', '换手', '涨跌', '量价', 'alpha',
      'beta', '波动率', '振幅', '流动性',
    ],
    '时序趋势': [
      '趋势', '变化', '增长', '同比', '环比', '时序', '连续', '下滑',
      '恶化', '改善', '拐点', '异常变动',
    ],
  };

  const dimKeys = Object.keys(dimKeywords);
  const result = new Array(dimKeys.length).fill(0);

  for (const feat of shapFeatures) {
    const val = Math.abs(feat.shap_value);
    let matched = false;
    for (let i = 0; i < dimKeys.length; i++) {
      if (dimKeywords[dimKeys[i]].some((kw) => feat.feature.toLowerCase().includes(kw.toLowerCase()))) {
        result[i] += val;
        matched = true;
        break;
      }
    }
    if (!matched) {
      // unclassified features → spread evenly across dimensions
      const fraction = val / dimKeys.length;
      for (let i = 0; i < dimKeys.length; i++) {
        result[i] += fraction;
      }
    }
  }

  // Normalise so the maximum is 1.0
  const maxVal = Math.max(...result, 0.01);
  return result.map((v) => Math.round((v / maxVal) * 100) / 100);
}

function formatMs(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

/* ── ECharts Options ── */

function buildForceGraphOption(graphData: GraphData) {
  const { nodes, links } = graphData.egonet;

  const categories = Object.entries(CATEGORY_COLORS).map(([name, color]) => ({
    name,
    itemStyle: { color },
  }));

  const graphNodes = nodes.map((n) => ({
    id: n.id,
    name: n.name || n.id,
    category: n.category || 'company',
    symbolSize: n.symbolSize || Math.max(20, Math.min(50, (n.market_cap || 30) / 5)),
    value: n.market_cap || n.risk_score || 30,
    itemStyle: {
      borderColor: '#fff',
      borderWidth: 2,
      shadowBlur: 8,
      shadowColor: 'rgba(0,0,0,0.1)',
    },
    ...n,
  }));

  const graphLinks = links.map((l) => ({
    source: l.source,
    target: l.target,
    label: {
      show: true,
      formatter: l.name || l.relation || '',
      fontSize: 10,
      color: '#9ca3af',
    },
    lineStyle: {
      color: '#d1d5db',
      curveness: 0.2,
      width: 1.2,
    },
  }));

  return {
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
      formatter: (params: any) => {
        if (params.dataType === 'node') {
          const cat = params.data.category || 'company';
          const catLabel = { company: '目标公司', controller: '实控人', auditor: '审计机构', shareholder: '股东', subsidiary: '子公司' }[cat] || cat;
          return `<strong>${params.name}</strong><br/>类别: ${catLabel}<br/>指标: ${params.value ?? '-'}`;
        }
        const rel = params.data?.label?.formatter || '';
        return `${params.data?.source ?? ''} → ${params.data?.target ?? ''}${rel ? `<br/>关系: ${rel}` : ''}`;
      },
    },
    legend: {
      data: categories.map((c) => {
        const labelMap: Record<string, string> = { company: '目标公司', controller: '实控人', auditor: '审计机构', shareholder: '股东', subsidiary: '子公司' };
        return labelMap[c.name] || c.name;
      }),
      orient: 'horizontal',
      bottom: 0,
      textStyle: { fontSize: 11, color: '#6b7280' },
    },
    series: [
      {
        type: 'graph',
        layout: 'force',
        roam: true,
        draggable: true,
        categories,
        data: graphNodes,
        links: graphLinks,
        force: {
          repulsion: 350,
          gravity: 0.08,
          edgeLength: [80, 200],
          layoutAnimation: true,
        },
        label: {
          show: true,
          fontSize: 11,
          color: '#4b5563',
          fontWeight: 500,
          position: 'right',
          distance: 6,
        },
        lineStyle: {
          color: '#d1d5db',
          curveness: 0.2,
          opacity: 0.5,
        },
        emphasis: {
          focus: 'adjacency',
          itemStyle: {
            shadowBlur: 16,
            shadowColor: 'rgba(26,92,255,0.25)',
          },
          lineStyle: {
            width: 2.5,
            opacity: 0.8,
          },
          label: {
            fontSize: 13,
            fontWeight: 600,
          },
        },
        itemStyle: {
          borderColor: '#fff',
          borderWidth: 2,
        },
      },
    ],
  };
}

function buildRadarOption(scanResult: ScanResult) {
  const values = deriveRadarValues(scanResult.shap_features);

  return {
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
      formatter: (params: any) => {
        const val = params.value ?? params.data?.value;
        if (!Array.isArray(val)) return params.name;
        return RADAR_DIMENSIONS.map((d, i) => `${d}: ${val[i]?.toFixed(2) ?? 0}`).join('<br/>');
      },
    },
    radar: {
      center: ['50%', '52%'],
      radius: '65%',
      indicator: RADAR_DIMENSIONS.map((name) => ({ name, max: 1.0 })),
      shape: 'polygon',
      splitNumber: 5,
      axisName: {
        color: '#4b5563',
        fontSize: 12,
        fontWeight: 500,
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(26,92,255,0.02)', 'rgba(26,92,255,0.04)', 'rgba(26,92,255,0.02)', 'rgba(26,92,255,0.04)', 'rgba(26,92,255,0.02)'],
        },
      },
      splitLine: {
        lineStyle: { color: 'rgba(26,92,255,0.10)' },
      },
      axisLine: {
        lineStyle: { color: 'rgba(26,92,255,0.15)' },
      },
    },
    series: [
      {
        type: 'radar',
        data: [
          {
            value: values,
            name: '风险评分',
            areaStyle: { color: 'rgba(26,92,255,0.12)' },
            lineStyle: { color: '#1a5cff', width: 2 },
            itemStyle: { color: '#1a5cff', borderColor: '#fff', borderWidth: 1.5 },
            symbol: 'circle',
            symbolSize: 6,
          },
        ],
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  };
}

function buildShapBarOption(shapFeatures: ShapFeature[]) {
  if (!shapFeatures || shapFeatures.length === 0) {
    return {};
  }

  const sorted = [...shapFeatures]
    .filter((f) => f.shap_value !== 0)
    .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
    .slice(0, 10);

  if (sorted.length === 0) {
    return {};
  }

  // Render so largest absolute value appears at the top (y-axis is inverted in horizontal bar)
  const reversed = [...sorted].reverse();

  return {
    tooltip: {
      backgroundColor: '#ffffff',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      textStyle: { color: '#1f2937', fontSize: 12 },
      formatter: (params: any) => {
        const v = params.value ?? 0;
        const direction = v >= 0 ? '正向贡献' : '负向贡献';
        return `<strong>${params.name}</strong><br/>SHAP: ${v.toFixed(4)}<br/>${direction}`;
      },
    },
    grid: {
      left: '3%',
      right: '8%',
      top: '3%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'value',
      name: 'SHAP Value',
      nameTextStyle: { fontSize: 11, color: '#9ca3af' },
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: { fontSize: 11, color: '#6b7280' },
      splitLine: { lineStyle: { color: '#f0f0f0' } },
    },
    yAxis: {
      type: 'category',
      data: reversed.map((f) => f.feature),
      axisLine: { lineStyle: { color: '#e5e7eb' } },
      axisLabel: {
        fontSize: 11,
        color: '#4b5563',
        width: 120,
        overflow: 'truncate',
      },
      axisTick: { show: false },
    },
    series: [
      {
        type: 'bar',
        barWidth: 16,
        data: reversed.map((f) => ({
          value: f.shap_value,
          itemStyle: {
            color: f.shap_value >= 0 ? '#dc2626' : '#1a5cff',
            borderRadius: f.shap_value >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4],
          },
        })),
        label: {
          show: true,
          position: 'right',
          fontSize: 10,
          color: '#6b7280',
          formatter: (params: any) => {
            const v = params.value ?? 0;
            return v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3);
          },
        },
        emphasis: {
          itemStyle: {
            shadowBlur: 8,
            shadowColor: 'rgba(0,0,0,0.15)',
          },
        },
      },
    ],
  };
}

/* ══════════════════════════════════════════════
   CompanyTwin — 公司级风险全景孪生
   ══════════════════════════════════════════════ */

export default function CompanyTwin() {
  /* ── State ── */
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);

  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined);
  const [windowDays, setWindowDays] = useState<number>(60);

  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [graphData, setGraphData] = useState<GraphData | null>(null);

  const [analysisStarted, setAnalysisStarted] = useState(false);

  /* ── Fetch company list on mount ── */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setCompaniesLoading(true);
      try {
        const data = await getCompanies();
        if (cancelled) return;
        if (Array.isArray(data)) {
          setCompanies(data);
        } else if (Array.isArray(data?.companies)) {
          setCompanies(data.companies);
        } else if (Array.isArray(data?.data)) {
          setCompanies(data.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error('Failed to load companies', err);
          // Not showing a message here – the dropdown will just be empty
        }
      } finally {
        if (!cancelled) setCompaniesLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  /* ── Handlers ── */

  async function handleAnalyze() {
    if (!selectedCompany) {
      message.warning('请先选择公司代码');
      return;
    }

    setScanning(true);
    setScanResult(null);
    setGraphData(null);
    setAnalysisStarted(true);

    try {
      const [scanRes, graphRes] = await Promise.all([
        scanSingle(selectedCompany, windowDays),
        getGraph(selectedCompany),
      ]);

      // Normalise scan result
      const result: ScanResult = {
        probability: scanRes?.probability ?? scanRes?.risk_probability ?? 0,
        risk_level: scanRes?.risk_level ?? scanRes?.level ?? 'low',
        confidence: scanRes?.confidence ?? scanRes?.model_confidence ?? 0,
        elapsed_ms: scanRes?.elapsed_ms ?? scanRes?.scan_time_ms ?? 0,
        shap_features: Array.isArray(scanRes?.shap_features) ? scanRes.shap_features : [],
        risk_factors: Array.isArray(scanRes?.risk_factors) ? scanRes.risk_factors : [],
      };

      // Normalise graph data
      const graph: GraphData = {
        egonet: {
          nodes: Array.isArray(graphRes?.egonet?.nodes) ? graphRes.egonet.nodes : [],
          links: Array.isArray(graphRes?.egonet?.links) ? graphRes.egonet.links : [],
        },
      };

      setScanResult(result);
      setGraphData(graph);

      const factorCount = result.risk_factors.length;
      if (factorCount > 0) {
        message.success(`分析完成，发现 ${factorCount} 个风险因素`);
      } else {
        message.success('分析完成，未发现显著风险因素');
      }
    } catch (err: any) {
      console.error('Scan failed', err);
      const detail = err?.response?.data?.detail ?? err?.message ?? '未知错误';
      message.error(`分析失败: ${detail}`);
      setScanResult(null);
      setGraphData(null);
    } finally {
      setScanning(false);
    }
  }

  function handleReset() {
    setSelectedCompany(undefined);
    setWindowDays(60);
    setScanResult(null);
    setGraphData(null);
    setAnalysisStarted(false);
  }

  /* ── Derived display values ── */

  const riskTag = scanResult?.risk_level
    ? RISK_LEVEL_MAP[scanResult.risk_level] ?? { color: 'default', label: scanResult.risk_level }
    : null;

  const statCardColors: Array<'blue' | 'red' | 'orange' | 'green'> = ['blue', 'red', 'orange', 'green'];

  /* ── Render ── */

  return (
    <div className="page-container fade-in">
      {/* ── Page Title ── */}
      <div className="page-title">
        <span className="title-bar" />
        <span>公司风险全景孪生</span>
      </div>

      {/* ── Toolbar ── */}
      <Card
        style={{ marginBottom: 20 }}
        styles={{ body: { padding: '16px 20px' } }}
      >
        <Row gutter={[16, 12]} align="middle">
          <Col flex="auto">
            <Space size="middle" wrap>
              <Select
                showSearch
                placeholder="选择公司代码 / 名称"
                value={selectedCompany}
                onChange={(val) => setSelectedCompany(val)}
                loading={companiesLoading}
                style={{ minWidth: 280 }}
                filterOption={(input, option) =>
                  (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
                options={companies.map((c) => ({
                  value: c.code,
                  label: `${c.code}  ${c.name}`,
                }))}
                notFoundContent={companiesLoading ? <Spin size="small" /> : <Empty description="无公司数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />}
              />

              <Select
                value={windowDays}
                onChange={(val) => setWindowDays(val)}
                style={{ width: 110 }}
                options={WINDOW_OPTIONS}
              />

              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleAnalyze}
                loading={scanning}
                disabled={!selectedCompany}
              >
                启动分析
              </Button>

              {(analysisStarted || scanResult) && (
                <Button
                  icon={<ReloadOutlined />}
                  onClick={handleReset}
                >
                  重置
                </Button>
              )}
            </Space>
          </Col>
        </Row>
      </Card>

      {/* ── Loading ── */}
      {scanning && (
        <div style={{ textAlign: 'center', padding: '80px 0' }}>
          <Spin
            size="large"
            tip="正在进行风险扫描分析，请稍候..."
          >
            <div style={{ height: 120 }} />
          </Spin>
        </div>
      )}

      {/* ── Empty (before analysis) ── */}
      {!scanning && !scanResult && !analysisStarted && (
        <Card>
          <Empty
            description="请选择公司代码并启动分析"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '60px 0' }}
          >
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleAnalyze}
              disabled={!selectedCompany}
            >
              启动分析
            </Button>
          </Empty>
        </Card>
      )}

      {/* ── Error with no data after analysis attempt ── */}
      {!scanning && !scanResult && analysisStarted && (
        <Card>
          <Empty
            description="分析失败，请检查网络连接后重试"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ padding: '60px 0' }}
          >
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              onClick={handleAnalyze}
              disabled={!selectedCompany}
            >
              重新分析
            </Button>
          </Empty>
        </Card>
      )}

      {/* ════════════ Results ════════════ */}
      {!scanning && scanResult && (
        <>
          {/* ── Row 1: Stat Cards ── */}
          <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
            <Col xs={24} sm={12} lg={6}>
              <Card className={`stat-card stat-${statCardColors[0]}`}>
                <Statistic
                  title="问询概率"
                  value={scanResult.probability}
                  suffix="%"
                  precision={2}
                  valueStyle={{ color: scanResult.probability > 50 ? '#dc2626' : scanResult.probability > 20 ? '#d97706' : '#059669', fontWeight: 700 }}
                />
                <ThunderboltOutlined className="stat-icon-bg" />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className={`stat-card stat-${statCardColors[1]}`}>
                <Statistic
                  title="风险等级"
                  valueRender={() =>
                    riskTag ? (
                      <Tag color={riskTag.color} style={{ fontSize: 18, padding: '4px 16px', fontWeight: 700 }}>
                        {riskTag.label}
                      </Tag>
                    ) : (
                      <span style={{ color: '#9ca3af' }}>-</span>
                    )
                  }
                />
                <AimOutlined className="stat-icon-bg" />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className={`stat-card stat-${statCardColors[2]}`}>
                <Statistic
                  title="置信度"
                  value={scanResult.confidence}
                  suffix="%"
                  precision={1}
                  valueStyle={{ color: '#1a5cff', fontWeight: 700 }}
                />
                <CheckCircleOutlined className="stat-icon-bg" />
              </Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card className={`stat-card stat-${statCardColors[3]}`}>
                <Statistic
                  title="分析耗时"
                  valueRender={() => (
                    <span style={{ fontSize: 24, fontWeight: 700, color: scanResult.elapsed_ms > 5000 ? '#d97706' : '#059669' }}>
                      {formatMs(scanResult.elapsed_ms)}
                    </span>
                  )}
                />
                <ClockCircleOutlined className="stat-icon-bg" />
              </Card>
            </Col>
          </Row>

          {/* ── Row 2: Force Graph + Radar ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col xs={24} lg={10}>
              <Card
                title="关联图谱 · 自我中心网络"
                extra={
                  <Tag color="purple" style={{ fontSize: 11 }}>
                    力导向布局
                  </Tag>
                }
                styles={{ body: { padding: '8px' } }}
              >
                {graphData && graphData.egonet.nodes.length > 0 ? (
                  <ReactECharts
                    option={buildForceGraphOption(graphData)}
                    style={{ height: 480 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge
                  />
                ) : (
                  <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description="暂无图谱数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                )}
              </Card>
            </Col>
            <Col xs={24} lg={14}>
              <Card
                title="风险雷达图"
                extra={
                  <Tag color="blue" style={{ fontSize: 11 }}>
                    六维评估
                  </Tag>
                }
                styles={{ body: { padding: '8px' } }}
              >
                {scanResult.shap_features.length > 0 ? (
                  <ReactECharts
                    option={buildRadarOption(scanResult)}
                    style={{ height: 480 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge
                  />
                ) : (
                  <div style={{ height: 480, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description="暂无特征数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Row 3: SHAP Feature Waterfall ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={24}>
              <Card
                title="SHAP 特征贡献图"
                extra={
                  <Space size="small">
                    <Tag color="red" style={{ fontSize: 11 }}>正向贡献 (+)</Tag>
                    <Tag color="blue" style={{ fontSize: 11 }}>负向贡献 (-)</Tag>
                  </Space>
                }
                styles={{ body: { padding: '8px' } }}
              >
                {scanResult.shap_features.length > 0 ? (
                  <ReactECharts
                    option={buildShapBarOption(scanResult.shap_features)}
                    style={{ height: 420 }}
                    opts={{ renderer: 'canvas' }}
                    notMerge
                  />
                ) : (
                  <div style={{ height: 420, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Empty description="暂无 SHAP 特征数据" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Row 4: Risk Factors Timeline ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            <Col span={24}>
              <Card
                title="风险因素时间线"
                extra={
                  <Tag color="orange" style={{ fontSize: 11 }}>
                    {scanResult.risk_factors.length} 项因素
                  </Tag>
                }
              >
                {scanResult.risk_factors.length > 0 ? (
                  <Timeline
                    items={scanResult.risk_factors.map((factor, idx) => ({
                      color: factor.importance && factor.importance > 0.5 ? 'red' : factor.importance && factor.importance > 0.2 ? 'orange' : 'blue',
                      dot: idx === 0 ? <ExclamationCircleOutlined style={{ fontSize: 16 }} /> : undefined,
                      children: (
                        <div style={{ padding: '4px 0' }}>
                          <div style={{ fontWeight: 600, fontSize: 14, color: '#1f2937', marginBottom: 4 }}>
                            {factor.name}
                            {factor.importance !== undefined && (
                              <Tag
                                color={factor.importance > 0.5 ? 'red' : factor.importance > 0.2 ? 'orange' : 'default'}
                                style={{ marginLeft: 8, fontSize: 11 }}
                              >
                                权重 {factor.importance.toFixed(2)}
                              </Tag>
                            )}
                          </div>
                          {factor.evidence && (
                            <div
                              style={{
                                fontSize: 13,
                                color: '#6b7280',
                                lineHeight: 1.7,
                                background: '#f9fafb',
                                padding: '8px 12px',
                                borderRadius: 6,
                                borderLeft: '3px solid #e5e7eb',
                              }}
                            >
                              {factor.evidence}
                            </div>
                          )}
                        </div>
                      ),
                    }))}
                  />
                ) : (
                  <Empty description="未发现显著风险因素" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ padding: '40px 0' }} />
                )}
              </Card>
            </Col>
          </Row>

          {/* ── Bottom: Download ── */}
          <div style={{ textAlign: 'center', padding: '16px 0 40px' }}>
            <Button
              type="primary"
              size="large"
              icon={<DownloadOutlined />}
              href={getReportDownloadUrl(selectedCompany!, windowDays)}
              target="_blank"
              rel="noopener noreferrer"
            >
              下载完整报告
            </Button>
          </div>
        </>
      )}
    </div>
  );
}