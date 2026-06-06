/**
 * 数字孪生系统 - 后端API服务示例
 *
 * 部署说明：
 * 1. 安装依赖: npm install express cors body-parser
 * 2. 运行服务: node api-server.js
 * 3. 服务将在 http://localhost:8000 启动
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = 8000;

// 中间件
app.use(cors());
app.use(bodyParser.json());

// 模拟数据存储
let entities = new Map();
let history = [];

// 初始化模拟数据
function initializeMockData() {
  const mockEntities = [
    {
      id: 'company-001',
      type: 'company',
      name: '科技公司A',
      position: { x: 0, y: 0, z: 0 },
      status: 'normal',
      metrics: { revenue: 1000000, employees: 500, riskScore: 0.2 },
      lastUpdate: Date.now(),
    },
    {
      id: 'company-002',
      type: 'company',
      name: '制造企业B',
      position: { x: 3, y: 0, z: 2 },
      status: 'warning',
      metrics: { revenue: 800000, employees: 300, riskScore: 0.6 },
      lastUpdate: Date.now(),
    },
    {
      id: 'pipeline-001',
      type: 'pipeline',
      name: '数据管道1',
      position: { x: -2, y: 1, z: -1 },
      status: 'normal',
      metrics: { throughput: 1000, latency: 50, errorRate: 0.01 },
      lastUpdate: Date.now(),
    },
  ];

  mockEntities.forEach((entity) => {
    entities.set(entity.id, entity);
  });

  console.log(`Initialized ${entities.size} mock entities`);
}

// API路由

// 获取当前状态
app.get('/api/twin/state', (req, res) => {
  const state = {
    entities: Array.from(entities.values()),
    timestamp: Date.now(),
  };
  res.json(state);
});

// 获取单个实体
app.get('/api/twin/entity/:id', (req, res) => {
  const entity = entities.get(req.params.id);
  if (entity) {
    res.json(entity);
  } else {
    res.status(404).json({ error: 'Entity not found' });
  }
});

// 更新实体
app.put('/api/twin/entity/:id', (req, res) => {
  const id = req.params.id;
  const updates = req.body;

  if (entities.has(id)) {
    const entity = entities.get(id);
    const updated = { ...entity, ...updates, lastUpdate: Date.now() };
    entities.set(id, updated);

    // 保存到历史
    history.push({
      timestamp: Date.now(),
      entity: updated,
    });

    res.json(updated);
  } else {
    res.status(404).json({ error: 'Entity not found' });
  }
});

// 添加实体
app.post('/api/twin/entity', (req, res) => {
  const entity = {
    ...req.body,
    lastUpdate: Date.now(),
  };

  if (!entity.id) {
    return res.status(400).json({ error: 'Entity ID is required' });
  }

  entities.set(entity.id, entity);
  res.status(201).json(entity);
});

// 删除实体
app.delete('/api/twin/entity/:id', (req, res) => {
  const id = req.params.id;
  if (entities.has(id)) {
    entities.delete(id);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: 'Entity not found' });
  }
});

// 发送控制命令
app.post('/api/twin/command', (req, res) => {
  const { entityId, command, params } = req.body;

  if (!entities.has(entityId)) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  console.log(`Command received: ${command} for entity ${entityId}`, params);

  // 模拟命令执行
  setTimeout(() => {
    const entity = entities.get(entityId);
    // 根据命令更新实体状态
    if (command === 'start') {
      entity.status = 'normal';
    } else if (command === 'stop') {
      entity.status = 'offline';
    }
    entity.lastUpdate = Date.now();
    entities.set(entityId, entity);
  }, 1000);

  res.json({
    success: true,
    message: `Command ${command} sent to entity ${entityId}`,
  });
});

// 获取历史数据
app.get('/api/twin/history', (req, res) => {
  const { entityId, startTime, endTime, limit = 100 } = req.query;

  let filtered = history;

  if (entityId) {
    filtered = filtered.filter((h) => h.entity.id === entityId);
  }

  if (startTime) {
    filtered = filtered.filter((h) => h.timestamp >= parseInt(startTime));
  }

  if (endTime) {
    filtered = filtered.filter((h) => h.timestamp <= parseInt(endTime));
  }

  // 限制返回数量
  filtered = filtered.slice(-parseInt(limit));

  res.json({
    history: filtered,
    total: filtered.length,
  });
});

// 预测接口
app.post('/api/twin/predict', (req, res) => {
  const { entityId, horizonMs } = req.body;

  if (!entities.has(entityId)) {
    return res.status(404).json({ error: 'Entity not found' });
  }

  const entity = entities.get(entityId);

  // 模拟预测计算
  setTimeout(() => {
    const predicted = {
      ...entity,
      lastUpdate: Date.now() + horizonMs,
      metrics: {
        ...entity.metrics,
        // 简单的线性预测
        value: (entity.metrics.value || 50) + Math.random() * 10,
      },
      confidence: 0.75 + Math.random() * 0.2,
    };

    res.json({
      prediction: predicted,
      confidence: predicted.confidence,
      horizon: horizonMs,
    });
  }, 2000); // 模拟计算延迟
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: Date.now(),
    entities: entities.size,
    history: history.length,
  });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('数字孪生系统 - API服务器');
  console.log('='.repeat(60));
  console.log(`\n服务地址: http://localhost:${PORT}`);
  console.log('\nAPI端点:');
  console.log('  GET    /api/twin/state          - 获取当前状态');
  console.log('  GET    /api/twin/entity/:id     - 获取单个实体');
  console.log('  PUT    /api/twin/entity/:id     - 更新实体');
  console.log('  POST   /api/twin/entity         - 添加实体');
  console.log('  DELETE /api/twin/entity/:id     - 删除实体');
  console.log('  POST   /api/twin/command        - 发送控制命令');
  console.log('  GET    /api/twin/history        - 获取历史数据');
  console.log('  POST   /api/twin/predict        - 请求预测');
  console.log('  GET    /health                  - 健康检查');
  console.log('\n初始化模拟数据...');

  initializeMockData();

  console.log('\nAPI服务器运行中...\n');
});

// 定期更新模拟数据
setInterval(() => {
  entities.forEach((entity) => {
    // 随机更新指标
    if (entity.metrics) {
      entity.metrics.value = (entity.metrics.value || 50) + (Math.random() - 0.5) * 5;
      entity.lastUpdate = Date.now();
    }

    // 随机改变状态
    if (Math.random() > 0.95) {
      const statuses = ['normal', 'warning', 'error'];
      entity.status = statuses[Math.floor(Math.random() * statuses.length)];
    }

    entities.set(entity.id, entity);

    // 保存到历史
    history.push({
      timestamp: Date.now(),
      entity: { ...entity },
    });
  });

  // 限制历史记录大小
  if (history.length > 10000) {
    history = history.slice(-5000);
  }
}, 10000); // 每10秒更新一次
