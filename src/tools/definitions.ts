/**
 * MCP工具定义
 * 定义所有可用的地图工具及其Schema
 */

import type { MCPTool } from '../types/index.js';

/** 地理编码工具 */
export const geocodeTool: MCPTool = {
  name: 'geocode',
  description: '将结构化地址转换为经纬度坐标。适用于解析用户输入的地址文本，如"北京市朝阳区阜通东大街6号"。返回坐标可用于后续的路径规划或地图展示。',
  parameters: {
    type: 'object',
    properties: {
      address: {
        type: 'string',
        description: '结构化地址，如：北京市朝阳区阜通东大街6号',
      },
      city: {
        type: 'string',
        description: '指定城市，可提高解析准确性。如：北京',
      },
    },
    required: ['address'],
  },
};

/** 逆地理编码工具 */
export const reverseGeocodeTool: MCPTool = {
  name: 'reverse_geocode',
  description: '将经纬度坐标转换为结构化地址。适用于根据GPS坐标获取可读的地址描述。支持返回周边POI信息。',
  parameters: {
    type: 'object',
    properties: {
      longitude: {
        type: 'number',
        description: '经度，如：116.480881',
      },
      latitude: {
        type: 'number',
        description: '纬度，如：39.989410',
      },
      include_pois: {
        type: 'boolean',
        description: '是否返回周边POI信息',
        default: false,
      },
    },
    required: ['longitude', 'latitude'],
  },
};

/** 路径规划工具 */
export const routeTool: MCPTool = {
  name: 'route',
  description: '计算两点之间的驾车路线。返回路线距离、预计时间、详细导航步骤等信息。支持设置途经点。',
  parameters: {
    type: 'object',
    properties: {
      origin: {
        type: 'string',
        description: '起点坐标或地址，如：116.481028,39.989673 或 "北京南站"',
      },
      destination: {
        type: 'string',
        description: '终点坐标或地址，如：116.434446,39.90816 或 "北京西站"',
      },
      mode: {
        type: 'string',
        enum: ['driving', 'walking', 'riding', 'transit'],
        description: '出行方式：driving(驾车)、walking(步行)、riding(骑行)、transit(公交)',
        default: 'driving',
      },
      strategy: {
        type: 'integer',
        description: '驾车策略：0-速度优先，1-费用优先，2-距离优先，3-不走高速，4-高速优先',
        default: 0,
      },
      waypoints: {
        type: 'array',
        items: { type: 'string' },
        description: '途经点坐标列表，如：["116.481028,39.989673"]',
      },
    },
    required: ['origin', 'destination'],
  },
};

/** POI搜索工具 */
export const searchNearbyTool: MCPTool = {
  name: 'search_nearby',
  description: '搜索指定位置周边的POI（兴趣点）。适用于查找附近的餐厅、酒店、银行等服务设施。',
  parameters: {
    type: 'object',
    properties: {
      keywords: {
        type: 'string',
        description: '搜索关键词，如：餐厅、酒店、银行',
      },
      location: {
        type: 'string',
        description: '中心点坐标，如：116.481028,39.989673',
      },
      radius: {
        type: 'number',
        description: '搜索半径（米），最大3000米',
        default: 1000,
      },
      city: {
        type: 'string',
        description: '城市名称，用于关键字搜索时限定城市范围',
      },
      limit: {
        type: 'number',
        description: '返回结果数量',
        default: 10,
      },
    },
    required: ['keywords'],
  },
};

/** 坐标转换工具 */
export const convertCoordinatesTool: MCPTool = {
  name: 'convert_coordinates',
  description: '将其他坐标系（GPS、百度、图吧）转换为高德坐标系（GCJ-02）。',
  parameters: {
    type: 'object',
    properties: {
      locations: {
        type: 'string',
        description: '坐标列表，格式："经度,纬度;经度,latitude"，如："116.481028,39.989673;116.434446,39.90816"',
      },
      coordsys: {
        type: 'string',
        enum: ['gps', 'baidu', 'mapbar'],
        description: '原坐标系：gps(WGS-84)、baidu(BD-09)、mapbar',
      },
    },
    required: ['locations', 'coordsys'],
  },
};

/** 静态地图工具 */
export const staticMapTool: MCPTool = {
  name: 'static_map',
  description: '生成静态地图图片URL。可在响应中嵌入地图图片，展示标记点、路线等信息。',
  parameters: {
    type: 'object',
    properties: {
      center: {
        type: 'string',
        description: '地图中心点坐标，如：116.481028,39.989673',
      },
      zoom: {
        type: 'number',
        description: '缩放级别，1-17',
        default: 13,
      },
      size: {
        type: 'string',
        description: '地图尺寸，如：600x400',
        default: '600x400',
      },
      markers: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            location: { type: 'string' },
            label: { type: 'string' },
          },
        },
        description: '标记点列表',
      },
    },
    required: ['center'],
  },
};

/** IP定位工具 */
export const ipLocationTool: MCPTool = {
  name: 'ip_location',
  description: '根据IP地址获取大致地理位置。适用于获取用户当前所在城市。',
  parameters: {
    type: 'object',
    properties: {
      ip: {
        type: 'string',
        description: 'IP地址，如不提供则使用请求IP',
      },
    },
  },
};

/** 所有可用工具列表 */
export const allTools: MCPTool[] = [
  geocodeTool,
  reverseGeocodeTool,
  routeTool,
  searchNearbyTool,
  convertCoordinatesTool,
  staticMapTool,
  ipLocationTool,
];

/** 工具名称到定义的映射 */
export const toolDefinitions: Record<string, MCPTool> = {
  geocode: geocodeTool,
  reverse_geocode: reverseGeocodeTool,
  route: routeTool,
  search_nearby: searchNearbyTool,
  convert_coordinates: convertCoordinatesTool,
  static_map: staticMapTool,
  ip_location: ipLocationTool,
};