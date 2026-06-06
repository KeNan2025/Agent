import { useState } from 'react';
import {
  Card, Input, Button, Table, Tag, Select, Space, Alert, Row, Col, message,
} from 'antd';
import {
  ThunderboltOutlined, UploadOutlined, SearchOutlined,
  WarningOutlined, SafetyOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { scanBatch } from '../api/client';
import type { BatchScanResponse } from '../types';
import StatCard from '../components/StatCard';
import RiskBadge from '../components/RiskBadge';
import ProbabilityBar from '../components/ProbabilityBar';
import PageTitle from '../components/PageTitle';

export default function BatchScan() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState('');
  const [windowDays, setWindowDays] = useState(60);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BatchScanResponse | null>(null);

  const handleScan = async () => {
    const codeList = codes.split(/[,\s\n]+/).map((c) => c.trim()).filter(Boolean);
    if (codeList.length === 0) {
      message.warning('请输入至少一个公司代码');
      return;
    }
    setLoading(true);
    try {
      const data = await scanBatch(codeList, windowDays);
      setResults(data);
    } catch {
      message.error('扫雷失败');
    }
    setLoading(false);
  };

  const columns = [
    {
      title: '代码', dataIndex: 'company_code', width: 100,
      render: (v: string) => <span style={{ fontWeight: 600, color: 'var(--primary)' }}>{v}</span>,
    },
    { title: '名称', dataIndex: 'company_name', width: 130 },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', width: 200,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => <ProbabilityBar value={v} size="small" />,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => <RiskBadge level={v} />,
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', width: 160,
      render: (v: string) => (
        <span style={{ color: 'var(--text-dim)', maxWidth: 150, display: 'inline-block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v}>
          {v}
        </span>
      ),
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <a className="action-link" onClick={() => navigate(`/company/${r.company_code}`)}>
          详情 <RightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
  ];

  const highCount = results?.results?.filter((r) => r.risk_level === '高风险').length || 0;
  const maxProb = results?.results?.length
    ? Math.max(...results.results.map((r) => r.inquiry_probability))
    : 0;

  return (
    <div className="page-container fade-in">
      <PageTitle title="批量扫雷" />

      <Card style={{ marginBottom: 20 }}>
        <Alert
          message="批量风险扫描"
          description="输入公司代码（股票代码），支持逗号、空格或换行分隔。系统将调度 Agent 对每家公司进行深度风险扫描。"
          type="info"
          showIcon
          style={{ marginBottom: 20 }}
        />
        <Row gutter={20}>
          <Col xs={24} lg={16}>
            <Input.TextArea
              rows={5}
              placeholder={"例如：600001, 000002, 300003\n或每行一个代码"}
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
            />
          </Col>
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <span style={{ fontSize: 12, color: 'var(--text-dim)', marginBottom: 4, display: 'block' }}>预测窗口</span>
                <Select
                  value={windowDays}
                  onChange={setWindowDays}
                  style={{ width: '100%' }}
                  options={[
                    { label: '30天窗口', value: 30 },
                    { label: '60天窗口', value: 60 },
                    { label: '90天窗口', value: 90 },
                  ]}
                />
              </div>
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleScan}
                loading={loading}
                block
                size="large"
                style={{ height: 44, fontWeight: 600 }}
              >
                {loading ? 'Agent 分析中...' : '开始扫雷'}
              </Button>
              <Button
                icon={<UploadOutlined />}
                block
                onClick={() => setCodes('600000, 000001, 300002, 600003, 000004, 300005, 600006, 000007, 300008, 600009')}
              >
                加载示例代码
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {results && (
        <div className="fade-in-up">
          <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}>
              <StatCard title="扫描公司数" value={results.total} color="blue" icon={<SafetyOutlined />} />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard title="高风险公司" value={highCount} color="red" icon={<WarningOutlined />} />
            </Col>
            <Col xs={24} sm={8}>
              <StatCard title="最高概率" value={(maxProb * 100).toFixed(1)} suffix="%" color="orange" icon={<SearchOutlined />} />
            </Col>
          </Row>

          <Card
            title={
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SearchOutlined style={{ color: 'var(--primary)' }} />
                <span style={{ fontWeight: 600 }}>扫雷结果</span>
                <Tag color="blue">{results.total} 家</Tag>
              </span>
            }
          >
            <Table
              columns={columns}
              dataSource={results.results}
              rowKey="company_code"
              size="middle"
              pagination={false}
              onRow={(r: any) => ({
                style: { cursor: 'pointer' },
                onClick: () => navigate(`/company/${r.company_code}`),
              })}
            />
          </Card>
        </div>
      )}
    </div>
  );
}
