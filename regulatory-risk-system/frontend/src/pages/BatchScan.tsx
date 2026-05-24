import { useState } from 'react';
import { Card, Input, Button, Table, Tag, Select, Space, Alert, Row, Col, Statistic, message } from 'antd';
import { ThunderboltOutlined, UploadOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { scanBatch } from '../api/client';

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

  const riskColor: Record<string, string> = {
    '高风险': 'red', '中风险': 'orange', '低风险': 'green',
  };

  const columns = [
    { title: '代码', dataIndex: 'company_code', width: 100 },
    { title: '名称', dataIndex: 'company_name', width: 120 },
    {
      title: '问询概率', dataIndex: 'inquiry_probability', width: 120,
      sorter: (a: any, b: any) => a.inquiry_probability - b.inquiry_probability,
      render: (v: number) => <span style={{ fontWeight: 600 }}>{(v * 100).toFixed(1)}%</span>,
    },
    {
      title: '风险等级', dataIndex: 'risk_level', width: 100,
      render: (v: string) => <Tag color={riskColor[v]}>{v}</Tag>,
    },
    { title: '主要风险', dataIndex: 'top_risk_factor', width: 140 },
    {
      title: '操作', key: 'action', width: 80,
      render: (_: any, r: any) => <a onClick={() => navigate(`/company/${r.company_code}`)}>详情</a>,
    },
  ];

  const highCount = results?.results?.filter((r: any) => r.risk_level === '高风险').length || 0;

  return (
    <div>
      <Card title="批量扫雷" style={{ marginBottom: 16 }}>
        <Alert
          message="输入公司代码（股票代码），支持逗号、空格或换行分隔。系统将对每家公司进行风险扫描。"
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Row gutter={16}>
          <Col span={16}>
            <Input.TextArea
              rows={4}
              placeholder="例如: 600001, 000002, 300003&#10;或每行一个代码"
              value={codes}
              onChange={(e) => setCodes(e.target.value)}
            />
          </Col>
          <Col span={8}>
            <Space direction="vertical" style={{ width: '100%' }}>
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
              <Button
                type="primary"
                icon={<ThunderboltOutlined />}
                onClick={handleScan}
                loading={loading}
                block
                size="large"
              >
                开始扫雷
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
        <>
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card><Statistic title="扫描公司数" value={results.total} /></Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic title="高风险公司" value={highCount} valueStyle={{ color: '#f5222d' }} />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="最高概率"
                  value={results.results?.length ? (Math.max(...results.results.map((r: any) => r.inquiry_probability)) * 100).toFixed(1) : 0}
                  suffix="%"
                />
              </Card>
            </Col>
          </Row>
          <Card title={`扫雷结果 (${results.total}家)`}>
            <Table
              columns={columns}
              dataSource={results.results}
              rowKey="company_code"
              size="middle"
              pagination={false}
            />
          </Card>
        </>
      )}
    </div>
  );
}
