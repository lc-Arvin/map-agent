/**
 * 工具函数
 */

/**
 * 格式化距离显示
 */
export function formatDistance(meters: number): string {
  if (meters >= 10000) {
    return `${(meters / 1000).toFixed(1)}公里`;
  } else if (meters >= 1000) {
    return `${Math.round(meters / 1000)}公里`;
  }
  return `${meters}米`;
}

/**
 * 格式化时间显示
 */
export function formatDuration(seconds: number): string {
  if (seconds >= 3600) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}小时${minutes}分钟`;
  } else if (seconds >= 60) {
    return `${Math.floor(seconds / 60)}分钟`;
  }
  return `${seconds}秒`;
}

/**
 * 解析坐标字符串
 * 支持格式："116.481028,39.989673" 或 "116.481028, 39.989673"
 */
export function parseCoordinates(coordStr: string): { longitude: number; latitude: number } | null {
  const parts = coordStr.split(/[,，\s]+/).filter(s => s.length > 0);
  if (parts.length >= 2) {
    const longitude = parseFloat(parts[0]);
    const latitude = parseFloat(parts[1]);
    if (!isNaN(longitude) && !isNaN(latitude)) {
      return { longitude, latitude };
    }
  }
  return null;
}

/**
 * 验证坐标是否有效
 */
export function isValidCoordinates(longitude: number, latitude: number): boolean {
  return (
    longitude >= -180 &&
    longitude <= 180 &&
    latitude >= -90 &&
    latitude <= 90
  );
}

/**
 * 延迟函数
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 重试函数
 */
export async function retry<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  delayMs: number = 1000
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxAttempts) {
        await delay(delayMs * attempt);
      }
    }
  }

  throw lastError || new Error('Max retry attempts reached');
}

/**
 * 深拷贝
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * 安全获取对象属性
 */
export function safeGet<T>(obj: unknown, path: string, defaultValue?: T): T | undefined {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[key];
  }

  return current !== undefined ? (current as T) : defaultValue;
}