/**
 * 高德Web服务API客户端
 * 封装HTTP请求和响应处理
 */

import type {
  AgentConfig,
  AMapAPIClient,
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
} from '../types/index.js';
import { MetricsCollector } from '../observability/collector.js';

/** API错误 */
export class AMapAPIError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly response?: unknown
  ) {
    super(message);
    this.name = 'AMapAPIError';
  }
}

/** 高德API客户端实现 */
export class AMapClient implements AMapAPIClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeout: number;
  private readonly metricsCollector: MetricsCollector;

  constructor(config: AgentConfig) {
    this.apiKey = config.amapKey;
    this.baseUrl = config.baseUrl || 'https://restapi.amap.com';
    this.timeout = config.timeout || 10000;
    this.metricsCollector = MetricsCollector.getInstance();
  }

  /**
   * 发送HTTP请求
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined>,
    apiName: string
  ): Promise<T> {
    // 创建API调用跟踪器
    const tracker = this.metricsCollector.createAPITracker(apiName, endpoint, params);

    // 过滤undefined参数
    const filteredParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined)
    ) as Record<string, string | number>;

    // 添加API Key
    filteredParams.key = this.apiKey;

    // 构建URL
    const url = new URL(endpoint, this.baseUrl);
    Object.entries(filteredParams).forEach(([key, value]) => {
      url.searchParams.append(key, String(value));
    });

    // 发送请求
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url.toString(), {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (!response.ok) {
        const error = new AMapAPIError(
          `HTTP error: ${response.status}`,
          String(response.status)
        );
        tracker.error(error, response.status);
        throw error;
      }

      const responseText = await response.text();
      const responseSize = Buffer.byteLength(responseText, 'utf8');
      const data = JSON.parse(responseText) as T & { status: string; info: string };

      // 检查API返回状态
      if (data.status !== '1') {
        const error = new AMapAPIError(
          `API error: ${data.info}`,
          data.status,
          data
        );
        tracker.error(error, response.status);
        throw error;
      }

      // 计算结果数量（根据API类型）
      const resultCount = this.extractResultCount(data, apiName);

      // 记录成功
      tracker.end('success', {
        httpStatus: response.status,
        responseCode: data.status,
        responseSize,
      });

      // 调试日志（可在需要时开启）
      if (process.env.DEBUG_AMAP) {
        console.log(`[API ${apiName}] 结果数: ${resultCount}, 响应大小: ${responseSize} bytes`);
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof AMapAPIError) {
        throw error;
      }
      const apiError = new AMapAPIError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`
      );
      tracker.error(apiError);
      throw apiError;
    }
  }

  /**
   * 从响应数据中提取结果数量
   */
  private extractResultCount(data: unknown, apiName: string): number | undefined {
    const d = data as Record<string, unknown>;
    
    switch (apiName) {
      case 'geocode':
        return Array.isArray(d.geocodes) ? d.geocodes.length : undefined;
      case 'searchPOI.text':
      case 'searchPOI.around':
        return Array.isArray(d.pois) ? d.pois.length : undefined;
      case 'route.driving':
      case 'route.walking':
      case 'route.riding':
        return d.route && Array.isArray((d.route as Record<string, unknown>).paths) 
          ? ((d.route as Record<string, unknown>).paths as unknown[]).length 
          : undefined;
      default:
        return undefined;
    }
  }

  /**
   * 地理编码 - 将地址转换为坐标
   */
  async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
    return this.request<GeocodeResponse>('/v3/geocode/geo', {
      address: request.address,
      city: request.city,
    }, 'geocode');
  }

  /**
   * 逆地理编码 - 将坐标转换为地址
   */
  async reverseGeocode(
    request: ReverseGeocodeRequest
  ): Promise<ReverseGeocodeResponse> {
    return this.request<ReverseGeocodeResponse>('/v3/geocode/regeo', {
      location: request.location,
      extensions: request.pois && request.pois > 0 ? 'all' : 'base',
      poitype: request.pois && request.pois > 0 ? '' : undefined,
      radius: request.pois && request.pois > 0 ? 1000 : undefined,
    }, 'reverseGeocode');
  }

  /**
   * 驾车路径规划
   */
  async route(request: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('/v3/direction/driving', {
      origin: request.origin,
      destination: request.destination,
      strategy: request.strategy || 0,
      waypoints: request.waypoints,
      extensions: 'all',
    }, 'route.driving');
  }

  /**
   * POI搜索
   */
  async searchPOI(request: POISearchRequest): Promise<POISearchResponse> {
    // 判断搜索类型
    if (request.location) {
      // 周边搜索
      return this.request<POISearchResponse>('/v3/place/around', {
        location: request.location,
        keywords: request.keywords,
        types: request.types,
        radius: request.radius || 3000,
        offset: request.offset || 20,
        page: request.page || 1,
      }, 'searchPOI.around');
    } else {
      // 关键字搜索
      return this.request<POISearchResponse>('/v3/place/text', {
        keywords: request.keywords,
        types: request.types,
        city: request.city,
        offset: request.offset || 20,
        page: request.page || 1,
      }, 'searchPOI.text');
    }
  }

  /**
   * 静态地图
   */
  async staticMap(request: StaticMapRequest): Promise<StaticMapResponse> {
    const url = new URL('/v3/staticmap', this.baseUrl);
    url.searchParams.append('key', this.apiKey);
    url.searchParams.append('location', request.location);
    if (request.zoom) url.searchParams.append('zoom', String(request.zoom));
    if (request.size) url.searchParams.append('size', request.size);
    if (request.markers) url.searchParams.append('markers', request.markers);
    if (request.path) url.searchParams.append('path', request.path);
    if (request.labels) url.searchParams.append('labels', request.labels);

    return { url: url.toString() };
  }

  /**
   * 步行路径规划
   */
  async walkingRoute(request: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('/v3/direction/walking', {
      origin: request.origin,
      destination: request.destination,
    }, 'route.walking');
  }

  /**
   * 骑行路径规划
   */
  async ridingRoute(request: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('/v3/direction/riding', {
      origin: request.origin,
      destination: request.destination,
    }, 'route.riding');
  }

  /**
   * 公交路径规划
   */
  async transitRoute(
    request: RouteRequest & { city: string; cityd?: string }
  ): Promise<RouteResponse> {
    return this.request<RouteResponse>('/v3/direction/transit/integrated', {
      origin: request.origin,
      destination: request.destination,
      city: request.city,
      cityd: request.cityd || request.city,
    }, 'route.transit');
  }

  /**
   * 坐标转换
   */
  async convertCoordinates(
    locations: string,
    coordsys: 'gps' | 'mapbar' | 'baidu'
  ): Promise<{ status: string; info: string; locations: string }> {
    return this.request('/v3/assistant/coordinate/convert', {
      locations,
      coordsys,
    }, 'convertCoordinates');
  }

  /**
   * IP定位
   */
  async ipLocation(ip?: string): Promise<{
    status: string;
    info: string;
    province: string;
    city: string;
    adcode: string;
    rectangle: string;
  }> {
    return this.request('/v3/ip', {
      ip,
    }, 'ipLocation');
  }
}