import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Row, Col, Tag, Descriptions, Table, Timeline, Progress, Spin, Button,
  Tabs, Statistic, Alert, Typography, Collapse, Space, Tooltip,
} from 'antd';
import {
  ArrowLeftOutlined, WarningOutlined, CheckCircleOutlined,
  ClockCircleOutlined, ThunderboltOutlined, FileTextOutlined,
  NodeIndexOutlined, ApartmentOutlined, FundOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import { scanSingle } from '../api/client';

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
  const [windowDays, setWindowDays] = useState(60);

  useEffect(() => {
    if (!code) return;
    setLoading(true);
    scanSingle(code, windowDays).then((d) => {
      setData(d);
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
    'Master Planner': <ApartmentOutlined style={{ color: '#1677ff' }} />,
    '财务异常检测Agent': <FundOutlined style={{ color: '#fa8c16' }} />,
    '公告研读Agent': <FileTextOutlined style={{ color: '#52c41a' }} />,
    '概率预测模型': <ThunderboltOutlined style={{ color: '#f5222d' }} />,
    '案例检索Agent': <FileTextOutlined style={{ color: '#722ed1' }} />,
    '归因解释Agent': <CheckCircleOutlined style={{ color: '#13c2c2' }} />,
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
          color: step.agent_name === 'Master Planner' ? 'blue' : step.tokens_used > 0 ? 'green' : 'gray',
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
                {step.skills_called.length > 0 && (
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
