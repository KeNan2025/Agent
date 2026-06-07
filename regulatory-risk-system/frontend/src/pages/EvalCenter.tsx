import { useState } from 'react';
import {
  Card, Button, Table, Input, Tabs, Spin, Tag, Row, Col, Statistic, Alert, Space, message,
} from 'antd';
import {
  ExperimentOutlined, ThunderboltOutlined, TrophyOutlined,
  CheckCircleOutlined, CloseCircleOutlined, FileSearchOutlined,
} from '@ant-design/icons';
import {
  evalAblation, evalBaseline, evalJudge,
  evalEvidenceRecall, evalFocusAccuracy, evalCaseTopK,
} from '../api/client';
import type {
  AblationResult, BaselineResult, JudgeResult,
  EvidenceRecallResult, FocusClassificationResult, CaseTopKResult,
} from '../types';
import StatCard from '../components/StatCard';
import MetricGate from '../components/MetricGate';
import PageTitle from '../components/PageTitle';

function safeParseJson<T>(text: string, fallback: T): T {
  try { return JSON.parse(text); } catch { return fallback; }
}

export default function EvalCenter() {
  const [tab, setTab] = useState('ablation');
  const [ablLoading, setAblLoading] = useState(false);
  const [ablation, setAblation] = useState<AblationResult | null>(null);
  const [blLoading, setBlLoading] = useState(false);
  const [baseline, setBaseline] = useState<BaselineResult | null>(null);
  const [judgeCode, setJudgeCode] = useState('600000');
  const [judgeLoading, setJudgeLoading] = useState(false);
  const [judgeResult, setJudgeResult] = useState<JudgeResult | null>(null);

  // ── Phase 3: 赛题三项细评估 ──
  const [evidencePred, setEvidencePred] = useState('[{"evidence_quote":"应收账款大幅增长"}]');
  const [evidenceGold, setEvidenceGold] = useState('[{"evidence_quote":"应收账款增长 45%"}]');
  const [evidenceResult, setEvidenceResult] = useState<EvidenceRecallResult | null>(null);
  const [evidenceLoading, setEvidenceLoading] = useState(false);

  const [focusPred, setFocusPred] = useState('[{"category":"财务异常","subcategory":"收入确认异常"}]');
  const [focusGold, setFocusGold] = useState('[{"category":"财务异常","subcategory":"收入确认异常"}]');
  const [focusResult, setFocusResult] = useState<FocusClassificationResult | null>(null);
  const [focusLoading, setFocusLoading] = useState(false);

  const [casePred, setCasePred] = useState('["600519","000001","002271","600036","601318"]');
  const [caseGold, setCaseGold] = useState('["600519"]');
  const [caseTopK, setCaseTopK] = useState(5);
  const [caseResult, setCaseResult] = useState<CaseTopKResult | null>(null);
  const [caseLoading, setCaseLoading] = useState(false);

  const runEvidenceRecall = async () => {
    setEvidenceLoading(true);
    try {
      const r = await evalEvidenceRecall(
        safeParseJson(evidencePred, []),
        safeParseJson(evidenceGold, []),
        0.5,
      );
      setEvidenceResult(r);
    } catch (e: any) {
      message.error('评估失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setEvidenceLoading(false);
    }
  };

  const runFocusAccuracy = async () => {
    setFocusLoading(true);
    try {
      const r = await evalFocusAccuracy(
        safeParseJson(focusPred, []),
        safeParseJson(focusGold, []),
      );
      setFocusResult(r);
    } catch (e: any) {
      message.error('评估失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setFocusLoading(false);
    }
  };

  const runCaseTopK = async () => {
    setCaseLoading(true);
    try {
      const r = await evalCaseTopK(
        safeParseJson(casePred, []),
        safeParseJson(caseGold, []),
        caseTopK,
      );
      setCaseResult(r);
    } catch (e: any) {
      message.error('评估失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setCaseLoading(false);
    }
  };

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
          {
            key: 'competition-detail',
            label: <><FileSearchOutlined /> 赛题细评估</>,
            children: (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <Alert
                  type="info" showIcon
                  message="赛题三项细分指标"
                  description="证据片段召回 ≥ 85% · 关注点分类准确率 ≥ 80% · 案例 Top-5 命中率 ≥ 70%。输入预测结果与 gold 标注（JSON 格式），后端按相同口径计算评估结果。"
                />

                {/* 证据召回 */}
                <Card
                  title={<Space><FileSearchOutlined style={{ color: 'var(--warning)' }} /><span style={{ fontWeight: 600 }}>关键证据片段召回</span></Space>}
                  extra={
                    <Button type="primary" onClick={runEvidenceRecall} loading={evidenceLoading} icon={<ThunderboltOutlined />}>
                      评估
                    </Button>
                  }
                >
                  <Row gutter={12}>
                    <Col xs={24} sm={12}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>predictions (JSON)</div>
                      <Input.TextArea rows={4} value={evidencePred} onChange={(e) => setEvidencePred(e.target.value)} />
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>gold (JSON)</div>
                      <Input.TextArea rows={4} value={evidenceGold} onChange={(e) => setEvidenceGold(e.target.value)} />
                    </Col>
                  </Row>
                  {evidenceResult && (
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={12}>
                        <Col xs={12} sm={8}>
                          <MetricGate label="召回率" value={evidenceResult.recall} target={0.85} format="percent" />
                        </Col>
                        <Col xs={12} sm={8}>
                          <StatCard title="匹配数" value={evidenceResult.matched} color="green" size="small" />
                        </Col>
                        <Col xs={12} sm={8}>
                          <StatCard title="gold 数" value={evidenceResult.total_gold} color="blue" size="small" />
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card>

                {/* 关注点分类 */}
                <Card
                  title={<Space><FileSearchOutlined style={{ color: 'var(--purple)' }} /><span style={{ fontWeight: 600 }}>监管关注点分类</span></Space>}
                  extra={
                    <Button type="primary" onClick={runFocusAccuracy} loading={focusLoading} icon={<ThunderboltOutlined />}>
                      评估
                    </Button>
                  }
                >
                  <Row gutter={12}>
                    <Col xs={24} sm={12}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>predictions (JSON)</div>
                      <Input.TextArea rows={4} value={focusPred} onChange={(e) => setFocusPred(e.target.value)} />
                    </Col>
                    <Col xs={24} sm={12}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>gold (JSON)</div>
                      <Input.TextArea rows={4} value={focusGold} onChange={(e) => setFocusGold(e.target.value)} />
                    </Col>
                  </Row>
                  {focusResult && (
                    <div style={{ marginTop: 16 }}>
                      <Row gutter={12}>
                        <Col xs={12} sm={8}>
                          <MetricGate label="准确率" value={focusResult.accuracy} target={0.8} format="percent" />
                        </Col>
                        <Col xs={12} sm={8}>
                          <StatCard title="匹配数" value={focusResult.matched} color="green" size="small" />
                        </Col>
                        <Col xs={12} sm={8}>
                          <StatCard title="gold 数" value={focusResult.total_gold} color="blue" size="small" />
                        </Col>
                      </Row>
                    </div>
                  )}
                </Card>

                {/* 案例 Top-K */}
                <Card
                  title={<Space><FileSearchOutlined style={{ color: 'var(--cyan)' }} /><span style={{ fontWeight: 600 }}>相似案例 Top-K 命中</span></Space>}
                  extra={
                    <Button type="primary" onClick={runCaseTopK} loading={caseLoading} icon={<ThunderboltOutlined />}>
                      评估
                    </Button>
                  }
                >
                  <Row gutter={12}>
                    <Col xs={24} sm={10}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>predicted_case_codes (JSON list)</div>
                      <Input.TextArea rows={3} value={casePred} onChange={(e) => setCasePred(e.target.value)} />
                    </Col>
                    <Col xs={24} sm={10}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>gold_case_codes (JSON list)</div>
                      <Input.TextArea rows={3} value={caseGold} onChange={(e) => setCaseGold(e.target.value)} />
                    </Col>
                    <Col xs={24} sm={4}>
                      <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>K</div>
                      <Input type="number" value={caseTopK} onChange={(e) => setCaseTopK(Number(e.target.value) || 5)} />
                    </Col>
                  </Row>
                  {caseResult && (
                    <div style={{ marginTop: 16 }}>
                      <Tag color={caseResult.hit ? 'green' : 'red'} icon={caseResult.hit ? <CheckCircleOutlined /> : <CloseCircleOutlined />}>
                        {caseResult.hit ? `Top-${caseResult.top_k} 命中` : `Top-${caseResult.top_k} 未命中`}
                      </Tag>
                      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-dim)' }}>
                        预测：{caseResult.predicted.join(', ')} · gold：{caseResult.gold.join(', ')}
                      </div>
                    </div>
                  )}
                </Card>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
