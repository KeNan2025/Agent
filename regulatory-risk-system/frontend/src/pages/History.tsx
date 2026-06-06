import { useEffect, useState } from 'react';
import {
  Card, Table, Tag, Button, Row, Col, Spin, Space, Badge,
} from 'antd';
import {
  HistoryOutlined, FileTextOutlined, ClockCircleOutlined,
  ThunderboltOutlined, CloseOutlined, WarningOutlined,
  DownloadOutlined,
} from '@ant-design/icons';
import { listScans, getScanTrace, getTraceExportUrl } from '../api/client';
import { useNavigate } from 'react-router-dom';
import type { ScanRecord } from '../types';
import { formatDate } from '../utils/format';
import StatCard from '../components/StatCard';
import ProbabilityBar from '../components/ProbabilityBar';
import RiskBadge from '../components/RiskBadge';
import PageTitle from '../components/PageTitle';

export default function History() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [traceLoading, setTraceLoading] = useState(false);
  const [trace, setTrace] = useState<any | null>(null);

  useEffect(() => {
    listScans(100).then((d: any) => {
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
        <span className="text-mono" style={{ fontSize: 11, color: 'var(--text-dim)' }}>
          {v.slice(0, 12)}...
        </span>
      ),
    },
    {
      title: '公司代码', dataIndex: 'company_code', width: 110,
      render: (v: string) => (
        <span className="code-link" onClick={() => navigate(`/company/${v}`)}>
          {v}
        </span>
      ),
    },
    {
      title: '窗口', dataIndex: 'window_days', width: 80,
      render: (v: number) => <Tag>{v}天</Tag>,
    },
    {
      title: '问询概率', dataIndex: 'probability', width: 200,
      render: (v: number) => <ProbabilityBar value={v} size="small" />,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => <RiskBadge level={v} />,
    },
    {
      title: '时间', dataIndex: 'created_at', width: 170,
      render: (v: string) => (
        <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>
          {v ? v.replace('T', ' ').slice(0, 19) : '-'}
        </span>
      ),
    },
    {
      title: '操作', key: 'op', width: 110,
      render: (_: any, r: ScanRecord) => (
        <Button type="default" className="btn-purple" size="small" icon={<FileTextOutlined />}
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
      <div className="page-container fade-in">
        <PageTitle title="扫雷历史" />

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={24} sm={8}>
            <StatCard title="历史扫雷次数" value={scans.length} color="blue" icon={<HistoryOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title="高风险占比" value={scans.length ? (highCount / scans.length * 100).toFixed(1) : 0} suffix="%" color="red" icon={<WarningOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <StatCard title="平均概率" value={(avgProb * 100).toFixed(1)} suffix="%" color="green" />
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={trace ? 14 : 24} style={{ transition: 'all 0.3s ease' }}>
            <Card
              title={
                <Space><HistoryOutlined style={{ color: 'var(--primary)' }} /><span style={{ fontWeight: 600 }}>持久化扫雷历史</span></Space>
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
            <Col span={10} className="fade-in-up">
              <Card
                title={
                  <Space><FileTextOutlined style={{ color: 'var(--primary)' }} />Trace 详情</Space>
                }
                extra={
                  <Space>
                    <Button
                      size="small"
                      className="btn-ghost-primary"
                      icon={<DownloadOutlined />}
                      onClick={() => {
                        if (trace?.scan_id) {
                          window.open(getTraceExportUrl(trace.scan_id), '_blank');
                        }
                      }}
                    >
                      导出 Trace
                    </Button>
                    <Button type="text" icon={<CloseOutlined />} onClick={() => setTrace(null)} />
                  </Space>
                }
              >
                <Spin spinning={traceLoading}>
                  <div style={{ maxHeight: 600, overflow: 'auto' }}>
                    {trace.events?.map((e: any) => (
                      <Card
                        size="small" key={e.event_id}
                        className="trace-card"
                        style={{ marginBottom: 8 }}
                        styles={{ body: { padding: '10px 14px' } }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Space size={8}>
                            <Tag color="blue">{e.node_name}</Tag>
                            <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>{e.action}</span>
                          </Space>
                          <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: 'var(--text-dim)' }}>
                            <ClockCircleOutlined style={{ marginRight: 3 }} />{e.duration_ms}ms
                            {e.tokens_used > 0 && (
                              <span style={{ marginLeft: 8 }}>
                                <ThunderboltOutlined style={{ marginRight: 3 }} />{e.tokens_used}t
                              </span>
                            )}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-normal)', marginTop: 6 }}>
                          <div style={{ marginBottom: 2 }}><span style={{ color: 'var(--text-dim)' }}>输入：</span>{e.input_summary}</div>
                          <div><span style={{ color: 'var(--text-dim)' }}>输出：</span>{e.output_summary}</div>
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
