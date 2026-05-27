import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Spin, Table, Tag, Alert, Typography, Descriptions, Space, Progress,
} from 'antd';
import {
  ThunderboltOutlined, ExperimentOutlined, FundOutlined,
  BarChartOutlined, ReloadOutlined,
} from '@ant-design/icons';
import { mlMetrics, mlFeatureImportance, mlTrain } from '../api/client';

const { Text } = Typography;

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
      <div className="fade-in">
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
          description="若环境中未安装 CatBoost/LightGBM/TabPFN，则自动回退到 sklearn GradientBoosting；指标依然有效。"
        />

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-purple" bodyStyle={{ padding: '20px 24px' }}>
              <ThunderboltOutlined className="stat-icon" />
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>特征维度</Text>}
                value={metrics?.n_features ?? 0}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>AUC-ROC</Text>}
                value={metrics?.metrics?.auc_roc?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-green" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>AUC-PR</Text>}
                value={metrics?.metrics?.auc_pr?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={6}>
            <Card className="stat-card stat-orange" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>F1 (最优阈值)</Text>}
                value={metrics?.metrics?.f1?.toFixed(3) ?? '-'}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><FundOutlined style={{ color: '#1677ff' }} /><span style={{ fontWeight: 600 }}>Base Model 性能 (OOF AUC)</span></Space>
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
                    <Descriptions.Item key={k} label={<Text strong>{k}</Text>}>
                      <Text style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{Number(v).toFixed(3)}</Text>
                    </Descriptions.Item>
                  ))}
                <Descriptions.Item label={<Text strong>最优阈值</Text>}>
                  <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{metrics?.metrics?.threshold?.toFixed(3)}</Text>
                </Descriptions.Item>
                <Descriptions.Item label={<Text strong>模型路径</Text>}>
                  <Text code style={{ fontSize: 11 }}>{metrics?.model_path}</Text>
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card
              title={
                <Space><BarChartOutlined style={{ color: '#fa8c16' }} /><span style={{ fontWeight: 600 }}>Top-20 特征重要性</span></Space>
              }
            >
              <Table
                size="small" pagination={false}
                dataSource={importance.map((f) => ({ ...f, key: f.name }))}
                columns={[
                  {
                    title: '#', key: 'rank', width: 40,
                    render: (_: any, __: any, i: number) => (
                      <Text type="secondary" style={{ fontSize: 12 }}>{i + 1}</Text>
                    ),
                  },
                  {
                    title: '特征', dataIndex: 'name',
                    render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text>,
                  },
                  {
                    title: '重要度', dataIndex: 'importance', width: 220,
                    render: (v: number) => {
                      const pct = Math.round((v / maxImportance) * 100);
                      return (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ flex: 1, height: 10, borderRadius: 5, background: '#f5f5f5', overflow: 'hidden' }}>
                            <div style={{
                              height: '100%', width: `${pct}%`, borderRadius: 5,
                              background: 'linear-gradient(90deg, #1677ff66, #1677ff)',
                              transition: 'width 0.6s ease',
                            }} />
                          </div>
                          <Text style={{ minWidth: 46, textAlign: 'right', fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#595959' }}>
                            {v.toFixed(3)}
                          </Text>
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
