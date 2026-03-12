/**
 * 可观测性工具函数
 */

import { randomUUID } from 'crypto';

/**
 * 生成追踪ID
 */
export function generateTraceId(): string {
  return randomUUID();
}

/**
 * 格式化持续时间
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${(ms / 60000).toFixed(1)}m`;
}

/**
 * 格式化时间戳
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toISOString();
}
