import { useState, useEffect } from 'react';
import {
  Card, Row, Col, Select, Spin, Statistic, Space, Tag, Button,
  Empty, message, Table,
} from 'antd';
import {
  NodeIndexOutlined, ThunderboltOutlined, ClockCircleOutlined,
  CodeOutlined, ApiOutlined, PlayCircleOutlined, ReloadOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { getCompanies, scanSingle, getPipelineStatus, getScanTrace } from '../api/client';

/* ── Types ── */

interface TraceEvent {
  agent_name: string;
  action: string;
  duration_ms: number;
  tokens_used: number;
  status: string;
  skills_called?: SkillEntry[];
}

interface SkillEntry {
  skill_name: string;
  agent_name: string;
  duration_ms: number;
  tokens_used: number;
}

interface ScanResult {
  scan_id: string;
  company_code: string;
  probability: number;
  total_duration_ms: number;
  total_tokens: number;
  risk_level: string;
  agent_trace: TraceEvent[];
}

interface PipelineRecord {
  scan_id: string;
  company_code: string;
  probability: number;
  total_duration_ms: number;
  total_tokens: number;
  created_at: string;
}

interface Company {
  company_code: string;
  company_name: string;
}

/* ── Helpers ── */

const STATUS_COLOR: Record<string, string> = {
  running: '#1a5cff',
  completed: '#059669',
  error: '#dc2626',
  waiting: '#9ca3af',
};

const AGENT_NODES = [
  { name: 'Planner', x: 50, y: 200 },
  { name: 'Financial Agent', x: 170, y: 200 },
  { name: 'Announcement Agent', x: 290, y: 200 },
  { name: 'Graph Agent', x: 410, y: 200 },
  { name: 'Replan', x: 530, y: 200 },
  { name: 'Predictor', x: 650, y: 200 },
  { name: 'Case Agent', x: 770, y: 200 },
  { name: 'Attribution Agent', x: 890, y: 200 },
];

const AGENT_EDGES = [
  { source: 'Planner', target: 'Financial Agent' },
  { source: 'Financial Agent', target: 'Announcement Agent' },
  { source: 'Announcement Agent', target: 'Graph Agent' },
  { source: 'Graph Agent', target: 'Replan' },
  { source: 'Replan', target: 'Predictor' },
  { source: 'Predictor', target: 'Case Agent' },
  { source: 'Case Agent', target: 'Attribution Agent' },
];

/* ── Component ── */

export default function PipelineTwin() {
  /* state */
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<string | undefined>(undefined);
  const [windowDays, setWindowDays] = useState<number>(60);
  const [loading, setLoading] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [pipelineHistory, setPipelineHistory] = useState<PipelineRecord[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  /* load companies on mount */
  useEffect(() => {
    (async () => {
      try {
        const data = await getCompanies();
        const list: Company[] = Array.isArray(data)
          ? data
          : Array.isArray(data?.companies)
            ? data.companies
            : Array.isArray(data?.data)
              ? data.data
              : [];
        setCompanies(list);
      } catch {
        // silent
      }
    })();
  }, []);

  /* load pipeline history on mount */
  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setHistoryLoading(true);
    try {
      const data = await getPipelineStatus(5);
      const list: PipelineRecord[] = Array.isArray(data)
        ? data
        : Array.isArray(data?.scans)
          ? data.scans
          : Array.isArray(data?.data)
            ? data.data
            : [];
      setPipelineHistory(list);
    } catch {
      // silent
    } finally {
      setHistoryLoading(false);
    }
  }

  /* trigger scan */
  async function handleScan() {
    if (!selectedCompany) {
      message.warning('请先选择公司代码');
      return;
    }
    setLoading(true);
    setScanResult(null);
    try {
      const raw = await scanSingle(selectedCompany, windowDays);
      const result: ScanResult = {
        scan_id: raw.scan_id ?? raw.id ?? '',
        company_code: raw.company_code ?? selectedCompany,
        probability: raw.probability ?? 0,
        total_duration_ms: raw.total_duration_ms ?? 0,
        total_tokens: raw.total_tokens ?? 0,
        risk_level: raw.risk_level ?? 'none',
        agent_trace: Array.isArray(raw.agent_trace) ? raw.agent_trace : [],
      };
      setScanResult(result);
      message.success('Agent 扫描完成');
      // refresh history
      loadHistory();
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? err?.message ?? '扫描失败');
    } finally {
      setLoading(false);
    }
  }

  /* load historical trace */
  async function handleLoadHistoryTrace(scanId: string) {
    setLoading(true);
    setScanResult(null);
    setSelectedPipelineId(scanId);
    try {
      const raw = await getScanTrace(scanId);
      const result: ScanResult = {
        scan_id: raw.scan_id ?? scanId,
        company_code: raw.company_code ?? '',
        probability: raw.probability ?? 0,
        total_duration_ms: raw.total_duration_ms ?? 0,
        total_tokens: raw.total_tokens ?? 0,
        risk_level: raw.risk_level ?? 'none',
        agent_trace: Array.isArray(raw.agent_trace) ? raw.agent_trace : [],
      };
      setScanResult(result);
      message.success('历史 Pipeline 已加载');
    } catch (err: any) {
      message.error(err?.response?.data?.detail ?? err?.message ?? '加载失败');
    } finally {
      setLoading(false);
    }
  }

  /* ── Derived data ── */

  const agentTrace: TraceEvent[] = scanResult?.agent_trace ?? [];
  const totalLLMCalls = agentTrace.filter((s) => s.agent_name.toLowerCase().includes('llm') || s.tokens_used > 0).length;
  const totalSkills = agentTrace.reduce((acc, s) => acc + (s.skills_called?.length ?? 0), 0);
  const allSkills: SkillEntry[] = agentTrace.flatMap((s) =>
    (s.skills_called ?? []).map((sk) => ({ ...sk, agent_name: sk.agent_name || s.agent_name })),
  );

  /* ── ECharts pipeline graph option ── */

  const pipelineGraphOption = (): Record<string, unknown> => {
    const traceMap = new Map<string, TraceEvent>();
    agentTrace.forEach((t) => traceMap.set(t.agent_name, t));

    const nodes = AGENT_NODES.map((n) => {
      const trace = traceMap.get(n.name);
      const status = trace?.status ?? 'waiting';
      const duration = trace?.duration_ms ?? 50;
      const minSize = 30;
      const maxSize = 72;
      const size = Math.min(maxSize, Math.max(minSize, 20 + duration / 30));

      return {
        name: n.name,
        x: n.x,
        y: n.y,
        symbolSize: size,
        itemStyle: {
          color: STATUS_COLOR[status] ?? STATUS_COLOR.waiting,
          borderColor: '#ffffff',
          borderWidth: 3,
          shadowBlur: 12,
          shadowColor: (STATUS_COLOR[status] ?? STATUS_COLOR.waiting) + '44',
        },
        label: {
          show: true,
          position: 'bottom' as const,
          fontSize: 11,
          color: '#1f2937',
          fontWeight: 600,
          distance: 10,
        },
        tooltip: {
          formatter: () => {
            const t = trace;
            if (!t) return `${n.name}<br/>状态: 等待中`;
            return `<b>${t.agent_name}</b><br/>动作: ${t.action}<br/>耗时: ${t.duration_ms}ms<br/>Token: ${t.tokens_used}<br/>状态: ${t.status}`;
          },
        },
      };
    });

    const edges = AGENT_EDGES.map((e) => ({
      source: e.source,
      target: e.target,
      lineStyle: {
        color: '#cbd5e1',
        width: 2,
        curveness: 0,
        type: 'solid' as const,
      },
      label: {
        show: true,
        position: 'middle' as const,
        fontSize: 9,
        color: '#94a3b8',
        formatter: '→',
        distance: 5,
      },
    }));

    return {
      tooltip: {
        trigger: 'item' as const,
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        textStyle: { color: '#1f2937' },
      },
      series: [
        {
          type: 'graph',
          layout: 'none',
          roam: true,
          draggable: false,
          data: nodes,
          edges,
          emphasis: {
            focus: 'adjacency' as const,
            itemStyle: { borderColor: '#1a5cff', borderWidth: 3 },
            lineStyle: { width: 3, color: '#1a5cff' },
          },
          animation: true,
          animationDuration: 800,
          animationEasing: 'cubicInOut' as const,
        },
      ],
    };
  };

  /* ── Render ── */

  return (
    <div className="page-container fade-in">
      {/* Page title */}
      <div className="page-title">
        <span className="title-bar" />
        <span>Agent Pipeline 运行孪生</span>
      </div>

      {/* Top bar */}
      <Card style={{ marginBottom: 20 }}>
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <span style={{ fontSize: 13, color: 'var(--text-2)', marginRight: 8 }}>公司代码</span>
            <Select
              showSearch
              allowClear
              placeholder="搜索公司代码或名称..."
              style={{ width: 280 }}
              value={selectedCompany}
              onChange={(v) => setSelectedCompany(v)}
              filterOption={(input, option) =>
                (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
              }
              options={companies.map((c) => ({
                label: `${c.company_code} · ${c.company_name}`,
                value: c.company_code,
              }))}
            />
          </Col>
          <Col>
            <span style={{ fontSize: 13, color: 'var(--text-2)', marginRight: 8 }}>窗口(天)</span>
            <Select
              style={{ width: 100 }}
              value={windowDays}
              onChange={(v) => setWindowDays(v)}
              options={[
                { label: '30天', value: 30 },
                { label: '60天', value: 60 },
                { label: '90天', value: 90 },
                { label: '180天', value: 180 },
              ]}
            />
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlayCircleOutlined />}
              onClick={handleScan}
              loading={loading}
              size="middle"
            >
              启动扫描
            </Button>
          </Col>
          <Col>
            <Button
              icon={<ReloadOutlined />}
              onClick={loadHistory}
              size="middle"
            >
              刷新
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Loading */}
      {loading && (
        <Card style={{ marginBottom: 20, textAlign: 'center', padding: 60 }}>
          <Spin
            size="large"
            tip={
              <span style={{ fontSize: 15, color: 'var(--text-1)', marginTop: 16, display: 'block' }}>
                Agent 分析中...
              </span>
            }
          >
            <div style={{ height: 160 }} />
          </Spin>
        </Card>
      )}

      {/* Empty state */}
      {!loading && !scanResult && (
        <Card style={{ marginBottom: 20 }}>
          <Empty
            image={<NodeIndexOutlined style={{ fontSize: 64, color: 'var(--text-3)' }} />}
            description={
              <span style={{ fontSize: 15, color: 'var(--text-2)' }}>
                选择公司并启动 Agent 扫描，可视化 Pipeline 执行全流程
              </span>
            }
          />
        </Card>
      )}

      {/* Results */}
      {!loading && scanResult && (
        <>
          {/* ── Row 1: Stat cards ── */}
          <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
            <Col xs={24} sm={12} md={Math.floor(24 / 5)}>
              <Card className="stat-card stat-blue">
                <div className="stat-icon-bg"><ClockCircleOutlined /></div>
                <Statistic
                  title="总耗时(ms)"
                  value={scanResult.total_duration_ms}
                  valueStyle={{ fontWeight: 700, fontSize: 22, color: 'var(--text-1)' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={Math.floor(24 / 5)}>
              <Card className="stat-card stat-purple">
                <div className="stat-icon-bg"><CodeOutlined /></div>
                <Statistic
                  title="LLM 调用次数"
                  value={totalLLMCalls}
                  valueStyle={{ fontWeight: 700, fontSize: 22, color: 'var(--text-1)' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={Math.floor(24 / 5)}>
              <Card className="stat-card stat-cyan">
                <div className="stat-icon-bg"><ThunderboltOutlined /></div>
                <Statistic
                  title="Token 消耗"
                  value={scanResult.total_tokens}
                  valueStyle={{ fontWeight: 700, fontSize: 22, color: 'var(--text-1)' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={Math.floor(24 / 5)}>
              <Card className="stat-card stat-green">
                <div className="stat-icon-bg"><ApiOutlined /></div>
                <Statistic
                  title="Skill 调用数"
                  value={totalSkills}
                  valueStyle={{ fontWeight: 700, fontSize: 22, color: 'var(--text-1)' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={Math.floor(24 / 5)}>
              <Card className={`stat-card ${scanResult.risk_level === 'high' ? 'stat-red' : scanResult.risk_level === 'medium' ? 'stat-orange' : 'stat-green'}`}>
                <div className="stat-icon-bg"><NodeIndexOutlined /></div>
                <Statistic
                  title="风险等级"
                  value={scanResult.risk_level.toUpperCase()}
                  valueStyle={{
                    fontWeight: 700,
                    fontSize: 22,
                    color: scanResult.risk_level === 'high'
                      ? 'var(--danger)'
                      : scanResult.risk_level === 'medium'
                        ? 'var(--warning)'
                        : 'var(--success)',
                  }}
                />
              </Card>
            </Col>
          </Row>

          {/* ── Row 2: Pipeline graph + Trace log ── */}
          <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
            {/* Left: ECharts Pipeline 流程图 */}
            <Col xs={24} lg={16}>
              <Card
                title={
                  <Space>
                    <NodeIndexOutlined style={{ color: 'var(--accent)' }} />
                    <span>Agent Pipeline 拓扑图</span>
                  </Space>
                }
                extra={
                  <Space size={4}>
                    <Tag color="blue" style={{ fontSize: 10 }}>RUNNING</Tag>
                    <Tag color="green" style={{ fontSize: 10 }}>COMPLETED</Tag>
                    <Tag color="red" style={{ fontSize: 10 }}>ERROR</Tag>
                    <Tag color="default" style={{ fontSize: 10 }}>WAITING</Tag>
                  </Space>
                }
              >
                {agentTrace.length > 0 ? (
                  <ReactECharts
                    option={pipelineGraphOption()}
                    style={{ height: 420, width: '100%' }}
                    notMerge
                    lazyUpdate
                  />
                ) : (
                  <Empty description="暂无 Agent 流程数据" />
                )}
              </Card>
            </Col>

            {/* Right: Trace 事件流 */}
            <Col xs={24} lg={8}>
              <Card
                title={
                  <Space>
                    <ClockCircleOutlined style={{ color: 'var(--accent)' }} />
                    <span>Trace 事件流</span>
                  </Space>
                }
                bodyStyle={{ padding: 0 }}
              >
                <div
                  style={{
                    background: '#1e293b',
                    borderRadius: '0 0 12px 12px',
                    padding: 16,
                    maxHeight: 420,
                    overflow: 'auto',
                    border: 'none',
                    fontFamily: '"SF Mono", "Cascadia Code", "Fira Code", Consolas, monospace',
                  }}
                >
                  {agentTrace.length > 0 ? (
                    agentTrace.map((step, i) => (
                      <div
                        key={i}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '8px 0',
                          borderBottom: '1px solid rgba(255,255,255,.06)',
                          fontSize: 13,
                          animation: `fadeInUp 0.3s cubic-bezier(.16,1,.3,1) both`,
                          animationDelay: `${i * 0.04}s`,
                        }}
                      >
                        <span className="text-mono" style={{ color: '#94a3b8', minWidth: 24 }}>
                          [{i + 1}]
                        </span>
                        <Tag
                          color={step.status === 'completed' ? 'green' : step.status === 'error' ? 'red' : step.status === 'running' ? 'blue' : 'default'}
                          style={{ borderRadius: 4, fontSize: 12 }}
                        >
                          {step.agent_name}
                        </Tag>
                        <span style={{ color: '#e2e8f0', flex: 1, fontSize: 12 }}>
                          {step.action}
                        </span>
                        <span style={{ color: '#64748b', fontSize: 11, whiteSpace: 'nowrap' }}>
                          {step.duration_ms}ms · {step.tokens_used}t
                        </span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: '#64748b', textAlign: 'center', padding: 40, fontSize: 13 }}>
                      暂无 Trace 事件
                    </div>
                  )}
                </div>
              </Card>
            </Col>
          </Row>

          {/* ── Row 3: Skill 调用明细表 ── */}
          <Card
            title={
              <Space>
                <ApiOutlined style={{ color: 'var(--accent)' }} />
                <span>Skill 调用明细</span>
              </Space>
            }
            style={{ marginBottom: 20 }}
          >
            <Table
              dataSource={allSkills}
              rowKey={(_, i) => String(i)}
              pagination={false}
              size="small"
              locale={{ emptyText: <Empty description="暂无 Skill 调用记录" /> }}
              columns={[
                {
                  title: 'Skill 名称',
                  dataIndex: 'skill_name',
                  key: 'skill_name',
                  render: (v: string) => (
                    <Tag color="purple" style={{ borderRadius: 4, fontWeight: 500 }}>
                      {v}
                    </Tag>
                  ),
                },
                {
                  title: '调用 Agent',
                  dataIndex: 'agent_name',
                  key: 'agent_name',
                  render: (v: string) => (
                    <Tag color="blue" style={{ borderRadius: 4 }}>
                      {v}
                    </Tag>
                  ),
                },
                {
                  title: '耗时(ms)',
                  dataIndex: 'duration_ms',
                  key: 'duration_ms',
                  width: 120,
                  render: (v: number) => (
                    <span className="text-mono num-cell">{v?.toLocaleString()}</span>
                  ),
                },
                {
                  title: 'Token',
                  dataIndex: 'tokens_used',
                  key: 'tokens_used',
                  width: 100,
                  render: (v: number) => (
                    <span className="text-mono num-cell">{v?.toLocaleString()}</span>
                  ),
                },
              ]}
            />
          </Card>
        </>
      )}

      {/* ── Bottom: Pipeline History ── */}
      <Card
        title={
          <Space>
            <ClockCircleOutlined style={{ color: 'var(--accent)' }} />
            <span>历史 Pipeline 记录</span>
          </Space>
        }
        extra={
          <Button size="small" icon={<ReloadOutlined />} onClick={loadHistory} loading={historyLoading}>
            刷新
          </Button>
        }
      >
        <Table
          dataSource={pipelineHistory}
          rowKey="scan_id"
          loading={historyLoading}
          size="small"
          pagination={false}
          locale={{ emptyText: <Empty description="暂无历史记录" /> }}
          onRow={(record) => ({
            onClick: () => handleLoadHistoryTrace(record.scan_id),
            style: {
              cursor: 'pointer',
              background: record.scan_id === selectedPipelineId ? 'rgba(26,92,255,.04)' : undefined,
            },
          })}
          columns={[
            {
              title: 'Scan ID',
              dataIndex: 'scan_id',
              key: 'scan_id',
              width: 220,
              render: (v: string) => (
                <span className="code-link text-mono" style={{ fontSize: 12 }}>
                  {v}
                </span>
              ),
            },
            {
              title: '公司代码',
              dataIndex: 'company_code',
              key: 'company_code',
              width: 120,
              render: (v: string) => (
                <Tag color="blue" style={{ borderRadius: 4 }}>
                  {v}
                </Tag>
              ),
            },
            {
              title: '风险概率',
              dataIndex: 'probability',
              key: 'probability',
              width: 130,
              render: (v: number) => {
                const pct = ((v ?? 0) * 100).toFixed(1);
                const color = v > 0.6 ? 'var(--danger)' : v > 0.3 ? 'var(--warning)' : 'var(--success)';
                return (
                  <div className="prob-cell">
                    <div
                      style={{
                        flex: 1,
                        height: 6,
                        borderRadius: 3,
                        background: '#f0f0f0',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(100, (v ?? 0) * 100)}%`,
                          height: '100%',
                          borderRadius: 3,
                          background: color,
                          transition: 'width .4s var(--ease)',
                        }}
                      />
                    </div>
                    <span className="prob-value" style={{ color }}>
                      {pct}%
                    </span>
                  </div>
                );
              },
            },
            {
              title: '总耗时(ms)',
              dataIndex: 'total_duration_ms',
              key: 'total_duration_ms',
              width: 130,
              render: (v: number) => (
                <span className="text-mono num-cell">{v?.toLocaleString()}</span>
              ),
            },
            {
              title: 'Token',
              dataIndex: 'total_tokens',
              key: 'total_tokens',
              width: 110,
              render: (v: number) => (
                <span className="text-mono num-cell">{v?.toLocaleString()}</span>
              ),
            },
            {
              title: '时间',
              dataIndex: 'created_at',
              key: 'created_at',
              width: 180,
              render: (v: string) => (
                <span style={{ fontSize: 12, color: 'var(--text-2)' }} className="text-mono">
                  {v}
                </span>
              ),
            },
            {
              title: '操作',
              key: 'action',
              width: 80,
              render: (_: unknown, record: PipelineRecord) => (
                <span
                  className="action-link"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleLoadHistoryTrace(record.scan_id);
                  }}
                >
                  查看
                </span>
              ),
            },
          ]}
        />
      </Card>
    </div>
  );
}