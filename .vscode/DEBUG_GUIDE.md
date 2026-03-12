# 🐛 VS Code 调试指南

本项目已配置完整的 VS Code 调试环境，支持单步调试 CLI、Dashboard 和示例代码。

## 🚀 快速开始

### 1. 安装推荐扩展

打开 VS Code，会提示安装以下扩展（或手动安装）：
- **TypeScript Debugger** (内置)
- **ESLint** (代码检查)
- **Prettier** (代码格式化)

### 2. 一键调试

#### 方法1：使用调试面板
1. 打开 VS Code 左侧的调试图标 (或按 `Ctrl+Shift+D`)
2. 在顶部的调试配置下拉框中选择：`Debug CLI (with Query)`
3. 按 `F5` 或点击绿色播放按钮
4. 在弹出的输入框中输入要测试的查询（如：`从北京南站到北京西站怎么走`）

#### 方法2：使用快捷键
- `F5` - 启动调试（使用上次选择的配置）
- `Ctrl+F5` - 不调试直接运行
- `Shift+F5` - 停止调试

### 3. 设置断点

在 `src/` 目录下的 TypeScript 文件中点击行号左侧即可设置断点：

**关键调试位置推荐：**

1. **Agent 核心逻辑** (`src/agent/map-agent.ts`)
   - `query()` 方法入口 - 查看用户输入处理
   - `analyzeQuery()` - 查看意图分析过程
   - `extractRouteInfo()` - 查看路线信息提取

2. **API 客户端** (`src/client/amap-client.ts`)
   - `request()` 方法 - 查看 HTTP 请求构造
   - `geocode()` / `route()` 等方法 - 查看具体 API 调用

3. **工具执行器** (`src/tools/executors.ts`)
   - 各个工具的执行函数 - 查看工具调用逻辑

4. **可观测性** (`src/observability/`)
   - `collector.ts` - 查看指标收集过程
   - `storage.ts` - 查看数据存储

## 📋 调试配置说明

### 可用的调试配置

| 配置名称 | 用途 | 说明 |
|---------|------|------|
| **Debug CLI (Interactive)** | 交互式调试 CLI | 启动后可以在终端输入查询 |
| **Debug CLI (with Query)** | 带参数的 CLI 调试 | 启动时会提示输入查询文本 |
| **Debug Dashboard** | 调试 Dashboard 服务 | 启动 Dashboard 并附加调试器 |
| **Debug Current Test File** | 调试当前测试文件 | 调试当前打开的测试文件 |
| **Debug Example: Basic Usage** | 调试基础示例 | 运行 basic-usage.ts 示例 |
| **Debug Example: Observability** | 调试可观测性示例 | 运行 observability.ts 示例 |
| **Attach to Process** | 附加到运行中的进程 | 附加到已启动的 Node 进程 |

### 复合配置

- **CLI + Dashboard (Debug Both)**: 同时调试 CLI 和 Dashboard 两个服务

## 🔧 高级调试技巧

### 条件断点

右键点击断点，可以设置条件：
```javascript
// 只在查询包含"北京"时中断
query.includes('北京')

// 只在执行时间超过 1000ms 时中断
duration > 1000
```

### 日志断点

右键点击断点选择 "Log Message"，可以在不中断的情况下输出日志：
```
Processing query: {query}
```

### 调用栈导航

调试时可以使用：
- `F11` / `Step Into` - 进入函数内部
- `F10` / `Step Over` - 跳过函数（不进入）
- `Shift+F11` / `Step Out` - 跳出当前函数
- `Ctrl+Shift+F5` / `Restart` - 重新启动调试

### 监视表达式

在左侧的 "Watch" 面板中添加监视：
```javascript
// 监视用户查询
userQuery.query

// 监视工具调用列表
toolCalls

// 监视 API 响应
response.geocodes[0].location
```

### 调试控制台

在调试控制台中可以直接执行代码：
```javascript
// 查看变量
> userQuery
{ query: "从北京南站到北京西站怎么走" }

// 调用函数
> agent.executeTool('geocode', { address: '北京南站' })

// 查看类型
> typeof response
"object"
```

## 📝 调试配置详解

### launch.json 结构

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "配置名称",
      "type": "node",
      "request": "launch",
      "runtimeArgs": [
        "--inspect-brk",          // 在首行暂停，等待调试器
        "${workspaceFolder}/dist/cli.js"  // 入口文件
      ],
      "sourceMaps": true,         // 启用 source map
      "outFiles": [               // 编译后的 JS 文件位置
        "${workspaceFolder}/dist/**/*.js"
      ],
      "preLaunchTask": "npm: build"  // 调试前自动编译
    }
  ]
}
```

### Source Map 配置

项目已启用 source map：
- `tsconfig.json` 中设置了 `"sourceMap": true`
- 调试器会自动将 `dist/*.js` 映射回 `src/*.ts`
- 可以在 TypeScript 源代码中设置断点

## 🐛 常见问题

### 1. 断点不生效

**原因**：代码未编译或 source map 未生成

**解决**：
```bash
npm run build
```

或启用自动编译：
```bash
npm run dev
```

### 2. 调试器无法启动

**原因**：端口被占用

**解决**：检查是否有其他 Node 进程占用了 9229 端口：
```bash
# Linux/Mac
lsof -i :9229

# Windows
netstat -ano | findstr :9229
```

### 3. 无法进入源代码

**原因**：source map 配置错误

**解决**：
1. 检查 `tsconfig.json` 中 `"sourceMap": true`
2. 删除 `dist` 目录重新编译
3. 检查 `launch.json` 中的 `outFiles` 路径

### 4. 调试时变量显示不正确

**原因**：优化后的代码与源代码对应关系混乱

**解决**：在 `tsconfig.json` 中添加：
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs"
  }
}
```

## 🔍 关键调用链路

### CLI 调用链路

```
cli.ts
  ↓
MapAgent.query()
  ↓
analyzeQuery()          ← 意图分析
  ↓
executeToolsParallel()
  ↓
工具执行器 (executors.ts)
  ↓
AMapClient.API方法()
  ↓
request()               ← HTTP 请求
  ↓
生成响应
```

**推荐断点位置**：
1. `src/cli.ts:45` - CLI 入口
2. `src/agent/map-agent.ts:40` - Agent 查询入口
3. `src/agent/map-agent.ts:80` - 意图分析
4. `src/tools/executors.ts:25` - 工具执行
5. `src/client/amap-client.ts:55` - API 请求

### Dashboard 调用链路

```
dashboard.ts
  ↓
DashboardServer.start()
  ↓
HTTP 请求处理
  ↓
MetricsStorage 查询
  ↓
返回统计数据
```

## 📚 参考链接

- [VS Code Node.js 调试](https://code.visualstudio.com/docs/nodejs/nodejs-debugging)
- [Node.js Inspector](https://nodejs.org/en/docs/inspector)
- [TypeScript 调试配置](https://code.visualstudio.com/docs/typescript/typescript-debugging)
