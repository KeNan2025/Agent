import { useState } from 'react';
import {
  Card, Button, Table, Input, Tabs, Spin, Tag, Row, Col, Statistic, Alert, Space,
} from 'antd';
import {
  ExperimentOutlined, ThunderboltOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { evalAblation, evalBaseline, evalJudge } from '../api/client';
import type { AblationResult, BaselineResult, JudgeResult } from '../types';
import StatCard from '../components/StatCard';
import PageTitle from '../components/PageTitle';

export default function EvalCenter() {
  const [tab, setTab] = useState('ablation');
  const [ablLoading, setAblLoading] = useState(false);
  const [ablation, setAblation] = useState<AblationResult | null>(null);
  const [blLoading, setBlLoading] = useState(false);
  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [judgeCode, setJudgeCode] = useState('600000');
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);

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
      <PageTitle title="评估中心" />

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
                  <Space><ExperimentOutlined style={{ color: 'var(--purple)' }} /><span style={{ fontWeight: 600 }}>6 组消融实验</span></Space>
                }
                extra={
                  <Button type="primary" className="btn-purple" onClick={runAblation} loading={ablLoading}
                          icon={<ThunderboltOutlined />} style={{ fontWeight: 500 }}>
                    运行实验
                  </Button>
                }
              >
                <Alert
                  type="info" showIcon style={{ marginBottom: 20 }}
                  message="基于 5-fold 交叉验证评估模型消融实验效果"
                />
                <Spin spinning={ablLoading}>
                  {ablation ? (
                    <div className="fade-in-up">
                      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
                        <Col xs={12} sm={6}>
                          <StatCard title="完整模型 AUC-ROC" value={ablation.full_model.auc_roc.toFixed(3)} color="blue" size="small" />
                        </Col>
                        <Col xs={12} sm={6}>
                          <StatCard title="完整模型 AUC-PR" value={ablation.full_model.auc_pr.toFixed(3)} color="purple" size="small" />
                        </Col>
                        <Col xs={12} sm={6}>
                          <StatCard title="完整模型 F1" value={ablation.full_model.f1.toFixed(3)} color="green" size="small" />
                        </Col>
                        <Col xs={12} sm={6}>
                          <StatCard title="正样本率" value={`${(ablation.summary.positive_rate * 100).toFixed(1)}%`} color="cyan" size="small" />
                        </Col>
                      </Row>
                      <Table
                        rowKey="name" size="middle" pagination={false}
                        dataSource={ablation.ablations}
                        columns={[
                          {
                            title: '实验', dataIndex: 'name', width: 280,
                            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{v}</span>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 100,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 100,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{v?.toFixed?.(3) ?? '-'}</span>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 90,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'ΔAUC vs 完整', key: 'delta', width: 130,
                            render: (_: any, r: any) => {
                              const d = r.auc_roc - ablation.full_model.auc_roc;
                              return (
                                <Tag
                                  color={d < 0 ? 'red' : 'green'}
                                  style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
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
                    <div style={{ textAlign: 'center', padding: 60 }}>
                      <ExperimentOutlined style={{ fontSize: 48, color: 'var(--text-dim)' }} />
                      <div style={{ color: 'var(--text-dim)', marginTop: 12 }}>点击「运行实验」开始消融分析</div>
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
                  <Space><TrophyOutlined style={{ color: 'var(--warning)' }} /><span style={{ fontWeight: 600 }}>4 组基线对比</span></Space>
                }
                extra={
                  <Button type="primary" className="btn-purple" onClick={runBaseline} loading={blLoading}
                          icon={<ThunderboltOutlined />} style={{ fontWeight: 500 }}>
                    运行对比
                  </Button>
                }
              >
                <Spin spinning={blLoading}>
                  {baseline ? (
                    <div className="fade-in-up">
                      <Card
                        size="small"
                        style={{ marginBottom: 20, background: 'var(--primary-dim)', border: '1px solid var(--border-panel)' }}
                        styles={{ body: { padding: '12px 20px' } }}
                      >
                        <Row gutter={16}>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>完整模型 AUC-ROC</span>}
                              value={baseline.full_model.auc_roc.toFixed(3)}
                              valueStyle={{ color: 'var(--primary)', fontWeight: 700, fontSize: 22 }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>完整模型 AUC-PR</span>}
                              value={baseline.full_model.auc_pr.toFixed(3)}
                              valueStyle={{ fontSize: 22, color: 'var(--text-bright)' }}
                            />
                          </Col>
                          <Col xs={8}>
                            <Statistic
                              title={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>完整模型 F1</span>}
                              value={baseline.full_model.f1.toFixed(3)}
                              valueStyle={{ fontSize: 22, color: 'var(--text-bright)' }}
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
                            render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{v}</span>,
                          },
                          {
                            title: 'AUC-ROC', dataIndex: 'auc_roc', width: 120,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'AUC-PR', dataIndex: 'auc_pr', width: 120,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{(v ?? null) === null ? '-' : v.toFixed(3)}</span>,
                          },
                          {
                            title: 'F1', dataIndex: 'f1', width: 120,
                            render: (v: number) => <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{v.toFixed(3)}</span>,
                          },
                          {
                            title: 'Δ AUC', key: 'delta', width: 120,
                            render: (_: any, r: any) => {
                              const d = r.auc_roc - baseline.full_model.auc_roc;
                              return (
                                <Tag
                                  color={d < 0 ? 'red' : 'green'}
                                  style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}
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
                    <div style={{ textAlign: 'center', padding: 60 }}>
                      <TrophyOutlined style={{ fontSize: 48, color: 'var(--text-dim)' }} />
                      <div style={{ color: 'var(--text-dim)', marginTop: 12 }}>点击「运行对比」开始基线对比</div>
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
                  <Space><ExperimentOutlined style={{ color: 'var(--cyan)' }} /><span style={{ fontWeight: 600 }}>LLM-as-Judge 报告评估</span></Space>
                }
              >
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <Input
                    style={{ width: 200 }}
                    value={judgeCode}
                    onChange={(e) => setJudgeCode(e.target.value)}
                    placeholder="公司代码"
                    prefix={<span style={{ fontSize: 12, color: 'var(--text-dim)' }}>代码</span>}
                  />
                  <Button type="primary" className="btn-ghost-primary" onClick={runJudge} loading={judgeLoading} icon={<ThunderboltOutlined />}>
                    评估
                  </Button>
                </div>

                <Spin spinning={judgeLoading}>
                  {judgeResult ? (
                    <div className="fade-in-up">
                      <Row gutter={[12, 12]} className="stat-row" style={{ marginBottom: 20 }}>
                        {Object.entries(judgeResult.scores || {}).map(([k, v]) => (
                          <Col xs={8} sm={4} key={k}>
                            <StatCard title={k} value={v} color="blue" size="small" />
                          </Col>
                        ))}
                        <Col xs={8} sm={4}>
                          <Card
                            size="small"
                            style={{ background: 'var(--warning-soft)', border: '1px solid rgba(250,173,20,0.12)' }}
                            styles={{ body: { padding: '12px 16px', textAlign: 'center' } }}
                          >
                            <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>加权总分</span>
                            <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--warning)', fontVariantNumeric: 'tabular-nums' }}>
                              {judgeResult.weighted_total}
                            </div>
                          </Card>
                        </Col>
                      </Row>
                      {judgeResult.issues?.length > 0 && (
                        <Card size="small" title={<Space><CloseCircleOutlined style={{ color: 'var(--danger)' }} />发现问题</Space>} style={{ marginBottom: 12 }}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.issues.map((s, i) => (
                              <li key={i} style={{ color: 'var(--text-normal)', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                      {judgeResult.suggestions?.length > 0 && (
                        <Card size="small" title={<Space><CheckCircleOutlined style={{ color: 'var(--success)' }} />改进建议</Space>}>
                          <ul style={{ margin: 0, paddingLeft: 20 }}>
                            {judgeResult.suggestions.map((s, i) => (
                              <li key={i} style={{ color: 'var(--text-normal)', marginBottom: 4 }}>{s}</li>
                            ))}
                          </ul>
                        </Card>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'center', padding: 60 }}>
                      <ExperimentOutlined style={{ fontSize: 48, color: 'var(--text-dim)' }} />
                      <div style={{ color: 'var(--text-dim)', marginTop: 12 }}>输入公司代码并点击「评估」</div>
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
