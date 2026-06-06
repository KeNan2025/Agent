import { useState, useEffect } from 'react';
import { Card, Row, Col, Select, Spin, Statistic, Space, Tag, Empty, Table } from 'antd';
import {
  HeatMapOutlined,
  WarningOutlined,
  SafetyOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getMarketOverview, getIndustries } from '../api/client';

/* ──────────────── Types ──────────────── */

interface CompanyRisk {
  code: string;
  name: string;
  industry: string;
  market_cap: number;
  probability: number;
  risk_level: string;
}

interface IndustryRisk {
  name: string;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  total_companies: number;
  companies: CompanyRisk[];
}

interface MarketOverview {
  total_companies: number;
  high_risk_count: number;
  medium_risk_count: number;
  low_risk_count: number;
  avg_probability: number;
  industries: IndustryRisk[];
}

/* ──────────────── Constants ──────────────── */

const RISK_COLORS: Record<string, string> = {
  '高风险': '#dc2626',
  '中风险': '#f59e0b',
  '低风险': '#22c55e',
};

const RISK_VALUES: Record<string, number> = {
  '高风险': 3,
  '中风险': 2,
  '低风险': 1,
};

const RISK_BADGE_CLASS: Record<string, string> = {
  '高风险': 'high',
  '中风险': 'medium',
  '低风险': 'low',
};

const WINDOW_OPTIONS = [
  { value: 30, label: '30天' },
  { value: 60, label: '60天' },
  { value: 90, label: '90天' },
];

/* ──────────────── Helpers ──────────────── */

function formatMarketCap(val: number): string {
  if (val >= 1e8) return (val / 1e8).toFixed(1) + '亿';
  if (val >= 1e4) return (val / 1e4).toFixed(1) + '万';
  return val.toFixed(0);
}

/* ──────────────── Component ──────────────── */

export default function MarketHeatmap() {
  const [windowDays, setWindowDays] = useState(60);
  const [selectedIndustry, setSelectedIndustry] = useState<string | undefined>(undefined);
  const [industries, setIndustries] = useState<string[]>([]);
  const [marketData, setMarketData] = useState<MarketOverview | null>(null);
  const [loading, setLoading] = useState(false);

  /* ---- Load industries list on mount ---- */
  useEffect(() => {
    getIndustries()
      .then(data => {
        const list = Array.isArray(data) ? data : data?.industries ?? [];
        const names = list.map((item: any) =>
          typeof item === 'string' ? item : item.name ?? item.industry ?? '',
        );
        setIndustries(names.filter(Boolean));
      })
      .catch(() => setIndustries([]));
  }, []);

  /* ---- Load market overview when windowDays changes ---- */
  useEffect(() => {
    setLoading(true);
    getMarketOverview(windowDays)
      .then(data => setMarketData(data as MarketOverview))
      .catch(err => {
        console.error('Failed to load market overview:', err);
        setMarketData(null);
      })
      .finally(() => setLoading(false));
  }, [windowDays]);

  /* ---- Build ECharts Treemap Option ---- */
  function buildTreemapOption(): any {
    if (!marketData?.industries?.length) return null;

    const allIndustries = marketData.industries;
    const filteredIndustries = selectedIndustry
      ? allIndustries.filter(ind => ind.name === selectedIndustry)
      : allIndustries;

    if (filteredIndustries.length === 0) return null;

    const treemapData = filteredIndustries.map(ind => ({
      name: ind.name,
      value: ind.companies.reduce((sum, c) => sum + (c.market_cap || 0), 0),
      children: ind.companies.map(c => ({
        name: c.code,
        value: RISK_VALUES[c.risk_level] ?? 2,
        probability: c.probability,
        risk_level: c.risk_level,
        companyName: c.name,
        industry: c.industry || ind.name,
        market_cap: c.market_cap,
      })),
    }));

    return {
      tooltip: {
        trigger: 'item',
        confine: true,
        formatter: (params: any) => {
          const d = params.data;
          if (!d || !d.companyName) return params.name;
          const riskColor = RISK_COLORS[d.risk_level] ?? '#666';
          const capStr = formatMarketCap(d.market_cap ?? 0);
          const probStr = ((d.probability ?? 0) * 100).toFixed(2) + '%';
          return (
            `<div style="padding:4px 0;min-width:190px;">` +
            `<div style="font-weight:700;font-size:14px;margin-bottom:6px;">${d.companyName} (${params.name})</div>` +
            `<div style="font-size:12px;line-height:1.9;color:#6b7280;">` +
            `<div>行业: ${d.industry || '-'}</div>` +
            `<div>市值: ${capStr}</div>` +
            `<div>问询概率: <span style="font-weight:700;color:#1f2937;">${probStr}</span></div>` +
            `<div>风险等级: <span style="color:${riskColor};font-weight:600;">${d.risk_level}</span></div>` +
            `</div></div>`
          );
        },
      },
      series: [
        {
          type: 'treemap',
          roam: false,
          nodeClick: 'link',
          width: '100%',
          height: '88%',
          top: 40,
          breadcrumb: {
            show: true,
            height: 28,
            left: 12,
            top: 4,
            itemStyle: {
              color: '#f3f4f6',
              borderColor: '#e5e7eb',
              textStyle: { color: '#6b7280' },
            },
            emphasis: {
              itemStyle: {
                color: '#e5e7eb',
                textStyle: { color: '#1f2937' },
              },
            },
          },
          label: {
            show: true,
            formatter: (params: any) => {
              const d = params.data;
              if (d && d.probability != null) {
                return `${params.name}\n${((d.probability ?? 0) * 100).toFixed(1)}%`;
              }
              return params.name;
            },
            fontSize: 11,
          },
          levels: [
            {
              // Industry level
              itemStyle: {
                borderColor: '#fff',
                borderWidth: 2,
                gapWidth: 2,
              },
              upperLabel: {
                show: true,
                height: 30,
                fontSize: 13,
                fontWeight: 'bold',
              },
            },
            {
              // Company level
              colorMappingBy: 'value',
              itemStyle: {
                gapWidth: 1,
              },
            },
          ],
          data: treemapData,
        },
      ],
      visualMap: {
        min: 1,
        max: 3,
        inRange: { color: ['#22c55e', '#f59e0b', '#dc2626'] },
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        text: ['高风险', '低风险'],
        textStyle: { fontSize: 11, color: '#6b7280' },
        calculable: false,
        show: true,
        itemWidth: 16,
        itemHeight: 120,
      },
    };
  }

  /* ---- Build Industry Risk Ranking Bar Chart Option ---- */
  function buildBarOption(): any {
    if (!marketData?.industries?.length) return null;

    const sorted = [...marketData.industries].sort(
      (a, b) => (b.high_risk_count || 0) - (a.high_risk_count || 0),
    );

    const industryNames = sorted.map(ind => ind.name);
    const highCounts = sorted.map(ind => ind.high_risk_count || 0);
    const medCounts = sorted.map(ind => ind.medium_risk_count || 0);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any[]) => {
          let html = `<div style="font-weight:600;margin-bottom:4px;">${params[0]?.axisValue || ''}</div>`;
          params.forEach(p => {
            html += `<div style="font-size:12px;line-height:1.8;">${p.marker} ${p.seriesName}: <b>${p.value}</b> 家</div>`;
          });
          return html;
        },
      },
      legend: {
        data: ['高风险', '中风险'],
        top: 0,
        textStyle: { fontSize: 12, color: '#6b7280' },
      },
      grid: {
        left: 4,
        right: 16,
        top: 32,
        bottom: 8,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: industryNames,
        axisLabel: {
          rotate: industryNames.length > 6 ? 35 : 0,
          fontSize: 11,
          color: '#6b7280',
          interval: 0,
        },
        axisTick: { alignWithLabel: true },
      },
      yAxis: {
        type: 'value',
        name: '公司数量',
        nameTextStyle: { fontSize: 11, color: '#9ca3af' },
        axisLabel: { fontSize: 11, color: '#9ca3af' },
        splitLine: { lineStyle: { color: '#f3f4f6' } },
      },
      series: [
        {
          name: '高风险',
          type: 'bar',
          stack: 'total',
          data: highCounts,
          itemStyle: { color: '#dc2626', borderRadius: [4, 4, 0, 0] },
          barMaxWidth: 36,
          emphasis: { itemStyle: { color: '#ef4444' } },
        },
        {
          name: '中风险',
          type: 'bar',
          stack: 'total',
          data: medCounts,
          itemStyle: { color: '#f59e0b' },
          barMaxWidth: 36,
          emphasis: { itemStyle: { color: '#fbbf24' } },
        },
      ],
    };
  }

  /* ---- Top-10 highest-probability companies across all industries ---- */
  function getTop10(): CompanyRisk[] {
    if (!marketData?.industries) return [];
    const allCompanies = marketData.industries.flatMap(ind =>
      (ind.companies || []).map(c => ({ ...c, industry: c.industry || ind.name })),
    );
    return allCompanies
      .sort((a, b) => (b.probability || 0) - (a.probability || 0))
      .slice(0, 10);
  }

  /* ---- Table column definitions ---- */
  const top10Columns = [
    {
      title: '#',
      dataIndex: 'rank',
      key: 'rank',
      width: 48,
      render: (_: any, __: any, idx: number) => (
        <span className={`rank-medal rank-medal--${idx + 1}`}>{idx + 1}</span>
      ),
    },
    {
      title: '公司代码',
      dataIndex: 'code',
      key: 'code',
      width: 90,
      render: (code: string) => <span className="code-link">{code}</span>,
    },
    {
      title: '公司名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '行业',
      dataIndex: 'industry',
      key: 'industry',
      width: 100,
      render: (industry: string) => <span className="industry-tag">{industry}</span>,
    },
    {
      title: '市值',
      dataIndex: 'market_cap',
      key: 'market_cap',
      width: 90,
      render: (val: number) => <span className="num-cell">{formatMarketCap(val)}</span>,
    },
    {
      title: '问询概率',
      dataIndex: 'probability',
      key: 'probability',
      width: 140,
      render: (p: number) => {
        const color = p >= 0.7 ? '#dc2626' : p >= 0.4 ? '#d97706' : '#059669';
        return (
          <div className="prob-cell">
            <span className="prob-value" style={{ color }}>
              {((p ?? 0) * 100).toFixed(2)}%
            </span>
          </div>
        );
      },
    },
    {
      title: '风险等级',
      dataIndex: 'risk_level',
      key: 'risk_level',
      width: 90,
      render: (level: string) => {
        const cls = RISK_BADGE_CLASS[level] || 'low';
        return <span className={`risk-badge risk-badge--${cls}`}>{level}</span>;
      },
    },
  ];

  /* ---- Derived data ---- */
  const treemapOption = buildTreemapOption();
  const barOption = buildBarOption();
  const top10 = getTop10();

  /* ---- Render ---- */
  return (
    <div className="page-container fade-in">
      {/* Page Title */}
      <div className="page-title">
        <span className="title-bar" />
        <span>市场风险热力图</span>
      </div>

      {/* Filters */}
      <Row gutter={[12, 12]} style={{ marginBottom: 16 }} align="middle">
        <Col>
          <Space size={8}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>窗口天数</span>
            <Select
              value={windowDays}
              onChange={setWindowDays}
              options={WINDOW_OPTIONS}
              style={{ width: 100 }}
            />
          </Space>
        </Col>
        <Col>
          <Space size={8}>
            <span style={{ fontSize: 13, color: '#6b7280', fontWeight: 500 }}>行业筛选</span>
            <Select
              value={selectedIndustry}
              onChange={setSelectedIndustry}
              allowClear
              placeholder="全部行业"
              style={{ width: 190 }}
              options={industries.map(name => ({ value: name, label: name }))}
              showSearch
              filterOption={(input, option) =>
                (option?.label as string)?.includes(input)
              }
            />
          </Space>
        </Col>
        {selectedIndustry && (
          <Col>
            <Tag
              closable
              onClose={() => setSelectedIndustry(undefined)}
              color="processing"
              style={{ fontSize: 12 }}
            >
              当前行业: {selectedIndustry}
            </Tag>
          </Col>
        )}
      </Row>

      {/* Page Content */}
      <Spin spinning={loading}>
        {!marketData && !loading ? (
          <Empty
            description="暂无市场数据"
            style={{ padding: 80 }}
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <>
            {/* Stat Cards */}
            <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
              <Col xs={12} sm={6}>
                <Card className="stat-card stat-blue">
                  <Statistic
                    title={<span className="stat-label">监控公司数</span>}
                    value={marketData?.total_companies ?? 0}
                    prefix={<HeatMapOutlined />}
                    valueStyle={{ color: '#1a5cff' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card className="stat-card stat-red">
                  <Statistic
                    title={<span className="stat-label">高风险公司数</span>}
                    value={marketData?.high_risk_count ?? 0}
                    prefix={<ExclamationCircleOutlined />}
                    valueStyle={{ color: '#dc2626' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card className="stat-card stat-orange">
                  <Statistic
                    title={<span className="stat-label">中风险公司数</span>}
                    value={marketData?.medium_risk_count ?? 0}
                    prefix={<WarningOutlined />}
                    valueStyle={{ color: '#d97706' }}
                  />
                </Card>
              </Col>
              <Col xs={12} sm={6}>
                <Card className="stat-card stat-green">
                  <Statistic
                    title={<span className="stat-label">平均问询概率</span>}
                    value={
                      marketData?.avg_probability != null
                        ? (marketData.avg_probability * 100).toFixed(2) + '%'
                        : '--'
                    }
                    valueStyle={{ color: '#059669' }}
                  />
                </Card>
              </Col>
            </Row>

            {/* Main Treemap Chart */}
            <Card
              title={<span className="table-card-title">风险热力图</span>}
              style={{ marginBottom: 20 }}
              styles={{ body: { padding: '12px 20px 20px' } }}
            >
              {treemapOption ? (
                <ReactECharts
                  option={treemapOption}
                  style={{ height: 520 }}
                  opts={{ renderer: 'canvas' }}
                  notMerge
                />
              ) : (
                <Empty
                  description={
                    selectedIndustry
                      ? `"${selectedIndustry}" 行业暂无数据`
                      : '暂无可展示的热力图数据'
                  }
                  style={{ padding: 60 }}
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                />
              )}
            </Card>

            {/* Bottom Row */}
            <Row gutter={[20, 20]}>
              {/* Industry Risk Ranking Bar Chart */}
              <Col xs={24} lg={10}>
                <Card
                  title={<span className="table-card-title">行业风险排名</span>}
                  style={{ height: '100%' }}
                >
                  {barOption ? (
                    <ReactECharts
                      option={barOption}
                      style={{ height: 420 }}
                      opts={{ renderer: 'canvas' }}
                      notMerge
                    />
                  ) : (
                    <Empty
                      description="暂无行业数据"
                      style={{ padding: 40 }}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </Card>
              </Col>

              {/* Top 10 High-Risk Companies */}
              <Col xs={24} lg={14}>
                <Card
                  title={<span className="table-card-title">高风险公司 Top 10</span>}
                >
                  {top10.length > 0 ? (
                    <Table
                      dataSource={top10.map((c, i) => ({ ...c, key: c.code, rank: i + 1 }))}
                      columns={top10Columns}
                      pagination={false}
                      size="small"
                      onRow={record => ({
                        onClick: () => {
                          window.open(`/company?code=${record.code}`, '_self');
                        },
                        style: { cursor: 'pointer' },
                      })}
                      locale={{ emptyText: '暂无公司数据' }}
                    />
                  ) : (
                    <Empty
                      description="暂无公司数据"
                      style={{ padding: 40 }}
                      image={Empty.PRESENTED_IMAGE_SIMPLE}
                    />
                  )}
                </Card>
              </Col>
            </Row>
          </>
        )}
      </Spin>
    </div>
  );
}