/**
 * 工具执行器
 * 实现每个MCP工具的具体执行逻辑
 */

import type {
  AMapAPIClient,
  MCPToolCall,
  MCPToolResult,
} from '../types/index.js';

/** 工具执行函数类型 */
type ToolExecutor = (
  args: Record<string, unknown>,
  apiClient: AMapAPIClient
) => Promise<MCPToolResult>;

/** 工具注册表 */
const toolExecutors: Record<string, ToolExecutor> = {
  /**
   * 地理编码工具
   */
  async geocode(args, apiClient) {
    const address = args.address as string;
    const city = args.city as string | undefined;

    if (!address) {
      return { success: false, error: '缺少必要参数：address' };
    }

    try {
      const response = await apiClient.geocode({ address, city });
      
      if (!response.geocodes || response.geocodes.length === 0) {
        return {
          success: false,
          error: `未找到地址"${address}"对应的坐标`,
        };
      }

      const geocode = response.geocodes[0];
      const [longitude, latitude] = geocode.location.split(',').map(Number);

      return {
        success: true,
        data: {
          address: geocode.formatted_address,
          location: {
            longitude,
            latitude,
          },
          province: geocode.province,
          city: geocode.city,
          district: geocode.district,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `地理编码失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * 逆地理编码工具
   */
  async reverse_geocode(args, apiClient) {
    const longitude = args.longitude as number;
    const latitude = args.latitude as number;
    const includePois = args.include_pois as boolean | undefined;

    if (typeof longitude !== 'number' || typeof latitude !== 'number') {
      return { success: false, error: '缺少必要参数：longitude 和 latitude' };
    }

    try {
      const response = await apiClient.reverseGeocode({
        location: `${longitude},${latitude}`,
        pois: includePois ? 10 : 0,
      });

      const regeocode = response.regeocode;
      const pois = includePois && regeocode.pois
        ? regeocode.pois.map(poi => ({
            name: poi.name,
            address: poi.address,
            type: poi.type,
            distance: parseInt(poi.distance, 10),
          }))
        : undefined;

      return {
        success: true,
        data: {
          address: regeocode.formatted_address,
          components: {
            province: regeocode.addressComponent.province,
            city: regeocode.addressComponent.city,
            district: regeocode.addressComponent.district,
            street: regeocode.addressComponent.street,
            streetNumber: regeocode.addressComponent.streetNumber,
          },
          pois,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `逆地理编码失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * 路径规划工具
   */
  async route(args, apiClient) {
    const origin = args.origin as string;
    const destination = args.destination as string;
    const mode = (args.mode as string) || 'driving';
    const strategy = args.strategy as number | undefined;
    const waypoints = args.waypoints as string[] | undefined;

    if (!origin || !destination) {
      return { success: false, error: '缺少必要参数：origin 和 destination' };
    }

    try {
      // 解析起点和终点（可能是地址或坐标）
      let originCoord = origin;
      let destCoord = destination;

      // 如果不是坐标格式（含逗号数字），则进行地理编码
      if (!origin.includes(',')) {
        const geocodeResult = await apiClient.geocode({ address: origin });
        if (geocodeResult.geocodes && geocodeResult.geocodes.length > 0) {
          originCoord = geocodeResult.geocodes[0].location;
        }
      }

      if (!destination.includes(',')) {
        const geocodeResult = await apiClient.geocode({ address: destination });
        if (geocodeResult.geocodes && geocodeResult.geocodes.length > 0) {
          destCoord = geocodeResult.geocodes[0].location;
        }
      }

      // 根据出行方式调用不同API
      let response;
      const routeClient = apiClient as AMapAPIClient & {
        walkingRoute: typeof apiClient.route;
        ridingRoute: typeof apiClient.route;
      };

      if (mode === 'walking') {
        response = await routeClient.walkingRoute({
          origin: originCoord,
          destination: destCoord,
        });
      } else if (mode === 'riding') {
        response = await routeClient.ridingRoute({
          origin: originCoord,
          destination: destCoord,
        });
      } else {
        response = await apiClient.route({
          origin: originCoord,
          destination: destCoord,
          strategy,
          waypoints: waypoints?.join(';'),
        });
      }

      if (!response.route || !response.route.paths || response.route.paths.length === 0) {
        return { success: false, error: '未找到可行路线' };
      }

      const path = response.route.paths[0];

      return {
        success: true,
        data: {
          origin: origin,
          destination: destination,
          mode,
          distance: parseInt(path.distance, 10),
          duration: parseInt(path.duration, 10),
          strategy: path.strategy,
          steps: path.steps.map(step => ({
            instruction: step.instruction,
            road: step.road,
            distance: parseInt(step.distance, 10),
            duration: parseInt(step.duration, 10),
            polyline: step.polyline,
          })),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `路径规划失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * POI搜索工具
   */
  async search_nearby(args, apiClient) {
    const keywords = args.keywords as string;
    const location = args.location as string | undefined;
    const city = args.city as string | undefined;
    const radius = args.radius as number | undefined;
    const limit = args.limit as number | undefined;

    if (!keywords) {
      return { success: false, error: '缺少必要参数：keywords' };
    }

    try {
      let searchLocation = location;

      // 如果location不是坐标格式，进行地理编码
      if (location && !location.includes(',')) {
        const geocodeResult = await apiClient.geocode({ address: location, city });
        if (geocodeResult.geocodes && geocodeResult.geocodes.length > 0) {
          searchLocation = geocodeResult.geocodes[0].location;
        }
      }

      const response = await apiClient.searchPOI({
        keywords,
        location: searchLocation,
        city,
        radius,
        offset: limit,
      });

      if (!response.pois || response.pois.length === 0) {
        return {
          success: true,
          data: {
            total: 0,
            pois: [],
          },
        };
      }

      return {
        success: true,
        data: {
          total: parseInt(response.count, 10),
          pois: response.pois.map(poi => {
            const [longitude, latitude] = poi.location.split(',').map(Number);
            return {
              id: poi.id,
              name: poi.name,
              address: poi.address,
              type: poi.type,
              tel: poi.tel,
              location: { longitude, latitude },
              distance: poi.distance ? parseInt(poi.distance, 10) : undefined,
            };
          }),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `POI搜索失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * 静态地图工具
   */
  async static_map(args, apiClient) {
    const center = args.center as string;
    const zoom = args.zoom as number | undefined;
    const size = args.size as string | undefined;
    const markers = args.markers as Array<{ location: string; label?: string }> | undefined;

    if (!center) {
      return { success: false, error: '缺少必要参数：center' };
    }

    try {
      // 构建markers参数
      let markersParam: string | undefined;
      if (markers && markers.length > 0) {
        markersParam = markers
          .map((m, i) => `mid,${String.fromCharCode(65 + i)}:${m.location}`)
          .join('|');
      }

      const response = await apiClient.staticMap({
        location: center,
        zoom,
        size,
        markers: markersParam,
      });

      return {
        success: true,
        data: {
          url: response.url,
          description: `静态地图图片，中心点：${center}`,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `生成静态地图失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * 坐标转换工具
   */
  async convert_coordinates(args, apiClient) {
    const locations = args.locations as string;
    const coordsys = args.coordsys as 'gps' | 'baidu' | 'mapbar';

    if (!locations || !coordsys) {
      return { success: false, error: '缺少必要参数：locations 和 coordsys' };
    }

    try {
      const client = apiClient as AMapAPIClient & {
        convertCoordinates: (locations: string, coordsys: string) => Promise<{
          status: string;
          info: string;
          locations: string;
        }>;
      };
      
      const response = await client.convertCoordinates(locations, coordsys);
      const convertedCoords = response.locations.split(';').map((loc, index) => {
        const [longitude, latitude] = loc.split(',').map(Number);
        return { index, longitude, latitude };
      });

      return {
        success: true,
        data: {
          original: locations,
          converted: convertedCoords,
          coordsys,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `坐标转换失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },

  /**
   * IP定位工具
   */
  async ip_location(args, apiClient) {
    const ip = args.ip as string | undefined;

    try {
      const client = apiClient as AMapAPIClient & {
        ipLocation: (ip?: string) => Promise<{
          status: string;
          info: string;
          province: string;
          city: string;
          adcode: string;
          rectangle: string;
        }>;
      };

      const response = await client.ipLocation(ip);

      return {
        success: true,
        data: {
          ip: ip || '当前IP',
          province: response.province,
          city: response.city,
          adcode: response.adcode,
          rectangle: response.rectangle,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `IP定位失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
};

/**
 * 执行工具调用
 */
export async function executeTool(
  toolCall: MCPToolCall,
  apiClient: AMapAPIClient
): Promise<MCPToolResult> {
  const executor = toolExecutors[toolCall.name];

  if (!executor) {
    return {
      success: false,
      error: `未知工具：${toolCall.name}。可用工具：${Object.keys(toolExecutors).join(', ')}`,
    };
  }

  try {
    return await executor(toolCall.arguments, apiClient);
  } catch (error) {
    return {
      success: false,
      error: `工具执行异常: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * 批量执行工具调用（并行）
 */
export async function executeToolsParallel(
  toolCalls: MCPToolCall[],
  apiClient: AMapAPIClient
): Promise<MCPToolResult[]> {
  return Promise.all(
    toolCalls.map(call => executeTool(call, apiClient))
  );
}