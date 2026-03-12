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

  constructor(config: AgentConfig) {
    this.apiKey = config.amapKey;
    this.baseUrl = config.baseUrl || 'https://restapi.amap.com';
    this.timeout = config.timeout || 10000;
  }

  /**
   * 发送HTTP请求
   */
  private async request<T>(
    endpoint: string,
    params: Record<string, string | number | undefined>
  ): Promise<T> {
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
        throw new AMapAPIError(
          `HTTP error: ${response.status}`,
          String(response.status)
        );
      }

      const data = await response.json() as T & { status: string; info: string };

      // 检查API返回状态
      if (data.status !== '1') {
        throw new AMapAPIError(
          `API error: ${data.info}`,
          data.status,
          data
        );
      }

      return data;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof AMapAPIError) {
        throw error;
      }
      throw new AMapAPIError(
        `Request failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * 地理编码 - 将地址转换为坐标
   */
  async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
    return this.request<GeocodeResponse>('/v3/geocode/geo', {
      address: request.address,
      city: request.city,
    });
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
    });
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
    });
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
      });
    } else {
      // 关键字搜索
      return this.request<POISearchResponse>('/v3/place/text', {
        keywords: request.keywords,
        types: request.types,
        city: request.city,
        offset: request.offset || 20,
        page: request.page || 1,
      });
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
    });
  }

  /**
   * 骑行路径规划
   */
  async ridingRoute(request: RouteRequest): Promise<RouteResponse> {
    return this.request<RouteResponse>('/v3/direction/riding', {
      origin: request.origin,
      destination: request.destination,
    });
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
    });
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
    });
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
    });
  }
}