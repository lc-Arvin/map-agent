/**
 * CLI工具
 * 命令行交互式地图Agent
 */

import { loadEnv } from './utils/env.js';
import { MapAgent } from './agent/map-agent.js';
import { MetricsCollector } from './observability/collector.js';
import { MetricsStorage } from './observability/storage.js';
import type { AgentConfig } from './types/index.js';
import type { APICallMetric, AgentExecutionMetric, ToolExecutionMetric } from './observability/types.js';

// 加载.env文件
loadEnv();

const CONFIG: AgentConfig = {
  amapKey: process.env.AMAP_KEY || '',
  timeout: parseInt(process.env.AMAP_TIMEOUT || '10000', 10),
};

// 初始化可观测性存储
let storage: MetricsStorage | null = null;
let unsubscribeMetrics: (() => void) | null = null;

const OBSERVABILITY_DATA_DIR = process.env.OBSERVABILITY_DATA_DIR || './observability-data';

async function initObservability(): Promise<void> {
  // 创建存储实例
  storage = new MetricsStorage({
    dataDir: OBSERVABILITY_DATA_DIR,
    maxRetentionDays: parseInt(process.env.OBSERVABILITY_RETENTION_DAYS || '30', 10),
    autoSaveInterval: parseInt(process.env.OBSERVABILITY_SAVE_INTERVAL || '60000', 10),
  });

  // 等待存储初始化完成（加载历史数据）
  await new Promise(resolve => setTimeout(resolve, 100));

  // 注册指标监听器，将指标保存到存储
  const collector = MetricsCollector.getInstance();
  unsubscribeMetrics = collector.onMetric((metric) => {
    if ('apiName' in metric) {
      storage?.storeAPICall(metric as APICallMetric);
    } else if ('query' in metric) {
      storage?.storeAgentExecution(metric as AgentExecutionMetric);
    } else if ('toolName' in metric) {
      storage?.storeToolExecution(metric as ToolExecutionMetric);
    } else {
      storage?.storePerformance(metric);
    }
  });

  console.log('📊 可观测性系统已启动，数据将保存到:', OBSERVABILITY_DATA_DIR);
}

async function shutdownObservability(): Promise<void> {
  if (unsubscribeMetrics) {
    unsubscribeMetrics();
    unsubscribeMetrics = null;
  }
  if (storage) {
    await storage.flush();
    storage.stopAutoSave();
    console.log('📊 可观测性数据已保存');
  }
}

async function main() {
  // 检查API Key
  if (!CONFIG.amapKey) {
    console.error('❌ 错误：请设置环境变量 AMAP_KEY');
    console.error('\n您可以通过以下方式设置：');
    console.error('  1. 创建 .env 文件：echo "AMAP_KEY=your_api_key_here" > .env');
    console.error('  2. 或在命令行设置：export AMAP_KEY=your_api_key_here');
    console.error('\n您可以在高德开放平台申请API Key：https://console.amap.com/dev/key/app');
    process.exit(1);
  }

  // 初始化可观测性
  await initObservability();

  // 注册优雅关闭处理
  process.on('SIGINT', async () => {
    console.log('\n\n接收到中断信号，正在保存数据...');
    await shutdownObservability();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n\n接收到终止信号，正在保存数据...');
    await shutdownObservability();
    process.exit(0);
  });

  const agent = new MapAgent(CONFIG);

  console.log('🗺️  高德地图 Agent CLI');
  console.log('=======================\n');
  console.log('支持的功能：');
  console.log('  • 地理编码：查询地址对应的坐标');
  console.log('  • 路径规划：计算两点间的路线');
  console.log('  • POI搜索：查找附近的兴趣点');
  console.log('  • 坐标转换：转换不同坐标系');
  console.log('  • IP定位：获取IP所在城市\n');
  console.log('输入 "exit" 或 "quit" 退出程序\n');

  // 读取命令行参数
  const args = process.argv.slice(2);

  if (args.length > 0) {
    // 直接执行查询
    const query = args.join(' ');
    console.log(`\n📝 查询：${query}\n`);

    try {
      const response = await agent.query({ query });
      console.log(response.text);

      if (response.mapVisualization?.url) {
        console.log(`\n🗺️  地图：${response.mapVisualization.url}`);
      }
    } catch (error) {
      console.error('❌ 查询失败：', error instanceof Error ? error.message : String(error));
      await shutdownObservability();
      process.exit(1);
    }
  } else {
    // 交互模式
    console.log('请输入您的查询：');

    const decoder = new TextDecoder();
    const buffer = new Uint8Array(1024);

    while (true) {
      process.stdout.write('\n> ');

      try {
        const { stdin } = process;
        const bytesRead = await new Promise<number>((resolve) => {
          stdin.once('data', (data: Buffer) => {
            const len = Math.min(data.length, buffer.length);
            buffer.set(data.slice(0, len));
            resolve(len);
          });
        });

        const input = decoder.decode(buffer.slice(0, bytesRead)).trim();

        if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
          console.log('\n再见！👋');
          break;
        }

        if (!input) {
          continue;
        }

        try {
          const response = await agent.query({ query: input });
          console.log('\n' + response.text);

          if (response.mapVisualization?.url) {
            console.log(`\n🗺️  地图图片：${response.mapVisualization.url}`);
          }
        } catch (error) {
          console.error('❌ 查询失败：', error instanceof Error ? error.message : String(error));
        }
      } catch (error) {
        console.error('读取输入失败：', error);
        break;
      }
    }
  }

  // 关闭时保存可观测性数据
  await shutdownObservability();
}

main().catch(async (error) => {
  console.error(error);
  await shutdownObservability();
  process.exit(1);
});
