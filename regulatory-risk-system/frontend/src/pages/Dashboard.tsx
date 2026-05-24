import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Card, Table, Tag, Select, InputNumber, Row, Col, Statistic, Progress, Input, Space,
} from 'antd';
import {
  WarningOutlined, SafetyOutlined, ExclamationCircleOutlined,
  ArrowUpOutlined,
} from '@ant-design/icons';
import { getRanking, getIndustries } from '../api/client';

const riskColor: Record<string, string> = {
  '高风险': 'red',
  '中风险': 'orange',
  '低风险': 'green',
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
      render: (v: number) => (
        <span style={{ fontWeight: v <= 3 ? 700 : 400, color: v <= 3 ? '#f5222d' : undefined }}>
          {v}
        </span>
      ),
    },
    {
      title: '股票代码', key: 'code', width: 100,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company.code}`)}>{r.company.code}</a>
      ),
    },
    {
      title: '公司名称', key: 'name', width: 140,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company.code}`)}>{r.company.name}</a>
      ),
    },
    {
      title: '行业', key: 'industry', width: 110,
      render: (_: any, r: any) => r.company.industry,
    },
    {
      title: '市值(亿)', key: 'cap', width: 90,
      render: (_: any, r: any) => r.company.market_cap.toFixed(1),
      sorter: (a: any, b: any) => a.company.market_cap - b.company.market_cap,
    },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', key: 'prob', width: 180,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Progress
            percent={Math.round(v * 100)}
            size="small"
            strokeColor={v >= 0.6 ? '#f5222d' : v >= 0.3 ? '#fa8c16' : '#52c41a'}
            style={{ width: 100, margin: 0 }}
            format={(p) => `${p}%`}
          />
        </div>
      ),
    },
    {
      title: '风险等级', dataIndex: 'risk_level', key: 'level', width: 90,
      filters: [
        { text: '高风险', value: '高风险' },
        { text: '中风险', value: '中风险' },
        { text: '低风险', value: '低风险' },
      ],
      onFilter: (v: any, r: any) => r.risk_level === v,
      render: (v: string) => <Tag color={riskColor[v]}>{v}</Tag>,
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', key: 'risk', width: 140,
      render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company.code}`)}>详情</a>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card>
            <Statistic title="监控公司总数" value={data.total} prefix={<SafetyOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="高风险公司" value={highCount}
              valueStyle={{ color: '#f5222d' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="中风险公司" value={medCount}
              valueStyle={{ color: '#fa8c16' }}
              prefix={<ExclamationCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均问询概率"
              value={(avgProb * 100).toFixed(1)}
              suffix="%"
              prefix={<ArrowUpOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title="全市场风险排行榜"
        extra={
          <Space>
            <Input.Search
              placeholder="搜索代码/名称"
              style={{ width: 180 }}
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
          pagination={{ pageSize: 20, showSizeChanger: true, showTotal: (t) => `共 ${t} 家公司` }}
          scroll={{ x: 1000 }}
        />
      </Card>
    </div>
  );
}
