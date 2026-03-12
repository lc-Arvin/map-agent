# 高德地图Agent 设计文档

## 1. 架构概述

本Agent采用**MCP（Model Context Protocol）协议**设计，结合**分层工具路由**架构，实现自然语言到地图API调用的智能转换。

```
┌─────────────────────────────────────────────────────────────┐
│                      MapAgent                               │
│                   (Agent核心层)                             │
├─────────────────────────────────────────────────────────────┤
│  Intent Analyzer    │   Tool Router    │   Response Builder│
│  (意图分析)         │   (工具路由)      │   (响应构建)      │
├─────────────────────────────────────────────────────────────┤
│                    Tool Executor                            │
│                   (工具执行层)                              │
├─────────────────────────────────────────────────────────────┤
│  geocode  │  reverse_geocode  │  route  │  search_nearby   │
├─────────────────────────────────────────────────────────────┤
│                   AMapClient                                │
│                  (API客户端层)                             │
├─────────────────────────────────────────────────────────────┤
│           高德开放平台 Web Service API                      │
└─────────────────────────────────────────────────────────────┘
```

## 2. 核心设计决策

### 2.1 MCP协议兼容性

每个工具都遵循MCP标准格式：

```typescript
{
  name: string;           // 工具唯一标识
  description: string;    // 工具功能描述（供LLM理解）
  parameters: {           // JSON Schema格式参数定义
    type: 'object',
    properties: { ... },
    required: [...]
  }
}
```

**设计理由**：
- 标准化接口，便于LLM集成
- 描述字段帮助LLM理解何时使用该工具
- Schema验证确保参数正确性

### 2.2 意图分析 vs LLM路由

本Agent采用**基于规则的意图分析**，而非依赖LLM进行工具选择：

**对比**：
| 方案 | 优点 | 缺点 |
|------|------|------|
| LLM路由 | 灵活、可处理复杂意图 | 成本高、延迟大、需要LLM支持 |
| 规则路由 | 快速、成本低、确定性 | 无法处理复杂模糊意图 |

**选择理由**：
- 地图查询意图相对明确（路线、搜索、坐标转换）
- 规则路由覆盖80%常见场景
- 降低使用门槛（无需LLM Key）

### 2.3 并行执行

独立工具调用并行执行：

```typescript
const results = await Promise.all(
  toolCalls.map(call => executeTool(call, apiClient))
);
```

**适用场景**：
- ✅ 查询A地到B地的路线 + 搜索B地附近的酒店
- ❌ 先获取坐标，再查询该坐标周边的POI（有依赖关系）

**当前实现**：当前Agent未实现复杂的多跳查询，工具间依赖通过顺序执行处理。

### 2.4 坐标处理

支持多种坐标格式输入：
- 结构化地址："北京市朝阳区阜通东大街6号"
- 坐标字符串："116.481028,39.989673"

Agent自动识别格式并决定是否需要进行地理编码。

## 3. 工具设计

### 3.1 工具清单

| 工具 | 功能 | 对应高德API | 复杂度 |
|------|------|------------|--------|
| geocode | 地址→坐标 | /v3/geocode/geo | 低 |
| reverse_geocode | 坐标→地址 | /v3/geocode/regeo | 低 |
| route | 路径规划 | /v3/direction/* | 中 |
| search_nearby | POI搜索 | /v3/place/* | 中 |
| convert_coordinates | 坐标转换 | /v3/assistant/coordinate/convert | 低 |
| static_map | 静态地图 | /v3/staticmap | 低 |
| ip_location | IP定位 | /v3/ip | 低 |

### 3.2 工具参数设计原则

1. **自然语言友好**：参数名使用易懂的自然语言（如 `include_pois` 而非 `pois`）
2. **智能默认值**：提供合理的默认值（如搜索半径默认1000米）
3. **灵活输入**：支持地址或坐标作为位置输入，Agent自动处理转换

## 4. 扩展性设计

### 4.1 添加新工具

1. 在 `src/tools/definitions.ts` 添加工具定义
2. 在 `src/tools/executors.ts` 添加执行函数
3. 在 `src/agent/map-agent.ts` 添加意图识别规则
4. 在 `src/utils/response-generator.ts` 添加结果格式化

### 4.2 接入LLM

如需接入LLM进行工具路由：

```typescript
// 替换 analyzeQuery 方法
private async analyzeQueryWithLLM(query: string): Promise<MCPToolCall[]> {
  const response = await llm.chat({
    messages: [{
      role: 'system',
      content: `你是一个地图Agent。根据用户查询选择合适的工具。可用工具：${JSON.stringify(allTools)}`
    }, {
      role: 'user',
      content: query
    }]
  });
  return JSON.parse(response.content);
}
```

### 4.3 替换地图提供商

实现 `AMapAPIClient` 接口即可接入其他地图服务：

```typescript
export class BaiduMapClient implements AMapAPIClient {
  async geocode(request: GeocodeRequest): Promise<GeocodeResponse> {
    // 调用百度API并转换为统一格式
  }
  // ... 其他方法
}
```

## 5. 性能考虑

### 5.1 缓存策略

建议添加缓存层：

- **地理编码结果**：地址→坐标映射很少变化，可长期缓存
- **POI数据**：设置TTL（如7天）
- **路径规划**：考虑实时性，短期缓存（如5分钟）或不做缓存

### 5.2 配额管理

高德API有配额限制：
- 个人开发者：月15万次基础LBS服务
- 建议实现配额监控和告警

## 6. 安全考虑

1. **API Key保护**：不要在前端暴露Key，通过代理服务器转发请求
2. **输入验证**：所有参数经过Zod Schema验证
3. **错误处理**：不暴露敏感信息给用户

## 7. 参考实现

本设计参考以下业界最佳实践：

- **MapAgent** (EACL 2026): 分层架构设计
- **Mapbox MCP Server**: MCP协议实现
- **高德开放平台官方文档**: API能力映射

## 8. 未来改进

- [ ] 接入LLM进行更智能的意图识别
- [ ] 实现复杂多跳查询（如：先找到酒店，再规划从机场到酒店的路线）
- [ ] 添加对话上下文支持
- [ ] 实现更丰富的地图可视化（交互式地图、热力图等）
- [ ] 添加缓存层
- [ ] 支持批量操作（批量地理编码、批量路径规划）
