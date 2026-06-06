import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Button, Spin, Table, Tag, Alert, Descriptions, Space, Progress,
} from 'antd';
import {
  ThunderboltOutlined, ExperimentOutlined, FundOutlined,
  BarChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { mlMetrics, mlFeatureImportance, mlTrain } from '../api/client';
import type { MlMetricsData, FeatureImportance } from '../types';
import StatCard from '../components/StatCard';
import PageTitle from '../components/PageTitle';

export default function MlMetrics() {
  const [metrics, setMetrics] = useState<MlMetricsData | null>(null);
  const [importance, setImportance] = useState<FeatureImportance[]>([]);
  const [loading, setLoading] = useState(true);
  const [training, setTraining] = useState(false);

  const refresh = async () => {
    setLoading(true);
    const [m, fi] = await Promise.all([mlMetrics(), mlFeatureImportance(20)]);
    setMetrics(m);
    setImportance(fi.features);
    setLoading(false);
  };

  useEffect(() => { refresh(); }, []);

  const retrain = async () => {
    setTraining(true);
    await mlTrain(200);
    setTraining(false);
    refresh();
  };

  const maxImportance = importance.length > 0
    ? Math.max(...importance.map((f) => f.importance))
    : 1;

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <PageTitle title="模型指标" />

        <Alert
          type="info" showIcon style={{ marginBottom: 20 }}
          message={
            <Space>
              <ExperimentOutlined />
              <span>异质集成预测模型 (CatBoost + LightGBM + TabPFN-2.5 + Stacking)</span>
            </Space>
          }
        />

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <StatCard title="特征维度" value={metrics?.n_features ?? 0} color="purple" icon={<ThunderboltOutlined />} />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="AUC-ROC" value={metrics?.metrics?.auc_roc?.toFixed(3) ?? '-'} color="blue" />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="AUC-PR" value={metrics?.metrics?.auc_pr?.toFixed(3) ?? '-'} color="green" />
          </Col>
          <Col xs={12} sm={6}>
            <StatCard title="F1 (最优阈值)" value={metrics?.metrics?.f1?.toFixed(3) ?? '-'} color="cyan" />
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><FundOutlined style={{ color: 'var(--primary)' }} /><span style={{ fontWeight: 600 }}>Base Model 性能 (OOF AUC)</span></Space>
              }
              extra={
                <Button onClick={retrain} className="btn-warning" loading={training} icon={<ReloadOutlined />}>
                  重新训练
                </Button>
              }
            >
              <Descriptions column={1} size="small" bordered>
                {metrics?.metrics?.per_model_auc &&
                  Object.entries(metrics.metrics.per_model_auc).map(([k, v]) => (
                    <Descriptions.Item key={k} label={<span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{k}</span>}>
                      <span className="text-mono" style={{ fontWeight: 600, color: 'var(--text-bright)' }}>{Number(v).toFixed(3)}</span>
                    </Descriptions.Item>
                  ))}
                <Descriptions.Item label={<span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>最优阈值</span>}>
                  <span className="text-mono" style={{ color: 'var(--text-bright)' }}>{metrics?.metrics?.threshold?.toFixed(3)}</span>
                </Descriptions.Item>
                <Descriptions.Item label={<span style={{ fontWeight: 600, color: 'var(--text-bright)' }}>模型路径</span>}>
                  <span className="text-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>{metrics?.model_path}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><BarChartOutlined style={{ color: 'var(--warning)' }} /><span style={{ fontWeight: 600 }}>Top-20 特征重要性</span></Space>
              }
            >
              <Table
                size="small" pagination={false}
                dataSource={importance.map((f) => ({ ...f, key: f.name }))}
                columns={[
                  {
                    title: '#', key: 'rank', width: 40,
                    render: (_: any, __: any, i: number) => (
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{i + 1}</span>
                    ),
                  },
                  {
                    title: '特征', dataIndex: 'name',
                    render: (v: string) => <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>{v}</span>,
                  },
                  {
                    title: '重要度', dataIndex: 'importance', width: 220,
                    render: (v: number) => {
                      const pct = Math.round((v / maxImportance) * 100);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'var(--primary-dim)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 3,
                              background: 'var(--primary-gradient)',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                          <span className="text-mono" style={{ minWidth: 46, textAlign: 'right', fontSize: 12, color: 'var(--text-normal)' }}>
                            {v.toFixed(3)}
                          </span>
                        </div>
                      );
                    },
                  },
                ]}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </Spin>
  );
}
