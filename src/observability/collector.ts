/**
 * 指标收集器
 * 单例模式，在整个应用中收集各种指标
 */

import { randomUUID } from 'crypto';
import type {
  APICallMetric,
  AgentExecutionMetric,
  ToolExecutionMetric,
  PerformanceMetric,
} from './types.js';

/** 指标监听器类型 */
type MetricListener = (metric: APICallMetric | AgentExecutionMetric | ToolExecutionMetric | PerformanceMetric) => void;

/**
 * 指标收集器类
 */
export class MetricsCollector {
  private static instance: MetricsCollector | null = null;
  private listeners: Set<MetricListener> = new Set();
  private currentQueryId: string | null = null;

  /** 单例获取 */
  static getInstance(): MetricsCollector {
    if (!MetricsCollector.instance) {
      MetricsCollector.instance = new MetricsCollector();
    }
    return MetricsCollector.instance;
  }

  /** 重置单例（测试用） */
  static resetInstance(): void {
    MetricsCollector.instance = null;
  }

  /**
   * 注册监听器
   */
  onMetric(listener: MetricListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知所有监听器
   */
  private notify(metric: APICallMetric | AgentExecutionMetric | ToolExecutionMetric | PerformanceMetric): void {
    for (const listener of this.listeners) {
      try {
        listener(metric);
      } catch (error) {
        console.error('Metrics listener error:', error);
      }
    }
  }

  /**
   * 开始一个新的查询跟踪
   */
  startQuery(_query: string): string {
    const queryId = randomUUID();
    this.currentQueryId = queryId;
    return queryId;
  }

  /**
   * 获取当前查询ID
   */
  getCurrentQueryId(): string | null {
    return this.currentQueryId;
  }

  /**
   * 记录API调用
   */
  recordAPICall(metric: Omit<APICallMetric, 'id' | 'timestamp'>): void {
    const fullMetric: APICallMetric = {
      ...metric,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    this.notify(fullMetric);
  }

  /**
   * 记录Agent执行
   */
  recordAgentExecution(metric: Omit<AgentExecutionMetric, 'id' | 'timestamp'>): void {
    const fullMetric: AgentExecutionMetric = {
      ...metric,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    this.notify(fullMetric);
  }

  /**
   * 记录工具执行
   */
  recordToolExecution(metric: Omit<ToolExecutionMetric, 'id' | 'timestamp'>): void {
    const fullMetric: ToolExecutionMetric = {
      ...metric,
      id: randomUUID(),
      timestamp: Date.now(),
    };
    this.notify(fullMetric);
  }

  /**
   * 记录性能指标
   */
  recordPerformance(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
    };
    this.notify(fullMetric);
  }

  /**
   * 创建API调用跟踪器
   * 返回开始和结束函数
   */
  createAPITracker(apiName: string, endpoint: string, params?: Record<string, unknown>) {
    const startTime = Date.now();
    // const queryId = this.currentQueryId;

    // 脱敏处理：移除敏感字段
    const sanitizedParams = params ? this.sanitizeParams(params) : undefined;

    return {
      end: (status: 'success' | 'error', details?: {
        httpStatus?: number;
        responseCode?: string;
        errorMessage?: string;
        requestSize?: number;
        responseSize?: number;
      }): void => {
        const duration = Date.now() - startTime;
        this.recordAPICall({
          apiName,
          endpoint,
          params: sanitizedParams,
          status,
          duration,
          ...details,
        });
      },
      error: (error: Error, httpStatus?: number): void => {
        const duration = Date.now() - startTime;
        this.recordAPICall({
          apiName,
          endpoint,
          params: sanitizedParams,
          status: 'error',
          httpStatus,
          errorMessage: error.message,
          duration,
        });
      },
    };
  }

  /**
   * 创建Agent执行跟踪器
   */
  createAgentTracker(queryId: string, query: string) {
    const startTime = Date.now();
    const stages: {
      intentAnalysis?: number;
      toolExecution?: number;
      responseGeneration?: number;
    } = {};

    return {
      markIntentAnalysisComplete: (): void => {
        stages.intentAnalysis = Date.now() - startTime;
      },
      markToolExecutionComplete: (): void => {
        stages.toolExecution = Date.now() - startTime;
      },
      markResponseGenerationStart: (): void => {
        stages.responseGeneration = Date.now() - startTime;
      },
      end: (status: 'success' | 'error' | 'partial', details: {
        intent?: string;
        toolsUsed: string[];
        hasMapVisualization: boolean;
        errorMessage?: string;
        resultSummary?: string;
      }): void => {
        const totalDuration = Date.now() - startTime;
        this.recordAgentExecution({
          queryId,
          query,
          status,
          totalDuration,
          intentAnalysisDuration: stages.intentAnalysis,
          toolExecutionDuration: stages.toolExecution,
          responseGenerationDuration: stages.responseGeneration
            ? totalDuration - stages.responseGeneration
            : undefined,
          ...details,
        });
      },
    };
  }

  /**
   * 创建工具执行跟踪器
   */
  createToolTracker(toolName: string, queryId: string, input?: Record<string, unknown>) {
    const startTime = Date.now();

    // 脱敏处理
    const sanitizedInput = input ? this.sanitizeParams(input) : undefined;

    return {
      end: (status: 'success' | 'error', errorMessage?: string): void => {
        const duration = Date.now() - startTime;
        this.recordToolExecution({
          queryId,
          toolName,
          status,
          duration,
          input: sanitizedInput,
          errorMessage,
        });
      },
    };
  }

  /**
   * 脱敏处理参数
   * 移除敏感信息如API Key
   */
  private sanitizeParams(params: Record<string, unknown>): Record<string, unknown> {
    const sanitized = { ...params };
    const sensitiveFields = ['key', 'apiKey', 'api_key', 'password', 'token', 'secret'];

    for (const field of sensitiveFields) {
      if (field in sanitized) {
        sanitized[field] = '***';
      }
    }

    return sanitized;
  }

  /**
   * 启动性能监控
   */
  startPerformanceMonitoring(intervalMs: number = 30000): () => void {
    const timer = setInterval(() => {
      this.collectPerformanceMetrics();
    }, intervalMs);

    return () => {
      clearInterval(timer);
    };
  }

  /**
   * 收集性能指标
   */
  private collectPerformanceMetrics(): void {
    // 内存使用
    const memUsage = process.memoryUsage();
    this.recordPerformance({
      type: 'memory',
      value: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
      unit: 'MB',
      details: {
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        external: Math.round((memUsage.external || 0) / 1024 / 1024),
      },
    });
  }
}
