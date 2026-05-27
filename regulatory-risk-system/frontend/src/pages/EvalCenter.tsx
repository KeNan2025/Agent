import { useState } from 'react';
import {
  Card, Button, Table, Input, Tabs, Spin, Tag, Row, Col, Statistic, Alert, Typography, Space, Badge,
} from 'antd';
import {
  ExperimentOutlined, ThunderboltOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { evalAblation, evalBaseline, evalJudge } from '../api/client';

const { Text } = Typography;

export default function EvalCenter() {
  const [tab, setTab] = useState('ablation');
  const [ablLoading, setAblLoading] = useState(false);
  const [ablation, setAblation] = useState<any>(null);
  const [blLoading, setBlLoading] = useState(false);
  const [baseline, setBaseline] = useState<any>(null);
  const [judgeCode, setJudgeCode] = useState('600000');
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeResult, setJudgeResult] = useState<any>(null);

  const runAblation = async () => {
    setAblLoading(true);
    setAblation(await evalAblation());
    setAblLoading(false);
  };

  const runBaseline = async () => {
    setBlLoading(true);
    setBaseline(await evalBaseline());
    setBlLoading(false);
  };

  const runJudge = async () => {
    setJudgeLoading(true);
    setJudgeResult(await evalJudge(judgeCode));
    setJudgeLoading(false);
  };

  return (
    <div className="fade-in">
      <div className="page-title">
        <span className="title-bar" />
        评估中心
      </div>

      <Tabs
        activeKey={tab} onChange={setTab}
        type="card"
        items={[
          {
            key: 'ablation',
            label: <><ExperimentOutlined /> 消融实验</>,
            children: (
              <Card
                title={
                  <Space><ExperimentOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 600 }}>6 组消融实验</span></Space>
                }
                extra={
                  <Button type="primary" onClick={runAblation} loading={ablLoading}
                          icon={<ThunderboltOutlined />} style={{ fontWeight: 500 }}>
                    运行实验
                  </Button>
                }
              >
                <Alert
                  type="info" showIcon style={{ marginBottom: 20, borderRadius: 8 }}
                  message="每次运行使用合成训练集做 5-fold 交叉验证；首次约 30 秒，后续秒级"
                />
                <Spin spinning={ablLoading}>
                  {ablation ? (
                    <div className="slide-in-up">
                      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-blue" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 AUC-ROC</Text>}
                              value={ablation.full_model.auc_roc.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-purple" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 AUC-PR</Text>}
                              value={ablation.full_model.auc_pr.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#722ed1' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-green" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 F1</Text>}
                              value={ablation.full_model.f1.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#52c41a' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-orange" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>正样本率</Text>}
                              value={`${(ablation.summary.positive_rate * 100).toFixed(1)}%`}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#fa8c16' }}
                            />
                          </Card>
                        </Col>
                      </Row>
                      <Table
                        rowKey="name" size="middle" pagination={false}
                        dataSource={ablation.ablations}
                        columns={[
                          {
                            title: '实验', dataIndex: 'name', width: 280,
                            render: (v: string) => <Text strong>{v}</Text>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 100,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(3)}</Text>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 100,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v?.toFixed?.(3) ?? '-'}</Text>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 90,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(3)}</Text>,
                          },
                          {
                            title: 'ΔAUC vs 完整', key: 'delta', width: 130,
                            render: (_: any, r: any) => {
                              const d = r.auc_roc - ablation.full_model.auc_roc;
                              return (
                                <Tag
                                  color={d < 0 ? 'red' : 'green'}
                                  style={{ borderRadius: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                                  icon={d < 0 ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                                >
                                  {d >= 0 ? '+' : ''}{d.toFixed(3)}
                                </Tag>
                              );
                            },
                          },
                          { title: '预期结论', dataIndex: 'expected', width: 200 },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="empty-action">
                      <ExperimentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                      <Text type="secondary">点击「运行实验」开始消融分析</Text>
                    </div>
                  )}
                </Spin>
              </Card>
            ),
          },
          {
            key: 'baseline',
            label: <><TrophyOutlined /> 基线对比</>,
            children: (
              <Card
                title={
                  <Space><TrophyOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 600 }}>4 组基线对比</span></Space>
                }
                extra={
                  <Button type="primary" onClick={runBaseline} loading={blLoading}
                          icon={<ThunderboltOutlined />} style={{ fontWeight: 500 }}>
                    运行对比
                  </Button>
                }
              >
                <Spin spinning={blLoading}>
                  {baseline ? (
                    <div className="slide-in-up">
                      <Card
                        size="small"
                        style={{ marginBottom: 20, background: 'linear-gradient(135deg, #e6f4ff, #f0f5ff)', border: '1px solid #91caff' }}
                        bodyStyle={{ padding: '12px 20px' }}
                      >
                        <Row gutter={16}>
                          <Col xs={8}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 AUC-ROC</Text>}
                              value={baseline.full_model.auc_roc.toFixed(3)}
                              valueStyle={{ color: '#1677ff', fontWeight: 700, fontSize: 22 }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 AUC-PR</Text>}
                              value={baseline.full_model.auc_pr.toFixed(3)}
                              valueStyle={{ fontSize: 22 }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<Text type="secondary" style={{ fontSize: 12 }}>完整模型 F1</Text>}
                              value={baseline.full_model.f1.toFixed(3)}
                              valueStyle={{ fontSize: 22 }}
                            />
                          </Col>
                        </Row>
                      </Card>
                      <Table
                        rowKey="name" size="middle" pagination={false}
                        dataSource={baseline.baselines}
                        columns={[
                          {
                            title: '基线方法', dataIndex: 'name', width: 240,
                            render: (v: string) => <Text strong>{v}</Text>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 120,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(3)}</Text>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 120,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{(v ?? null) === null ? '-' : v.toFixed(3)}</Text>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 120,
                            render: (v: number) => <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{v.toFixed(3)}</Text>,
                          },
                          {
                            title: 'Δ AUC', key: 'delta', width: 120,
                            render: (_: any, r: any) => {
                              const d = r.auc_roc - baseline.full_model.auc_roc;
                              return (
                                <Tag
                                  color={d < 0 ? 'red' : 'green'}
                                  style={{ borderRadius: 4, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
                                  icon={d < 0 ? <CloseCircleOutlined /> : <CheckCircleOutlined />}
                                >
                                  {d >= 0 ? '+' : ''}{d.toFixed(3)}
                                </Tag>
                              );
                            },
                          },
                        ]}
                      />
                    </div>
                  ) : (
                    <div className="empty-action">
                      <TrophyOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                      <Text type="secondary">点击「运行对比」开始基线对比</Text>
                    </div>
                  )}
                </Spin>
              </Card>
            ),
          },
          {
            key: 'judge',
            label: <><ExperimentOutlined /> LLM-as-Judge</>,
            children: (
              <Card
                title={
                  <Space><ExperimentOutlined style={{ color: '#13c2c2' }} /><span style={{ fontWeight: 600 }}>LLM-as-Judge 报告评估</span></Space>
                }
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <Input
                    style={{ width: 200 }}
                    value={judgeCode}
                    onChange={(e) => setJudgeCode(e.target.value)}
                    placeholder="公司代码"
                    prefix={<Text type="secondary" style={{ fontSize: 12 }}>代码</Text>}
                  />
                  <Button type="primary" onClick={runJudge} loading={judgeLoading} icon={<ThunderboltOutlined />}>
                    评估
                  </Button>
                </div>

                <Spin spinning={judgeLoading}>
                  {judgeResult ? (
                    <div className="slide-in-up">
                      <Row gutter={[12, 12]} className="stat-row" style={{ marginBottom: 20 }}>
                        {Object.entries(judgeResult.scores || {}).map(([k, v]: any) => (
                          <Col xs={8} sm={4} key={k}>
                            <Card size="small" className="stat-card stat-blue" bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}>
                              <Text type="secondary" style={{ fontSize: 11 }}>{k}</Text>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#1677ff', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                            </Card>
                          </Col>
                        ))}
                        <Col xs={8} sm={4}>
                          <Card
                            size="small" className="stat-card stat-orange"
                            bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}
                          >
                            <Text type="secondary" style={{ fontSize: 11 }}>加权总分</Text>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#fa8c16', fontVariantNumeric: 'tabular-nums' }}>
                              {judgeResult.weighted_total}
                            </div>
                          </Card>
                        </Col>
                      </Row>
                      {judgeResult.issues?.length > 0 && (
                        <Card size="small" title={<Space><CloseCircleOutlined style={{ color: '#f5222d' }} />发现问题</Space>} style={{ marginBottom: 12 }}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.issues.map((s: string, i: number) => (
                              <li key={i} style={{ color: '#595959', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                      {judgeResult.suggestions?.length > 0 && (
                        <Card size="small" title={<Space><CheckCircleOutlined style={{ color: '#52c41a' }} />改进建议</Space>}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.suggestions.map((s: string, i: number) => (
                              <li key={i} style={{ color: '#595959', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="empty-action">
                      <ExperimentOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
                      <Text type="secondary">输入公司代码并点击「评估」</Text>
                    </div>
                  )}
                </Spin>
              </Card>
            ),
          },
        ]}
      />
    </div>
  );
}
