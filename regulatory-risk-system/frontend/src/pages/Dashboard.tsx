import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Select, Row, Col, Statistic, Progress, Input, Space, Tag,
} from 'antd';
import {
  WarningOutlined, SafetyOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, FundOutlined, RightOutlined, ThunderboltOutlined,
} from '@ant-design/icons';
import { getRanking, getIndustries } from '../api/client';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<any>({ items: [], total: 0 });
  const [windowDays, setWindowDays] = useState(60);
  const [industry, setIndustry] = useState<string | undefined>();
  const [industries, setIndustries] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getIndustries().then((d) => setIndustries(d.industries));
  }, []);

  useEffect(() => {
    setLoading(true);
    getRanking(windowDays, 200, industry).then((d) => {
      setData(d);
      setLoading(false);
    });
  }, [windowDays, industry]);

  const filteredItems = data.items.filter(
    (item: any) =>
      !search ||
      item.company.code.includes(search) ||
      item.company.name.includes(search),
  );

  const highCount = data.items.filter((i: any) => i.risk_level === '高风险').length;
  const medCount = data.items.filter((i: any) => i.risk_level === '中风险').length;
  const avgProb = data.items.length
    ? (data.items.reduce((s: number, i: any) => s + i.inquiry_probability, 0) / data.items.length)
    : 0;

  const columns = [
    {
      title: '排名', dataIndex: 'rank', key: 'rank', width: 70,
      render: (v: number) => {
        if (v <= 3) {
          return <span className={`rank-medal rank-medal--${v}`}>{v}</span>;
        }
        return <span className="rank-text">{v}</span>;
      },
    },
    {
      title: '股票代码', key: 'code', width: 105,
      render: (_: any, r: any) => (
        <span className="code-link"
              onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          {r.company.code}
        </span>
      ),
    },
    {
      title: '公司名称', key: 'name', width: 160,
      render: (_: any, r: any) => (
        <a className="name-link"
           onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          {r.company.name}
        </a>
      ),
    },
    {
      title: '行业', key: 'industry', width: 120,
      render: (_: any, r: any) => (
        <span className="industry-tag">{r.company.industry}</span>
      ),
    },
    {
      title: '市值(亿)', key: 'cap', width: 105,
      render: (_: any, r: any) => (
        <span className="num-cell">
          {r.company.market_cap.toFixed(1)}
        </span>
      ),
      sorter: (a: any, b: any) => a.company.market_cap - b.company.market_cap,
    },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', key: 'prob', width: 210,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const strokeColor = v >= 0.6 ? '#ff4757' : v >= 0.3 ? '#ffbe0b' : '#00ff88';
        return (
          <div className="prob-cell">
            <Progress
              percent={pct}
              size="small"
              strokeColor={strokeColor}
              trailColor="rgba(255,255,255,0.04)"
              showInfo={false}
              className="prob-progress"
            />
            <span className="prob-value" style={{ color: strokeColor }}>
              {pct}%
            </span>
          </div>
        );
      },
    },
    {
      title: '风险等级', dataIndex: 'risk_level', key: 'level', width: 105,
      filters: [
        { text: '高风险', value: '高风险' },
        { text: '中风险', value: '中风险' },
        { text: '低风险', value: '低风险' },
      ],
      onFilter: (v: any, r: any) => r.risk_level === v,
      render: (v: string) => {
        const level = v === '高风险' ? 'high' : v === '中风险' ? 'medium' : 'low';
        return <span className={`risk-badge risk-badge--${level}`}>{v}</span>;
      },
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', key: 'risk', width: 160,
      render: (v: string) => (
        <span className="risk-factor-text" title={v}>{v}</span>
      ),
    },
    {
      title: '操作', key: 'action', width: 85, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <a className="action-link"
           onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          详情 <RightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
  ];

  return (
    <div className="page-container fade-in">
      {/* ── Stat Cards ── */}
      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-blue">
            <span className="stat-icon-bg"><SafetyOutlined /></span>
            <Statistic
              title={<span className="stat-label">监控公司总数</span>}
              value={data.total}
              valueStyle={{ fontSize: 30, fontWeight: 700, color: '#00d4ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-red">
            <span className="stat-icon-bg"><WarningOutlined /></span>
            <Statistic
              title={<span className="stat-label">高风险公司</span>}
              value={highCount}
              valueStyle={{ fontSize: 30, fontWeight: 700, color: '#ff4757' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-orange">
            <span className="stat-icon-bg"><ExclamationCircleOutlined /></span>
            <Statistic
              title={<span className="stat-label">中风险公司</span>}
              value={medCount}
              valueStyle={{ fontSize: 30, fontWeight: 700, color: '#ffbe0b' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-green">
            <span className="stat-icon-bg"><ArrowUpOutlined /></span>
            <Statistic
              title={<span className="stat-label">平均问询概率</span>}
              value={(avgProb * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ fontSize: 30, fontWeight: 700, color: '#00ff88' }}
            />
          </Card>
        </Col>
      </Row>

      {/* ── Main Table ── */}
      <Card
        style={{ borderRadius: 12 }}
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: 'var(--accent)', fontSize: 16 }} />
            <span className="table-card-title">全市场风险排行榜</span>
            <Tag
              color="cyan"
              style={{
                marginLeft: 6, fontWeight: 600, fontSize: 11,
                background: 'rgba(0,212,255,0.10)', border: '1px solid rgba(0,212,255,0.2)',
                color: '#00d4ff',
              }}
            >
              {windowDays}天窗口
            </Tag>
          </span>
        }
        extra={
          <Space size="middle">
            <Input.Search
              placeholder="搜索代码 / 名称"
              style={{ width: 210 }}
              onSearch={setSearch}
              onChange={(e) => !e.target.value && setSearch('')}
              allowClear
            />
            <Select
              placeholder="行业筛选"
              allowClear
              style={{ width: 150 }}
              onChange={setIndustry}
              options={industries.map((i) => ({ label: i, value: i }))}
            />
            <Select
              value={windowDays}
              onChange={setWindowDays}
              style={{ width: 130 }}
              options={[
                { label: '30 天窗口', value: 30 },
                { label: '60 天窗口', value: 60 },
                { label: '90 天窗口', value: 90 },
              ]}
            />
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredItems}
          rowKey={(r: any) => r.company.code}
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => <span style={{ color: 'var(--text-dim)' }}>共 {t} 家公司</span>,
            showQuickJumper: true,
          }}
          scroll={{ x: 1200 }}
          onRow={(r: any) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/company/${r.company.code}`),
          })}
        />
      </Card>
    </div>
  );
}