/**
 * 实时监控面板 - 显示实时数据流和告警
 */

import { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Badge, Timeline, Tag, Empty } from 'antd';
import {
  ThunderboltOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { PhysicalEntity, TwinEvent } from '../core/DigitalTwinEngine';

interface RealtimeMonitorProps {
  entities: PhysicalEntity[];
  events: TwinEvent[];
  onEventClick?: (event: TwinEvent) => void;
}

export default function RealtimeMonitor({ entities, events, onEventClick }: RealtimeMonitorProps) {
  const [stats, setStats] = useState({
    total: 0,
    normal: 0,
    warning: 0,
    error: 0,
    offline: 0,
  });

  const [recentEvents, setRecentEvents] = useState<TwinEvent[]>([]);

  useEffect(() => {
    // 统计实体状态
    const newStats = {
      total: entities.length,
      normal: entities.filter((e) => e.status === 'normal').length,
      warning: entities.filter((e) => e.status === 'warning').length,
      error: entities.filter((e) => e.status === 'error').length,
      offline: entities.filter((e) => e.status === 'offline').length,
    };
    setStats(newStats);
  }, [entities]);

  useEffect(() => {
    // 保留最近20条事件
    setRecentEvents(events.slice(-20).reverse());
  }, [events]);

  // 获取事件图标
  const getEventIcon = (event: TwinEvent) => {
    switch (event.type) {
      case 'alert:trigger':
        return <WarningOutlined style={{ color: '#ef4444' }} />;
      case 'entity:add':
        return <CheckCircleOutlined style={{ color: '#22c55e' }} />;
      case 'entity:remove':
        return <ClockCircleOutlined style={{ color: '#6b7280' }} />;
      case 'entity:update':
        return <SyncOutlined style={{ color: '#3b82f6' }} />;
      default:
        return <ThunderboltOutlined style={{ color: '#8b5cf6' }} />;
    }
  };

  // 获取事件颜色
  const getEventColor = (event: TwinEvent): string => {
    switch (event.type) {
      case 'alert:trigger':
        return 'red';
      case 'entity:add':
        return 'green';
      case 'entity:remove':
        return 'default';
      case 'entity:update':
        return 'blue';
      default:
        return 'purple';
    }
  };

  // 格式化时间
  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('zh-CN', { hour12: false });
  };

  // 格式化事件描述
  const formatEventDescription = (event: TwinEvent): string => {
    switch (event.type) {
      case 'alert:trigger':
        return event.payload.message || '触发告警';
      case 'entity:add':
        return `新增实体: ${event.payload.name}`;
      case 'entity:remove':
        return `移除实体: ${event.payload.name}`;
      case 'entity:update':
        return `更新实体: ${event.payload.entity?.name || '未知'}`;
      case 'prediction:update':
        return '预测模型更新';
      default:
        return '系统事件';
    }
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* 统计卡片 */}
      <Row gutter={[12, 12]}>
        <Col span={6}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>总实体数</span>}
              value={stats.total}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
              prefix={<ThunderboltOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>正常</span>}
              value={stats.normal}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>警告</span>}
              value={stats.warning}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)' }}>
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)' }}>异常</span>}
              value={stats.error}
              valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 'bold' }}
              prefix={<WarningOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 实时事件流 */}
      <Card
        title={
          <span>
            <Badge status="processing" />
            <span style={{ marginLeft: 8 }}>实时事件流</span>
          </span>
        }
        size="small"
        style={{ flex: 1, overflow: 'hidden' }}
        styles={{ body: { height: 'calc(100% - 48px)', overflowY: 'auto' } }}
      >
        {recentEvents.length > 0 ? (
          <Timeline
            items={recentEvents.map((event) => ({
              dot: getEventIcon(event),
              color: getEventColor(event),
              children: (
                <div
                  style={{ cursor: 'pointer' }}
                  onClick={() => onEventClick?.(event)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    <Tag color={getEventColor(event)} style={{ margin: 0 }}>
                      {event.type}
                    </Tag>
                    <span style={{ fontSize: '12px', color: '#6b7280' }}>
                      {formatTime(event.timestamp)}
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: '#1f2937' }}>
                    {formatEventDescription(event)}
                  </div>
                </div>
              ),
            }))}
          />
        ) : (
          <Empty
            description="暂无事件"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            style={{ marginTop: '40px' }}
          />
        )}
      </Card>

      {/* 实时状态指示 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '8px',
          padding: '8px',
          background: 'rgba(34, 197, 94, 0.1)',
          borderRadius: '6px',
          border: '1px solid rgba(34, 197, 94, 0.3)',
        }}
      >
        <Badge status="processing" />
        <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 500 }}>
          实时同步中 · 最后更新: {formatTime(Date.now())}
        </span>
      </div>
    </div>
  );
}
