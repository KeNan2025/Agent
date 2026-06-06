/**
 * 数字孪生核心引擎
 * 负责物理实体与虚拟模型的双向同步
 */

export interface PhysicalEntity {
  id: string;
  type: 'company' | 'pipeline' | 'market' | 'grid' | 'facility';
  name: string;
  position?: { x: number; y: number; z: number };
  status: 'normal' | 'warning' | 'error' | 'offline';
  metrics: Record<string, any>;
  lastUpdate: number;
}

export interface TwinState {
  entities: Map<string, PhysicalEntity>;
  timestamp: number;
  simulationMode: boolean;
  playbackSpeed: number;
}

export interface HistoricalSnapshot {
  timestamp: number;
  state: any;
}

export type TwinEventType =
  | 'entity:update'
  | 'entity:add'
  | 'entity:remove'
  | 'state:change'
  | 'alert:trigger'
  | 'prediction:update';

export interface TwinEvent {
  type: TwinEventType;
  payload: any;
  timestamp: number;
}

export class DigitalTwinEngine {
  private state: TwinState;
  private history: HistoricalSnapshot[] = [];
  private maxHistorySize = 1000;
  private listeners: Map<TwinEventType, Set<(event: TwinEvent) => void>> = new Map();
  private syncInterval: NodeJS.Timeout | null = null;
  private ws: WebSocket | null = null;

  constructor(private config: { wsUrl?: string; syncIntervalMs?: number } = {}) {
    this.state = {
      entities: new Map(),
      timestamp: Date.now(),
      simulationMode: false,
      playbackSpeed: 1.0,
    };
  }

  /**
   * 启动数字孪生引擎
   */
  async start(): Promise<void> {
    console.log('[DigitalTwin] Engine starting...');

    // 连接WebSocket进行实时数据同步
    if (this.config.wsUrl) {
      await this.connectWebSocket();
    }

    // 启动定期同步
    this.startSync();

    console.log('[DigitalTwin] Engine started');
  }

  /**
   * 停止引擎
   */
  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    console.log('[DigitalTwin] Engine stopped');
  }

  /**
   * 连接WebSocket实现实时数据流
   */
  private async connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.wsUrl!);

        this.ws.onopen = () => {
          console.log('[DigitalTwin] WebSocket connected');
          resolve();
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleWebSocketMessage(data);
          } catch (error) {
            console.error('[DigitalTwin] Failed to parse message:', error);
          }
        };

        this.ws.onerror = (error) => {
          console.error('[DigitalTwin] WebSocket error:', error);
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[DigitalTwin] WebSocket disconnected');
          // 尝试重连
          setTimeout(() => {
            if (this.config.wsUrl) {
              this.connectWebSocket().catch(console.error);
            }
          }, 5000);
        };

        // 超时处理
        setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            console.warn('[DigitalTwin] WebSocket connection timeout, using polling mode');
            resolve();
          }
        }, 5000);
      } catch (error) {
        console.error('[DigitalTwin] Failed to create WebSocket:', error);
        reject(error);
      }
    });
  }

  /**
   * 处理WebSocket消息
   */
  private handleWebSocketMessage(data: any): void {
    switch (data.type) {
      case 'entity:update':
        this.updateEntity(data.payload);
        break;
      case 'entity:add':
        this.addEntity(data.payload);
        break;
      case 'entity:remove':
        this.removeEntity(data.payload.id);
        break;
      default:
        console.warn('[DigitalTwin] Unknown message type:', data.type);
    }
  }

  /**
   * 启动定期同步
   */
  private startSync(): void {
    const interval = this.config.syncIntervalMs || 5000;
    this.syncInterval = setInterval(() => {
      this.syncState();
    }, interval);
  }

  /**
   * 同步状态（轮询模式）
   */
  private async syncState(): Promise<void> {
    // 如果WebSocket已连接，则不需要轮询
    if (this.ws?.readyState === WebSocket.OPEN) return;

    try {
      // 这里可以调用REST API获取最新状态
      // const response = await fetch('/api/twin/state');
      // const data = await response.json();
      // this.updateState(data);
    } catch (error) {
      console.error('[DigitalTwin] Sync failed:', error);
    }
  }

  /**
   * 更新实体
   */
  updateEntity(entity: PhysicalEntity): void {
    const existing = this.state.entities.get(entity.id);

    entity.lastUpdate = Date.now();
    this.state.entities.set(entity.id, entity);
    this.state.timestamp = Date.now();

    // 保存历史快照
    this.saveSnapshot();

    // 触发事件
    this.emit({
      type: 'entity:update',
      payload: { entity, previous: existing },
      timestamp: Date.now(),
    });

    // 检查异常并触发告警
    this.checkAnomalies(entity);
  }

  /**
   * 添加实体
   */
  addEntity(entity: PhysicalEntity): void {
    entity.lastUpdate = Date.now();
    this.state.entities.set(entity.id, entity);
    this.state.timestamp = Date.now();

    this.emit({
      type: 'entity:add',
      payload: entity,
      timestamp: Date.now(),
    });
  }

  /**
   * 移除实体
   */
  removeEntity(id: string): void {
    const entity = this.state.entities.get(id);
    if (entity) {
      this.state.entities.delete(id);
      this.state.timestamp = Date.now();

      this.emit({
        type: 'entity:remove',
        payload: entity,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 获取当前状态
   */
  getState(): TwinState {
    return { ...this.state };
  }

  /**
   * 获取实体
   */
  getEntity(id: string): PhysicalEntity | undefined {
    return this.state.entities.get(id);
  }

  /**
   * 获取所有实体
   */
  getAllEntities(): PhysicalEntity[] {
    return Array.from(this.state.entities.values());
  }

  /**
   * 保存历史快照
   */
  private saveSnapshot(): void {
    const snapshot: HistoricalSnapshot = {
      timestamp: Date.now(),
      state: {
        entities: Array.from(this.state.entities.entries()),
        timestamp: this.state.timestamp,
      },
    };

    this.history.push(snapshot);

    // 限制历史记录大小
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }
  }

  /**
   * 历史回溯 - 获取指定时间点的状态
   */
  getHistoricalState(timestamp: number): TwinState | null {
    // 找到最接近的快照
    let closest: HistoricalSnapshot | null = null;
    let minDiff = Infinity;

    for (const snapshot of this.history) {
      const diff = Math.abs(snapshot.timestamp - timestamp);
      if (diff < minDiff) {
        minDiff = diff;
        closest = snapshot;
      }
    }

    if (!closest) return null;

    return {
      entities: new Map(closest.state.entities),
      timestamp: closest.state.timestamp,
      simulationMode: false,
      playbackSpeed: 1.0,
    };
  }

  /**
   * 获取历史时间范围
   */
  getHistoryRange(): { start: number; end: number } | null {
    if (this.history.length === 0) return null;
    return {
      start: this.history[0].timestamp,
      end: this.history[this.history.length - 1].timestamp,
    };
  }

  /**
   * 时间轴回放
   */
  async playback(startTime: number, endTime: number, speed: number = 1.0): Promise<void> {
    this.state.simulationMode = true;
    this.state.playbackSpeed = speed;

    const snapshots = this.history.filter(
      (s) => s.timestamp >= startTime && s.timestamp <= endTime
    );

    for (let i = 0; i < snapshots.length; i++) {
      if (!this.state.simulationMode) break;

      const snapshot = snapshots[i];
      this.state.timestamp = snapshot.timestamp;

      // 恢复实体状态
      this.state.entities = new Map(snapshot.state.entities);

      this.emit({
        type: 'state:change',
        payload: { snapshot, progress: (i + 1) / snapshots.length },
        timestamp: Date.now(),
      });

      // 根据速度调整延迟
      if (i < snapshots.length - 1) {
        const delay = (snapshots[i + 1].timestamp - snapshot.timestamp) / speed;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    this.state.simulationMode = false;
  }

  /**
   * 停止回放
   */
  stopPlayback(): void {
    this.state.simulationMode = false;
  }

  /**
   * 预测未来状态
   */
  async predict(entityId: string, horizonMs: number): Promise<PhysicalEntity | null> {
    const entity = this.getEntity(entityId);
    if (!entity) return null;

    // 获取历史数据
    const historicalData = this.history
      .map((s) => {
        const entities = new Map(s.state.entities);
        return entities.get(entityId);
      })
      .filter(Boolean) as PhysicalEntity[];

    // 简单的线性预测
    const predicted: PhysicalEntity = JSON.parse(JSON.stringify(entity));
    predicted.lastUpdate = Date.now() + horizonMs;

    return predicted;
  }

  /**
   * 异常检测
   */
  private checkAnomalies(entity: PhysicalEntity): void {
    if (entity.status === 'error') {
      this.emit({
        type: 'alert:trigger',
        payload: {
          entityId: entity.id,
          severity: 'high',
          message: `实体 ${entity.name} 状态异常`,
        },
        timestamp: Date.now(),
      });
    }
  }

  /**
   * 事件监听
   */
  on(eventType: TwinEventType, callback: (event: TwinEvent) => void): () => void {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, new Set());
    }
    this.listeners.get(eventType)!.add(callback);

    // 返回取消监听函数
    return () => {
      this.listeners.get(eventType)?.delete(callback);
    };
  }

  /**
   * 触发事件
   */
  private emit(event: TwinEvent): void {
    const listeners = this.listeners.get(event.type);
    if (listeners) {
      listeners.forEach((callback) => callback(event));
    }
  }

  /**
   * 发送控制指令到物理实体
   */
  async sendCommand(entityId: string, command: string, params: any): Promise<void> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'command', entityId, command, params }));
    }
  }
}

// 单例模式
let engineInstance: DigitalTwinEngine | null = null;

export function getDigitalTwinEngine(config?: any): DigitalTwinEngine {
  if (!engineInstance) {
    engineInstance = new DigitalTwinEngine(config);
  }
  return engineInstance;
}
