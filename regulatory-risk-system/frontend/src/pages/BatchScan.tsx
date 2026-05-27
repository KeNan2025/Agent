import { useState } from 'react';
import {
  Card, Input, Button, Table, Tag, Select, Space, Alert, Row, Col,
  Statistic, message, Typography, Progress, Badge, Divider,
} from 'antd';
import {
  ThunderboltOutlined, UploadOutlined, SearchOutlined,
  WarningOutlined, SafetyOutlined, RightOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { scanBatch } from '../api/client';

const { Text } = Typography;

const riskColorMap: Record<string, string> = {
  '高风险': '#f5222d', '中风险': '#fa8c16', '低风险': '#52c41a',
};

export default function BatchScan() {
  const navigate = useNavigate();
  const [codes, setCodes] = useState('');
  const [windowDays, setWindowDays] = useState(60);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

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
      render: (v: string) => <Text strong style={{ color: '#1677ff' }}>{v}</Text>,
    },
    { title: '名称', dataIndex: 'company_name', width: 130 },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', width: 180,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => {
        const pct = Math.round(v * 100);
        const color = v >= 0.6 ? '#f5222d' : v >= 0.3 ? '#fa8c16' : '#52c41a';
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{ height: 8, borderRadius: 4, background: '#f0f0f0', overflow: 'hidden' }}>
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
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => (
        <Badge
          color={riskColorMap[v]}
          text={<Text style={{ color: riskColorMap[v], fontWeight: 600, fontSize: 13 }}>{v}</Text>}
        />
      ),
    },
    {
      title: '主要风险', dataIndex: 'top_risk_factor', width: 160,
      render: (v: string) => <Text ellipsis={{ tooltip: v }} style={{ maxWidth: 150 }}>{v}</Text>,
    },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: any) => (
        <a onClick={() => navigate(`/company/${r.company_code}`)}
           style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          详情 <RightOutlined style={{ fontSize: 10 }} />
        </a>
      ),
    },
  ];

  const highCount = results?.results?.filter((r: any) => r.risk_level === '高风险').length || 0;
  const maxProb = results?.results?.length
    ? Math.max(...results.results.map((r: any) => r.inquiry_probability))
    : 0;

  return (
    <div className="fade-in">
      <div className="page-title">
        <span className="title-bar" />
        批量扫雷
      </div>

      <Card style={{ marginBottom: 20 }}>
        <Alert
          message="批量风险扫描"
          description="输入公司代码（股票代码），支持逗号、空格或换行分隔。系统将调度 Agent 对每家公司进行深度风险扫描。"
          type="info"
          showIcon
          style={{ marginBottom: 20, borderRadius: 8 }}
        />
        <Row gutter={20}>
          <Col xs={24} lg={16}>
            <Input.TextArea
              rows={5}
              placeholder={"例如：600001, 000002, 300003\n或每行一个代码"}
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
              style={{ borderRadius: 8, fontSize: 14 }}
            />
          </Col>
          <Col xs={24} lg={8}>
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              <div>
                <Text type="secondary" style={{ fontSize: 12, marginBottom: 4, display: 'block' }}>预测窗口</Text>
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
        <div className="slide-in-up">
          <Row gutter={[16, 16]} className="stat-row" style={{ marginBottom: 20 }}>
            <Col xs={24} sm={8}>
              <Card className="stat-card stat-blue" bodyStyle={{ padding: '20px 24px' }}>
                <SafetyOutlined className="stat-icon" />
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 13 }}>扫描公司数</Text>}
                  value={results.total}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: '#1677ff' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="stat-card stat-red" bodyStyle={{ padding: '20px 24px' }}>
                <WarningOutlined className="stat-icon" />
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 13 }}>高风险公司</Text>}
                  value={highCount}
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: '#f5222d' }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="stat-card stat-orange" bodyStyle={{ padding: '20px 24px' }}>
                <SearchOutlined className="stat-icon" />
                <Statistic
                  title={<Text type="secondary" style={{ fontSize: 13 }}>最高概率</Text>}
                  value={(maxProb * 100).toFixed(1)}
                  suffix="%"
                  valueStyle={{ fontSize: 28, fontWeight: 700, color: '#fa8c16' }}
                />
              </Card>
            </Col>
          </Row>

          <Card
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <SearchOutlined style={{ color: '#1677ff' }} />
                <span style={{ fontWeight: 600 }}>扫雷结果</span>
                <Tag color="blue">{results.total} 家</Tag>
              </div>
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
