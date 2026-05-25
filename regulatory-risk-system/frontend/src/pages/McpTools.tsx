import { useState, useEffect } from 'react';
import {
  Card, Table, Tag, Progress, Button, Space, Alert,
  Input, Spin, message, Row, Col, Statistic, Typography,
} from 'antd';
import { ApiOutlined, ThunderboltOutlined } from '@ant-design/icons';
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
    { title: '名称', dataIndex: 'name', width: 200, render: (v: string) => <Tag color="purple">{v}</Tag> },
    { title: '描述', dataIndex: 'description' },
    {
      title: '调用次数 (24h)', key: 'calls', width: 130,
      render: (_: any, r: any) => <span>{stats[r.name]?.count || 0}</span>,
    },
    {
      title: '成功率', key: 'success_rate', width: 100,
      render: (_: any, r: any) => {
        const s = stats[r.name]?.success_rate;
        return s === undefined ? '-' : <Progress percent={Math.round(s * 100)} size="small" style={{ width: 80 }} />;
      },
    },
    {
      title: '平均耗时', key: 'avg_ms', width: 100,
      render: (_: any, r: any) => stats[r.name]?.avg_ms != null ? `${stats[r.name].avg_ms} ms` : '-',
    },
    {
      title: '操作', key: 'action', width: 100,
      render: (_: any, r: any) => <a onClick={() => handleSelectTool(r)}>调用</a>,
    },
  ];

  const totalCalls = Object.values(stats).reduce((sum: number, s: any) => sum + (s.count || 0), 0);

  return (
    <Spin spinning={loading}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card><Statistic title="可挂载 Skill 数量" value={tools.length} prefix={<ApiOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card><Statistic title="24h 总调用数" value={totalCalls} prefix={<ThunderboltOutlined />} /></Card>
        </Col>
        <Col span={12}>
          <Card>
            <Alert
              type="info"
              showIcon
              message="MCP（Model Context Protocol）兼容接口"
              description="POST /mcp/v1/tools/list 与 /mcp/v1/tools/call 暴露所有 Skill，可在任何兼容 MCP 的客户端中挂载使用。"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={selected ? 14 : 24}>
          <Card title="所有可用 Skill">
            <Table
              size="middle" rowKey="name" pagination={false}
              columns={columns} dataSource={tools}
            />
          </Card>
        </Col>
        {selected && (
          <Col span={10}>
            <Card title={<>调用 <Tag color="purple">{selected.name}</Tag></>}
                  extra={<Button onClick={() => setSelected(null)}>关闭</Button>}>
              <Paragraph type="secondary">{selected.description}</Paragraph>
              <Text strong>参数 (JSON):</Text>
              <Input.TextArea
                rows={6}
                value={args}
                onChange={(e) => setArgs(e.target.value)}
                style={{ marginTop: 8, fontFamily: 'monospace' }}
              />
              <Button
                type="primary"
                style={{ marginTop: 8 }}
                onClick={handleCall}
                loading={calling}
              >
                运行
              </Button>
              {result && (
                <Card size="small" style={{ marginTop: 12, background: result.ok ? '#f6ffed' : '#fff2f0' }}>
                  <Text strong>结果 ({result.ok ? '成功' : '失败'}, {result.duration_ms} ms):</Text>
                  <pre style={{ maxHeight: 320, overflow: 'auto', marginTop: 8, fontSize: 12 }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </Card>
              )}
            </Card>
          </Col>
        )}
      </Row>
    </Spin>
  );
}
