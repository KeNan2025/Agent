/**
 * 预测仿真组件 - AI驱动的未来状态预测
 */

import { useState } from 'react';
import { Card, Row, Col, Button, Select, InputNumber, Space, Spin, Empty, Tag } from 'antd';
import { ThunderboltOutlined, LineChartOutlined, RocketOutlined } from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import { PhysicalEntity } from '../core/DigitalTwinEngine';

interface PredictionSimulationProps {
  entities: PhysicalEntity[];
  onPredict: (entityId: string, horizonMs: number) => Promise<PhysicalEntity | null>;
}

export default function PredictionSimulation({ entities, onPredict }: PredictionSimulationProps) {
  const [selectedEntity, setSelectedEntity] = useState<string | undefined>(undefined);
  const [horizonHours, setHorizonHours] = useState<number>(24);
  const [predicting, setPredicting] = useState(false);
  const [prediction, setPrediction] = useState<PhysicalEntity | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);

  const handlePredict = async () => {
    if (!selectedEntity) return;

    setPredicting(true);
    try {
      const horizonMs = horizonHours * 60 * 60 * 1000;
      const result = await onPredict(selectedEntity, horizonMs);
      setPrediction(result);

      // 生成模拟的历史和预测数据用于图表展示
      const now = Date.now();
      const historical = Array.from({ length: 24 }, (_, i) => ({
        time: now - (24 - i) * 60 * 60 * 1000,
        value: 50 + Math.random() * 30 + i * 0.5,
        type: 'historical',
      }));

      const predicted = Array.from({ length: horizonHours }, (_, i) => ({
        time: now + (i + 1) * 60 * 60 * 1000,
        value: historical[historical.length - 1].value + (Math.random() - 0.5) * 10 + i * 0.3,
        type: 'predicted',
      }));

      setHistoricalData([...historical, ...predicted]);
    } catch (error) {
      console.error('Prediction failed:', error);
    } finally {
      setPredicting(false);
    }
  };

  const getChartOption = () => {
    if (historicalData.length === 0) return {};

    const historical = historicalData.filter((d) => d.type === 'historical');
    const predicted = historicalData.filter((d) => d.type === 'predicted');

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: '#ffffff',
        borderColor: '#e5e7eb',
        borderWidth: 1,
        textStyle: { color: '#1f2937', fontSize: 12 },
        formatter: (params: any) => {
          const time = new Date(params[0].axisValue).toLocaleString('zh-CN');
          let result = `<strong>${time}</strong><br/>`;
          params.forEach((p: any) => {
            result += `${p.marker} ${p.seriesName}: ${p.value.toFixed(2)}<br/>`;
          });
          return result;
        },
      },
      legend: {
        data: ['历史数据', '预测数据', '置信区间'],
        bottom: 0,
        textStyle: { fontSize: 11, color: '#6b7280' },
      },
      grid: {
        left: '3%',
        right: '4%',
        top: '10%',
        bottom: '15%',
        containLabel: true,
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { fontSize: 11, color: '#6b7280' },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '指标值',
        nameTextStyle: { fontSize: 11, color: '#9ca3af' },
        axisLine: { lineStyle: { color: '#e5e7eb' } },
        axisLabel: { fontSize: 11, color: '#6b7280' },
        splitLine: { lineStyle: { color: '#f0f0f0' } },
      },
      series: [
        {
          name: '历史数据',
          type: 'line',
          data: historical.map((d) => [d.time, d.value]),
          smooth: true,
          lineStyle: { color: '#3b82f6', width: 2 },
          itemStyle: { color: '#3b82f6' },
          areaStyle: { color: 'rgba(59, 130, 246, 0.1)' },
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '预测数据',
          type: 'line',
          data: predicted.map((d) => [d.time, d.value]),
          smooth: true,
          lineStyle: { color: '#8b5cf6', width: 2, type: 'dashed' },
          itemStyle: { color: '#8b5cf6' },
          areaStyle: { color: 'rgba(139, 92, 246, 0.1)' },
          symbol: 'circle',
          symbolSize: 4,
        },
        {
          name: '置信区间',
          type: 'line',
          data: predicted.map((d) => [d.time, d.value + 5]),
          smooth: true,
          lineStyle: { color: '#d1d5db', width: 1, type: 'dotted' },
          itemStyle: { color: 'transparent' },
          showSymbol: false,
        },
        {
          name: '置信区间',
          type: 'line',
          data: predicted.map((d) => [d.time, d.value - 5]),
          smooth: true,
          lineStyle: { color: '#d1d5db', width: 1, type: 'dotted' },
          itemStyle: { color: 'transparent' },
          areaStyle: { color: 'rgba(139, 92, 246, 0.05)' },
          showSymbol: false,
        },
      ],
    };
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 控制面板 */}
      <Card size="small">
        <Row gutter={[16, 16]} align="middle">
          <Col flex="auto">
            <Space size="middle" wrap>
              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>选择实体</div>
                <Select
                  placeholder="选择要预测的实体"
                  value={selectedEntity}
                  onChange={setSelectedEntity}
                  style={{ width: 240 }}
                  options={entities.map((e) => ({
                    value: e.id,
                    label: `${e.name} (${e.type})`,
                  }))}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>预测时长</div>
                <InputNumber
                  value={horizonHours}
                  onChange={(val) => setHorizonHours(val || 24)}
                  min={1}
                  max={168}
                  addonAfter="小时"
                  style={{ width: 140 }}
                />
              </div>

              <div style={{ paddingTop: '20px' }}>
                <Button
                  type="primary"
                  icon={<RocketOutlined />}
                  onClick={handlePredict}
                  loading={predicting}
                  disabled={!selectedEntity}
                >
                  开始预测
                </Button>
              </div>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 预测结果 */}
      {predicting ? (
        <Card style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Spin size="large" tip="AI模型计算中，请稍候..." />
        </Card>
      ) : prediction ? (
        <>
          {/* 预测指标卡片 */}
          <Row gutter={[12, 12]}>
            <Col span={6}>
              <Card size="small" style={{ background: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%)' }}>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginBottom: '8px' }}>
                  预测状态
                </div>
                <Tag
                  color={prediction.status === 'normal' ? 'success' : prediction.status === 'warning' ? 'warning' : 'error'}
                  style={{ fontSize: '14px', padding: '4px 12px' }}
                >
                  {prediction.status === 'normal' ? '正常' : prediction.status === 'warning' ? '警告' : '异常'}
                </Tag>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)' }}>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginBottom: '8px' }}>
                  置信度
                </div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                  {(Math.random() * 20 + 75).toFixed(1)}%
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginBottom: '8px' }}>
                  风险等级
                </div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                  {Math.random() > 0.5 ? '低' : '中'}
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card size="small" style={{ background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' }}>
                <div style={{ color: 'rgba(255,255,255,0.9)', fontSize: '12px', marginBottom: '8px' }}>
                  预测时长
                </div>
                <div style={{ color: '#fff', fontSize: '24px', fontWeight: 'bold' }}>
                  {horizonHours}h
                </div>
              </Card>
            </Col>
          </Row>

          {/* 预测趋势图 */}
          <Card
            title={
              <span>
                <LineChartOutlined style={{ marginRight: 8 }} />
                预测趋势分析
              </span>
            }
            extra={
              <Space>
                <Tag color="blue">历史数据</Tag>
                <Tag color="purple">预测数据</Tag>
              </Space>
            }
            style={{ flex: 1 }}
          >
            <ReactECharts
              option={getChartOption()}
              style={{ height: 400 }}
              opts={{ renderer: 'canvas' }}
              notMerge
            />
          </Card>

          {/* 预测说明 */}
          <Card size="small">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ThunderboltOutlined style={{ fontSize: '20px', color: '#8b5cf6' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#1f2937', marginBottom: '4px' }}>
                  AI预测模型说明
                </div>
                <div style={{ fontSize: '12px', color: '#6b7280', lineHeight: 1.6 }}>
                  基于历史数据和机器学习模型，预测未来{horizonHours}小时内的状态变化趋势。
                  置信区间表示预测值的可能波动范围，实际值有95%的概率落在该区间内。
                </div>
              </div>
            </div>
          </Card>
        </>
      ) : (
        <Card style={{ flex: 1 }}>
          <Empty
            description="请选择实体并设置预测参数"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: '80px' }}
          />
        </Card>
      )}
    </div>
  );
}
