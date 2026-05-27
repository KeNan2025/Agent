import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Select, Row, Col, Statistic, Progress, Input, Space, Typography, Badge,
} from 'antd';
import {
  WarningOutlined, SafetyOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined, FundOutlined, RightOutlined,
} from '@ant-design/icons';
import { getRanking, getIndustries } from '../api/client';

const { Text } = Typography;

const riskColor: Record<string, string> = {
  '高风险': 'red',
  '中风险': 'orange',
  '低风险': 'green',
};

const riskHexColor: Record<string, string> = {
  '高风险': '#f5222d',
  '中风险': '#fa8c16',
  '低风险': '#52c41a',
};

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
          const colors = ['#f5222d', '#fa8c16', '#faad14'];
          return (
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: colors[v - 1], color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: 13,
            }}>
              {v}
            </div>
          );
        }
        return <Text type="secondary">{v}</Text>;
      },
    },
    {
      title: '股票代码', key: 'code', width: 100,
      render: (_: any, r: any) => (
        <Text strong style={{ color: '#1677ff', cursor: 'pointer' }}
              onClick={() => navigate(`/company/${r.company.code}`)}>
          {r.company.code}
        </Text>
      ),
    },
    {
      title: '公司名称', key: 'name', width: 150,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company.code}`)}
           style={{ fontWeight: 500 }}>
          {r.company.name}
        </a>
      ),
    },
    {
      title: '行业', key: 'industry', width: 110,
      render: (_: any, r: any) => (
        <Tag style={{ borderRadius: 4 }}>{r.company.industry}</Tag>
      ),
    },
    {
      title: '市值(亿)', key: 'cap', width: 100,
      render: (_: any, r: any) => (
        <Text style={{ fontVariantNumeric: 'tabular-nums' }}>
          {r.company.market_cap.toFixed(1)}
        </Text>
      ),
      sorter: (a: any, b: any) => a.company.market_cap - b.company.market_cap,
    },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', key: 'prob', width: 200,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.6 ? '#f5222d' : v >= 0.3 ? '#fa8c16' : '#52c41a';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                height: 8, borderRadius: 4, background: '#f0f0f0', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 4,
                  background: `linear-gradient(90deg, ${color}88, ${color})`,
                  transition: 'width 0.6s ease',
                }} />
              </div>
            </div>
            <Text strong style={{ color, minWidth: 40, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {pct}%
            </Text>
          </div>
        );
      },
    },
    {
      title: '风险等级', dataIndex: 'risk_level', key: 'level', width: 100,
      filters: [
        { text: '高风险', value: '高风险' },
        { text: '中风险', value: '中风险' },
        { text: '低风险', value: '低风险' },
      ],
      onFilter: (v: any, r: any) => r.risk_level === v,
      render: (v: string) => (
        <Badge
          color={riskHexColor[v]}
          text={<Text style={{ color: riskHexColor[v], fontWeight: 600, fontSize: 13 }}>{v}</Text>}
        />
      ),
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', key: 'risk', width: 150,
      render: (v: string) => (
        <Text ellipsis={{ tooltip: v }} style={{ fontSize: 13, maxWidth: 140 }}>
          {v}
        </Text>
      ),
    },
    {
      title: '操作', key: 'action', width: 80, fixed: 'right' as const,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company.code}`)}
           style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          详情 <RightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
  ];

  return (
    <div className="fade-in">
      <div className="page-title">
        <span className="title-bar" />
        全市场风险监控
      </div>

      <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
            <SafetyOutlined className="stat-icon" />
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>监控公司总数</Text>}
              value={data.total}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-red" bodyStyle={{ padding: '20px 24px' }}>
            <WarningOutlined className="stat-icon" />
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>高风险公司</Text>}
              value={highCount}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#f5222d' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-orange" bodyStyle={{ padding: '20px 24px' }}>
            <ExclamationCircleOutlined className="stat-icon" />
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>中风险公司</Text>}
              value={medCount}
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} lg={6}>
          <Card className="stat-card stat-green" bodyStyle={{ padding: '20px 24px' }}>
            <ArrowUpOutlined className="stat-icon" />
            <Statistic
              title={<Text type="secondary" style={{ fontSize: 13 }}>平均问询概率</Text>}
              value={(avgProb * 100).toFixed(1)}
              suffix="%"
              valueStyle={{ fontSize: 28, fontWeight: 700, color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <FundOutlined style={{ color: '#1677ff' }} />
            <span style={{ fontWeight: 600 }}>风险排行榜</span>
            <Tag color="blue" style={{ marginLeft: 4 }}>{windowDays}天窗口</Tag>
          </div>
        }
        extra={
          <Space size="middle">
            <Input.Search
              placeholder="搜索代码 / 名称"
              style={{ width: 200 }}
              onSearch={setSearch}
              onChange={(e) => !e.target.value && setSearch('')}
              allowClear
            />
            <Select
              placeholder="行业筛选"
              allowClear
              style={{ width: 140 }}
              onChange={setIndustry}
              options={industries.map((i) => ({ label: i, value: i }))}
            />
            <Select
              value={windowDays}
              onChange={setWindowDays}
              style={{ width: 120 }}
              options={[
                { label: '30天窗口', value: 30 },
                { label: '60天窗口', value: 60 },
                { label: '90天窗口', value: 90 },
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
            showTotal: (t) => `共 ${t} 家公司`,
            showQuickJumper: true,
          }}
          scroll={{ x: 1100 }}
          onRow={(r: any) => ({
            style: { cursor: 'pointer' },
            onClick: () => navigate(`/company/${r.company.code}`),
          })}
        />
      </Card>
    </div>
  );
}
