/**
 * 数字孪生主页面 - 整合所有核心功能
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, Row, Col, Tabs, Button, Space, Badge, message, Modal } from 'antd';
import {
  ThunderboltOutlined,
  EyeOutlined,
  HistoryOutlined,
  RocketOutlined,
  SettingOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import Scene3D from '../components/Scene3D';
import RealtimeMonitor from '../components/RealtimeMonitor';
import HistoryPlayback from '../components/HistoryPlayback';
import PredictionSimulation from '../components/PredictionSimulation';
import { getDigitalTwinEngine, PhysicalEntity, TwinEvent } from '../core/DigitalTwinEngine';

export default function DigitalTwinDashboard() {
  const [engine] = useState(() => getDigitalTwinEngine({ syncIntervalMs: 3000 }));
  const [entities, setEntities] = useState<PhysicalEntity[]>([]);
  const [events, setEvents] = useState<TwinEvent[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<PhysicalEntity | null>(null);
  const [activeTab, setActiveTab] = useState('3d');

  // 历史回溯相关状态
  const [historyRange, setHistoryRange] = useState<{ start: number; end: number } | null>(null);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  // 初始化引擎
  useEffect(() => {
    engine.start().catch(console.error);

    // 监听实体更新
    const unsubUpdate = engine.on('entity:update', (event) => {
      setEntities(engine.getAllEntities());
      setEvents((prev) => [...prev, event]);
    });

    const unsubAdd = engine.on('entity:add', (event) => {
      setEntities(engine.getAllEntities());
      setEvents((prev) => [...prev, event]);
    });

    const unsubRemove = engine.on('entity:remove', (event) => {
      setEntities(engine.getAllEntities());
      setEvents((prev) => [...prev, event]);
    });

    const unsubAlert = engine.on('alert:trigger', (event) => {
      setEvents((prev) => [...prev, event]);
      message.warning(event.payload.message);
    });

    const unsubStateChange = engine.on('state:change', (event) => {
      setEntities(engine.getAllEntities());
    });

    // 初始化模拟数据
    initializeMockData();

    // 定期更新历史范围
    const rangeInterval = setInterval(() => {
      const range = engine.getHistoryRange();
      setHistoryRange(range);
    }, 5000);

    return () => {
      unsubUpdate();
      unsubAdd();
      unsubRemove();
      unsubAlert();
      unsubStateChange();
      clearInterval(rangeInterval);
      engine.stop();
    };
  }, [engine]);

  // 初始化模拟数据
  const initializeMockData = () => {
    // 添加一些模拟实体
    const mockEntities: PhysicalEntity[] = [
      {
        id: 'company-001',
        type: 'company',
        name: '科技公司A',
        position: { x: 0, y: 0, z: 0 },
        status: 'normal',
        metrics: { revenue: 1000000, employees: 500 },
        lastUpdate: Date.now(),
      },
      {
        id: 'company-002',
        type: 'company',
        name: '制造企业B',
        position: { x: 3, y: 0, z: 2 },
        status: 'warning',
        metrics: { revenue: 800000, employees: 300 },
        lastUpdate: Date.now(),
      },
      {
        id: 'pipeline-001',
        type: 'pipeline',
        name: '数据管道1',
        position: { x: -2, y: 1, z: -1 },
        status: 'normal',
        metrics: { throughput: 1000, latency: 50 },
        lastUpdate: Date.now(),
      },
      {
        id: 'grid-001',
        type: 'grid',
        name: '网格节点1',
        position: { x: 2, y: -1, z: 3 },
        status: 'normal',
        metrics: { load: 0.6, capacity: 100 },
        lastUpdate: Date.now(),
      },
      {
        id: 'facility-001',
        type: 'facility',
        name: '设施单元1',
        position: { x: -3, y: 0, z: 1 },
        status: 'error',
        metrics: { temperature: 85, pressure: 120 },
        lastUpdate: Date.now(),
      },
    ];

    mockEntities.forEach((entity) => engine.addEntity(entity));

    // 模拟实时数据更新
    setInterval(() => {
      const allEntities = engine.getAllEntities();
      if (allEntities.length > 0) {
        const randomEntity = allEntities[Math.floor(Math.random() * allEntities.length)];
        const updated = { ...randomEntity };

        // 随机更新状态
        if (Math.random() > 0.9) {
          const statuses: Array<'normal' | 'warning' | 'error'> = ['normal', 'warning', 'error'];
          updated.status = statuses[Math.floor(Math.random() * statuses.length)];
        }

        // 更新指标
        updated.metrics = {
          ...updated.metrics,
          value: Math.random() * 100,
        };

        engine.updateEntity(updated);
      }
    }, 5000);
  };

  // 处理实体点击
  const handleEntityClick = (entity: PhysicalEntity) => {
    setSelectedEntity(entity);
    Modal.info({
      title: `实体详情: ${entity.name}`,
      content: (
        <div>
          <p><strong>ID:</strong> {entity.id}</p>
          <p><strong>类型:</strong> {entity.type}</p>
          <p><strong>状态:</strong> {entity.status}</p>
          <p><strong>位置:</strong> ({entity.position?.x}, {entity.position?.y}, {entity.position?.z})</p>
          <p><strong>指标:</strong></p>
          <pre>{JSON.stringify(entity.metrics, null, 2)}</pre>
          <p><strong>最后更新:</strong> {new Date(entity.lastUpdate).toLocaleString('zh-CN')}</p>
        </div>
      ),
      width: 600,
    });
  };

  // 历史回放控制
  const handlePlay = useCallback(() => {
    if (!historyRange) return;
    setIsPlaying(true);
    engine.playback(currentTime, historyRange.end, playbackSpeed).then(() => {
      setIsPlaying(false);
    });
  }, [engine, historyRange, currentTime, playbackSpeed]);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    engine.stopPlayback();
  }, [engine]);

  const handleTimeChange = useCallback((time: number) => {
    setCurrentTime(time);
    const state = engine.getHistoricalState(time);
    if (state) {
      setEntities(Array.from(state.entities.values()));
    }
  }, [engine]);

  const handleSpeedChange = useCallback((speed: number) => {
    setPlaybackSpeed(speed);
  }, []);

  const handleReset = useCallback(() => {
    setIsPlaying(false);
    engine.stopPlayback();
    if (historyRange) {
      setCurrentTime(historyRange.start);
    }
    setEntities(engine.getAllEntities());
  }, [engine, historyRange]);

  // 预测功能
  const handlePredict = useCallback(async (entityId: string, horizonMs: number) => {
    return engine.predict(entityId, horizonMs);
  }, [engine]);

  return (
    <div className="page-container fade-in">
      {/* 页面标题 */}
      <div className="page-title">
        <span className="title-bar" />
        <span>数字孪生系统</span>
        <Badge
          status="processing"
          text="实时同步中"
          style={{ marginLeft: 16, fontSize: '12px' }}
        />
      </div>

      {/* 主要内容区 */}
      <Row gutter={[16, 16]}>
        {/* 左侧：3D场景和标签页 */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <Space>
                <ThunderboltOutlined />
                <span>数字孪生可视化</span>
              </Space>
            }
            extra={
              <Space>
                <Button
                  icon={<ReloadOutlined />}
                  size="small"
                  onClick={() => {
                    setEntities(engine.getAllEntities());
                    message.success('已刷新');
                  }}
                >
                  刷新
                </Button>
                <Button icon={<SettingOutlined />} size="small">
                  设置
                </Button>
              </Space>
            }
            styles={{ body: { padding: '12px' } }}
          >
            <Tabs
              activeKey={activeTab}
              onChange={setActiveTab}
              items={[
                {
                  key: '3d',
                  label: (
                    <span>
                      <EyeOutlined />
                      3D场景
                    </span>
                  ),
                  children: (
                    <div style={{ background: '#0f172a', borderRadius: '8px', overflow: 'hidden' }}>
                      <Scene3D
                        entities={entities}
                        onEntityClick={handleEntityClick}
                        width={undefined}
                        height={600}
                      />
                    </div>
                  ),
                },
                {
                  key: 'history',
                  label: (
                    <span>
                      <HistoryOutlined />
                      历史回溯
                    </span>
                  ),
                  children: (
                    <HistoryPlayback
                      historyRange={historyRange}
                      currentTime={currentTime}
                      isPlaying={isPlaying}
                      playbackSpeed={playbackSpeed}
                      onTimeChange={handleTimeChange}
                      onPlay={handlePlay}
                      onPause={handlePause}
                      onSpeedChange={handleSpeedChange}
                      onReset={handleReset}
                    />
                  ),
                },
                {
                  key: 'prediction',
                  label: (
                    <span>
                      <RocketOutlined />
                      预测仿真
                    </span>
                  ),
                  children: (
                    <PredictionSimulation
                      entities={entities}
                      onPredict={handlePredict}
                    />
                  ),
                },
              ]}
            />
          </Card>
        </Col>

        {/* 右侧：实时监控 */}
        <Col xs={24} lg={8}>
          <div style={{ height: '100%', minHeight: '700px' }}>
            <RealtimeMonitor
              entities={entities}
              events={events}
              onEventClick={(event) => {
                console.log('Event clicked:', event);
              }}
            />
          </div>
        </Col>
      </Row>

      {/* 底部统计信息 */}
      <Card size="small" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>总实体数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginTop: '4px' }}>
                {entities.length}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>事件总数</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginTop: '4px' }}>
                {events.length}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>历史快照</div>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1f2937', marginTop: '4px' }}>
                {historyRange ? Math.floor((historyRange.end - historyRange.start) / 60000) : 0}
              </div>
            </div>
          </Col>
          <Col span={6}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>同步状态</div>
              <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#22c55e', marginTop: '8px' }}>
                <Badge status="processing" text="正常" />
              </div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
}
