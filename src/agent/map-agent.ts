/**
 * 地图Agent核心逻辑
 * 基于简单规则的工具路由（不依赖LLM）
 */

import type {
  AgentConfig,
  AgentQuery,
  AgentResponse,
  MCPToolCall,
  MCPToolResult,
} from '../types/index.js';
import { AMapClient } from '../client/amap-client.js';
import { allTools } from '../tools/definitions.js';
import { executeTool, executeToolsParallel } from '../tools/executors.js';
import { generateResponseText } from '../utils/response-generator.js';

/** 地图Agent类 */
export class MapAgent {
  private apiClient: AMapClient;

  constructor(config: AgentConfig) {
    this.apiClient = new AMapClient(config);
  }

  /**
   * 获取所有可用工具定义
   */
  getTools() {
    return allTools;
  }

  /**
   * 处理用户查询
   */
  async query(userQuery: AgentQuery): Promise<AgentResponse> {
    const query = userQuery.query.toLowerCase();

    // 1. 分析查询意图，确定需要调用的工具
    const toolCalls = this.analyzeQuery(query, userQuery);

    if (toolCalls.length === 0) {
      return {
        text: '您好！我是地图助手，可以帮您：\n1. 查询地址对应的坐标（地理编码）\n2. 查询坐标对应的地址（逆地理编码）\n3. 规划路线（驾车、步行、骑行）\n4. 搜索附近的POI（餐厅、酒店等）\n5. 生成静态地图\n\n请告诉我您需要什么帮助？',
        toolsUsed: [],
      };
    }

    // 2. 并行执行工具调用
    const results = await executeToolsParallel(toolCalls, this.apiClient);

    // 3. 生成响应文本
    const responseText = generateResponseText(query, toolCalls, results);

    // 4. 构建响应数据
    const toolsUsed = toolCalls.map(call => call.name);
    const successfulResults = results.filter(r => r.success);

    // 5. 构建地图可视化（如果有位置数据）
    let mapVisualization: AgentResponse['mapVisualization'] | undefined;
    if (this.shouldGenerateMap(query, toolCalls, results)) {
      mapVisualization = await this.generateMapVisualization(results);
    }

    return {
      text: responseText,
      toolsUsed,
      data: successfulResults.length === 1 ? successfulResults[0].data : successfulResults.map(r => r.data),
      mapVisualization,
    };
  }

  /**
   * 分析查询意图，生成工具调用计划
   */
  private analyzeQuery(query: string, context: AgentQuery): MCPToolCall[] {
    const calls: MCPToolCall[] = [];

    // 路线规划相关
    if (
      query.includes('路线') ||
      query.includes('导航') ||
      query.includes('怎么去') ||
      query.includes('从') && query.includes('到') ||
      query.includes('怎么走')
    ) {
      const routeInfo = this.extractRouteInfo(query, context);
      if (routeInfo.origin && routeInfo.destination) {
        calls.push({
          name: 'route',
          arguments: {
            origin: routeInfo.origin,
            destination: routeInfo.destination,
            mode: routeInfo.mode || 'driving',
          },
        });
      }
    }

    // 附近搜索相关
    if (
      query.includes('附近') ||
      query.includes('周边') ||
      query.includes('最近的') ||
      query.includes('哪里') && (query.includes('有') || query.includes('在'))
    ) {
      const searchInfo = this.extractSearchInfo(query, context);
      if (searchInfo.keywords) {
        calls.push({
          name: 'search_nearby',
          arguments: {
            keywords: searchInfo.keywords,
            location: searchInfo.location,
            city: searchInfo.city,
            radius: searchInfo.radius || 2000,
          },
        });
      }
    }

    // 地理编码（地址转坐标）
    if (
      query.includes('坐标') ||
      query.includes('经纬度') ||
      query.includes('在哪里') && !query.includes('附近')
    ) {
      const address = this.extractAddress(query);
      if (address) {
        calls.push({
          name: 'geocode',
          arguments: { address },
        });
      }
    }

    // 逆地理编码（坐标转地址）
    if (
      query.includes('这是哪里') ||
      query.includes('这个地址') ||
      (query.includes('经度') || query.includes('纬度')) && query.includes('地址')
    ) {
      const location = this.extractCoordinates(query);
      if (location) {
        calls.push({
          name: 'reverse_geocode',
          arguments: {
            longitude: location.longitude,
            latitude: location.latitude,
            include_pois: true,
          },
        });
      }
    }

    return calls;
  }

  /**
   * 提取路线信息
   */
  private extractRouteInfo(
    query: string,
    _context: AgentQuery
  ): { origin?: string; destination?: string; mode?: string } {
    let origin: string | undefined;
    let destination: string | undefined;
    let mode = 'driving';

    // 提取起点和终点
    const fromToPatterns = [
      /从(.+?)(?:到|去|前往)(.+)/,
      /(.+?)(?:到|去|前往)(.+?)(?:怎么|怎样|如何)/,
      /(.+?)到(.+?)的路线/,
      /(.+?)到(.+?)(?:有多远|距离)/,
    ];

    for (const pattern of fromToPatterns) {
      const match = query.match(pattern);
      if (match) {
        origin = match[1].trim();
        destination = match[2].trim();
        break;
      }
    }

    // 确定出行方式
    if (query.includes('步行') || query.includes('走路')) {
      mode = 'walking';
    } else if (query.includes('骑行') || query.includes('自行车') || query.includes('骑车')) {
      mode = 'riding';
    } else if (query.includes('公交') || query.includes('地铁') || query.includes('坐车')) {
      mode = 'transit';
    }

    return { origin, destination, mode };
  }

  /**
   * 提取搜索信息
   */
  private extractSearchInfo(
    query: string,
    _context: AgentQuery
  ): { keywords?: string; location?: string; city?: string; radius?: number } {
    let keywords: string | undefined;
    let location: string | undefined;
    let city: string | undefined;
    let radius = 2000;

    // 提取关键词
    const keywordPatterns = [
      /附近(?:有)?(.+?)[吗？]/,
      /(.+?)(?:在|附近)/,
      /找(.+)/,
      /搜索(.+)/,
      /(.+?)(?:哪里|在哪)/,
    ];

    for (const pattern of keywordPatterns) {
      const match = query.match(pattern);
      if (match) {
        keywords = match[1].trim();
        break;
      }
    }

    // 提取城市
    const cityMatch = query.match(/在(.+?)(?:市|附近|周边)/);
    if (cityMatch) {
      city = cityMatch[1].trim();
    }

    // 提取搜索半径
    const radiusMatch = query.match(/(\d+)(?:米|m|公里|km)/);
    if (radiusMatch) {
      const value = parseInt(radiusMatch[1], 10);
      if (query.includes('公里') || query.includes('km')) {
        radius = value * 1000;
      } else {
        radius = value;
      }
    }

    // 提取具体位置
    const locationPatterns = [
      /在(.+?)(?:附近|周边|周围)/,
      /(.+?)附近/,
    ];
    for (const pattern of locationPatterns) {
      const match = query.match(pattern);
      if (match) {
        const loc = match[1].trim();
        // 如果不是纯数字（关键词），则作为位置
        if (!/^[\d,\.]+$/.test(loc)) {
          location = loc;
          break;
        }
      }
    }

    return { keywords, location, city, radius };
  }

  /**
   * 提取地址
   */
  private extractAddress(query: string): string | undefined {
    const patterns = [
      /(.+?)(?:的坐标|的经纬度|在哪里)/,
      /(?:查询|查找|获取)(.+?)(?:的|的坐标)/,
      /地址[:：]\s*(.+)/,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * 提取坐标
   */
  private extractCoordinates(query: string): { longitude: number; latitude: number } | undefined {
    const patterns = [
      /经度[:：]?\s*([\d.]+)[,，\s]*纬度[:：]?\s*([\d.]+)/,
      /([\d.]+)[,，\s]+([\d.]+)/,
    ];

    for (const pattern of patterns) {
      const match = query.match(pattern);
      if (match) {
        const longitude = parseFloat(match[1]);
        const latitude = parseFloat(match[2]);
        if (!isNaN(longitude) && !isNaN(latitude)) {
          return { longitude, latitude };
        }
      }
    }

    return undefined;
  }

  /**
   * 判断是否需要生成地图可视化
   */
  private shouldGenerateMap(
    _query: string,
    toolCalls: MCPToolCall[],
    results: MCPToolResult[]
  ): boolean {
    return (
      toolCalls.some(call => call.name === 'route' || call.name === 'search_nearby') &&
      results.some(r => r.success && r.data)
    );
  }

  /**
   * 生成地图可视化
   */
  private async generateMapVisualization(
    results: MCPToolResult[]
  ): Promise<AgentResponse['mapVisualization']> {
    // 从结果中提取位置信息
    const markers: Array<{ location: string; label?: string }> = [];
    let center: string | undefined;

    for (const result of results) {
      if (!result.success || !result.data) continue;

      const data = result.data as Record<string, unknown>;

      // 路线结果
      if (data.steps && Array.isArray(data.steps)) {
        // 提取路线起点和终点
        // 这里简化处理，实际应该从steps中提取
      }

      // POI搜索结果
      if (data.pois && Array.isArray(data.pois)) {
        const pois = data.pois.slice(0, 5);
        for (const poi of pois) {
          if (poi.location) {
            markers.push({
              location: `${poi.location.longitude},${poi.location.latitude}`,
              label: poi.name,
            });
          }
        }
        if (pois.length > 0 && pois[0].location) {
          center = `${pois[0].location.longitude},${pois[0].location.latitude}`;
        }
      }

      // 地理编码结果
      if (data.location) {
        const loc = data.location as { longitude: number; latitude: number };
        markers.push({
          location: `${loc.longitude},${loc.latitude}`,
          label: data.address as string,
        });
        if (!center) {
          center = `${loc.longitude},${loc.latitude}`;
        }
      }
    }

    if (!center && markers.length > 0) {
      center = markers[0].location;
    }

    if (center) {
      const staticMapResult = await this.apiClient.staticMap({
        location: center,
        zoom: 13,
        markers: markers.map((m, i) => `mid,${String.fromCharCode(65 + i)}:${m.location}`).join('|'),
      });

      return {
        type: 'static',
        url: staticMapResult.url,
      };
    }

    return undefined;
  }

  /**
   * 执行单个工具调用（供外部使用）
   */
  async executeTool(name: string, args: Record<string, unknown>): Promise<MCPToolResult> {
    return executeTool({ name, arguments: args }, this.apiClient);
  }
}
