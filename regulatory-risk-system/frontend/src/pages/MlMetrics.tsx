import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Spin, Table, Tag, Alert, Descriptions, Space, Progress,
} from 'antd';
import {
  ThunderboltOutlined, ExperimentOutlined, FundOutlined,
  BarChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { mlMetrics, mlFeatureImportance, mlTrain } from '../api/client';

export default function MlMetrics() {
  const [metrics, setMetrics] = useState<any>(null);
  const [importance, setImportance] = useState<any[]>([]);
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
        <div className="page-title">
          <span className="title-bar" />
          模型指标
        </div>

        <Alert
          type="info" showIcon style={{ marginBottom: 20, borderRadius: 8 }}
          message={
            <Space>
              <ExperimentOutlined />
              <span>异质集成预测模型 (CatBoost + LightGBM + TabPFN-2.5 + Stacking)</span>
            </Space>
          }
        />

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-purple" bodyStyle={{ padding: '20px 24px' }}>
              <ThunderboltOutlined className="stat-icon" />
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>特征维度</span>}
                value={metrics?.n_features ?? 0}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>AUC-ROC</span>}
                value={metrics?.metrics?.auc_roc?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#4f8ff7' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-green" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>AUC-PR</span>}
                value={metrics?.metrics?.auc_pr?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#10b981' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-cyan" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>F1 (最优阈值)</span>}
                value={metrics?.metrics?.f1?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#06b6d4' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><FundOutlined style={{ color: '#4f8ff7' }} /><span style={{ fontWeight: 600 }}>Base Model 性能 (OOF AUC)</span></Space>
              }
              extra={
                <Button onClick={retrain} loading={training} icon={<ReloadOutlined />}>
                  重新训练
                </Button>
              }
            >
              <Descriptions column={1} size="small" bordered>
                {metrics?.metrics?.per_model_auc &&
                  Object.entries(metrics.metrics.per_model_auc).map(([k, v]: any) => (
                    <Descriptions.Item key={k} label={<span style={{ fontWeight: 600, color: 'var(--text-1)' }}>{k}</span>}>
                      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600, color: 'var(--text-1)' }}>{Number(v).toFixed(3)}</span>
                    </Descriptions.Item>
                  ))}
                <Descriptions.Item label={<span style={{ fontWeight: 600, color: 'var(--text-1)' }}>最优阈值</span>}>
                  <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{metrics?.metrics?.threshold?.toFixed(3)}</span>
                </Descriptions.Item>
                <Descriptions.Item label={<span style={{ fontWeight: 600, color: 'var(--text-1)' }}>模型路径</span>}>
                  <span className="text-mono" style={{ fontSize: 11, color: 'var(--text-3)' }}>{metrics?.model_path}</span>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><BarChartOutlined style={{ color: '#f59e0b' }} /><span style={{ fontWeight: 600 }}>Top-20 特征重要性</span></Space>
              }
            >
              <Table
                size="small" pagination={false}
                dataSource={importance.map((f) => ({ ...f, key: f.name }))}
                columns={[
                  {
                    title: '#', key: 'rank', width: 40,
                    render: (_: any, __: any, i: number) => (
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{i + 1}</span>
                    ),
                  },
                  {
                    title: '特征', dataIndex: 'name',
                    render: (v: string) => <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>{v}</span>,
                  },
                  {
                    title: '重要度', dataIndex: 'importance', width: 220,
                    render: (v: number) => {
                      const pct = Math.round((v / maxImportance) * 100);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 10, borderRadius: 5, background: 'rgba(59,130,246,0.1)', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 3,
                              background: 'linear-gradient(90deg, #2563eb, #4f8ff7)',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                          <span className="text-mono" style={{ minWidth: 46, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-2)' }}>
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
