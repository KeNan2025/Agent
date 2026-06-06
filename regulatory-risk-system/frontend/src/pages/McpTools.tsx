import { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Alert,
  Input, Spin, message, Row, Col, Progress,
} from 'antd';
import { ApiOutlined, ThunderboltOutlined, PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { mcpListTools, mcpCallTool, mcpToolStats } from '../api/client';
import type { McpTool, McpToolStat } from '../types';
import StatCard from '../components/StatCard';
import PageTitle from '../components/PageTitle';

export default function McpTools() {
  const [tools, setTools] = useState<McpTool[]>([]);
  const [stats, setStats] = useState<Record<string, McpToolStat>>({});
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<McpTool | null>(null);
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

  const handleSelectTool = (tool: McpTool) => {
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
      render: (v: string) => <Tag color="purple" style={{ fontWeight: 600 }}>{v}</Tag>,
    },
    {
      title: '描述', dataIndex: 'description',
      render: (v: string) => <span style={{ color: 'var(--text-normal)', maxWidth: 300, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</span>,
    },
    {
      title: '调用次数 (24h)', key: 'calls', width: 130,
      render: (_: any, r: McpTool) => {
        const count = stats[r.name]?.count || 0;
        return <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--text-bright)' }}>{count}</span>;
      },
    },
    {
      title: '成功率', key: 'success_rate', width: 120,
      render: (_: any, r: McpTool) => {
        const s = stats[r.name]?.success_rate;
        if (s === undefined) return <span style={{ color: 'var(--text-dim)' }}>-</span>;
        const pct = Math.round(s * 100);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct} size="small" showInfo={false}
              strokeColor={pct >= 90 ? 'var(--success)' : pct >= 70 ? 'var(--warning)' : 'var(--danger)'}
              style={{ width: 60, margin: 0 }}
            />
            <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: 'var(--text-bright)' }}>{pct}%</span>
          </div>
        );
      },
    },
    {
      title: '平均耗时', key: 'avg_ms', width: 100,
      render: (_: any, r: McpTool) => {
        const ms = stats[r.name]?.avg_ms;
        return ms != null
          ? <span style={{ fontVariantNumeric: 'tabular-nums', color: 'var(--text-bright)' }}>{ms} ms</span>
          : <span style={{ color: 'var(--text-dim)' }}>-</span>;
      },
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: McpTool) => (
        <Button type="link" size="small" icon={<PlayCircleOutlined />}
                onClick={() => handleSelectTool(r)}>
          调用
        </Button>
      ),
    },
  ];

  const totalCalls = Object.values(stats).reduce((sum, s) => sum + (s?.count || 0), 0);

  return (
    <Spin spinning={loading}>
      <div className="page-container fade-in">
        <PageTitle title="MCP 工具注册中心" />

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={8}>
            <StatCard title="可挂载 Skill" value={tools.length} color="purple" icon={<ApiOutlined />} />
          </Col>
          <Col xs={12} sm={8}>
            <StatCard title="24h 总调用" value={totalCalls} color="cyan" icon={<ThunderboltOutlined />} />
          </Col>
          <Col xs={24} sm={8}>
            <Card styles={{ body: { padding: '16px 20px' } }}>
              <Alert
                type="info" showIcon
                message="MCP（Model Context Protocol）兼容接口"
                description={
                  <span style={{ fontSize: 12, color: 'var(--text-normal)' }}>
                    所有 Skill 均支持 MCP 协议标准调用，可在任何兼容 MCP 的客户端中挂载使用
                  </span>
                }
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={selected ? 14 : 24} style={{ transition: 'all 0.3s ease' }}>
            <Card
              title={
                <Space><ApiOutlined style={{ color: 'var(--purple)' }} /><span style={{ fontWeight: 600 }}>所有可用 Skill</span></Space>
              }
            >
              <Table
                size="middle" rowKey="name" pagination={false}
                columns={columns} dataSource={tools}
              />
            </Card>
          </Col>
          {selected && (
            <Col span={10} className="fade-in-up">
              <Card
                title={
                  <Space>
                    <PlayCircleOutlined style={{ color: 'var(--primary)' }} />
                    <span>调用</span>
                    <Tag color="purple">{selected.name}</Tag>
                  </Space>
                }
                extra={
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setSelected(null)} />
                }
              >
                <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{selected.description}</p>
                <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-bright)' }}>参数 (JSON):</span>
                <Input.TextArea
                  rows={6}
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  style={{ marginTop: 8, fontFamily: 'monospace', fontSize: 12 }}
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
                    size="small"
                    style={{
                      marginTop: 12,
                      borderLeft: `3px solid ${result.ok ? 'var(--success)' : 'var(--danger)'}`,
                      background: result.ok ? 'var(--success-soft)' : 'var(--danger-soft)',
                      border: `1px solid ${result.ok ? 'rgba(82,196,26,0.12)' : 'rgba(255,77,79,0.12)'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Tag color={result.ok ? 'green' : 'red'}>
                        {result.ok ? '成功' : '失败'}
                      </Tag>
                      <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{result.duration_ms} ms</span>
                    </div>
                    <pre className="text-mono" style={{ maxHeight: 320, overflow: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0, color: 'var(--text-normal)' }}>
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
