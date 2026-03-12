/**
 * Dashboard服务启动脚本
 * 独立启动可观测性Dashboard
 */

import { loadEnv } from './utils/env.js';
import { MetricsStorage, DashboardServer } from './observability/index.js';

// 加载.env文件
loadEnv();

async function main() {
  const port = parseInt(process.env.DASHBOARD_PORT || '8080', 10);
  const host = process.env.DASHBOARD_HOST || 'localhost';

  console.log('📊 启动 MapAgent 可观测性 Dashboard...\n');

  // 创建存储
  const storage = new MetricsStorage({
    dataDir: './observability-data',
    maxRetentionDays: 30,
    autoSaveInterval: 60000,
    maxMemoryCache: 10000,
  });

  // 创建Dashboard服务器
  const dashboard = new DashboardServer(storage, {
    port,
    host,
    enableWebSocket: true,
  });

  // 启动服务器
  await dashboard.start();

  console.log(`\n🌐 Dashboard地址: http://${host}:${port}`);
  console.log(`📁 数据存储目录: ./observability-data`);
  console.log('\n快捷键:');
  console.log('  Ctrl+C - 停止服务');
  console.log('\n');

  // 优雅关闭
  process.on('SIGINT', async () => {
    console.log('\n\n🛑 正在停止 Dashboard 服务...');
    await dashboard.stop();
    await storage.flush();
    console.log('✅ 服务已停止');
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n🛑 正在停止 Dashboard 服务...');
    await dashboard.stop();
    await storage.flush();
    console.log('✅ 服务已停止');
    process.exit(0);
  });
}

main().catch(error => {
  console.error('❌ 启动失败:', error);
  process.exit(1);
});
