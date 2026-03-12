# 🗺️ AMap Agent - 高德地图智能Agent

基于高德开放平台API的智能地图Agent，支持地理编码、路径规划、POI搜索等能力。采用MCP（Model Context Protocol）协议设计，可作为工具提供给大语言模型使用。

## ✨ 特性

- 🎯 **地理编码**：地址转坐标，支持结构化地址解析
- 🚗 **路径规划**：驾车、步行、骑行多模式路线规划
- 🔍 **POI搜索**：关键字搜索、周边搜索、多边形搜索
- 🔄 **坐标转换**：支持GPS、百度、图吧坐标系转换
- 🗺️ **静态地图**：生成带标记点的静态地图图片
- 📡 **IP定位**：根据IP获取大致地理位置
- 🤖 **Agent模式**：智能解析用户意图，自动选择工具
- ⚡ **并行执行**：独立工具调用并行处理

## 🚀 快速开始

### 安装

```bash
npm install
npm run build
```

### 配置API Key

1. 访问 [高德开放平台](https://console.amap.com/dev/key/app) 申请Web服务API Key
2. 设置环境变量：

```bash
export AMAP_KEY=your_api_key_here
```

### CLI使用

```bash
# 直接查询
npm run cli -- "从北京南站到北京西站怎么走"

# 交互模式
npm run cli
```

### 编程使用

```typescript
import { MapAgent } from 'amap-agent';

const agent = new MapAgent({
  amapKey: 'your_api_key_here',
});

// 路径规划
const response = await agent.query({
  query: '从北京南站到北京西站怎么走',
});

console.log(response.text);
```

## 📖 API文档

### MapAgent

主Agent类，提供智能查询和工具调用能力。

```typescript
const agent = new MapAgent(config);

// 智能查询
const response = await agent.query({
  query: string,
  userLocation?: Location,
  context?: Record<string, unknown>,
});

// 直接执行工具
const result = await agent.executeTool('geocode', {
  address: '北京市朝阳区阜通东大街6号',
});
```

### AMapClient

直接访问高德API的客户端。

```typescript
import { AMapClient } from 'amap-agent';

const client = new AMapClient({ amapKey: 'your_key' });

// 地理编码
await client.geocode({ address: '北京市朝阳区阜通东大街6号' });

// 路径规划
await client.route({
  origin: '116.481028,39.989673',
  destination: '116.434446,39.90816',
});

// POI搜索
await client.searchPOI({
  keywords: '餐厅',
  city: '北京',
});

// 静态地图
await client.staticMap({
  location: '116.481028,39.989673',
  zoom: 15,
});
```

## 🛠️ 支持的工具

| 工具名 | 描述 | 参数 |
|--------|------|------|
| `geocode` | 地理编码（地址→坐标） | `address`, `city?` |
| `reverse_geocode` | 逆地理编码（坐标→地址） | `longitude`, `latitude`, `include_pois?` |
| `route` | 路径规划 | `origin`, `destination`, `mode?`, `strategy?` |
| `search_nearby` | POI搜索 | `keywords`, `location?`, `city?`, `radius?` |
| `convert_coordinates` | 坐标转换 | `locations`, `coordsys` |
| `static_map` | 静态地图 | `center`, `zoom?`, `size?`, `markers?` |
| `ip_location` | IP定位 | `ip?` |

## 📁 项目结构

```
amap-agent/
├── src/
│   ├── agent/
│   │   └── map-agent.ts       # Agent核心逻辑
│   ├── client/
│   │   └── amap-client.ts     # 高德API客户端
│   ├── observability/         # 可观测性模块
│   │   ├── collector.ts       # 指标收集器
│   │   ├── storage.ts         # 指标存储
│   │   ├── dashboard-server.ts # Dashboard服务
│   │   └── types.ts           # 指标类型定义
│   ├── tools/
│   │   ├── definitions.ts     # MCP工具定义
│   │   └── executors.ts       # 工具执行器
│   ├── types/
│   │   └── index.ts           # 类型定义
│   ├── utils/
│   │   ├── index.ts           # 工具函数
│   │   └── response-generator.ts  # 响应生成器
│   ├── cli.ts                 # CLI入口
│   ├── dashboard.ts           # Dashboard启动脚本
│   └── index.ts               # 主入口
├── examples/
│   ├── basic-usage.ts         # 基本使用示例
│   └── direct-api.ts          # 直接API调用示例
├── package.json
├── tsconfig.json
└── README.md
```

## 🎨 架构设计

### MCP协议兼容

本Agent采用MCP（Model Context Protocol）协议设计，每个工具都有标准的JSON Schema定义：

```typescript
{
  name: 'geocode',
  description: '将结构化地址转换为经纬度坐标',
  parameters: {
    type: 'object',
    properties: {
      address: { type: 'string' },
      city: { type: 'string' },
    },
    required: ['address'],
  },
}
```

### 工具路由

Agent使用基于规则的意图识别，自动分析用户查询并选择合适工具：

```
用户输入 → 意图分析 → 工具选择 → 并行执行 → 结果聚合 → 自然语言响应
```

### 并行执行

独立的工具调用并行执行，提升响应速度：

```typescript
const results = await Promise.all(
  toolCalls.map(call => executeTool(call, apiClient))
);
```

## 📊 业界参考

本Agent参考了以下业界最佳实践：

- **MapAgent** (EACL 2026): 三层架构（Planner → Module → Tool）
- **Mapbox MCP Server**: MCP协议标准实现
- **CARTO MCP**: 企业级地理空间工作流

## 📊 可观测性

本Agent内置完整的可观测性系统，可以监控API调用、Agent执行和性能指标。

### 启动Dashboard

```bash
# 启动可观测性Dashboard
npm run dashboard

# 或使用自定义端口
DASHBOARD_PORT=3000 npm run dashboard
```

Dashboard服务启动后，访问 http://localhost:8080 查看实时监控数据。

### 监控指标

- **API调用指标**：调用次数、成功率、响应时间、端点分布
- **Agent执行指标**：查询处理时间、工具使用情况、成功率
- **工具执行指标**：各工具的执行次数和耗时
- **性能指标**：内存使用情况

### 使用可观测性API

```typescript
import { MapAgent, MetricsCollector, MetricsStorage, DashboardServer } from 'amap-agent';

// 创建存储
const storage = new MetricsStorage({
  dataDir: './observability-data',
  maxRetentionDays: 30,
});

// 启动Dashboard
const dashboard = new DashboardServer(storage, { port: 8080 });
await dashboard.start();

// 使用Agent（指标会自动收集）
const agent = new MapAgent({ amapKey: 'your_key' });
const response = await agent.query({ query: '搜索附近的餐厅' });

// 获取统计数据
const stats = storage.getAllStatistics();
console.log(stats.last24Hours.apiCalls);
```

## 📄 许可证

MIT License

## 🔗 相关链接

- [高德开放平台](https://lbs.amap.com/)
- [高德Web服务API文档](https://lbs.amap.com/api/webservice/guide/api/georegeo)
- [Model Context Protocol](https://modelcontextprotocol.io/)
