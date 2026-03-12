/**
 * 可观测性指标类型定义
 */

/** API调用指标 */
export interface APICallMetric {
  /** 唯一标识 */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** API名称 */
  apiName: string;
  /** API端点 */
  endpoint: string;
  /** 请求参数（脱敏后） */
  params?: Record<string, unknown>;
  /** 响应状态 */
  status: 'success' | 'error';
  /** HTTP状态码 */
  httpStatus?: number;
  /** 响应码 */
  responseCode?: string;
  /** 错误信息 */
  errorMessage?: string;
  /** 耗时（毫秒） */
  duration: number;
  /** 请求大小（字节） */
  requestSize?: number;
  /** 响应大小（字节） */
  responseSize?: number;
}

/** Agent执行指标 */
export interface AgentExecutionMetric {
  /** 唯一标识 */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 查询ID */
  queryId: string;
  /** 用户查询文本 */
  query: string;
  /** 解析到的意图 */
  intent?: string;
  /** 调用的工具列表 */
  toolsUsed: string[];
  /** 执行状态 */
  status: 'success' | 'error' | 'partial';
  /** 总耗时（毫秒） */
  totalDuration: number;
  /** 意图分析耗时 */
  intentAnalysisDuration?: number;
  /** 工具执行耗时 */
  toolExecutionDuration?: number;
  /** 响应生成耗时 */
  responseGenerationDuration?: number;
  /** 错误信息 */
  errorMessage?: string;
  /** 是否生成地图 */
  hasMapVisualization: boolean;
  /** 结果摘要 */
  resultSummary?: string;
}

/** 工具执行指标 */
export interface ToolExecutionMetric {
  /** 唯一标识 */
  id: string;
  /** 时间戳 */
  timestamp: number;
  /** 关联的查询ID */
  queryId: string;
  /** 工具名称 */
  toolName: string;
  /** 执行状态 */
  status: 'success' | 'error';
  /** 耗时（毫秒） */
  duration: number;
  /** 输入参数（脱敏后） */
  input?: Record<string, unknown>;
  /** 错误信息 */
  errorMessage?: string;
}

/** 性能指标 */
export interface PerformanceMetric {
  /** 时间戳 */
  timestamp: number;
  /** 指标类型 */
  type: 'memory' | 'cpu' | 'event_loop';
  /** 指标值 */
  value: number;
  /** 单位 */
  unit: string;
  /** 详细信息 */
  details?: Record<string, number>;
}

/** 统计数据 */
export interface Statistics {
  /** 时间范围 */
  timeRange: {
    start: number;
    end: number;
  };
  /** API调用统计 */
  apiCalls: {
    total: number;
    success: number;
    error: number;
    avgDuration: number;
    maxDuration: number;
    minDuration: number;
    byEndpoint: Record<string, {
      total: number;
      success: number;
      error: number;
      avgDuration: number;
    }>;
  };
  /** Agent执行统计 */
  agentExecutions: {
    total: number;
    success: number;
    error: number;
    partial: number;
    avgDuration: number;
    toolsUsed: Record<string, number>;
  };
  /** 工具执行统计 */
  toolExecutions: {
    total: number;
    byTool: Record<string, {
      total: number;
      success: number;
      error: number;
      avgDuration: number;
    }>;
  };
}

/** 实时指标数据 */
export interface RealtimeMetrics {
  /** 最近API调用 */
  recentAPICalls: APICallMetric[];
  /** 最近Agent执行 */
  recentAgentExecutions: AgentExecutionMetric[];
  /** 最近工具执行 */
  recentToolExecutions: ToolExecutionMetric[];
  /** 最近性能指标 */
  recentPerformance: PerformanceMetric[];
  /** 统计摘要 */
  statistics: {
    lastHour: Statistics;
    last24Hours: Statistics;
    allTime: Statistics;
  };
}
