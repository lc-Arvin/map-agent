/**
 * 示例：可观测性功能
 * 展示如何使用MetricsCollector和Dashboard
 */

import { MapAgent, MetricsStorage, DashboardServer } from '../src/index.js';

const AMAP_KEY = process.env.AMAP_KEY || 'your_api_key_here';

async function observabilityExample() {
  console.log('=== 可观测性功能示例 ===\n');

  // 1. 创建指标存储
  const storage = new MetricsStorage({
    dataDir: './observability-data',
    maxRetentionDays: 7,
    autoSaveInterval: 30000, // 30秒自动保存
    maxMemoryCache: 5000,
  });

  // 2. 启动Dashboard服务
  const dashboard = new DashboardServer(storage, {
    port: 8080,
    host: 'localhost',
    enableWebSocket: true,
  });

  await dashboard.start();
  console.log('✅ Dashboard 已启动: http://localhost:8080\n');

  // 3. 创建Agent
  const agent = new MapAgent({
    amapKey: AMAP_KEY,
  });

  // 4. 执行一些查询（指标会自动收集）
  console.log('执行示例查询...\n');

  const queries = [
    '从北京南站到北京西站怎么走',
    '搜索北京朝阳公园附近的餐厅',
    '北京市朝阳区阜通东大街6号的坐标',
  ];

  for (const query of queries) {
    console.log(`查询: ${query}`);
    try {
      const response = await agent.query({ query });
      console.log(`✅ 成功 (${response.toolsUsed.join(', ')})\n`);
    } catch (error) {
      console.log(`❌ 失败: ${error instanceof Error ? error.message : String(error)}\n`);
    }

    // 等待一小段时间
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // 5. 获取统计数据
  console.log('\n=== 统计数据 ===');
  const stats = storage.getAllStatistics();

  console.log(`\n最近1小时:`);
  console.log(`  API调用: ${stats.lastHour.apiCalls.total} 次`);
  console.log(`  成功率: ${Math.round((stats.lastHour.apiCalls.success / Math.max(stats.lastHour.apiCalls.total, 1)) * 100)}%`);
  console.log(`  平均响应时间: ${stats.lastHour.apiCalls.avgDuration}ms`);
  console.log(`  Agent执行: ${stats.lastHour.agentExecutions.total} 次`);

  console.log(`\nAPI端点分布:`);
  for (const [endpoint, data] of Object.entries(stats.allTime.apiCalls.byEndpoint)) {
    console.log(`  ${endpoint}: ${data.total} 次 (${data.avgDuration}ms)`);
  }

  console.log(`\n工具使用情况:`);
  for (const [tool, data] of Object.entries(stats.allTime.toolExecutions.byTool)) {
    console.log(`  ${tool}: ${data.total} 次`);
  }

  // 6. 保持运行，让用户可以查看Dashboard
  console.log('\n=== Dashboard运行中 ===');
  console.log('请在浏览器中打开: http://localhost:8080');
  console.log('按 Ctrl+C 停止服务\n');

  // 优雅关闭处理
  process.on('SIGINT', async () => {
    console.log('\n\n正在停止服务...');
    await dashboard.stop();
    await storage.flush();
    console.log('服务已停止');
    process.exit(0);
  });

  // 保持进程运行
  await new Promise(() => {});
}

observabilityExample().catch(console.error);
