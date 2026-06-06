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
  ExclamationCircleOutlined, RiseOutlined, DownloadOutlined,
  DashboardOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { scanSingle, getFinancial, getGraph, getReportDownloadUrl } from '../api/client';

const riskColorMap: Record<string, string> = {
  '高风险': 'var(--danger)',
  '中风险': 'var(--warning)',
  '低风险': 'var(--success)',
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
      <div style={{ textAlign: 'center', padding: 140 }}>
        <Spin size="large" />
        <div style={{ marginTop: 24 }}>
          <span style={{ fontSize: 16, color: 'var(--text-normal)' }}>
            <ThunderboltOutlined style={{ marginRight: 8, color: 'var(--accent)' }} />
            Agent 智能分析中...
          </span>
        </div>
        <div style={{ marginTop: 10 }}>
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            正在调度多智能体协作完成风险评估
          </span>
        </div>
      </div>
    );
  }

  if (!data) return <Alert message="未找到该公司" type="error" showIcon />;

  const prob = data.inquiry_probability;
  const riskColor = prob >= 0.6 ? 'var(--danger)' : prob >= 0.3 ? 'var(--warning)' : 'var(--success)';
  const riskHex = prob >= 0.6 ? '#ff4757' : prob >= 0.3 ? '#ffbe0b' : '#00ff88';
  const pct = Math.round(prob * 100);

  return (
    <div className="page-container fade-in">
      <Button
        icon={<ArrowLeftOutlined />}
        onClick={() => navigate('/')}
        type="text"
        style={{ marginBottom: 22, color: 'var(--text-dim)', fontSize: 14 }}
        onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
        onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-dim)')}
      >
        返回排行榜
      </Button>

      <Row gutter={[20, 20]} style={{ marginBottom: 24 }}>
        {/* ── Company Info Card ── */}
        <Col xs={24} lg={8}>
          <Card
            style={{
              background: 'linear-gradient(135deg, rgba(0, 212, 255, 0.04), rgba(139, 92, 246, 0.03))',
              border: '1px solid rgba(0, 212, 255, 0.15)',
            }}
            styles={{ body: { padding: '28px 24px', textAlign: 'center' } }}
          >
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--text-bright)', marginBottom: 4 }}>
                {data.company.name}
              </div>
              <Space size={8}>
                <span style={{ fontSize: 14, color: 'var(--text-dim)' }}>{data.company.code}</span>
                <span style={{ color: 'var(--text-faint)' }}>·</span>
                <span className="industry-tag">{data.company.industry}</span>
              </Space>
            </div>

            <div className="gauge-container" style={{ margin: '28px 0 20px' }}>
              <Progress
                type="dashboard"
                percent={pct}
                strokeColor={{
                  '0%': riskHex + '88',
                  '100%': riskHex,
                }}
                trailColor="rgba(255, 255, 255, 0.03)"
                format={() => (
                  <div>
                    <div style={{ fontSize: 40, fontWeight: 700, color: riskHex, lineHeight: 1 }}>
                      {pct}
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-dim)', marginTop: 4 }}>
                      问询概率(%)
                    </div>
                  </div>
                )}
                size={180}
                strokeWidth={10}
              />
            </div>

            <span className={`risk-badge risk-badge--${riskBadgeMap[data.risk_level] || 'low'}`}>
              {data.risk_level}
            </span>

            <Divider style={{ margin: '18px 0 14px', borderColor: 'var(--border-dim)' }} />

            <Row gutter={16}>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>预测窗口</span>}
                  value={windowDays}
                  suffix="天"
                  valueStyle={{ fontSize: 18, color: 'var(--text-bright)' }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>置信度</span>}
                  value={data.confidence}
                  valueStyle={{ fontSize: 18, color: 'var(--text-dim)' }}
                />
              </Col>
            </Row>
          </Card>
        </Col>

        {/* ── SHAP Features ── */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <DashboardOutlined style={{ color: 'var(--accent)' }} />
                <span>SHAP 特征贡献分解</span>
                <Tooltip title="SHAP 值表示每个特征对最终预测概率的贡献程度">
                  <ExclamationCircleOutlined style={{ color: 'var(--text-dim)', fontSize: 14, cursor: 'help' }} />
                </Tooltip>
              </Space>
            }
            styles={{ body: { padding: '12px 24px' } }}
          >
            {data.shap_features.map((f: any, i: number) => {
              const barColor = f.shap_value > 0.05 ? '#ff4757' : f.shap_value > 0.02 ? '#ffbe0b' : '#00d4ff';
              const barWidth = Math.max(4, Math.round((f.shap_value / prob) * 100));
              return (
                <div key={i} className="shap-row">
                  <div style={{
                    width: 140, textAlign: 'right', paddingRight: 18,
                    fontSize: 13, fontWeight: 500, color: 'var(--text-normal)',
                  }}>
                    {f.feature_name}
                  </div>
                  <Tooltip title={f.description} placement="top">
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{
                        flex: 1, height: 12, borderRadius: 6,
                        background: 'rgba(255, 255, 255, 0.03)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${barWidth}%`, borderRadius: 6,
                          background: `linear-gradient(90deg, ${barColor}44, ${barColor})`,
                          transition: 'width 1s var(--ease-out)',
                          boxShadow: `0 0 8px ${barColor}44`,
                        }} />
                      </div>
                      <span className="text-mono" style={{
                        color: barColor, minWidth: 60, textAlign: 'right',
                        fontSize: 13, fontWeight: 600,
                      }}>
                        +{(f.shap_value * 100).toFixed(1)}%
                      </span>
                    </div>
                  </Tooltip>
                  <div className="text-mono" style={{
                    width: 100, paddingLeft: 14, fontSize: 12,
                    color: 'var(--text-faint)', textAlign: 'right',
                  }}>
                    {f.feature_value}
                  </div>
                </div>
              );
            })}
          </Card>
        </Col>
      </Row>

      {/* ── Tabs ── */}
      <Tabs
        defaultActiveKey="risk"
        type="card"
        size="large"
        style={{ marginTop: 4 }}
        items={[
          {
            key: 'risk',
            label: <Space size={4}><WarningOutlined />风险因素</Space>,
            children: <RiskFactorsPanel factors={data.risk_factors} />,
          },
          {
            key: 'financial',
            label: <Space size={4}><PieChartOutlined />财务指标</Space>,
            children: <FinancialPanel financial={financial?.financial} />,
          },
          {
            key: 'graph',
            label: <Space size={4}><DotChartOutlined />关联图谱</Space>,
            children: <GraphPanel graph={graph} />,
          },
          {
            key: 'cases',
            label: <Space size={4}><FileTextOutlined />相似案例</Space>,
            children: <SimilarCasesPanel cases={data.similar_cases} />,
          },
          {
            key: 'trace',
            label: <Space size={4}><NodeIndexOutlined />Agent 推理链路</Space>,
            children: (
              <AgentTracePanel
                trace={data.agent_trace}
                stats={{
                  time: data.analysis_time_ms,
                  calls: data.llm_calls,
                  tokens: data.total_tokens,
                }}
              />
            ),
          },
          {
            key: 'report',
            label: <Space size={4}><FileTextOutlined />完整报告</Space>,
            children: (
              <Card
                extra={
                  <Button
                    type="primary"
                    className="btn-success"
                    icon={<DownloadOutlined />}
                    href={getReportDownloadUrl(code!, windowDays)}
                    target="_blank"
                  >
                    下载报告
                  </Button>
                }
              >
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Tag color={severityColor[f.severity]} style={{ borderRadius: 4, fontWeight: 600 }}>
              {f.severity}风险
            </Tag>
            <Tag color="cyan" style={{
              borderRadius: 4,
              background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.15)',
              color: '#00d4ff',
            }}>
              {f.category}
            </Tag>
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-bright)' }}>
              {f.subcategory}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-dim)', marginLeft: 'auto' }}>
              置信度 {(f.confidence * 100).toFixed(0)}%
            </span>
          </div>
        ),
        children: (
          <div style={{ padding: '4px 0' }}>
            <p style={{ fontSize: 14, color: 'var(--text-normal)', marginBottom: 14, lineHeight: 1.7 }}>
              {f.description}
            </p>
            <Card size="small" className="evidence-card" styles={{ body: { padding: '14px 18px' } }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>原文证据</span>
              <div style={{ marginTop: 6 }}>
                <span style={{
                  fontSize: 13, lineHeight: 1.8, fontStyle: 'italic',
                  color: 'var(--text-normal)',
                }}>
                  "{f.evidence_quote}"
                </span>
              </div>
            </Card>
            <div style={{ marginTop: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                <FileTextOutlined style={{ marginRight: 6 }} />
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
      title: '盈利能力', icon: <RiseOutlined style={{ color: '#00d4ff' }} />,
      items: [
        { label: 'ROE', value: `${financial.roe}%`, warn: financial.roe < 5 },
        { label: 'ROA', value: `${financial.roa}%`, warn: financial.roa < 3 },
        { label: '毛利率', value: `${financial.gross_margin}%`, warn: financial.gross_margin < 10 },
        { label: '净利率', value: `${financial.net_margin}%`, warn: financial.net_margin < 0 },
      ],
    },
    {
      title: '偿债能力', icon: <SafetyCertificateOutlined style={{ color: '#00ff88' }} />,
      items: [
        { label: '资产负债率', value: `${financial.debt_ratio}%`, warn: financial.debt_ratio > 65 },
        { label: '流动比率', value: financial.current_ratio, warn: financial.current_ratio < 1 },
      ],
    },
    {
      title: '营运能力', icon: <FundOutlined style={{ color: '#ffbe0b' }} />,
      items: [
        { label: '应收周转率', value: financial.receivable_turnover, warn: financial.receivable_turnover < 3 },
        { label: '存货周转率', value: financial.inventory_turnover, warn: financial.inventory_turnover < 3 },
      ],
    },
    {
      title: '现金流与增长', icon: <RiseOutlined style={{ color: '#22d3ee' }} />,
      items: [
        { label: '经营现金流/净利润', value: financial.ocf_to_profit, warn: financial.ocf_to_profit < 0.3 },
        { label: '营收增速', value: `${financial.revenue_growth}%`, warn: false },
        { label: '净利润增速', value: `${financial.profit_growth}%`, warn: financial.profit_growth < -30 },
        { label: '应收增速', value: `${financial.receivable_growth}%`, warn: financial.receivable_growth > 60 },
      ],
    },
    {
      title: '异常检测指标', icon: <WarningOutlined style={{ color: '#ff4757' }} />,
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
            title={<Space size={6}>{g.icon}<span style={{ color: 'var(--text-bright)' }}>{g.title}</span></Space>}
            size="small"
            styles={{ body: { padding: 0 } }}
          >
            <Descriptions size="small" column={1} bordered>
              {g.items.map((it) => (
                <Descriptions.Item key={it.label} label={it.label}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontWeight: 600,
                      color: it.warn ? '#ff4757' : 'var(--text-bright)',
                    }}>
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
    company: '#00d4ff',
    controller: '#a855f7',
    auditor: '#22d3ee',
  };
  const relColor: Record<string, string> = {
    same_controller: '#a855f7',
    related_transaction: '#ffbe0b',
    supplier: '#00ff88',
    customer: '#00ff88',
    same_auditor: '#22d3ee',
    subsidiary: '#00d4ff',
  };

  const legendItems = [
    { color: '#00d4ff', label: '公司' },
    { color: '#a855f7', label: '实控人' },
    { color: '#22d3ee', label: '审计机构' },
    { color: '#ff4757', label: '已被问询' },
  ];

  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={16}>
        <Card
          title={<Space><DotChartOutlined style={{ color: 'var(--accent)' }} />一度关联网络（Egonet）</Space>}
          styles={{ body: { padding: 16 } }}
        >
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} className="graph-svg">
            <defs>
              <filter id="shadow">
                <feDropShadow dx="0" dy="1" stdDeviation="3" floodColor="#000" floodOpacity="0.4" />
              </filter>
              <filter id="glow-target">
                <feDropShadow dx="0" dy="0" stdDeviation="4" floodColor="#00d4ff" floodOpacity="0.4" />
              </filter>
            </defs>
            {/* Edges */}
            {links.map((l: any, i: number) => {
              const s = layouted[l.source];
              const t = layouted[l.target];
              if (!s || !t) return null;
              return (
                <line
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={relColor[l.relation] || 'rgba(0, 212, 255, 0.12)'}
                  strokeOpacity={0.4}
                  strokeWidth={1 + (l.weight || 0.3) * 1.5}
                  strokeDasharray={l.relation === 'same_auditor' ? '4,3' : undefined}
                />
              );
            })}
            {/* Nodes */}
            {nodes.map((n: any) => {
              const p = layouted[n.id];
              if (!p) return null;
              const isInq = n.is_inquired;
              const isTarget = n.is_target;
              const r = isTarget ? 26 : (n.category === 'company' ? 16 : 12);
              const fill = isInq ? '#ff4757' : colorByType[n.category] || '#5a7fa0';
              return (
                <g key={n.id} className="graph-node" transform={`translate(${p.x},${p.y})`}>
                  {isTarget && (
                    <circle r={r + 6} fill="none" stroke={fill} strokeWidth={2} strokeOpacity={0.2} />
                  )}
                  <circle r={r} fill={fill} stroke="#020617" strokeWidth={2}
                    filter={isTarget ? 'url(#glow-target)' : 'url(#shadow)'} />
                  {isTarget && (
                    <text textAnchor="middle" dy={4} fontSize={10} fill="#020617" fontWeight={700}>
                      {n.name?.slice(0, 4)}
                    </text>
                  )}
                  <text textAnchor="middle" dy={-r - 8} fontSize={11} fill="var(--text-dim)" fontWeight={500}>
                    {n.name?.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 14, display: 'flex', gap: 22, justifyContent: 'center' }}>
            {legendItems.map((item) => (
              <Space key={item.label} size={5}>
                <span style={{
                  display: 'inline-block', width: 10, height: 10,
                  background: item.color, borderRadius: '50%',
                  boxShadow: `0 0 6px ${item.color}`,
                }} />
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{item.label}</span>
              </Space>
            ))}
          </div>
        </Card>
      </Col>
      <Col xs={24} lg={8}>
        <Card
          title={<Space><FundOutlined style={{ color: '#ffbe0b' }} />图谱风险指标</Space>}
          size="small"
        >
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="PageRank">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {(metrics.pagerank ?? 0).toFixed(4)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="度中心性">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {(metrics.degree_centrality ?? 0).toFixed(4)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="一度被问询邻居">
              <Tag color="red">{metrics.related_inquired_count_1deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="二度被问询邻居">
              <Tag color="orange">{metrics.related_inquired_count_2deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="同实控人被问询比">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {((metrics.same_controller_inquired_ratio ?? 0) * 100).toFixed(1)}%
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="供应商平均风险">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {(metrics.supplier_avg_risk ?? 0).toFixed(3)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="客户平均风险">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {(metrics.customer_avg_risk ?? 0).toFixed(3)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="同审计机构被问询比">
              <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>
                {((metrics.same_auditor_inquired_ratio ?? 0) * 100).toFixed(1)}%
              </span>
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
      title: '排名', key: 'rank', width: 65,
      render: (_: any, __: any, i: number) => (
        <Badge count={i + 1} style={{
          backgroundColor: i < 3 ? '#00d4ff' : 'rgba(0, 212, 255, 0.10)',
          color: i < 3 ? '#020617' : 'var(--text-dim)',
          fontWeight: 600,
          boxShadow: i < 3 ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
        }} />
      ),
    },
    {
      title: '公司代码', dataIndex: 'company_code', width: 105,
      render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--accent)' }}>{v}</span>,
    },
    { title: '公司名称', dataIndex: 'company_name', width: 130 },
    { title: '问询日期', dataIndex: 'inquiry_date', width: 115 },
    {
      title: '问询类型', dataIndex: 'inquiry_type', width: 115,
      render: (v: string) => (
        <Tag color="cyan" style={{
          borderRadius: 4,
          background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.15)',
          color: '#00d4ff',
        }}>
          {v}
        </Tag>
      ),
    },
    {
      title: '相似度', dataIndex: 'similarity', width: 125,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.8 ? '#ff4757' : v >= 0.7 ? '#ffbe0b' : '#00d4ff';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct} size="small" strokeColor={color}
              trailColor="rgba(255,255,255,0.04)"
              style={{ width: 60, margin: 0 }} showInfo={false}
            />
            <span className="text-mono" style={{ fontWeight: 600, color, fontSize: 13 }}>
              {pct}%
            </span>
          </div>
        );
      },
    },
    { title: '匹配维度', dataIndex: 'match_dimensions', width: 170 },
    { title: '关键差异', dataIndex: 'key_difference', width: 190 },
  ];

  return (
    <Table
      columns={columns} dataSource={cases}
      rowKey="company_code" pagination={false} size="middle"
    />
  );
}

function AgentTracePanel({
  trace,
  stats,
}: {
  trace: any[];
  stats: { time: number; calls: number; tokens: number };
}) {
  const agentIcons: Record<string, any> = {
    'planner': <ApartmentOutlined style={{ color: '#00d4ff' }} />,
    'Master Planner': <ApartmentOutlined style={{ color: '#00d4ff' }} />,
    'financial_agent': <FundOutlined style={{ color: '#ffbe0b' }} />,
    '财务异常检测Agent': <FundOutlined style={{ color: '#ffbe0b' }} />,
    'announcement_agent': <FileTextOutlined style={{ color: '#00ff88' }} />,
    '公告研读Agent': <FileTextOutlined style={{ color: '#00ff88' }} />,
    'graph_agent': <DotChartOutlined style={{ color: '#a855f7' }} />,
    'predictor': <ThunderboltOutlined style={{ color: '#ff4757' }} />,
    '概率预测模型': <ThunderboltOutlined style={{ color: '#ff4757' }} />,
    'case_agent': <FileTextOutlined style={{ color: '#a855f7' }} />,
    'replan': <ApartmentOutlined style={{ color: '#00d4ff' }} />,
    'attribution_agent': <CheckCircleOutlined style={{ color: '#22d3ee' }} />,
  };

  const agentColors: Record<string, string> = {
    'planner': '#00d4ff', 'Master Planner': '#00d4ff',
    'financial_agent': '#ffbe0b', '财务异常检测Agent': '#ffbe0b',
    'announcement_agent': '#00ff88', '公告研读Agent': '#00ff88',
    'graph_agent': '#a855f7', 'predictor': '#ff4757', '概率预测模型': '#ff4757',
    'case_agent': '#a855f7', 'replan': '#00d4ff', 'attribution_agent': '#22d3ee',
  };

  return (
    <div>
      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 22 }}>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-blue" styles={{ body: { padding: '18px 22px' } }}>
            <span className="stat-icon-bg"><ClockCircleOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>总耗时</span>}
              value={stats.time}
              suffix="ms"
              prefix={<ClockCircleOutlined />}
              valueStyle={{ fontSize: 22, color: '#00d4ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-purple" styles={{ body: { padding: '18px 22px' } }}>
            <span className="stat-icon-bg"><ThunderboltOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>LLM 调用次数</span>}
              value={stats.calls}
              prefix={<ThunderboltOutlined />}
              valueStyle={{ fontSize: 22, color: '#a855f7' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card size="small" className="stat-card stat-cyan" styles={{ body: { padding: '18px 22px' } }}>
            <span className="stat-icon-bg"><NodeIndexOutlined /></span>
            <Statistic
              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>总 Token 数</span>}
              value={stats.tokens}
              prefix={<NodeIndexOutlined />}
              valueStyle={{ fontSize: 22, color: '#22d3ee' }}
            />
          </Card>
        </Col>
      </Row>

      <Timeline
        items={trace.map((step: any) => ({
          color: agentColors[step.agent_name] || '#00d4ff',
          dot: agentIcons[step.agent_name] || <ClockCircleOutlined />,
          children: (
            <Card
              size="small"
              className="trace-card"
              style={{ borderLeftColor: agentColors[step.agent_name] || '#00d4ff' }}
              styles={{ body: { padding: '14px 18px' } }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Space size={8}>
                  <Tag color="cyan" style={{
                    borderRadius: 4, fontWeight: 600,
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.15)',
                    color: '#00d4ff',
                  }}>
                    {step.agent_name}
                  </Tag>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)' }}>
                    {step.action}
                  </span>
                </Space>
                <Space size={14}>
                  <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                    <ClockCircleOutlined style={{ marginRight: 4 }} />{step.duration_ms}ms
                  </span>
                  {step.tokens_used > 0 && (
                    <span className="text-mono" style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                      <ThunderboltOutlined style={{ marginRight: 4 }} />{step.tokens_used} tokens
                    </span>
                  )}
                </Space>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-normal)', lineHeight: 1.7 }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: 'var(--text-dim)' }}>输入：</span>
                  {step.input_summary}
                </div>
                <div>
                  <span style={{ color: 'var(--text-dim)' }}>输出：</span>
                  {step.output_summary}
                </div>
              </div>
              {step.skills_called?.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
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