/**
 * 高德地图Agent核心类型定义
 * 基于MCP (Model Context Protocol) 协议设计
 */

// ==================== 通用类型 ====================

/** 经纬度坐标 */
export interface Location {
  longitude: number;
  latitude: number;
}

/** 地址信息 */
export interface Address {
  /** 完整地址 */
  formattedAddress: string;
  /** 国家 */
  country?: string;
  /** 省份 */
  province?: string;
  /** 城市 */
  city?: string;
  /** 区县 */
  district?: string;
  /** 街道 */
  street?: string;
  /** 门牌号 */
  streetNumber?: string;
}

/** POI (兴趣点) */
export interface POI {
  /** POI ID */
  id: string;
  /** 名称 */
  name: string;
  /** 地址 */
  address: string;
  /** 坐标 */
  location: Location;
  /** 类型 */
  type?: string;
  /** 电话 */
  tel?: string;
  /** 距离（米） */
  distance?: number;
  /** 评分 */
  rating?: number;
}

// ==================== MCP工具类型 ====================

/** MCP工具定义 */
export interface MCPTool {
  /** 工具名称 */
  name: string;
  /** 工具描述 */
  description: string;
  /** 输入参数Schema */
  parameters: Record<string, unknown>;
}

/** MCP工具调用请求 */
export interface MCPToolCall {
  /** 工具名称 */
  name: string;
  /** 调用参数 */
  arguments: Record<string, unknown>;
}

/** MCP工具调用结果 */
export interface MCPToolResult {
  /** 是否成功 */
  success: boolean;
  /** 结果数据 */
  data?: unknown;
  /** 错误信息 */
  error?: string;
}

// ==================== 高德API类型 ====================

/** 地理编码请求 */
export interface GeocodeRequest {
  /** 结构化地址 */
  address: string;
  /** 指定城市 */
  city?: string;
}

/** 地理编码响应 */
export interface GeocodeResponse {
  /** 状态码 */
  status: string;
  /** 状态说明 */
  info: string;
  /** 数量 */
  count?: string;
  /** 地理编码结果列表 */
  geocodes: Array<{
    /** 结构化地址 */
    formatted_address: string;
    /** 省份 */
    province: string;
    /** 城市 */
    city: string;
    /** 区县 */
    district: string;
    /** 街道 */
    street?: string;
    /** 门牌号 */
    number?: string;
    /** 坐标 */
    location: string;
    /** 国家 */
    country: string;
    /** 区域编码 */
    adcode: string;
  }>;
}

/** 逆地理编码请求 */
export interface ReverseGeocodeRequest {
  /** 经纬度坐标 */
  location: string;
  /** 返回POI数量 */
  pois?: number;
}

/** 逆地理编码响应 */
export interface ReverseGeocodeResponse {
  /** 状态码 */
  status: string;
  /** 状态说明 */
  info: string;
  /** 逆地理编码结果 */
  regeocode: {
    /** 结构化地址 */
    formatted_address: string;
    /** 地址组件 */
    addressComponent: {
      province: string;
      city: string;
      district: string;
      street: string;
      streetNumber: string;
      country: string;
      adcode: string;
    };
    /** 周边POI */
    pois?: Array<{
      name: string;
      address: string;
      location: string;
      type: string;
      distance: string;
    }>;
  };
}

/** 路径规划请求 */
export interface RouteRequest {
  /** 起点坐标 */
  origin: string;
  /** 终点坐标 */
  destination: string;
  /** 驾车策略 */
  strategy?: number;
  /** 途经点 */
  waypoints?: string;
}

/** 路径规划响应 */
export interface RouteResponse {
  status: string;
  info: string;
  route: {
    origin: string;
    destination: string;
    paths: Array<{
      distance: string;
      duration: string;
      strategy: string;
      tolls: string;
      restriction: string;
      steps: Array<{
        instruction: string;
        orientation: string;
        road: string;
        distance: string;
        duration: string;
        polyline: string;
        action: string;
      }>;
    }>;
  };
}

/** POI搜索请求 */
export interface POISearchRequest {
  /** 搜索关键词 */
  keywords?: string;
  /** 搜索类型 */
  types?: string;
  /** 城市 */
  city?: string;
  /** 中心点坐标（周边搜索） */
  location?: string;
  /** 搜索半径（米） */
  radius?: number;
  /** 页码 */
  page?: number;
  /** 每页数量 */
  offset?: number;
}

/** POI搜索响应 */
export interface POISearchResponse {
  status: string;
  info: string;
  count: string;
  pois: Array<{
    id: string;
    name: string;
    type: string;
    address: string;
    location: string;
    tel: string;
    distance?: string;
  }>;
}

/** 静态地图请求 */
export interface StaticMapRequest {
  /** 地图中心点 */
  location: string;
  /** 缩放级别 */
  zoom?: number;
  /** 地图大小 */
  size?: string;
  /** 标记点 */
  markers?: string;
  /** 路线 */
  path?: string;
  /** 标签 */
  labels?: string;
}

/** 静态地图响应 */
export interface StaticMapResponse {
  /** 图片URL */
  url: string;
}

// ==================== Agent类型 ====================

/** Agent配置 */
export interface AgentConfig {
  /** 高德API Key */
  amapKey: string;
  /** 安全密钥（可选） */
  securityConfig?: string;
  /** API基础URL */
  baseUrl?: string;
  /** 超时时间（毫秒） */
  timeout?: number;
}

/** Agent查询请求 */
export interface AgentQuery {
  /** 用户查询文本 */
  query: string;
  /** 用户当前位置（可选） */
  userLocation?: Location;
  /** 上下文信息 */
  context?: Record<string, unknown>;
}

/** Agent查询响应 */
export interface AgentResponse {
  /** 响应文本 */
  text: string;
  /** 使用的工具 */
  toolsUsed: string[];
  /** 原始数据 */
  data?: unknown;
  /** 地图可视化数据 */
  mapVisualization?: {
    type: 'static' | 'interactive';
    url?: string;
    html?: string;
  };
}

/** 工具执行上下文 */
export interface ToolContext {
  /** API客户端 */
  apiClient: AMapAPIClient;
  /** 配置 */
  config: AgentConfig;
}

/** 高德API客户端接口 */
export interface AMapAPIClient {
  /** 地理编码 */
  geocode(request: GeocodeRequest): Promise<GeocodeResponse>;
  /** 逆地理编码 */
  reverseGeocode(request: ReverseGeocodeRequest): Promise<ReverseGeocodeResponse>;
  /** 路径规划 */
  route(request: RouteRequest): Promise<RouteResponse>;
  /** POI搜索 */
  searchPOI(request: POISearchRequest): Promise<POISearchResponse>;
  /** 静态地图 */
  staticMap(request: StaticMapRequest): Promise<StaticMapResponse>;
}