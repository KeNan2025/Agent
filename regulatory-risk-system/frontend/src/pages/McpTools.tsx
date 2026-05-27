import { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Button, Space, Alert,
  Input, Spin, message, Row, Col, Statistic, Typography, Progress,
} from 'antd';
import { ApiOutlined, ThunderboltOutlined, PlayCircleOutlined, CloseOutlined } from '@ant-design/icons';
import { mcpListTools, mcpCallTool, mcpToolStats } from '../api/client';

const { Text, Paragraph } = Typography;

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
      render: (v: string) => <Text ellipsis={{ tooltip: v }} style={{ maxWidth: 300 }}>{v}</Text>,
    },
    {
      title: '调用次数 (24h)', key: 'calls', width: 130,
      render: (_: any, r: any) => {
        const count = stats[r.name]?.count || 0;
        return <Text strong style={{ fontVariantNumeric: 'tabular-nums' }}>{count}</Text>;
      },
    },
    {
      title: '成功率', key: 'success_rate', width: 120,
      render: (_: any, r: any) => {
        const s = stats[r.name]?.success_rate;
        if (s === undefined) return <Text type="secondary">-</Text>;
        const pct = Math.round(s * 100);
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Progress
              percent={pct} size="small" showInfo={false}
              strokeColor={pct >= 90 ? '#52c41a' : pct >= 70 ? '#faad14' : '#f5222d'}
              style={{ width: 60, margin: 0 }}
            />
            <Text style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{pct}%</Text>
          </div>
        );
      },
    },
    {
      title: '平均耗时', key: 'avg_ms', width: 100,
      render: (_: any, r: any) => {
        const ms = stats[r.name]?.avg_ms;
        return ms != null
          ? <Text style={{ fontVariantNumeric: 'tabular-nums' }}>{ms} ms</Text>
          : <Text type="secondary">-</Text>;
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
      <div className="fade-in">
        <div className="page-title">
          <span className="title-bar" />
          MCP 工具注册中心
        </div>

        <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
          <Col xs={12} sm={8}>
            <Card className="stat-card stat-purple" bodyStyle={{ padding: '20px 24px' }}>
              <ApiOutlined className="stat-icon" />
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>可挂载 Skill</Text>}
                value={tools.length}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#722ed1' }}
              />
            </Card>
          </Col>
          <Col xs={12} sm={8}>
            <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
              <ThunderboltOutlined className="stat-icon" />
              <Statistic
                title={<Text type="secondary" style={{ fontSize: 13 }}>24h 总调用</Text>}
                value={totalCalls}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={8}>
            <Card bodyStyle={{ padding: '16px 20px' }}>
              <Alert
                type="info" showIcon
                message="MCP 兼容接口"
                description={
                  <Text style={{ fontSize: 12 }}>
                    POST /mcp/v1/tools/list 与 /tools/call 暴露所有 Skill
                  </Text>
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
                    <PlayCircleOutlined style={{ color: '#1677ff' }} />
                    <span>调用</span>
                    <Tag color="purple" style={{ borderRadius: 4 }}>{selected.name}</Tag>
                  </Space>
                }
                extra={
                  <Button type="text" icon={<CloseOutlined />} onClick={() => setSelected(null)} />
                }
              >
                <Paragraph type="secondary" style={{ fontSize: 13 }}>{selected.description}</Paragraph>
                <Text strong style={{ fontSize: 13 }}>参数 (JSON):</Text>
                <Input.TextArea
                  rows={6}
                  value={args}
                  onChange={(e) => setArgs(e.target.value)}
                  style={{ marginTop: 8, fontFamily: "'SF Mono', 'Fira Code', Consolas, monospace", fontSize: 12, borderRadius: 8 }}
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
                      borderLeft: `3px solid ${result.ok ? '#52c41a' : '#f5222d'}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <Tag color={result.ok ? 'green' : 'red'} style={{ borderRadius: 4 }}>
                        {result.ok ? '成功' : '失败'}
                      </Tag>
                      <Text type="secondary" style={{ fontSize: 12 }}>{result.duration_ms} ms</Text>
                    </div>
                    <pre style={{ maxHeight: 320, overflow: 'auto', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
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
