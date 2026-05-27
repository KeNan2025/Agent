import { useEffect, useState } from 'react';
import { Card, Table, Tag, Button, Row, Col, Statistic, Spin } from 'antd';
import { HistoryOutlined, FileTextOutlined } from '@ant-design/icons';
import { listScans, getScanTrace } from '../api/client';
import { useNavigate } from 'react-router-dom';

export default function History() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<any[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [trace, setTrace] = useState<any | null>(null);

  useEffect(() => {
    listScans(100).then((d) => {
      setScans(d.scans);
      setLoading(false);
    });
  }, []);

  const handleViewTrace = async (id: string) => {
    setTraceLoading(true);
    const t = await getScanTrace(id);
    setTrace(t);
    setTraceLoading(false);
  };

  const riskColor: Record<string, string> = { '高风险': 'red', '中风险': 'orange', '低风险': 'green' };

  const columns = [
    { title: 'Scan ID', dataIndex: 'scan_id', width: 200, render: (v: string) => <code style={{ fontSize: 12 }}>{v}</code> },
    {
      title: '公司代码', dataIndex: 'company_code', width: 110,
      render: (v: string) => <a onClick={() => navigate(`/company/${v}`)}>{v}</a>,
    },
    { title: '窗口', dataIndex: 'window_days', width: 80, render: (v: number) => `${v}天` },
    {
      title: '问询概率', dataIndex: 'probability', width: 100,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span>,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => <Tag color={riskColor[v]}>{v}</Tag>,
    },
    {
      title: '时间', dataIndex: 'created_at', width: 180,
      render: (v: string) => v ? v.replace('T', ' ').slice(0, 19) : '-',
    },
    {
      title: '操作', key: 'op', width: 110,
      render: (_: any, r: any) => <a onClick={() => handleViewTrace(r.scan_id)}>查看 Trace</a>,
    },
  ];

  const highCount = scans.filter((s) => s.risk_level === '高风险').length;

  return (
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card><Statistic title="历史扫雷次数" value={scans.length} prefix={<HistoryOutlined />} /></Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="高风险占比" value={scans.length ? (highCount / scans.length * 100).toFixed(1) : 0} suffix="%" valueStyle={{ color: '#f5222d' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic title="平均概率" value={scans.length ? (scans.reduce((s, x) => s + x.probability, 0) / scans.length * 100).toFixed(1) : 0} suffix="%" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={trace ? 14 : 24}>
          <Card title="持久化扫雷历史（数据库 ScanRecord）">
            <Table rowKey="scan_id" columns={columns} dataSource={scans} pagination={{ pageSize: 15 }} size="middle" />
          </Card>
        </Col>
        {trace && (
          <Col span={10}>
            <Card title={<><FileTextOutlined /> Trace 详情</>}
                  extra={<Button onClick={() => setTrace(null)}>关闭</Button>}>
              <Spin spinning={traceLoading}>
                <div style={{ maxHeight: 600, overflow: 'auto' }}>
                  {trace.events?.map((e: any) => (
                    <Card size="small" key={e.event_id} style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span><Tag color="blue">{e.node_name}</Tag> <strong>{e.action}</strong></span>
                        <span style={{ color: '#888' }}>{e.duration_ms}ms · {e.tokens_used}t</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
                        <div>输入: {e.input_summary}</div>
                        <div>输出: {e.output_summary}</div>
                      </div>
                    </Card>
                  ))}
                </div>
              </Spin>
            </Card>
          </Col>
        )}
      </Row>
    </Spin>
  );
}
