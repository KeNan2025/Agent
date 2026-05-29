import { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Alert,
  Input, Spin, message, Row, Col, Statistic, Progress,
} from 'antd';
import { ApiOutlined, ThunderboltOutlined, PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { mcpListTools, mcpCallTool, mcpToolStats } from '../api/client';

export default function McpTools() {
  const [tools, setTools] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [args, setArgs] = useState('{}');
  const [result, setResult] = useState<any | null>(null);
  const [calling, setCalling] = useState(false);

  useEffect(() => {
    Promise.all([mcpListTools(), mcpToolStats(24)]).then(([t, s]) => {
      setTools(t.tools);
      setStats(s.stats || {});
      setLoading(false);
    });
  }, []);

  const handleCall = async () => {
    if (!selected) return;
    setCalling(true);
    setResult(null);
    try {
      const parsed = JSON.parse(args);
      const out = await mcpCallTool(selected.name, parsed);
      setResult(out);
    } catch (e: any) {
      message.error('调用失败: ' + (e?.message ?? e));
    }
    setCalling(false);
  };

  const handleSelectTool = (tool: any) => {
    setSelected(tool);
    const props = tool.inputSchema?.properties || {};
    const required: string[] = tool.inputSchema?.required || [];
    const seed: Record<string, any> = {};
    required.forEach((k) => {
      const t = props[k]?.type;
      seed[k] = t === 'number' ? 0 : t === 'integer' ? 0 : t === 'boolean' ? false : t === 'array' ? [] : '';
    });
    setArgs(JSON.stringify(seed, null, 2));
    setResult(null);
  };

  const columns = [
    {
      title: '名称', dataIndex: 'name', width: 200,
      render: (v: string) => <Tag color="purple" style={{ borderRadius: 4, fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '描述', dataIndex: 'description',
      render: (v: string) => <span style={{ color: 'var(--text-2)', maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>,
    },
    {
      title: '调用次数 (24h)', key: 'calls', width: 130,
      render: (_: any, r: any) => {
        const count = stats[r.name]?.count || 0;
        return <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{count}</span>;
      },
    },
    {
      title: '成功率', key: 'success_rate', width: 120,
      render: (_: any, r: any) => {
        const s = stats[r.name]?.success_rate;
        if (s === undefined) return <span style={{ color: 'var(--text-3)' }}>-</span>;
        const pct = Math.round(s * 100);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct} size="small" showInfo={false}
              strokeColor={pct >= 90 ? '#10b981' : pct >= 70 ? '#f59e0b' : '#ef4444'}
              style={{ width: 60, margin: 0 }}
            />
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{pct}%</span>
          </div>
        );
      },
    },
    {
      title: '平均耗时', key: 'avg_ms', width: 100,
      render: (_: any, r: any) => {
        const ms = stats[r.name]?.avg_ms;
        return ms != null
          ? <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-1)' }}>{ms} ms</span>
          : <span style={{ color: 'var(--text-3)' }}>-</span>;
      },
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: any) => (
        <Button type="link" size="small" icon={<PlayCircleOutlined />}
                onClick={() => handleSelectTool(r)}>
          调用
        </Button>
      ),
    },
  ];

  const totalCalls = Object.values(stats).reduce((sum: number, s: any) => sum + (s.count || 0), 0);

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <div className="page-title">
          <span className="title-bar" />
          MCP 工具注册中心
        </div>

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={8}>
            <Card className="stat-card stat-purple" bodyStyle={{ padding: '20px 24px' }}>
              <ApiOutlined className="stat-icon" />
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>可挂载 Skill</span>}
                value={tools.length}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card className="stat-card stat-cyan" bodyStyle={{ padding: '20px 24px' }}>
              <ThunderboltOutlined className="stat-icon" />
              <Statistic
                title={<span style={{ fontSize: 13, color: 'var(--text-3)' }}>24h 总调用</span>}
                value={totalCalls}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#06b6d4' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bodyStyle={{ padding: '16px 20px' }}>
              <Alert
                type="info" showIcon
                message="MCP（Model Context Protocol）兼容接口"
                description={
                  <span style={{ fontSize: 12, color: 'var(--text-2)' }}>
                    所有 Skill 均支持 MCP 协议标准调用，可在任何兼容 MCP 的客户端中挂载使用
                  </span>
                }
                style={{ borderRadius: 8 }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={selected ? 14 : 24} style={{ transition: 'all 0.3s ease' }}>
            <Card
              title={
                <Space><ApiOutlined style={{ color: '#722ed1' }} /><span style={{ fontWeight: 600 }}>所有可用 Skill</span></Space>
              }
            >
              <Table
                size="middle" rowKey="name" pagination={false}
                columns={columns} dataSource={tools}
              />
            </Card>
          </Col>
          {selected && (
            <Col span={10} className="slide-in-left">
              <Card
                title={
                  <Space>
                    <PlayCircleOutlined style={{ color: '#1a5cff' }} />
                    <span>调用</span>
                    <Tag color="purple" style={{ borderRadius: 4 }}>{selected.name}</Tag>
                  </Space>
                }
                extra={
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setSelected(null)} />
                }
              >
                <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{selected.description}</p>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-1)' }}>参数 (JSON):</span>
                <Input.TextArea
                  rows={6}
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  style={{ marginTop: 8, background: 'var(--bg-input)', color: 'var(--text-1)', fontFamily: 'monospace', borderColor: 'var(--border)', fontSize: 12, borderRadius: 8 }}
                />
                <Button
                  type="primary"
                  style={{ marginTop: 12 }}
                  onClick={handleCall}
                  loading={calling}
                  icon={<ThunderboltOutlined />}
                >
                  运行
                </Button>
                {result && (
                  <Card
                    size="small" className="result-panel"
                    style={{
                      marginTop: 12,
                      borderLeft: `3px solid ${result.ok ? '#10b981' : '#ef4444'}`,
                      ...(result.ok
                        ? { background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.12)' }
                        : { background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.12)' }
                      ),
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Tag color={result.ok ? 'green' : 'red'} style={{ borderRadius: 4 }}>
                        {result.ok ? '成功' : '失败'}
                      </Tag>
                      <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{result.duration_ms} ms</span>
                    </div>
                    <pre className="text-mono" style={{ maxHeight: 320, overflow: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0, color: 'var(--text-2)' }}>
                      {JSON.stringify(result, null, 2)}
                    </pre>
                  </Card>
                )}
              </Card>
            </Col>
          )}
        </Row>
      </div>
    </Spin>
  );
}
