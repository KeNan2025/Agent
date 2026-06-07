/**
 * Backtest — competition-grade rolling backtest.
 * Calls POST /api/v1/eval/backtest and renders the pass/fail dashboard.
 */
import { useState } from 'react';
import {
  Alert, Button, Card, Col, Descriptions, InputNumber, message, Row, Select, Space, Spin, Tag,
} from 'antd';
import {
  ExperimentOutlined, ThunderboltOutlined, RocketOutlined,
  CheckCircleOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import PageTitle from '../components/PageTitle';
import CompetitionTargets from '../components/CompetitionTargets';
import StatCard from '../components/StatCard';
import { evalBacktest } from '../api/client';
import type { BacktestReport } from '../types';

export default function Backtest() {
  const [windowDays, setWindowDays] = useState(60);
  const [topKFrac, setTopKFrac] = useState(0.1);
  const [maxSamples, setMaxSamples] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<BacktestReport | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const r = await evalBacktest(windowDays, topKFrac, maxSamples ?? undefined);
      setReport(r);
      if (!r.ok) message.warning(r.error ?? '回测失败');
    } catch (e: any) {
      message.error('调用失败：' + (e?.response?.data?.detail ?? e?.message ?? ''));
    } finally {
      setLoading(false);
    }
  };

  const allPass = report?.pass_status
    && report.pass_status.auc && report.pass_status.f1 && report.pass_status.top_k_recall;

  return (
    <div className="page-container fade-in">
      <PageTitle title="赛题回测" />

      <Card style={{ marginBottom: 20 }}>
        <Alert
          type="info"
          showIcon
          message="滚动窗口回测 — 一次性输出赛题硬指标"
          description="对 data/competition/ground_truth/test.csv 中的每个 (company_code, scan_date) 跑预测，统计 AUC-ROC / F1 / Top-10% 召回。目标：AUC ≥ 0.75 / F1 ≥ 0.65 / Top-10% ≥ 35%。"
          style={{ marginBottom: 20 }}
        />
        <Row gutter={[16, 12]} align="bottom">
          <Col xs={24} sm={6}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>预测窗口</div>
            <Select
              value={windowDays}
              onChange={setWindowDays}
              style={{ width: '100%' }}
              options={[
                { label: '30 天', value: 30 },
                { label: '60 天', value: 60 },
                { label: '90 天', value: 90 },
              ]}
            />
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>Top-K 比例</div>
            <InputNumber
              value={topKFrac}
              onChange={(v) => setTopKFrac(v ?? 0.1)}
              min={0.01} max={1} step={0.05}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={6}>
            <div style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4 }}>样本上限（可选）</div>
            <InputNumber
              value={maxSamples ?? undefined}
              onChange={(v) => setMaxSamples(v ?? null)}
              min={1} style={{ width: '100%' }}
              placeholder="不限"
            />
          </Col>
          <Col xs={24} sm={6}>
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              loading={loading}
              onClick={run}
              block
              size="large"
            >
              开始回测
            </Button>
          </Col>
        </Row>
      </Card>

      <Spin spinning={loading}>
        {report?.ok && (
          <>
            <div style={{ marginBottom: 24 }}>
              <CompetitionTargets
                aucRoc={report.metrics.auc_roc}
                f1={report.metrics.f1}
                top10Recall={report.metrics.top_10pct_recall}
              />
            </div>

            <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
              <Col xs={24} sm={6}>
                <StatCard title="测试样本数" value={report.n_samples} color="blue" icon={<ExperimentOutlined />} />
              </Col>
              <Col xs={24} sm={6}>
                <StatCard title="正样本数" value={report.n_positive} color="red" />
              </Col>
              <Col xs={24} sm={6}>
                <StatCard title="失败样本" value={report.n_failed} color="orange" />
              </Col>
              <Col xs={24} sm={6}>
                <StatCard
                  title="最优阈值"
                  value={report.metrics.optimal_threshold.toFixed(3)}
                  color="purple"
                />
              </Col>
            </Row>

            <Card
              title={
                <Space>
                  <RocketOutlined style={{ color: 'var(--primary)' }} />
                  <span style={{ fontWeight: 600 }}>详细指标</span>
                  {allPass ? (
                    <Tag color="green" icon={<CheckCircleOutlined />}>赛题指标全部通过</Tag>
                  ) : (
                    <Tag color="red" icon={<CloseCircleOutlined />}>部分指标未达标</Tag>
                  )}
                </Space>
              }
            >
              <Descriptions column={2} bordered size="small">
                <Descriptions.Item label="AUC-ROC">
                  <span style={{ color: report.pass_status.auc ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {report.metrics.auc_roc.toFixed(4)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="F1 (最优阈值)">
                  <span style={{ color: report.pass_status.f1 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {report.metrics.f1_optimal_threshold.toFixed(4)}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Top-10% 召回率">
                  <span style={{ color: report.pass_status.top_k_recall ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                    {(report.metrics.top_10pct_recall * 100).toFixed(2)}%
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="F1 (固定阈值)">
                  {report.metrics.f1.toFixed(4)}
                </Descriptions.Item>
                <Descriptions.Item label="预测窗口">
                  {report.window_days} 天
                </Descriptions.Item>
                <Descriptions.Item label="Top-K 比例">
                  {(report.thresholds.top_k_frac * 100).toFixed(0)}%
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </>
        )}
        {report && !report.ok && (
          <Alert type="error" showIcon message="回测失败" description={report.error ?? ''} />
        )}
        {!report && !loading && (
          <Card>
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-dim)' }}>
              <ExperimentOutlined style={{ fontSize: 48, marginBottom: 12 }} />
              <div>点击「开始回测」运行赛题指标评估</div>
            </div>
          </Card>
        )}
      </Spin>
    </div>
  );
}
