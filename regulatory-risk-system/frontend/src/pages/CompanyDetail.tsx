import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Table, Timeline, Progress, Spin, Button,
  Tabs, Statistic, Alert, Collapse, Space, Tooltip,
  Descriptions, Empty, Badge, Divider,
} from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined, FileTextOutlined,
  NodeIndexOutlined, ApartmentOutlined, FundOutlined,
  PieChartOutlined, DotChartOutlined, SafetyCertificateOutlined,
  ExclamationCircleOutlined, RiseOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { scanSingle, getFinancial, getGraph } from '../api/client';

const riskColorMap: Record<string, string> = {
  '高风险': '#ef4444',
  '中风险': '#f59e0b',
  '低风险': '#10b981',
};

const riskBadgeMap: Record<string, string> = {
  '高风险': 'high',
  '中风险': 'medium',
  '低风险': 'low',
};

const severityColor: Record<string, string> = {
  '高': 'red', '中': 'orange', '低': 'green',
};

export default function CompanyDetail() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [windowDays] = useState(60);
  const [financial, setFinancial] = useState<any>(null);
  const [graph, setGraph] = useState<any>(null);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    Promise.all([
      scanSingle(code, windowDays),
      getFinancial(code, windowDays).catch(() => null),
      getGraph(code, 1, 25).catch(() => null),
    ]).then(([d, fin, g]) => {
      setData(d);
      setFinancial(fin);
      setGraph(g);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [code, windowDays]);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 120 }}>
        <Spin size="large" />
        <div style={{ marginTop: 20 }}>
          <span style={{ fontSize: 15, color: 'var(--text-2)' }}>Agent 智能分析中...</span>
        </div>
        <div style={{ marginTop: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-3)' }}>正在调度多智能体协作完成风险评估</span>
        </div>
      </div>
    );
  }

  if (!data) return <Alert message="未找到该公司" type="error" showIcon />;

  const prob = data.inquiry_probability;
  const riskColor = riskColorMap[data.risk_level] || '#64748b';
  const pct = Math.round(prob * 100);

  return (
    <div className="page-container fade-in">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        type="text"
        style={{ marginBottom: 20, color: 'var(--text-2)' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-2)')}
      >
        返回排行榜
      </Button>

      <Row gutter={[20, 20]} style={{ marginBottom: 20 }}>
        <Col xs={24} lg={8}>
          <Card
            bodyStyle={{
              padding: '28px 24px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(59,130,246,0.06), rgba(99,102,241,0.04))',
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 18, fontWeight: 600, margin: 0, color: 'var(--text-1)' }}>
                {data.company.name}
              </div>
              <span style={{ fontSize: 13, color: 'var(--text-2)' }}>
                {data.company.code} · {data.company.industry}
              </span>
            </div>

            <div className="gauge-container" style={{ margin: '24px 0 16px' }}>
              <Progress
                type="dashboard"
                percent={pct}
                strokeColor={{
                  '0%': riskColor + '88',
                  '100%': riskColor,
                }}
                trailColor="rgba(148,163,184,0.08)"
                format={() => (
                  <div>
                    <div style={{ fontSize: 36, fontWeight: 700, color: riskColor, lineHeight: 1 }}>
                      {pct}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>问询概率(%)</div>
                  </div>
                )}
                size={180}
                strokeWidth={10}
              />
            </div>

            <span className={`risk-badge risk-badge--${riskBadgeMap[data.risk_level] || 'low'}`}>
              {data.risk_level}
            </span>

            <Divider style={{ margin: '16px 0 12px', borderColor: 'var(--divider)' }} />

            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>预测窗口</span>}
                  value={windowDays}
                  suffix="天"
                  valueStyle={{ fontSize: 18, color: 'var(--text-1)' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>置信度</span>}
                  value={data.confidence}
                  valueStyle={{ fontSize: 18, color: 'var(--text-3)' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <FundOutlined style={{ color: 'var(--accent)' }} />
                <span>SHAP 特征贡献分解</span>
                <Tooltip title="SHAP 值表示每个特征对最终预测概率的贡献程度">
                  <ExclamationCircleOutlined style={{ color: 'var(--text-3)', fontSize: 14, cursor: 'help' }} />
                </Tooltip>
              </div>
            }
            bodyStyle={{ padding: '12px 24px' }}
          >
            {data.shap_features.map((f: any, i: number) => {
              const barColor = f.shap_value > 0.05 ? '#ef4444' : f.shap_value > 0.02 ? '#f59e0b' : '#4f8ff7';
              const barWidth = Math.max(4, Math.round((f.shap_value / prob) * 100));
              return (
                <div key={i} className="shap-row">
                  <div style={{ width: 130, textAlign: 'right', paddingRight: 16, fontSize: 13, fontWeight: 500, color: 'var(--text-2)' }}>
                    {f.feature_name}
                  </div>
                  <Tooltip title={f.description} placement="top">
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(148,163,184,0.08)', overflow: 'hidden' }}>
                        <div style={{
                          height: '100%', width: `${barWidth}%`, borderRadius: 5,
                          background: `linear-gradient(90deg, ${barColor}66, ${barColor})`,
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                      <span className="text-mono" style={{ color: barColor, minWidth: 56, textAlign: 'right', fontSize: 13, fontWeight: 600 }}>
                        +{(f.shap_value * 100).toFixed(1)}%
                      </span>
                    </div>
                  </Tooltip>
                  <div className="text-mono" style={{ width: 90, paddingLeft: 12, fontSize: 12, color: 'var(--text-3)', textAlign: 'right' }}>
                    {f.feature_value}
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      <Tabs
        className="detail-tabs"
        defaultActiveKey="risk"
        type="card"
        items={[
          {
            key: 'risk',
            label: <><WarningOutlined /> 风险因素</>,
            children: <RiskFactorsPanel factors={data.risk_factors} />,
          },
          {
            key: 'financial',
            label: <><PieChartOutlined /> 财务指标</>,
            children: <FinancialPanel financial={financial?.financial} />,
          },
          {
            key: 'graph',
            label: <><DotChartOutlined /> 关联图谱</>,
            children: <GraphPanel graph={graph} />,
          },
          {
            key: 'cases',
            label: <><FileTextOutlined /> 相似案例</>,
            children: <SimilarCasesPanel cases={data.similar_cases} />,
          },
          {
            key: 'trace',
            label: <><NodeIndexOutlined /> Agent 推理链路</>,
            children: <AgentTracePanel trace={data.agent_trace} stats={{ time: data.analysis_time_ms, calls: data.llm_calls, tokens: data.total_tokens }} />,
          },
          {
            key: 'report',
            label: <><FileTextOutlined /> 完整报告</>,
            children: (
              <Card>
                <div className="markdown-body" style={{ maxHeight: 650, overflow: 'auto', padding: '0 8px' }}>
                  <ReactMarkdown>{data.report_markdown}</ReactMarkdown>
                </div>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}

function RiskFactorsPanel({ factors }: { factors: any[] }) {
  if (!factors?.length) return <Empty description="无风险因素" />;
  return (
    <Collapse
      defaultActiveKey={factors.map((_: any, i: number) => String(i))}
      style={{ background: 'transparent' }}
      items={factors.map((f: any, i: number) => ({
        key: String(i),
        label: (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <Tag color={severityColor[f.severity]} style={{ borderRadius: 4, fontWeight: 600 }}>
              {f.severity}风险
            </Tag>
            <Tag color="blue" style={{ borderRadius: 4 }}>{f.category}</Tag>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-1)' }}>{f.subcategory}</span>
            <span style={{ fontSize: 12, color: 'var(--text-3)', marginLeft: 'auto' }}>
              置信度 {(f.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ),
        children: (
          <div style={{ padding: '4px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text-1)', marginBottom: 12 }}>
              {f.description}
            </p>
            <Card size="small" className="evidence-card" bodyStyle={{ padding: '12px 16px' }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>原文证据</span>
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 13, lineHeight: 1.8, fontStyle: 'italic', color: 'var(--text-1)' }}>"{f.evidence_quote}"</span>
              </div>
            </Card>
            <div style={{ marginTop: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
                <FileTextOutlined style={{ marginRight: 4 }} />
                来源：{f.evidence_source}
              </span>
            </div>
          </div>
        ),
      }))}
    />
  );
}

function FinancialPanel({ financial }: { financial: any }) {
  if (!financial) return <Empty description="财务数据不可用" />;
  const groups = [
    {
      title: '盈利能力', icon: <RiseOutlined style={{ color: '#4f8ff7' }} />,
      items: [
        { label: 'ROE', value: `${financial.roe}%`, warn: financial.roe < 5 },
        { label: 'ROA', value: `${financial.roa}%`, warn: financial.roa < 3 },
        { label: '毛利率', value: `${financial.gross_margin}%`, warn: financial.gross_margin < 10 },
        { label: '净利率', value: `${financial.net_margin}%`, warn: financial.net_margin < 0 },
      ],
    },
    {
      title: '偿债能力', icon: <SafetyCertificateOutlined style={{ color: '#10b981' }} />,
      items: [
        { label: '资产负债率', value: `${financial.debt_ratio}%`, warn: financial.debt_ratio > 65 },
        { label: '流动比率', value: financial.current_ratio, warn: financial.current_ratio < 1 },
      ],
    },
    {
      title: '营运能力', icon: <FundOutlined style={{ color: '#f59e0b' }} />,
      items: [
        { label: '应收周转率', value: financial.receivable_turnover, warn: financial.receivable_turnover < 3 },
        { label: '存货周转率', value: financial.inventory_turnover, warn: financial.inventory_turnover < 3 },
      ],
    },
    {
      title: '现金流与增长', icon: <ArrowLeftOutlined style={{ color: '#06b6d4', transform: 'rotate(-90deg)' }} />,
      items: [
        { label: '经营现金流/净利润', value: financial.ocf_to_profit, warn: financial.ocf_to_profit < 0.3 },
        { label: '营收增速', value: `${financial.revenue_growth}%`, warn: false },
        { label: '净利润增速', value: `${financial.profit_growth}%`, warn: financial.profit_growth < -30 },
        { label: '应收增速', value: `${financial.receivable_growth}%`, warn: financial.receivable_growth > 60 },
      ],
    },
    {
      title: '异常检测指标', icon: <WarningOutlined style={{ color: '#ef4444' }} />,
      items: [
        { label: 'Beneish M-Score', value: financial.beneish_m_score, warn: financial.beneish_m_score > -1.78 },
        { label: 'Altman Z-Score', value: financial.altman_z_score, warn: financial.altman_z_score < 1.8 },
        { label: '大股东质押比例', value: `${financial.pledge_ratio}%`, warn: financial.pledge_ratio > 50 },
        { label: '高管变动次数', value: financial.exec_turnover_count, warn: financial.exec_turnover_count > 2 },
      ],
    },
  ];

  return (
    <Row gutter={[16, 16]}>
      {groups.map((g, i) => (
        <Col key={i} xs={24} sm={12}>
          <Card
            title={<Space>{g.icon}<span>{g.title}</span></Space>}
            size="small"
            bodyStyle={{ padding: 0 }}
          >
            <Descriptions size="small" column={1} bordered>
              {g.items.map((it) => (
                <Descriptions.Item key={it.label} label={it.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 600, color: it.warn ? '#f87171' : 'var(--text-1)' }}>
                      {it.value}
                    </span>
                    {it.warn && (
                      <Tag color="red" style={{ fontSize: 11, fontWeight: 500, borderRadius: 4 }}>
                        异常
                      </Tag>
                    )}
                  </div>
                </Descriptions.Item>
              ))}
            </Descriptions>
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function GraphPanel({ graph }: { graph: any }) {
  if (!graph?.egonet?.nodes?.length) return <Empty description="无关联图谱数据" />;

  const { nodes, links } = graph.egonet;
  const metrics = graph.metrics || {};

  const W = 700;
  const H = 460;
  const center = { x: W / 2, y: H / 2 };
  const target = nodes.find((n: any) => n.is_target);
  const others = nodes.filter((n: any) => !n.is_target);
  const layouted = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {};
    if (target) pos[target.id] = { x: center.x, y: center.y };
    const radius = 180;
    others.forEach((n: any, i: number) => {
      const angle = (i / Math.max(1, others.length)) * 2 * Math.PI;
      pos[n.id] = {
        x: center.x + radius * Math.cos(angle),
        y: center.y + radius * Math.sin(angle),
      };
    });
    return pos;
  }, [graph]);

  const colorByType: Record<string, string> = {
    company: '#4f8ff7',
    controller: '#8b5cf6',
    auditor: '#06b6d4',
  };
  const relColor: Record<string, string> = {
    same_controller: '#8b5cf6',
    related_transaction: '#f59e0b',
    supplier: '#10b981',
    customer: '#10b981',
    same_auditor: '#06b6d4',
    subsidiary: '#4f8ff7',
  };

  const legendItems = [
    { color: '#4f8ff7', label: '公司' },
    { color: '#8b5cf6', label: '实控人' },
    { color: '#06b6d4', label: '审计机构' },
    { color: '#ef4444', label: '已被问询' },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title={<Space><DotChartOutlined style={{ color: 'var(--accent)' }} />一度关联网络（Egonet）</Space>}
          bodyStyle={{ padding: 16 }}
        >
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="graph-svg">
            <defs>
              <filter id="shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="2" floodOpacity="0.25" />
              </filter>
            </defs>
            {links.map((l: any, i: number) => {
              const s = layouted[l.source];
              const t = layouted[l.target];
              if (!s || !t) return null;
              return (
                <line
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={relColor[l.relation] || 'rgba(148,163,184,0.15)'}
                  strokeOpacity={0.5}
                  strokeWidth={1 + (l.weight || 0.3) * 1.5}
                  strokeDasharray={l.relation === 'same_auditor' ? '4,3' : undefined}
                />
              );
            })}
            {nodes.map((n: any) => {
              const p = layouted[n.id];
              if (!p) return null;
              const isInq = n.is_inquired;
              const isTarget = n.is_target;
              const r = isTarget ? 24 : (n.category === 'company' ? 15 : 11);
              const fill = isInq ? '#ef4444' : colorByType[n.category] || '#64748b';
              return (
                <g key={n.id} className="graph-node" transform={`translate(${p.x},${p.y})`}>
                  {isTarget && <circle r={r + 4} fill="none" stroke={fill} strokeWidth={2} strokeOpacity={0.2} />}
                  <circle
                    r={r} fill={fill}
                    stroke="rgba(10,15,30,0.6)" strokeWidth={2}
                    filter="url(#shadow)"
                  />
                  {isTarget && (
                    <text textAnchor="middle" dy={4} fontSize={10} fill="#fff" fontWeight={700}>
                      Target
                    </text>
                  )}
                  <text textAnchor="middle" dy={-r - 6} fontSize={11} fill="#94a3b8" fontWeight={500}>
                    {n.name?.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 12, display: 'flex', gap: 20, justifyContent: 'center' }}>
            {legendItems.map((item) => (
              <Space key={item.label} size={4}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  background: item.color, borderRadius: '50%',
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{item.label}</span>
              </Space>
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card
          title={<Space><FundOutlined style={{ color: '#f59e0b' }} />图谱风险指标</Space>}
          size="small"
        >
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="PageRank">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{(metrics.pagerank ?? 0).toFixed(4)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="度中心性">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{(metrics.degree_centrality ?? 0).toFixed(4)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="一度被问询邻居">
              <Tag color="red">{metrics.related_inquired_count_1deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="二度被问询邻居">
              <Tag color="orange">{metrics.related_inquired_count_2deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="同实控人被问询比">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{((metrics.same_controller_inquired_ratio ?? 0) * 100).toFixed(1)}%</span>
            </Descriptions.Item>
            <Descriptions.Item label="供应商平均风险">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{(metrics.supplier_avg_risk ?? 0).toFixed(3)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="客户平均风险">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{(metrics.customer_avg_risk ?? 0).toFixed(3)}</span>
            </Descriptions.Item>
            <Descriptions.Item label="同审计机构被问询比">
              <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{((metrics.same_auditor_inquired_ratio ?? 0) * 100).toFixed(1)}%</span>
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );
}

function SimilarCasesPanel({ cases }: { cases: any[] }) {
  const columns = [
    {
      title: '排名', key: 'rank', width: 60,
      render: (_: any, __: any, i: number) => (
        <Badge count={i + 1} style={{
          backgroundColor: i < 3 ? '#4f8ff7' : 'rgba(148,163,184,0.15)',
          color: i < 3 ? '#fff' : 'var(--text-2)',
          fontWeight: 600,
        }} />
      ),
    },
    { title: '公司代码', dataIndex: 'company_code', width: 100, render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{v}</span> },
    { title: '公司名称', dataIndex: 'company_name', width: 120 },
    { title: '问询日期', dataIndex: 'inquiry_date', width: 110 },
    {
      title: '问询类型', dataIndex: 'inquiry_type', width: 110,
      render: (v: string) => <Tag color="blue" style={{ borderRadius: 4 }}>{v}</Tag>,
    },
    {
      title: '相似度', dataIndex: 'similarity', width: 120,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.8 ? '#f87171' : v >= 0.7 ? '#fbbf24' : '#60a5fa';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct} size="small" strokeColor={color}
              trailColor="rgba(148,163,184,0.08)"
              style={{ width: 60, margin: 0 }} showInfo={false}
            />
            <span className="text-mono" style={{ fontWeight: 600, color, fontSize: 13 }}>{pct}%</span>
          </div>
        );
      },
    },
    { title: '匹配维度', dataIndex: 'match_dimensions', width: 160 },
    { title: '关键差异', dataIndex: 'key_difference', width: 180 },
  ];

  return <Table columns={columns} dataSource={cases} rowKey="company_code" pagination={false} size="middle" />;
}

function AgentTracePanel({ trace, stats }: { trace: any[]; stats: { time: number; calls: number; tokens: number } }) {
  const agentIcons: Record<string, any> = {
    'planner': <ApartmentOutlined style={{ color: '#4f8ff7' }} />,
    'Master Planner': <ApartmentOutlined style={{ color: '#4f8ff7' }} />,
    'financial_agent': <FundOutlined style={{ color: '#f59e0b' }} />,
    '财务异常检测Agent': <FundOutlined style={{ color: '#f59e0b' }} />,
    'announcement_agent': <FileTextOutlined style={{ color: '#10b981' }} />,
    '公告研读Agent': <FileTextOutlined style={{ color: '#10b981' }} />,
    'graph_agent': <DotChartOutlined style={{ color: '#8b5cf6' }} />,
    'predictor': <ThunderboltOutlined style={{ color: '#ef4444' }} />,
    '概率预测模型': <ThunderboltOutlined style={{ color: '#ef4444' }} />,
    'case_agent': <FileTextOutlined style={{ color: '#8b5cf6' }} />,
    'replan': <ApartmentOutlined style={{ color: '#4f8ff7' }} />,
    'attribution_agent': <CheckCircleOutlined style={{ color: '#06b6d4' }} />,
  };

  const agentColors: Record<string, string> = {
    'planner': '#4f8ff7', 'Master Planner': '#4f8ff7',
    'financial_agent': '#f59e0b', '财务异常检测Agent': '#f59e0b',
    'announcement_agent': '#10b981', '公告研读Agent': '#10b981',
    'graph_agent': '#8b5cf6', 'predictor': '#ef4444', '概率预测模型': '#ef4444',
    'case_agent': '#8b5cf6', 'replan': '#4f8ff7', 'attribution_agent': '#06b6d4',
  };

  return (
    <div>
      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-blue" bodyStyle={{ padding: '16px 20px' }}>
            <span className="stat-icon-bg"><ClockCircleOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>总耗时</span>}
              value={stats.time}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 22, color: '#60a5fa' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-purple" bodyStyle={{ padding: '16px 20px' }}>
            <span className="stat-icon-bg"><ThunderboltOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>LLM 调用次数</span>}
              value={stats.calls}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 22, color: '#a78bfa' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-cyan" bodyStyle={{ padding: '16px 20px' }}>
            <span className="stat-icon-bg"><NodeIndexOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>总 Token 数</span>}
              value={stats.tokens}
              prefix={<NodeIndexOutlined />}
              valueStyle={{ fontSize: 22, color: '#22d3ee' }}
            />
          </Card>
        </Col>
      </Row>

      <Timeline
        className="trace-timeline"
        items={trace.map((step: any) => ({
          color: agentColors[step.agent_name] || '#4f8ff7',
          dot: agentIcons[step.agent_name] || <ClockCircleOutlined />,
          children: (
            <Card
              size="small"
              className="trace-card"
              style={{ borderLeftColor: agentColors[step.agent_name] || '#4f8ff7' }}
              bodyStyle={{ padding: '12px 16px' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Space size={8}>
                  <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>{step.agent_name}</Tag>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-1)' }}>{step.action}</span>
                </Space>
                <Space size={12}>
                  <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                    <ClockCircleOutlined style={{ marginRight: 3 }} />{step.duration_ms}ms
                  </span>
                  {step.tokens_used > 0 && (
                    <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>
                      <ThunderboltOutlined style={{ marginRight: 3 }} />{step.tokens_used} tokens
                    </span>
                  )}
                </Space>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
                <div style={{ marginBottom: 2 }}><span style={{ color: 'var(--text-3)' }}>输入：</span>{step.input_summary}</div>
                <div><span style={{ color: 'var(--text-3)' }}>输出：</span>{step.output_summary}</div>
              </div>
              {step.skills_called?.length > 0 && (
                <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {step.skills_called.map((s: string) => (
                    <Tag key={s} color="purple" style={{ fontSize: 11, borderRadius: 4 }}>{s}</Tag>
                  ))}
                </div>
              )}
            </Card>
          ),
        }))}
      />
    </div>
  );
}
