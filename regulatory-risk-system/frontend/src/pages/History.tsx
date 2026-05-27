import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Row, Col, Statistic, Spin, Typography, Space, Badge,
} from 'antd';
import {
  HistoryOutlined, FileTextOutlined, ClockCircleOutlined,
  ThunderboltOutlined, CloseOutlined, WarningOutlined, RightOutlined,
} from '@ant-design/icons';
import { listScans, getScanTrace } from '../api/client';
import { useNavigate } from 'react-router-dom';

const { Text } = Typography;

const riskColorMap: Record<string, string> = {
  '高风险': '#f5222d', '中风险': '#fa8c16', '低风险': '#52c41a',
};

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

  const columns = [
    {
      title: 'Scan ID', dataIndex: 'scan_id', width: 200,
      render: (v: string) => (
        <Text copyable style={{ fontSize: 12, fontFamily: "'SF Mono', Consolas, monospace" }}>
          {v.slice(0, 12)}...
        </Text>
      ),
    },
    {
      title: '公司代码', dataIndex: 'company_code', width: 110,
      render: (v: string) => (
        <Text strong style={{ color: '#1677ff', cursor: 'pointer' }}
              onClick={() => navigate(`/company/${v}`)}>
          {v}
        </Text>
      ),
    },
    {
      title: '窗口', dataIndex: 'window_days', width: 80,
      render: (v: number) => <Tag style={{ borderRadius: 4 }}>{v}天</Tag>,
    },
    {
      title: '问询概率', dataIndex: 'probability', width: 120,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.6 ? '#f5222d' : v >= 0.3 ? '#fa8c16' : '#52c41a';
        return (
          <Text strong style={{ color, fontVariantNumeric: 'tabular-nums' }}>{pct}%</Text>
        );
      },
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => (
        <Badge
          color={riskColorMap[v]}
          text={<Text style={{ color: riskColorMap[v], fontWeight: 600, fontSize: 13 }}>{v}</Text>}
        />
      ),
    },
    {
      title: '时间', dataIndex: 'created_at', width: 170,
      render: (v: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>
          {v ? v.replace('T', ' ').slice(0, 19) : '-'}
        </Text>
      ),
    },
    {
      title: '操作', key: 'op', width: 110,
      render: (_: any, r: any) => (
        <Button type="link" size="small" icon={<FileTextOutlined />}
                onClick={() => handleViewTrace(r.scan_id)}>
          查看 Trace
        </Button>
      ),
    },
  ];

  const highCount = scans.filter((s) => s.risk_level === '高风险').length;
  const avgProb = scans.length
    ? scans.reduce((s, x) => s + x.probability, 0) / scans.length
    : 0;

  return (
    <Spin spinning={loading}>
      <div className="fade-in">
        <div className="page-title">
          <span className="title-bar" />
          扫雷历史
        </div>

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
              <HistoryOutlined className="stat-icon" />
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>历史扫雷次数</Text>}
                value={scans.length}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card stat-red" bodyStyle={{ padding: '20px 24px' }}>
              <WarningOutlined className="stat-icon" />
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>高风险占比</Text>}
                value={scans.length ? (highCount / scans.length * 100).toFixed(1) : 0}
                suffix="%"
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card className="stat-card stat-orange" bodyStyle={{ padding: '20px 24px' }}>
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>平均概率</Text>}
                value={(avgProb * 100).toFixed(1)}
                suffix="%"
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={trace ? 14 : 24} style={{ transition: 'all 0.3s ease' }}>
            <Card
              title={
                <Space><HistoryOutlined style={{ color: '#1677ff' }} /><span style={{ fontWeight: 600 }}>持久化扫雷历史</span></Space>
              }
            >
              <Table
                rowKey="scan_id" columns={columns} dataSource={scans}
                pagination={{ pageSize: 15, showQuickJumper: true }}
                size="middle"
              />
            </Card>
          </Col>
          {trace && (
            <Col span={10} className="slide-in-left">
              <Card
                title={
                  <Space><FileTextOutlined style={{ color: '#1677ff' }} />Trace 详情</Space>
                }
                extra={
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setTrace(null)} />
                }
              >
                <Spin spinning={traceLoading}>
                  <div style={{ maxHeight: 600, overflow: 'auto' }}>
                    {trace.events?.map((e: any) => (
                      <Card
                        size="small" key={e.event_id}
                        className="trace-card"
                        style={{ marginBottom: 8, borderLeftColor: '#1677ff' }}
                        bodyStyle={{ padding: '10px 14px' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size={8}>
                            <Tag color="blue" style={{ borderRadius: 4, fontWeight: 600 }}>{e.node_name}</Tag>
                            <Text strong style={{ fontSize: 13 }}>{e.action}</Text>
                          </Space>
                          <Text type="secondary" style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                            <ClockCircleOutlined style={{ marginRight: 3 }} />{e.duration_ms}ms
                            {e.tokens_used > 0 && (
                              <span style={{ marginLeft: 8 }}>
                                <ThunderboltOutlined style={{ marginRight: 3 }} />{e.tokens_used}t
                              </span>
                            )}
                          </Text>
                        </div>
                        <div style={{ fontSize: 12, color: '#595959', marginTop: 6 }}>
                          <div style={{ marginBottom: 2 }}><Text type="secondary">输入：</Text>{e.input_summary}</div>
                          <div><Text type="secondary">输出：</Text>{e.output_summary}</div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </Spin>
              </Card>
            </Col>
          )}
        </Row>
      </div>
    </Spin>
  );
}
