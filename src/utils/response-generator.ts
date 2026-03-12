/**
 * 响应文本生成器
 * 根据工具调用结果生成自然语言响应
 */

import type { MCPToolCall, MCPToolResult } from '../types/index.js';

/**
 * 生成响应文本
 */
export function generateResponseText(
  _query: string,
  toolCalls: MCPToolCall[],
  results: MCPToolResult[]
): string {
  const parts: string[] = [];

  for (let i = 0; i < toolCalls.length; i++) {
    const call = toolCalls[i];
    const result = results[i];

    if (!result.success) {
      parts.push(`❌ ${getToolNameInChinese(call.name)}失败：${result.error}`);
      continue;
    }

    const text = formatToolResult(call.name, result.data);
    if (text) {
      parts.push(text);
    }
  }

  if (parts.length === 0) {
    return '抱歉，我无法理解您的请求。请尝试用更明确的方式描述，例如：\n- "从北京南站到北京西站怎么走"\n- "搜索附近的餐厅"\n- "北京市朝阳区阜通东大街6号的坐标是多少"';
  }

  return parts.join('\n\n');
}

/**
 * 获取工具中文名
 */
function getToolNameInChinese(name: string): string {
  const names: Record<string, string> = {
    geocode: '地理编码',
    reverse_geocode: '逆地理编码',
    route: '路径规划',
    search_nearby: '附近搜索',
    convert_coordinates: '坐标转换',
    static_map: '静态地图',
    ip_location: 'IP定位',
  };
  return names[name] || name;
}

/**
 * 格式化工具结果
 */
function formatToolResult(toolName: string, data: unknown): string {
  switch (toolName) {
    case 'geocode':
      return formatGeocodeResult(data);
    case 'reverse_geocode':
      return formatReverseGeocodeResult(data);
    case 'route':
      return formatRouteResult(data);
    case 'search_nearby':
      return formatSearchResult(data);
    case 'convert_coordinates':
      return formatConvertResult(data);
    case 'static_map':
      return formatStaticMapResult(data);
    case 'ip_location':
      return formatIPLocationResult(data);
    default:
      return `✅ 操作成功完成`;
  }
}

/**
 * 格式化地理编码结果
 */
function formatGeocodeResult(data: unknown): string {
  const d = data as {
    address: string;
    location: { longitude: number; latitude: number };
    province: string;
    city: string;
    district: string;
  };

  return `📍 **地理编码结果**

**地址**：${d.address}
**坐标**：经度 ${d.location.longitude.toFixed(6)}, 纬度 ${d.location.latitude.toFixed(6)}
**行政区划**：${d.province} ${d.city} ${d.district}`;
}

/**
 * 格式化逆地理编码结果
 */
function formatReverseGeocodeResult(data: unknown): string {
  const d = data as {
    address: string;
    components: {
      province: string;
      city: string;
      district: string;
      street: string;
      streetNumber: string;
    };
    pois?: Array<{ name: string; address: string; type: string; distance: number }>;
  };

  let text = `📍 **逆地理编码结果**

**地址**：${d.address}
**行政区划**：${d.components.province} ${d.components.city} ${d.components.district}`;

  if (d.components.street) {
    text += `\n**街道**：${d.components.street}${d.components.streetNumber || ''}`;
  }

  if (d.pois && d.pois.length > 0) {
    text += '\n\n**周边POI**：';
    d.pois.slice(0, 5).forEach((poi, index) => {
      text += `\n${index + 1}. ${poi.name} - ${poi.type}（距离${poi.distance}米）`;
    });
  }

  return text;
}

/**
 * 格式化路径规划结果
 */
function formatRouteResult(data: unknown): string {
  const d = data as {
    origin: string;
    destination: string;
    mode: string;
    distance: number;
    duration: number;
    strategy?: string;
    steps: Array<{
      instruction: string;
      road: string;
      distance: number;
      duration: number;
    }>;
  };

  const modeNames: Record<string, string> = {
    driving: '驾车',
    walking: '步行',
    riding: '骑行',
    transit: '公交',
  };

  // 格式化距离
  let distanceText: string;
  if (d.distance >= 1000) {
    distanceText = `${(d.distance / 1000).toFixed(1)}公里`;
  } else {
    distanceText = `${d.distance}米`;
  }

  // 格式化时间
  let durationText: string;
  if (d.duration >= 3600) {
    const hours = Math.floor(d.duration / 3600);
    const minutes = Math.floor((d.duration % 3600) / 60);
    durationText = `${hours}小时${minutes}分钟`;
  } else if (d.duration >= 60) {
    durationText = `${Math.floor(d.duration / 60)}分钟`;
  } else {
    durationText = `${d.duration}秒`;
  }

  let text = `🚗 **${modeNames[d.mode] || d.mode}路线规划**

**从**：${d.origin}
**到**：${d.destination}
**总距离**：${distanceText}
**预计时间**：${durationText}`;

  if (d.steps && d.steps.length > 0) {
    text += '\n\n**导航步骤**：';
    d.steps.slice(0, 10).forEach((step, index) => {
      text += `\n${index + 1}. ${step.instruction}`;
    });
    if (d.steps.length > 10) {
      text += `\n...（共${d.steps.length}个步骤）`;
    }
  }

  return text;
}

/**
 * 格式化搜索结果
 */
function formatSearchResult(data: unknown): string {
  const d = data as {
    total: number;
    pois: Array<{
      name: string;
      address: string;
      type: string;
      tel?: string;
      distance?: number;
    }>;
  };

  if (d.total === 0 || !d.pois || d.pois.length === 0) {
    return '🔍 未找到匹配的POI';
  }

  let text = `🔍 **搜索结果**（共找到${d.total}个，显示前${d.pois.length}个）\n`;

  d.pois.forEach((poi, index) => {
    text += `\n${index + 1}. **${poi.name}**`;
    text += `\n   类型：${poi.type}`;
    text += `\n   地址：${poi.address}`;
    if (poi.distance) {
      text += `\n   距离：${poi.distance >= 1000 ? (poi.distance / 1000).toFixed(1) + '公里' : poi.distance + '米'}`;
    }
    if (poi.tel) {
      text += `\n   电话：${poi.tel}`;
    }
  });

  return text;
}

/**
 * 格式化坐标转换结果
 */
function formatConvertResult(data: unknown): string {
  const d = data as {
    original: string;
    coordsys: string;
    converted: Array<{ index: number; longitude: number; latitude: number }>;
  };

  const sysNames: Record<string, string> = {
    gps: 'WGS-84（GPS）',
    baidu: 'BD-09（百度）',
    mapbar: 'MapBar',
  };

  let text = `🔄 **坐标转换结果**\n\n原坐标系：${sysNames[d.coordsys] || d.coordsys}\n原坐标：${d.original}\n\n转换后（GCJ-02/高德坐标）：`;

  d.converted.forEach(c => {
    text += `\n[${c.index}] 经度: ${c.longitude.toFixed(6)}, 纬度: ${c.latitude.toFixed(6)}`;
  });

  return text;
}

/**
 * 格式化静态地图结果
 */
function formatStaticMapResult(data: unknown): string {
  const d = data as { url: string; description: string };
  return `🗺️ **静态地图**\n\n${d.description}\n\n图片URL：${d.url}`;
}

/**
 * 格式化IP定位结果
 */
function formatIPLocationResult(data: unknown): string {
  const d = data as {
    ip: string;
    province: string;
    city: string;
    adcode: string;
    rectangle: string;
  };

  return `📡 **IP定位结果**\n\nIP地址：${d.ip}\n所在省份：${d.province}\n所在城市：${d.city}\n区域编码：${d.adcode}`;
}