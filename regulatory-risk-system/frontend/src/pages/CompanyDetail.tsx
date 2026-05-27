import { useState, useEffect, useMemo } from 'react';
// useMemo is used in GraphPanel for circular layout caching
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Table, Timeline, Progress, Spin, Button,
  Tabs, Statistic, Alert, Typography, Collapse, Space, Tooltip,
  Descriptions, Empty,
} from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined, FileTextOutlined,
  NodeIndexOutlined, ApartmentOutlined, FundOutlined,
  PieChartOutlined, DotChartOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { scanSingle, getFinancial, getGraph } from '../api/client';

const { Title, Text, Paragraph } = Typography;

const riskColorMap: Record<string, string> = {
  '高风险': '#f5222d',
  '中风险': '#fa8c16',
  '低风险': '#52c41a',
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

  if (loading) return <div style={{ textAlign: 'center', padding: 100 }}><Spin size="large" tip="Agent 分析中..." /></div>;
  if (!data) return <Alert message="未找到该公司" type="error" />;

  const prob = data.inquiry_probability;
  const riskColor = riskColorMap[data.risk_level] || '#999';

  return (
    <div>
      <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} style={{ marginBottom: 16 }}>
        返回排行榜
      </Button>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card>
            <div style={{ textAlign: 'center' }}>
              <Title level={4}>{data.company.name}</Title>
              <Text type="secondary">{data.company.code} | {data.company.industry}</Text>
              <div style={{ margin: '20px 0' }}>
                <Progress
                  type="dashboard"
                  percent={Math.round(prob * 100)}
                  strokeColor={riskColor}
                  format={(p) => <span style={{ fontSize: 28, fontWeight: 700, color: riskColor }}>{p}%</span>}
                  size={180}
                />
              </div>
              <Tag color={riskColor} style={{ fontSize: 16, padding: '4px 16px' }}>{data.risk_level}</Tag>
              <div style={{ marginTop: 12 }}>
                <Text type="secondary">预测窗口: {windowDays}天 | 置信度: {data.confidence}</Text>
              </div>
            </div>
          </Card>
        </Col>

        <Col span={16}>
          <Card title={<><FundOutlined /> SHAP 特征贡献分解</>}>
            {data.shap_features.map((f: any, i: number) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ width: 140, textAlign: 'right', paddingRight: 12, fontSize: 13 }}>
                  {f.feature_name}
                </div>
                <Tooltip title={f.description}>
                  <div style={{ flex: 1 }}>
                    <Progress
                      percent={Math.round((f.shap_value / prob) * 100)}
                      strokeColor={f.shap_value > 0.05 ? '#f5222d' : f.shap_value > 0.02 ? '#fa8c16' : '#1677ff'}
                      format={() => `+${(f.shap_value * 100).toFixed(1)}%`}
                      size="small"
                    />
                  </div>
                </Tooltip>
                <div style={{ width: 100, paddingLeft: 12, fontSize: 12, color: '#888' }}>
                  {f.feature_value}
                </div>
              </div>
            ))}
          </Card>
        </Col>
      </Row>

      <Tabs
        defaultActiveKey="risk"
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
                <div className="markdown-body" style={{ maxHeight: 600, overflow: 'auto' }}>
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
      items={factors.map((f: any, i: number) => ({
        key: String(i),
        label: (
          <Space>
            <Tag color={severityColor[f.severity]}>{f.severity}风险</Tag>
            <Tag>{f.category}</Tag>
            <Text strong>{f.subcategory}</Text>
            <Text type="secondary" style={{ fontSize: 12 }}>
              置信度 {(f.confidence * 100).toFixed(0)}%
            </Text>
          </Space>
        ),
        children: (
          <div>
            <Paragraph><Text strong>风险描述: </Text>{f.description}</Paragraph>
            <Card size="small" style={{ background: '#fffbe6', borderColor: '#ffe58f', marginBottom: 12 }}>
              <Text type="secondary">原文证据: </Text>
              <Text italic>"{f.evidence_quote}"</Text>
            </Card>
            <Text type="secondary">证据来源: {f.evidence_source}</Text>
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
      title: '盈利能力',
      items: [
        { label: 'ROE', value: `${financial.roe}%`, warn: financial.roe < 5 },
        { label: 'ROA', value: `${financial.roa}%`, warn: financial.roa < 3 },
        { label: '毛利率', value: `${financial.gross_margin}%`, warn: financial.gross_margin < 10 },
        { label: '净利率', value: `${financial.net_margin}%`, warn: financial.net_margin < 0 },
      ],
    },
    {
      title: '偿债能力',
      items: [
        { label: '资产负债率', value: `${financial.debt_ratio}%`, warn: financial.debt_ratio > 65 },
        { label: '流动比率', value: financial.current_ratio, warn: financial.current_ratio < 1 },
      ],
    },
    {
      title: '营运能力',
      items: [
        { label: '应收周转率', value: financial.receivable_turnover, warn: financial.receivable_turnover < 3 },
        { label: '存货周转率', value: financial.inventory_turnover, warn: financial.inventory_turnover < 3 },
      ],
    },
    {
      title: '现金流与增长',
      items: [
        { label: '经营现金流/净利润', value: financial.ocf_to_profit, warn: financial.ocf_to_profit < 0.3 },
        { label: '营收增速', value: `${financial.revenue_growth}%`, warn: false },
        { label: '净利润增速', value: `${financial.profit_growth}%`, warn: financial.profit_growth < -30 },
        { label: '应收增速', value: `${financial.receivable_growth}%`, warn: financial.receivable_growth > 60 },
      ],
    },
    {
      title: '异常检测指标',
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
        <Col key={i} span={12}>
          <Card title={g.title} size="small">
            <Descriptions size="small" column={1} bordered>
              {g.items.map((it) => (
                <Descriptions.Item key={it.label} label={it.label}>
                  <Text strong style={{ color: it.warn ? '#f5222d' : '#1f1f1f' }}>
                    {it.value}
                  </Text>
                  {it.warn && <Tag color="red" style={{ marginLeft: 8 }}>异常</Tag>}
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

  // Lay out nodes on a circle around the target
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
    company: '#1677ff',
    controller: '#722ed1',
    auditor: '#13c2c2',
  };
  const relColor: Record<string, string> = {
    same_controller: '#722ed1',
    related_transaction: '#fa8c16',
    supplier: '#52c41a',
    customer: '#52c41a',
    same_auditor: '#13c2c2',
    subsidiary: '#1677ff',
  };

  return (
    <Row gutter={16}>
      <Col span={16}>
        <Card title="一度关联网络（Egonet）">
          <svg width={W} height={H} style={{ background: '#fafafa', borderRadius: 4 }}>
            {links.map((l: any, i: number) => {
              const s = layouted[l.source];
              const t = layouted[l.target];
              if (!s || !t) return null;
              return (
                <line
                  key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                  stroke={relColor[l.relation] || '#bbb'}
                  strokeOpacity={0.55}
                  strokeWidth={1 + (l.weight || 0.3) * 1.5}
                />
              );
            })}
            {nodes.map((n: any) => {
              const p = layouted[n.id];
              if (!p) return null;
              const isInq = n.is_inquired;
              const isTarget = n.is_target;
              const r = isTarget ? 22 : (n.category === 'company' ? 14 : 10);
              return (
                <g key={n.id} transform={`translate(${p.x},${p.y})`}>
                  <circle
                    r={r}
                    fill={isInq ? '#f5222d' : colorByType[n.category] || '#999'}
                    stroke={isTarget ? '#000' : '#fff'}
                    strokeWidth={isTarget ? 3 : 1.5}
                  />
                  <text textAnchor="middle" dy={-r - 4} fontSize={11} fill="#333">
                    {n.name?.slice(0, 8)}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ marginTop: 12 }}>
            <Space size="middle">
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#1677ff', borderRadius: 6, marginRight: 4 }}/>公司</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#722ed1', borderRadius: 6, marginRight: 4 }}/>实控人</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#13c2c2', borderRadius: 6, marginRight: 4 }}/>审计机构</span>
              <span><span style={{ display: 'inline-block', width: 12, height: 12, background: '#f5222d', borderRadius: 6, marginRight: 4 }}/>已被问询</span>
            </Space>
          </div>
        </Card>
      </Col>
      <Col span={8}>
        <Card title="图谱风险指标" size="small">
          <Descriptions column={1} size="small" bordered>
            <Descriptions.Item label="PageRank">
              {(metrics.pagerank ?? 0).toFixed(4)}
            </Descriptions.Item>
            <Descriptions.Item label="度中心性">
              {(metrics.degree_centrality ?? 0).toFixed(4)}
            </Descriptions.Item>
            <Descriptions.Item label="一度被问询邻居">
              <Tag color="red">{metrics.related_inquired_count_1deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="二度被问询邻居">
              <Tag color="orange">{metrics.related_inquired_count_2deg ?? 0}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="同实控人被问询比">
              {((metrics.same_controller_inquired_ratio ?? 0) * 100).toFixed(1)}%
            </Descriptions.Item>
            <Descriptions.Item label="供应商平均风险">
              {(metrics.supplier_avg_risk ?? 0).toFixed(3)}
            </Descriptions.Item>
            <Descriptions.Item label="客户平均风险">
              {(metrics.customer_avg_risk ?? 0).toFixed(3)}
            </Descriptions.Item>
            <Descriptions.Item label="同审计机构被问询比">
              {((metrics.same_auditor_inquired_ratio ?? 0) * 100).toFixed(1)}%
            </Descriptions.Item>
          </Descriptions>
        </Card>
      </Col>
    </Row>
  );
}

function SimilarCasesPanel({ cases }: { cases: any[] }) {
  const columns = [
    { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, i: number) => i + 1 },
    { title: '公司代码', dataIndex: 'company_code', width: 100 },
    { title: '公司名称', dataIndex: 'company_name', width: 120 },
    { title: '问询日期', dataIndex: 'inquiry_date', width: 110 },
    { title: '问询类型', dataIndex: 'inquiry_type', width: 110, render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '相似度', dataIndex: 'similarity', width: 100,
      render: (v: number) => (
        <span style={{ color: v >= 0.8 ? '#f5222d' : v >= 0.7 ? '#fa8c16' : '#1677ff', fontWeight: 600 }}>
          {(v * 100).toFixed(0)}%
        </span>
      ),
    },
    { title: '匹配维度', dataIndex: 'match_dimensions', width: 160 },
    { title: '关键差异', dataIndex: 'key_difference', width: 180 },
  ];

  return <Table columns={columns} dataSource={cases} rowKey="company_code" pagination={false} size="middle" />;
}

function AgentTracePanel({ trace, stats }: { trace: any[]; stats: { time: number; calls: number; tokens: number } }) {
  const agentIcons: Record<string, any> = {
    'planner': <ApartmentOutlined style={{ color: '#1677ff' }} />,
    'Master Planner': <ApartmentOutlined style={{ color: '#1677ff' }} />,
    'financial_agent': <FundOutlined style={{ color: '#fa8c16' }} />,
    '财务异常检测Agent': <FundOutlined style={{ color: '#fa8c16' }} />,
    'announcement_agent': <FileTextOutlined style={{ color: '#52c41a' }} />,
    '公告研读Agent': <FileTextOutlined style={{ color: '#52c41a' }} />,
    'graph_agent': <DotChartOutlined style={{ color: '#722ed1' }} />,
    'predictor': <ThunderboltOutlined style={{ color: '#f5222d' }} />,
    '概率预测模型': <ThunderboltOutlined style={{ color: '#f5222d' }} />,
    'case_agent': <FileTextOutlined style={{ color: '#722ed1' }} />,
    'replan': <ApartmentOutlined style={{ color: '#1677ff' }} />,
    'attribution_agent': <CheckCircleOutlined style={{ color: '#13c2c2' }} />,
  };

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总耗时" value={stats.time} suffix="ms" prefix={<ClockCircleOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="LLM 调用次数" value={stats.calls} prefix={<ThunderboltOutlined />} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总 Token 数" value={stats.tokens} prefix={<NodeIndexOutlined />} />
          </Card>
        </Col>
      </Row>

      <Timeline
        items={trace.map((step: any) => ({
          color: step.agent_name.toLowerCase().includes('planner') ? 'blue' : step.tokens_used > 0 ? 'green' : 'gray',
          dot: agentIcons[step.agent_name] || <ClockCircleOutlined />,
          children: (
            <Card size="small" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Space>
                  <Tag color="blue">{step.agent_name}</Tag>
                  <Text strong>{step.action}</Text>
                </Space>
                <Space>
                  <Text type="secondary">{step.duration_ms}ms</Text>
                  {step.tokens_used > 0 && <Text type="secondary">{step.tokens_used} tokens</Text>}
                </Space>
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                <div><Text type="secondary">输入: </Text>{step.input_summary}</div>
                <div><Text type="secondary">输出: </Text>{step.output_summary}</div>
                {step.skills_called?.length > 0 && (
                  <div style={{ marginTop: 4 }}>
                    {step.skills_called.map((s: string) => <Tag key={s} color="purple" style={{ fontSize: 11 }}>{s}</Tag>)}
                  </div>
                )}
              </div>
            </Card>
          ),
        }))}
      />
    </div>
  );
}
