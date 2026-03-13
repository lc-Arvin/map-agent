/**
 * 指标存储层
 * 支持内存缓存和文件持久化
 */

import { writeFile, readFile, mkdir, access } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import type {
  APICallMetric,
  AgentExecutionMetric,
  ToolExecutionMetric,
  PerformanceMetric,
  Statistics,
} from './types.js';

/** 存储配置 */
export interface StorageConfig {
  /** 数据目录 */
  dataDir: string;
  /** 最大保留天数 */
  maxRetentionDays: number;
  /** 自动保存间隔（毫秒） */
  autoSaveInterval: number;
  /** 最大内存缓存数量 */
  maxMemoryCache: number;
}

/** 默认配置 */
const DEFAULT_CONFIG: StorageConfig = {
  dataDir: './observability-data',
  maxRetentionDays: 30,
  autoSaveInterval: 60000, // 1分钟
  maxMemoryCache: 10000,
};

/**
 * 指标存储类
 */
export class MetricsStorage {
  private config: StorageConfig;
  private apiCalls: APICallMetric[] = [];
  private agentExecutions: AgentExecutionMetric[] = [];
  private toolExecutions: ToolExecutionMetric[] = [];
  private performanceMetrics: PerformanceMetric[] = [];
  private autoSaveTimer: NodeJS.Timeout | null = null;

  constructor(config: Partial<StorageConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initStorage();
  }

  /**
   * 初始化存储
   */
  private async initStorage(): Promise<void> {
    // 创建数据目录
    if (!existsSync(this.config.dataDir)) {
      await mkdir(this.config.dataDir, { recursive: true });
    }

    // 加载历史数据
    await this.loadFromDisk();

    // 启动自动保存
    this.startAutoSave();
  }

  /**
   * 获取存储文件路径
   */
  private getFilePath(type: string): string {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    return join(this.config.dataDir, `${type}-${date}.json`);
  }

  /**
   * 保存数据到磁盘
   */
  private async saveToDisk(): Promise<void> {
    try {
      await Promise.all([
        writeFile(
          this.getFilePath('api-calls'),
          JSON.stringify(this.apiCalls, null, 2)
        ),
        writeFile(
          this.getFilePath('agent-executions'),
          JSON.stringify(this.agentExecutions, null, 2)
        ),
        writeFile(
          this.getFilePath('tool-executions'),
          JSON.stringify(this.toolExecutions, null, 2)
        ),
        writeFile(
          this.getFilePath('performance'),
          JSON.stringify(this.performanceMetrics, null, 2)
        ),
      ]);
    } catch (error) {
      console.error('Failed to save metrics to disk:', error);
    }
  }

  /**
   * 从磁盘加载数据
   */
  private async loadFromDisk(): Promise<void> {
    try {
      const [apiCalls, agentExecutions, toolExecutions, performance] = await Promise.all([
        this.loadFile<APICallMetric[]>(this.getFilePath('api-calls')),
        this.loadFile<AgentExecutionMetric[]>(this.getFilePath('agent-executions')),
        this.loadFile<ToolExecutionMetric[]>(this.getFilePath('tool-executions')),
        this.loadFile<PerformanceMetric[]>(this.getFilePath('performance')),
      ]);

      if (apiCalls) this.apiCalls = apiCalls;
      if (agentExecutions) this.agentExecutions = agentExecutions;
      if (toolExecutions) this.toolExecutions = toolExecutions;
      if (performance) this.performanceMetrics = performance;
    } catch (error) {
      console.error('Failed to load metrics from disk:', error);
    }
  }

  /**
   * 重新从磁盘加载数据（用于多进程场景）
   */
  async reloadFromDisk(): Promise<void> {
    await this.loadFromDisk();
  }

  /**
   * 加载单个文件
   */
  private async loadFile<T>(path: string): Promise<T | null> {
    try {
      await access(path);
      const data = await readFile(path, 'utf-8');
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }

  /**
   * 启动自动保存
   */
  private startAutoSave(): void {
    this.autoSaveTimer = setInterval(() => {
      this.saveToDisk();
      this.cleanupOldData();
    }, this.config.autoSaveInterval);
  }

  /**
   * 停止自动保存
   */
  stopAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }

  /**
   * 清理旧数据
   */
  private async cleanupOldData(): Promise<void> {
    const cutoffTime = Date.now() - (this.config.maxRetentionDays * 24 * 60 * 60 * 1000);

    this.apiCalls = this.apiCalls.filter(m => m.timestamp > cutoffTime);
    this.agentExecutions = this.agentExecutions.filter(m => m.timestamp > cutoffTime);
    this.toolExecutions = this.toolExecutions.filter(m => m.timestamp > cutoffTime);
    this.performanceMetrics = this.performanceMetrics.filter(m => m.timestamp > cutoffTime);
  }

  /**
   * 存储API调用指标
   */
  storeAPICall(metric: APICallMetric): void {
    this.apiCalls.push(metric);
    this.trimCache(this.apiCalls);
  }

  /**
   * 存储Agent执行指标
   */
  storeAgentExecution(metric: AgentExecutionMetric): void {
    this.agentExecutions.push(metric);
    this.trimCache(this.agentExecutions);
  }

  /**
   * 存储工具执行指标
   */
  storeToolExecution(metric: ToolExecutionMetric): void {
    this.toolExecutions.push(metric);
    this.trimCache(this.toolExecutions);
  }

  /**
   * 存储性能指标
   */
  storePerformance(metric: PerformanceMetric): void {
    this.performanceMetrics.push(metric);
    this.trimCache(this.performanceMetrics);
  }

  /**
   * 修剪缓存，防止内存溢出
   */
  private trimCache<T>(array: T[]): void {
    if (array.length > this.config.maxMemoryCache) {
      array.splice(0, array.length - this.config.maxMemoryCache);
    }
  }

  /**
   * 获取最近的API调用
   */
  getRecentAPICalls(limit: number = 100): APICallMetric[] {
    return this.apiCalls.slice(-limit).reverse();
  }

  /**
   * 获取最近的Agent执行
   */
  getRecentAgentExecutions(limit: number = 100): AgentExecutionMetric[] {
    return this.agentExecutions.slice(-limit).reverse();
  }

  /**
   * 获取最近的工具执行
   */
  getRecentToolExecutions(limit: number = 100): ToolExecutionMetric[] {
    return this.toolExecutions.slice(-limit).reverse();
  }

  /**
   * 获取最近的性能指标
   */
  getRecentPerformance(limit: number = 100): PerformanceMetric[] {
    return this.performanceMetrics.slice(-limit).reverse();
  }

  /**
   * 计算统计数据
   */
  calculateStatistics(startTime: number, endTime: number): Statistics {
    const apiCallsInRange = this.apiCalls.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
    const agentExecutionsInRange = this.agentExecutions.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );
    const toolExecutionsInRange = this.toolExecutions.filter(
      m => m.timestamp >= startTime && m.timestamp <= endTime
    );

    // API调用统计
    const apiByEndpoint: Statistics['apiCalls']['byEndpoint'] = {};
    for (const call of apiCallsInRange) {
      if (!apiByEndpoint[call.endpoint]) {
        apiByEndpoint[call.endpoint] = {
          total: 0,
          success: 0,
          error: 0,
          avgDuration: 0,
        };
      }
      const stats = apiByEndpoint[call.endpoint];
      stats.total++;
      if (call.status === 'success') {
        stats.success++;
      } else {
        stats.error++;
      }
    }

    // 计算平均耗时
    for (const endpoint in apiByEndpoint) {
      const calls = apiCallsInRange.filter(c => c.endpoint === endpoint);
      apiByEndpoint[endpoint].avgDuration = Math.round(
        calls.reduce((sum, c) => sum + c.duration, 0) / calls.length
      );
    }

    // Agent执行统计
    const toolsUsed: Record<string, number> = {};
    for (const execution of agentExecutionsInRange) {
      for (const tool of execution.toolsUsed) {
        toolsUsed[tool] = (toolsUsed[tool] || 0) + 1;
      }
    }

    // 工具执行统计
    const toolStats: Statistics['toolExecutions']['byTool'] = {};
    for (const exec of toolExecutionsInRange) {
      if (!toolStats[exec.toolName]) {
        toolStats[exec.toolName] = {
          total: 0,
          success: 0,
          error: 0,
          avgDuration: 0,
        };
      }
      const stats = toolStats[exec.toolName];
      stats.total++;
      if (exec.status === 'success') {
        stats.success++;
      } else {
        stats.error++;
      }
    }

    // 计算工具平均耗时
    for (const toolName in toolStats) {
      const execs = toolExecutionsInRange.filter(e => e.toolName === toolName);
      toolStats[toolName].avgDuration = Math.round(
        execs.reduce((sum, e) => sum + e.duration, 0) / execs.length
      );
    }

    return {
      timeRange: { start: startTime, end: endTime },
      apiCalls: {
        total: apiCallsInRange.length,
        success: apiCallsInRange.filter(m => m.status === 'success').length,
        error: apiCallsInRange.filter(m => m.status === 'error').length,
        avgDuration: apiCallsInRange.length > 0
          ? Math.round(apiCallsInRange.reduce((sum, m) => sum + m.duration, 0) / apiCallsInRange.length)
          : 0,
        maxDuration: apiCallsInRange.length > 0
          ? Math.max(...apiCallsInRange.map(m => m.duration))
          : 0,
        minDuration: apiCallsInRange.length > 0
          ? Math.min(...apiCallsInRange.map(m => m.duration))
          : 0,
        byEndpoint: apiByEndpoint,
      },
      agentExecutions: {
        total: agentExecutionsInRange.length,
        success: agentExecutionsInRange.filter(m => m.status === 'success').length,
        error: agentExecutionsInRange.filter(m => m.status === 'error').length,
        partial: agentExecutionsInRange.filter(m => m.status === 'partial').length,
        avgDuration: agentExecutionsInRange.length > 0
          ? Math.round(agentExecutionsInRange.reduce((sum, m) => sum + m.totalDuration, 0) / agentExecutionsInRange.length)
          : 0,
        toolsUsed,
      },
      toolExecutions: {
        total: toolExecutionsInRange.length,
        byTool: toolStats,
      },
    };
  }

  /**
   * 获取所有统计数据
   */
  getAllStatistics(): {
    lastHour: Statistics;
    last24Hours: Statistics;
    allTime: Statistics;
  } {
    const now = Date.now();
    return {
      lastHour: this.calculateStatistics(now - 3600000, now),
      last24Hours: this.calculateStatistics(now - 86400000, now),
      allTime: this.calculateStatistics(0, now),
    };
  }

  /**
   * 强制保存到磁盘
   */
  async flush(): Promise<void> {
    await this.saveToDisk();
  }
}
