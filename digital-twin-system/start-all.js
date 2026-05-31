/**
 * 数字孪生系统 - 快速启动脚本
 *
 * 使用方法：
 * 1. 确保已安装依赖: npm install
 * 2. 运行此脚本: node start-all.js
 *
 * 功能：
 * - 启动WebSocket服务器（端口8080）
 * - 启动前端开发服务器（端口3001）
 */

const { spawn } = require('child_process');
const path = require('path');

console.log('='.repeat(60));
console.log('数字孪生系统 - 启动中...');
console.log('='.repeat(60));

// 启动WebSocket服务器
console.log('\n[1/2] 启动WebSocket服务器...');
const wsServer = spawn('node', ['websocket-server.js'], {
  cwd: __dirname,
  stdio: 'inherit',
  shell: true,
});

wsServer.on('error', (error) => {
  console.error('WebSocket服务器启动失败:', error);
});

// 等待2秒后启动前端服务器
setTimeout(() => {
  console.log('\n[2/2] 启动前端开发服务器...');
  const viteServer = spawn('npm', ['run', 'dev'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true,
  });

  viteServer.on('error', (error) => {
    console.error('前端服务器启动失败:', error);
  });

  console.log('\n' + '='.repeat(60));
  console.log('系统启动完成！');
  console.log('='.repeat(60));
  console.log('\n访问地址:');
  console.log('  前端界面: http://localhost:3001');
  console.log('  WebSocket: ws://localhost:8080');
  console.log('\n按 Ctrl+C 停止所有服务\n');

  // 处理退出信号
  process.on('SIGINT', () => {
    console.log('\n\n正在停止所有服务...');
    wsServer.kill();
    viteServer.kill();
    process.exit(0);
  });
}, 2000);
