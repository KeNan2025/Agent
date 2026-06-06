import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Select, Row, Col, Input, Space, Tag,
} from 'antd';
import {
  WarningOutlined, SafetyOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, ThunderboltOutlined, RightOutlined,
} from '@ant-design/icons';
import { getRanking, getIndustries } from '../api/client';
import type { RankingItem } from '../types';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import ProbabilityBar from '../components/ProbabilityBar';
import RankMedal from '../components/RankMedal';
import PageTitle from '../components/PageTitle';

export default function Dashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<{ items: RankingItem[]; total: number }>({ items: [], total: 0 });
  const [windowDays, setWindowDays] = useState(60);
  const [industry, setIndustry] = useState<string | undefined>();
  const [industries, setIndustries] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  useEffect(() => {
    getIndustries().then((d: any) => setIndustries(d.industries));
  }, []);

  useEffect(() => {
    setLoading(true);
    getRanking(windowDays, 200, industry).then((d: any) => {
      setData(d);
      setLoading(false);
    });
  }, [windowDays, industry]);

  const filteredItems = data.items.filter(
    (item) =>
      !search ||
      item.company.code.includes(search) ||
      item.company.name.includes(search),
  );

  const highCount = data.items.filter((i) => i.risk_level === '高风险').length;
  const medCount = data.items.filter((i) => i.risk_level === '中风险').length;
  const avgProb = data.items.length
    ? data.items.reduce((s, i) => s + i.inquiry_probability, 0) / data.items.length
    : 0;

  const columns = [
    {
      title: '排名', dataIndex: 'rank', key: 'rank', width: 70,
      render: (v: number) => <RankMedal rank={v} />,
    },
    {
      title: '股票代码', key: 'code', width: 105,
      render: (_: any, r: RankingItem) => (
        <span className="code-link"
              onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          {r.company.code}
        </span>
      ),
    },
    {
      title: '公司名称', key: 'name', width: 160,
      render: (_: any, r: RankingItem) => (
        <a className="name-link"
           onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          {r.company.name}
        </a>
      ),
    },
    {
      title: '行业', key: 'industry', width: 120,
      render: (_: any, r: RankingItem) => (
        <span className="industry-tag">{r.company.industry}</span>
      ),
    },
    {
      title: '市值(亿)', key: 'cap', width: 105,
      render: (_: any, r: RankingItem) => (
        <span className="num-cell">{r.company.market_cap.toFixed(1)}</span>
      ),
      sorter: (a: RankingItem, b: RankingItem) => a.company.market_cap - b.company.market_cap,
    },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', key: 'prob', width: 210,
      sorter: (a: RankingItem, b: RankingItem) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => <ProbabilityBar value={v} size="small" />,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', key: 'level', width: 105,
      filters: [
        { text: '高风险', value: '高风险' },
        { text: '中风险', value: '中风险' },
        { text: '低风险', value: '低风险' },
      ],
      onFilter: (v: any, r: RankingItem) => r.risk_level === v,
      render: (v: string) => <RiskBadge level={v} />,
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', key: 'risk', width: 160,
      render: (v: string) => (
        <span className="risk-factor-text" title={v}>{v}</span>
      ),
    },
    {
      title: '操作', key: 'action', width: 85, fixed: 'right' as const,
      render: (_: any, r: RankingItem) => (
        <a className="action-link"
           onClick={(e) => { e.stopPropagation(); navigate(`/company/${r.company.code}`); }}>
          详情 <RightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
  ];

  return (
    <div className="page-container fade-in">
      <PageTitle title="风险排行榜" />

      {/* ── Stat Cards ── */}
      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="监控公司总数" value={data.total} color="blue" icon={<SafetyOutlined />} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="高风险公司" value={highCount} color="red" icon={<WarningOutlined />} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="中风险公司" value={medCount} color="orange" icon={<ExclamationCircleOutlined />} />
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <StatCard title="平均问询概率" value={(avgProb * 100).toFixed(1)} suffix="%" color="green" icon={<ArrowUpOutlined />} />
        </Col>
      </Row>

      {/* ── Main Table ── */}
      <Card
        title={
          <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ThunderboltOutlined style={{ color: 'var(--primary)', fontSize: 16 }} />
            <span className="table-card-title">全市场风险排行榜</span>
            <Tag
              color="blue"
              style={{
                marginLeft: 6, fontWeight: 600, fontSize: 11,
                background: 'var(--primary-dim)', border: '1px solid var(--border-panel)',
                color: 'var(--primary)',
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
          rowKey={(r: RankingItem) => r.company.code}
          loading={loading}
          size="middle"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (t) => <span style={{ color: 'var(--text-dim)' }}>共 {t} 家公司</span>,
            showQuickJumper: true,
          }}
          scroll={{ x: 1200 }}
          onRow={(r: RankingItem) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/company/${r.company.code}`),
          })}
        />
      </Card>
    </div>
  );
}
