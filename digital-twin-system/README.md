# 数字孪生系统 - 部署与使用指南

## 系统概述

这是一个真正的数字孪生系统，具备以下核心能力：

### 核心特性

1. **物理-虚拟双向映射**
   - 实时数据同步引擎
   - WebSocket实时通信
   - 状态双向绑定

2. **3D可视化**
   - CSS 3D Transform实现的三维场景
   - 可交互的实体展示
   - 实时状态渲染

3. **实时监控**
   - 实时事件流
   - 状态统计面板
   - 告警推送

4. **历史回溯**
   - 时间轴回放
   - 历史快照存储
   - 任意时间点状态恢复

5. **预测仿真**
   - AI驱动的未来状态预测
   - 趋势分析
   - 置信区间计算

6. **智能决策**
   - 异常检测
   - 自动告警
   - 事件驱动架构

## 系统架构

```
数字孪生系统
├── 前端 (React + TypeScript)
│   ├── 数字孪生引擎 (DigitalTwinEngine)
│   ├── 3D场景组件 (Scene3D)
│   ├── 实时监控面板 (RealtimeMonitor)
│   ├── 历史回溯组件 (HistoryPlayback)
│   └── 预测仿真组件 (PredictionSimulation)
├── WebSocket服务 (实时数据推送)
└── 后端API (数据接口)
```

## 部署步骤

### 1. 环境准备

确保已安装：
- Node.js >= 18.0.0
- npm >= 9.0.0

### 2. 安装依赖

```bash
cd digital-twin-system
npm install
```

主要依赖：
- `react` - UI框架
- `antd` - UI组件库
- `echarts` - 图表库
- `dayjs` - 时间处理
- `axios` - HTTP客户端

### 3. 启动WebSocket服务（可选）

如果需要实时数据推送功能：

```bash
# 安装WebSocket依赖
npm install ws

# 启动WebSocket服务
node websocket-server.js
```

WebSocket服务将在 `ws://localhost:8080` 启动。

**功能说明：**
- 每5秒推送实体状态更新
- 每10秒随机推送告警信息
- 支持双向命令通信

### 4. 启动前端开发服务器

```bash
npm run dev
```

访问 `http://localhost:3001`

### 5. 生产构建

```bash
npm run build
```

构建产物在 `dist/` 目录。

## 使用指南

### 数字孪生主控台

访问 `/dashboard` 查看主控台，包含：

#### 1. 3D场景视图
- **拖拽旋转**：鼠标拖拽旋转视角
- **点击实体**：查看实体详细信息
- **实时更新**：实体状态实时反映

#### 2. 实时监控面板
- **状态统计**：总实体数、正常/警告/异常数量
- **事件流**：实时显示系统事件
- **告警推送**：异常自动告警

#### 3. 历史回溯
- **时间轴滑块**：拖动查看历史状态
- **播放控制**：播放/暂停历史回放
- **速度调节**：0.5x - 10x播放速度
- **快速跳转**：选择日期时间快速跳转

#### 4. 预测仿真
- **选择实体**：选择要预测的实体
- **设置时长**：1-168小时预测范围
- **AI预测**：基于历史数据的趋势预测
- **置信区间**：预测值的可能波动范围

### 公司风险孪生

访问 `/company` 查看公司级风险分析：
- 风险扫描分析
- 关联图谱
- SHAP特征贡献
- 风险因素时间线

### 市场风险热力图

访问 `/market` 查看市场整体风险分布。

### Pipeline运行孪生

访问 `/pipeline` 查看数据管道运行状态。

## 配置说明

### 数字孪生引擎配置

在 `DigitalTwinDashboard.tsx` 中配置引擎参数：

```typescript
const engine = getDigitalTwinEngine({
  wsUrl: 'ws://localhost:8080',  // WebSocket服务地址
  syncIntervalMs: 3000,           // 轮询同步间隔（毫秒）
});
```

### WebSocket配置

编辑 `websocket-server.js`：

```javascript
const wss = new WebSocket.Server({ port: 8080 }); // 修改端口

// 修改推送频率
setInterval(() => {
  // 实体更新逻辑
}, 5000); // 5秒推送一次
```

## API接口

### REST API

系统使用以下API接口（需要后端支持）：

```
GET  /api/twin/state          - 获取当前状态
POST /api/twin/command        - 发送控制命令
GET  /api/twin/history        - 获取历史数据
POST /api/twin/predict        - 请求预测
```

### WebSocket消息格式

**客户端 → 服务端：**
```json
{
  "type": "command",
  "entityId": "entity-001",
  "command": "start",
  "params": {}
}
```

**服务端 → 客户端：**
```json
{
  "type": "entity:update",
  "payload": {
    "id": "entity-001",
    "type": "company",
    "name": "实体名称",
    "status": "normal",
    "metrics": {},
    "lastUpdate": 1234567890
  },
  "timestamp": 1234567890
}
```

## 数据模型

### PhysicalEntity（物理实体）

```typescript
interface PhysicalEntity {
  id: string;                    // 唯一标识
  type: 'company' | 'pipeline' | 'market' | 'grid' | 'facility';
  name: string;                  // 名称
  position?: { x: number; y: number; z: number }; // 3D位置
  status: 'normal' | 'warning' | 'error' | 'offline';
  metrics: Record<string, any>;  // 业务指标
  lastUpdate: number;            // 最后更新时间戳
}
```

### TwinEvent（孪生事件）

```typescript
interface TwinEvent {
  type: 'entity:update' | 'entity:add' | 'entity:remove' | 
        'state:change' | 'alert:trigger' | 'prediction:update';
  payload: any;
  timestamp: number;
}
```

## 性能优化

### 历史数据管理

- 默认保留最近1000个快照
- 可在 `DigitalTwinEngine.ts` 中调整 `maxHistorySize`

### 实时更新频率

- WebSocket推送：实时
- 轮询模式：默认3秒
- 可根据需求调整 `syncIntervalMs`

### 3D渲染优化

- 使用CSS 3D Transform，性能优于WebGL
- 实体数量建议 < 100个
- 大量实体时考虑LOD（细节层次）

## 扩展开发

### 添加新实体类型

1. 在 `DigitalTwinEngine.ts` 中扩展 `PhysicalEntity.type`
2. 在 `Scene3D.tsx` 中添加对应的3D形状
3. 更新颜色映射和图标

### 自定义预测模型

在 `DigitalTwinEngine.ts` 的 `predict` 方法中实现：

```typescript
async predict(entityId: string, horizonMs: number): Promise<PhysicalEntity | null> {
  // 1. 获取历史数据
  // 2. 调用机器学习模型
  // 3. 返回预测结果
}
```

### 集成外部数据源

在 `syncState` 方法中实现：

```typescript
private async syncState(): Promise<void> {
  const response = await fetch('/api/your-data-source');
  const data = await response.json();
  // 更新实体状态
}
```

## 故障排查

### WebSocket连接失败

1. 检查 `websocket-server.js` 是否运行
2. 确认端口8080未被占用
3. 检查防火墙设置

### 3D场景不显示

1. 检查浏览器是否支持CSS 3D Transform
2. 查看控制台错误信息
3. 确认实体数据格式正确

### 历史回放卡顿

1. 减少历史快照数量
2. 降低回放速度
3. 优化实体渲染逻辑

## 技术栈

- **前端框架**: React 18 + TypeScript
- **UI组件**: Ant Design 5
- **图表库**: ECharts 5
- **路由**: React Router 6
- **构建工具**: Vite 5
- **实时通信**: WebSocket
- **3D渲染**: CSS 3D Transform

## 与传统可视化大屏的区别

| 特性 | 传统可视化大屏 | 数字孪生系统 |
|------|--------------|------------|
| 数据同步 | 定时刷新 | 实时双向同步 |
| 可视化 | 2D图表 | 3D场景 + 图表 |
| 历史数据 | 静态查询 | 时间轴回放 |
| 预测能力 | 无 | AI驱动预测 |
| 交互性 | 有限 | 全面交互 |
| 物理映射 | 无 | 物理-虚拟映射 |

## 后续优化方向

1. **增强3D渲染**
   - 集成Three.js实现更复杂的3D场景
   - 添加光照、阴影、材质效果

2. **机器学习集成**
   - 接入真实的ML预测模型
   - 实现异常检测算法

3. **分布式架构**
   - 支持多节点部署
   - 实现负载均衡

4. **数据持久化**
   - 历史数据存储到数据库
   - 支持长期数据分析

5. **移动端适配**
   - 响应式设计优化
   - 移动端专用界面

## 许可证

MIT License

## 联系方式

如有问题，请提交Issue或联系开发团队。
