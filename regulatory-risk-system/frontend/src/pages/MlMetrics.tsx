import { useEffect, useState } from 'react';
import {
  Card, Row, Col, Statistic, Button, Spin, Table, Tag, Alert, Typography, Descriptions,
} from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
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

  return (
    <Spin spinning={loading}>
      <Alert
        type="info" showIcon style={{ marginBottom: 16 }}
        message="异质集成预测模型 (CatBoost + LightGBM + TabPFN-2.5 + Stacking)"
        description="若环境中未安装 CatBoost/LightGBM/TabPFN，则自动回退到 sklearn GradientBoosting；指标依然有效。"
      />
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="特征维度" value={metrics?.n_features ?? 0} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="AUC-ROC" value={metrics?.metrics?.auc_roc?.toFixed(3) ?? '-'} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="AUC-PR" value={metrics?.metrics?.auc_pr?.toFixed(3) ?? '-'} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="F1 (最优阈值)" value={metrics?.metrics?.f1?.toFixed(3) ?? '-'} /></Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Base Model 性能 (OOF AUC)" extra={<Button onClick={retrain} loading={training}>重新训练</Button>}>
            <Descriptions column={1} size="small" bordered>
              {metrics?.metrics?.per_model_auc &&
                Object.entries(metrics.metrics.per_model_auc).map(([k, v]: any) => (
                  <Descriptions.Item key={k} label={k}>{Number(v).toFixed(3)}</Descriptions.Item>
                ))}
              <Descriptions.Item label="最优阈值">{metrics?.metrics?.threshold?.toFixed(3)}</Descriptions.Item>
              <Descriptions.Item label="模型路径"><Text code style={{ fontSize: 11 }}>{metrics?.model_path}</Text></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Top-20 特征重要性">
            <Table
              size="small" pagination={false}
              dataSource={importance.map((f) => ({ ...f, key: f.name }))}
              columns={[
                { title: '排名', key: 'rank', width: 60, render: (_: any, __: any, i: number) => i + 1 },
                { title: '特征', dataIndex: 'name' },
                {
                  title: '重要度', dataIndex: 'importance', width: 200,
                  render: (v: number) => (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: Math.max(2, v * 140), height: 12,
                        background: '#1677ff', borderRadius: 2,
                      }} />
                      <span style={{ marginLeft: 8, fontSize: 11 }}>{v.toFixed(3)}</span>
                    </div>
                  ),
                },
              ]}
            />
          </Card>
        </Col>
      </Row>
    </Spin>
  );
}
