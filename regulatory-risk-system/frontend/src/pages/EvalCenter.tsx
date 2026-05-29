import { useState } from 'react';
import {
  Card, Button, Table, Input, Tabs, Spin, Tag, Row, Col, Statistic, Alert, Space, Badge,
} from 'antd';
import {
  ExperimentOutlined, ThunderboltOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { evalAblation, evalBaseline, evalJudge } from '../api/client';

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
    <div className="page-container fade-in">
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
                  message="基于 5-fold 交叉验证评估模型消融实验效果"
                />
                <Spin spinning={ablLoading}>
                  {ablation ? (
                    <div className="slide-in-up">
                      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-blue" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 AUC-ROC</span>}
                              value={ablation.full_model.auc_roc.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#1677ff' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-purple" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 AUC-PR</span>}
                              value={ablation.full_model.auc_pr.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#722ed1' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-green" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 F1</span>}
                              value={ablation.full_model.f1.toFixed(3)}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#10b981' }}
                            />
                          </Card>
                        </Col>
                        <Col xs={12} sm={6}>
                          <Card className="stat-card stat-cyan" bodyStyle={{ padding: '16px 20px' }}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>正样本率</span>}
                              value={`${(ablation.summary.positive_rate * 100).toFixed(1)}%`}
                              valueStyle={{ fontSize: 24, fontWeight: 700, color: '#06b6d4' }}
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
                            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{v}</span>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 100,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 100,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{v?.toFixed?.(3) ?? '-'}</span>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 90,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{v.toFixed(3)}</span>,
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
                      <ExperimentOutlined style={{ fontSize: 48, color: 'var(--text-3)' }} />
                      <span style={{ color: 'var(--text-3)' }}>点击「运行实验」开始消融分析</span>
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
                  <Space><TrophyOutlined style={{ color: '#f59e0b' }} /><span style={{ fontWeight: 600 }}>4 组基线对比</span></Space>
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
                        style={{ marginBottom: 20, background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.12)', borderRadius: 12 }}
                        bodyStyle={{ padding: '12px 20px' }}
                      >
                        <Row gutter={16}>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 AUC-ROC</span>}
                              value={baseline.full_model.auc_roc.toFixed(3)}
                              valueStyle={{ color: '#4f8ff7', fontWeight: 700, fontSize: 22 }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 AUC-PR</span>}
                              value={baseline.full_model.auc_pr.toFixed(3)}
                              valueStyle={{ fontSize: 22, color: 'var(--text-1)' }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>完整模型 F1</span>}
                              value={baseline.full_model.f1.toFixed(3)}
                              valueStyle={{ fontSize: 22, color: 'var(--text-1)' }}
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
                            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{v}</span>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 120,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 120,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{(v ?? null) === null ? '-' : v.toFixed(3)}</span>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 120,
                            render: (v: number) => <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{v.toFixed(3)}</span>,
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
                      <TrophyOutlined style={{ fontSize: 48, color: 'var(--text-3)' }} />
                      <span style={{ color: 'var(--text-3)' }}>点击「运行对比」开始基线对比</span>
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
                    prefix={<span style={{ fontSize: 12, color: 'var(--text-3)' }}>代码</span>}
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
                              <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{k}</span>
                              <div style={{ fontSize: 22, fontWeight: 700, color: '#4f8ff7', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
                            </Card>
                          </Col>
                        ))}
                        <Col xs={8} sm={4}>
                          <Card
                            size="small"
                            style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.12)' }}
                            bodyStyle={{ padding: '12px 16px', textAlign: 'center' }}
                          >
                            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>加权总分</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: '#f59e0b', fontVariantNumeric: 'tabular-nums' }}>
                              {judgeResult.weighted_total}
                            </div>
                          </Card>
                        </Col>
                      </Row>
                      {judgeResult.issues?.length > 0 && (
                        <Card size="small" title={<Space><CloseCircleOutlined style={{ color: '#ef4444' }} />发现问题</Space>} style={{ marginBottom: 12 }}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.issues.map((s: string, i: number) => (
                              <li key={i} style={{ color: 'var(--text-2)', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                      {judgeResult.suggestions?.length > 0 && (
                        <Card size="small" title={<Space><CheckCircleOutlined style={{ color: '#10b981' }} />改进建议</Space>}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.suggestions.map((s: string, i: number) => (
                              <li key={i} style={{ color: 'var(--text-2)', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div className="empty-action">
                      <ExperimentOutlined style={{ fontSize: 48, color: 'var(--text-3)' }} />
                      <span style={{ color: 'var(--text-3)' }}>输入公司代码并点击「评估」</span>
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
