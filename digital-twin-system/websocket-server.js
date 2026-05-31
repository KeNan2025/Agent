/**
 * WebSocket服务端示例
 * 用于数字孪生系统的实时数据推送
 *
 * 部署说明：
 * 1. 安装依赖: npm install ws
 * 2. 运行服务: node websocket-server.js
 * 3. 服务将在 ws://localhost:8080 启动
 */

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

console.log('WebSocket server started on ws://localhost:8080');

// 存储所有连接的客户端
const clients = new Set();

wss.on('connection', (ws) => {
  console.log('New client connected');
  clients.add(ws);

  // 发送欢迎消息
  ws.send(JSON.stringify({
    type: 'connection',
    payload: { message: 'Connected to Digital Twin WebSocket Server' },
    timestamp: Date.now(),
  }));

  // 处理客户端消息
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      console.log('Received:', data);

      // 处理命令
      if (data.type === 'command') {
        handleCommand(data, ws);
      }
    } catch (error) {
      console.error('Failed to parse message:', error);
    }
  });

  // 处理断开连接
  ws.on('close', () => {
    console.log('Client disconnected');
    clients.delete(ws);
  });

  // 处理错误
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// 处理命令
function handleCommand(data, ws) {
  console.log(`Command received: ${data.command} for entity ${data.entityId}`);

  // 发送命令确认
  ws.send(JSON.stringify({
    type: 'command:ack',
    payload: {
      entityId: data.entityId,
      command: data.command,
      status: 'success',
    },
    timestamp: Date.now(),
  }));
}

// 广播消息到所有客户端
function broadcast(message) {
  const data = JSON.stringify(message);
  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(data);
    }
  });
}

// 模拟实时数据推送
setInterval(() => {
  const entityTypes = ['company', 'pipeline', 'market', 'grid', 'facility'];
  const statuses = ['normal', 'warning', 'error'];

  const randomEntity = {
    id: `entity-${Math.floor(Math.random() * 10)}`,
    type: entityTypes[Math.floor(Math.random() * entityTypes.length)],
    name: `实体-${Math.floor(Math.random() * 100)}`,
    position: {
      x: Math.random() * 10 - 5,
      y: Math.random() * 10 - 5,
      z: Math.random() * 10 - 5,
    },
    status: statuses[Math.floor(Math.random() * statuses.length)],
    metrics: {
      value: Math.random() * 100,
      temperature: Math.random() * 50 + 20,
      pressure: Math.random() * 200,
    },
    lastUpdate: Date.now(),
  };

  broadcast({
    type: 'entity:update',
    payload: randomEntity,
    timestamp: Date.now(),
  });
}, 5000);

// 模拟告警推送
setInterval(() => {
  if (Math.random() > 0.7) {
    broadcast({
      type: 'alert:trigger',
      payload: {
        entityId: `entity-${Math.floor(Math.random() * 10)}`,
        severity: Math.random() > 0.5 ? 'high' : 'medium',
        message: `检测到异常: ${['温度过高', '压力异常', '连接超时', '数据丢失'][Math.floor(Math.random() * 4)]}`,
      },
      timestamp: Date.now(),
    });
  }
}, 10000);

console.log('Digital Twin WebSocket Server is running...');
console.log('- Real-time entity updates every 5 seconds');
console.log('- Random alerts every 10 seconds');
