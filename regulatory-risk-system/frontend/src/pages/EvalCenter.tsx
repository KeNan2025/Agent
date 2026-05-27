import { useState } from 'react';
import {
  Card, Button, Table, Input, Tabs, Spin, Tag, Row, Col, Statistic, Alert, Typography,
} from 'antd';
import { ExperimentOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
    <Tabs
      activeKey={tab} onChange={setTab}
      items={[
        {
          key: 'ablation',
          label: <><ExperimentOutlined /> 消融实验</>,
          children: (
            <Card
              title="6 组消融实验"
              extra={<Button type="primary" onClick={runAblation} loading={ablLoading}>运行</Button>}
            >
              <Alert
                type="info" showIcon style={{ marginBottom: 16 }}
                message="每次运行使用合成训练集做 5-fold 交叉验证；首次约 30 秒，后续秒级"
              />
              <Spin spinning={ablLoading}>
                {ablation ? (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="完整模型 AUC-ROC" value={ablation.full_model.auc_roc.toFixed(3)} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="完整模型 AUC-PR" value={ablation.full_model.auc_pr.toFixed(3)} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="完整模型 F1" value={ablation.full_model.f1.toFixed(3)} />
                        </Card>
                      </Col>
                      <Col span={6}>
                        <Card size="small">
                          <Statistic title="正样本率" value={`${(ablation.summary.positive_rate * 100).toFixed(1)}%`} />
                        </Card>
                      </Col>
                    </Row>
                    <Table
                      rowKey="name" size="middle" pagination={false}
                      dataSource={ablation.ablations}
                      columns={[
                        { title: '实验', dataIndex: 'name', width: 280 },
                        {
                          title: 'AUC-ROC', dataIndex: 'auc_roc',
                          render: (v: number) => v.toFixed(3),
                          width: 100,
                        },
                        {
                          title: 'AUC-PR', dataIndex: 'auc_pr',
                          render: (v: number) => v?.toFixed?.(3) ?? '-',
                          width: 100,
                        },
                        {
                          title: 'F1', dataIndex: 'f1',
                          render: (v: number) => v.toFixed(3), width: 90,
                        },
                        {
                          title: 'ΔAUC vs 完整', key: 'delta',
                          render: (_: any, r: any) => {
                            const d = r.auc_roc - ablation.full_model.auc_roc;
                            return <Tag color={d < 0 ? 'red' : 'green'}>{d.toFixed(3)}</Tag>;
                          },
                          width: 130,
                        },
                        { title: '预期结论', dataIndex: 'expected', width: 200 },
                      ]}
                    />
                  </>
                ) : <Text type="secondary">点击「运行」开始</Text>}
              </Spin>
            </Card>
          ),
        },
        {
          key: 'baseline',
          label: <><ThunderboltOutlined /> 基线对比</>,
          children: (
            <Card
              title="4 组基线对比"
              extra={<Button type="primary" onClick={runBaseline} loading={blLoading}>运行</Button>}
            >
              <Spin spinning={blLoading}>
                {baseline ? (
                  <>
                    <Card size="small" style={{ marginBottom: 16, background: '#e6f4ff' }}>
                      <Row gutter={16}>
                        <Col span={6}>
                          <Statistic
                            title="完整模型 AUC-ROC"
                            value={baseline.full_model.auc_roc.toFixed(3)}
                            valueStyle={{ color: '#1677ff', fontWeight: 700 }}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic
                            title="完整模型 AUC-PR"
                            value={baseline.full_model.auc_pr.toFixed(3)}
                          />
                        </Col>
                        <Col span={6}>
                          <Statistic title="完整模型 F1" value={baseline.full_model.f1.toFixed(3)} />
                        </Col>
                      </Row>
                    </Card>
                    <Table
                      rowKey="name" size="middle" pagination={false}
                      dataSource={baseline.baselines}
                      columns={[
                        { title: '基线方法', dataIndex: 'name', width: 240 },
                        {
                          title: 'AUC-ROC', dataIndex: 'auc_roc',
                          render: (v: number) => v.toFixed(3), width: 120,
                        },
                        {
                          title: 'AUC-PR', dataIndex: 'auc_pr',
                          render: (v: number) => (v ?? null) === null ? '-' : v.toFixed(3),
                          width: 120,
                        },
                        {
                          title: 'F1', dataIndex: 'f1',
                          render: (v: number) => v.toFixed(3), width: 120,
                        },
                        {
                          title: 'Δ AUC', key: 'delta',
                          render: (_: any, r: any) => {
                            const d = r.auc_roc - baseline.full_model.auc_roc;
                            return <Tag color={d < 0 ? 'red' : 'green'}>{d.toFixed(3)}</Tag>;
                          },
                          width: 100,
                        },
                      ]}
                    />
                  </>
                ) : <Text type="secondary">点击「运行」开始</Text>}
              </Spin>
            </Card>
          ),
        },
        {
          key: 'judge',
          label: <><ExperimentOutlined /> LLM-as-Judge</>,
          children: (
            <Card title="LLM-as-Judge 报告评估">
              <Input.Group compact style={{ marginBottom: 16 }}>
                <Input
                  style={{ width: 200 }}
                  value={judgeCode}
                  onChange={(e) => setJudgeCode(e.target.value)}
                  placeholder="公司代码"
                />
                <Button type="primary" onClick={runJudge} loading={judgeLoading}>评估</Button>
              </Input.Group>

              <Spin spinning={judgeLoading}>
                {judgeResult && (
                  <>
                    <Row gutter={16} style={{ marginBottom: 16 }}>
                      {Object.entries(judgeResult.scores || {}).map(([k, v]: any) => (
                        <Col span={4} key={k}>
                          <Card size="small">
                            <Statistic title={k} value={v} suffix="/100" />
                          </Card>
                        </Col>
                      ))}
                      <Col span={4}>
                        <Card size="small" style={{ background: '#fff7e6' }}>
                          <Statistic
                            title="加权总分"
                            value={judgeResult.weighted_total}
                            suffix="/100"
                            valueStyle={{ color: '#fa8c16', fontWeight: 700 }}
                          />
                        </Card>
                      </Col>
                    </Row>
                    {judgeResult.issues?.length > 0 && (
                      <Card size="small" title="问题" style={{ marginBottom: 12 }}>
                        <ul>{judgeResult.issues.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                      </Card>
                    )}
                    {judgeResult.suggestions?.length > 0 && (
                      <Card size="small" title="建议">
                        <ul>{judgeResult.suggestions.map((s: string, i: number) => <li key={i}>{s}</li>)}</ul>
                      </Card>
                    )}
                  </>
                )}
              </Spin>
            </Card>
          ),
        },
      ]}
    />
  );
}
