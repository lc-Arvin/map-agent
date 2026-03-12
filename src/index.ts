/**
 * 主入口
 * 导出所有公开API
 */

// 类型
export type {
  AgentConfig,
  AgentQuery,
  AgentResponse,
  Location,
  Address,
  POI,
  MCPTool,
  MCPToolCall,
  MCPToolResult,
  GeocodeRequest,
  GeocodeResponse,
  ReverseGeocodeRequest,
  ReverseGeocodeResponse,
  RouteRequest,
  RouteResponse,
  POISearchRequest,
  POISearchResponse,
  StaticMapRequest,
  StaticMapResponse,
} from './types/index.js';

// 核心类
export { MapAgent } from './agent/map-agent.js';
export { AMapClient, AMapAPIError } from './client/amap-client.js';

// 工具
export { allTools, toolDefinitions } from './tools/definitions.js';
export { executeTool, executeToolsParallel } from './tools/executors.js';

// 工具函数
export {
  formatDistance,
  formatDuration,
  parseCoordinates,
  isValidCoordinates,
  retry,
  deepClone,
  safeGet,
} from './utils/index.js';

// 响应生成器
export { generateResponseText } from './utils/response-generator.js';
