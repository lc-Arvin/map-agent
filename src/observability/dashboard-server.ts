/**
 * 可观测性Dashboard服务器
 * 提供HTTP API和静态页面展示
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { MetricsStorage } from './storage.js';
import { MetricsCollector } from './collector.js';
import type { APICallMetric, AgentExecutionMetric, ToolExecutionMetric } from './types.js';

/** Dashboard配置 */
export interface DashboardConfig {
  /** 服务端口 */
  port: number;
  /** 主机地址 */
  host: string;
  /** 是否启用WebSocket */
  enableWebSocket: boolean;
}

/** 默认配置 */
const DEFAULT_CONFIG: DashboardConfig = {
  port: 8080,
  host: 'localhost',
  enableWebSocket: true,
};

/**
 * Dashboard服务器类
 */
export class DashboardServer {
  private config: DashboardConfig;
  private storage: MetricsStorage;
  private collector: MetricsCollector;
  private server: ReturnType<typeof createServer> | null = null;
  private unsubscribe: (() => void) | null = null;

  constructor(
    storage: MetricsStorage,
    config: Partial<DashboardConfig> = {}
  ) {
    this.storage = storage;
    this.collector = MetricsCollector.getInstance();
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 启动服务器
   */
  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        // 处理异步请求处理器
        this.handleRequest(req, res).catch((error) => {
          console.error('Unhandled error in request handler:', error);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: 'Internal server error' }));
          }
        });
      });

      this.server.listen(this.config.port, this.config.host, () => {
        console.log(`📊 Dashboard server running at http://${this.config.host}:${this.config.port}`);
        resolve();
      });

      this.server.on('error', reject);

      // 注册指标监听器
      this.unsubscribe = this.collector.onMetric((metric) => {
        if ('apiName' in metric) {
          this.storage.storeAPICall(metric as APICallMetric);
        } else if ('query' in metric) {
          this.storage.storeAgentExecution(metric as AgentExecutionMetric);
        } else if ('toolName' in metric) {
          this.storage.storeToolExecution(metric as ToolExecutionMetric);
        } else {
          this.storage.storePerformance(metric);
        }
      });
    });
  }

  /**
   * 停止服务器
   */
  async stop(): Promise<void> {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          console.log('Dashboard server stopped');
          resolve();
        });
      });
    }
  }

  /**
   * 处理HTTP请求
   */
  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = req.url || '/';
    const method = req.method || 'GET';

    // 设置CORS头
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // 路由处理
    try {
      if (url === '/' || url === '/dashboard') {
        this.serveDashboard(res);
      } else if (url === '/api/metrics/realtime') {
        await this.serveRealtimeMetrics(res);
      } else if (url === '/api/metrics/statistics') {
        await this.serveStatistics(res);
      } else if (url === '/api/metrics/api-calls') {
        await this.serveAPICalls(res);
      } else if (url === '/api/metrics/agent-executions') {
        await this.serveAgentExecutions(res);
      } else if (url === '/api/metrics/tool-executions') {
        await this.serveToolExecutions(res);
      } else if (url.startsWith('/api/metrics/query/')) {
        const queryId = url.split('/').pop();
        if (queryId) {
          await this.serveQueryDetails(res, queryId);
        } else {
          this.serve404(res);
        }
      } else {
        this.serve404(res);
      }
    } catch (error) {
      console.error('Error handling request:', error);
      this.serveError(res, error instanceof Error ? error.message : 'Internal server error');
    }
  }

  /**
   * 服务错误响应
   */
  private serveError(res: ServerResponse, message: string): void {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(500);
    res.end(JSON.stringify({ error: message }));
  }

  /**
   * 服务Dashboard页面
   */
  private serveDashboard(res: ServerResponse): void {
    const html = this.generateDashboardHTML();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.writeHead(200);
    res.end(html);
  }

  /**
   * 服务实时指标
   */
  private async serveRealtimeMetrics(res: ServerResponse): Promise<void> {
    // 重新加载数据以获取其他进程写入的最新数据
    await this.storage.reloadFromDisk();
    
    const data = {
      recentAPICalls: this.storage.getRecentAPICalls(50),
      recentAgentExecutions: this.storage.getRecentAgentExecutions(50),
      recentToolExecutions: this.storage.getRecentToolExecutions(50),
      recentPerformance: this.storage.getRecentPerformance(50),
      statistics: this.storage.getAllStatistics(),
    };
    this.serveJSON(res, data);
  }

  /**
   * 服务统计数据
   */
  private async serveStatistics(res: ServerResponse): Promise<void> {
    await this.storage.reloadFromDisk();
    const data = this.storage.getAllStatistics();
    this.serveJSON(res, data);
  }

  /**
   * 服务API调用记录
   */
  private async serveAPICalls(res: ServerResponse): Promise<void> {
    await this.storage.reloadFromDisk();
    const data = this.storage.getRecentAPICalls(100);
    this.serveJSON(res, data);
  }

  /**
   * 服务Agent执行记录
   */
  private async serveAgentExecutions(res: ServerResponse): Promise<void> {
    await this.storage.reloadFromDisk();
    const data = this.storage.getRecentAgentExecutions(100);
    this.serveJSON(res, data);
  }

  /**
   * 服务工具执行记录
   */
  private async serveToolExecutions(res: ServerResponse): Promise<void> {
    await this.storage.reloadFromDisk();
    const data = this.storage.getRecentToolExecutions(100);
    this.serveJSON(res, data);
  }

  /**
   * 服务查询详情
   */
  private async serveQueryDetails(res: ServerResponse, queryId: string): Promise<void> {
    await this.storage.reloadFromDisk();
    const agentExecutions = this.storage.getRecentAgentExecutions(1000);
    const toolExecutions = this.storage.getRecentToolExecutions(1000);
    const apiCalls = this.storage.getRecentAPICalls(1000);

    const agentExecution = agentExecutions.find(e => e.queryId === queryId);
    const relatedToolExecutions = toolExecutions.filter(e => e.queryId === queryId);
    const relatedAPICalls = apiCalls.filter(a => 
      relatedToolExecutions.some(t => 
        // 这里简化处理，实际应该有关联关系
        Math.abs(t.timestamp - a.timestamp) < 1000
      )
    );

    if (agentExecution) {
      this.serveJSON(res, {
        agentExecution,
        toolExecutions: relatedToolExecutions,
        apiCalls: relatedAPICalls,
      });
    } else {
      this.serve404(res);
    }
  }

  /**
   * 服务JSON数据
   */
  private serveJSON(res: ServerResponse, data: unknown): void {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.writeHead(200);
    res.end(JSON.stringify(data, null, 2));
  }

  /**
   * 服务404
   */
  private serve404(res: ServerResponse): void {
    res.setHeader('Content-Type', 'application/json');
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }

  /**
   * 生成Dashboard HTML
   */
  private generateDashboardHTML(): string {
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MapAgent 可观测性 Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: #f5f7fa;
      color: #333;
      line-height: 1.6;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 2rem;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 {
      font-size: 2rem;
      margin-bottom: 0.5rem;
    }
    .header p {
      opacity: 0.9;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 2rem;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
      transition: transform 0.2s;
    }
    .stat-card:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .stat-card h3 {
      font-size: 0.875rem;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 0.5rem;
    }
    .stat-value {
      font-size: 2.5rem;
      font-weight: bold;
      color: #667eea;
      margin-bottom: 0.5rem;
    }
    .stat-detail {
      font-size: 0.875rem;
      color: #888;
    }
    .section {
      background: white;
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
      box-shadow: 0 2px 8px rgba(0,0,0,0.08);
    }
    .section h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      color: #333;
      border-bottom: 2px solid #f0f0f0;
      padding-bottom: 0.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.875rem;
    }
    th, td {
      text-align: left;
      padding: 0.75rem;
      border-bottom: 1px solid #eee;
    }
    th {
      font-weight: 600;
      color: #666;
      background: #f9f9f9;
    }
    tr:hover {
      background: #f9f9f9;
    }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 500;
    }
    .status-success {
      background: #d4edda;
      color: #155724;
    }
    .status-error {
      background: #f8d7da;
      color: #721c24;
    }
    .status-partial {
      background: #fff3cd;
      color: #856404;
    }
    .duration {
      font-family: 'Monaco', 'Menlo', monospace;
      color: #666;
    }
    .timestamp {
      color: #888;
      font-size: 0.75rem;
    }
    .endpoint {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 0.75rem;
      color: #666;
      background: #f5f5f5;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
    }
    .refresh-btn {
      position: fixed;
      bottom: 2rem;
      right: 2rem;
      background: #667eea;
      color: white;
      border: none;
      border-radius: 50%;
      width: 56px;
      height: 56px;
      font-size: 1.5rem;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
      transition: all 0.3s;
    }
    .refresh-btn:hover {
      transform: scale(1.1);
      box-shadow: 0 6px 16px rgba(102, 126, 234, 0.5);
    }
    .refresh-btn.spinning {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .error-message {
      color: #dc3545;
      font-size: 0.875rem;
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .query-text {
      max-width: 300px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🗺️ MapAgent 可观测性 Dashboard</h1>
    <p>实时监控 Agent 运行状态、API 调用和性能指标</p>
  </div>

  <div class="container">
    <!-- 统计卡片 -->
    <div class="stats-grid" id="stats-grid">
      <div class="stat-card">
        <h3>最近1小时 API 调用</h3>
        <div class="stat-value" id="api-calls-1h">-</div>
        <div class="stat-detail">成功率: <span id="api-success-rate-1h">-</span>%</div>
      </div>
      <div class="stat-card">
        <h3>最近1小时 Agent 执行</h3>
        <div class="stat-value" id="agent-executions-1h">-</div>
        <div class="stat-detail">平均耗时: <span id="agent-avg-duration-1h">-</span>ms</div>
      </div>
      <div class="stat-card">
        <h3>API 平均响应时间</h3>
        <div class="stat-value" id="api-avg-duration">-</div>
        <div class="stat-detail">毫秒</div>
      </div>
      <div class="stat-card">
        <h3>总查询次数</h3>
        <div class="stat-value" id="total-queries">-</div>
        <div class="stat-detail">自服务启动</div>
      </div>
    </div>

    <!-- 最近 Agent 执行 -->
    <div class="section">
      <h2>🤖 最近 Agent 执行</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>查询</th>
            <th>工具</th>
            <th>状态</th>
            <th>耗时</th>
          </tr>
        </thead>
        <tbody id="agent-executions-table">
          <tr><td colspan="5" style="text-align:center;color:#888;">加载中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 最近 API 调用 -->
    <div class="section">
      <h2>🌐 最近 API 调用</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>API</th>
            <th>端点</th>
            <th>参数</th>
            <th>状态</th>
            <th>耗时</th>
            <th>响应大小</th>
          </tr>
        </thead>
        <tbody id="api-calls-table">
          <tr><td colspan="7" style="text-align:center;color:#888;">加载中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 最近工具执行 -->
    <div class="section">
      <h2>🛠️ 最近工具执行</h2>
      <table>
        <thead>
          <tr>
            <th>时间</th>
            <th>工具</th>
            <th>查询ID</th>
            <th>状态</th>
            <th>耗时</th>
          </tr>
        </thead>
        <tbody id="tool-executions-table">
          <tr><td colspan="5" style="text-align:center;color:#888;">加载中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- API 调用统计 -->
    <div class="section">
      <h2>📊 API 端点统计 (24小时)</h2>
      <table>
        <thead>
          <tr>
            <th>端点</th>
            <th>调用次数</th>
            <th>成功</th>
            <th>失败</th>
            <th>平均耗时</th>
          </tr>
        </thead>
        <tbody id="api-stats-table">
          <tr><td colspan="5" style="text-align:center;color:#888;">加载中...</td></tr>
        </tbody>
      </table>
    </div>

    <!-- 工具使用统计 -->
    <div class="section">
      <h2>🔧 工具使用统计 (24小时)</h2>
      <table>
        <thead>
          <tr>
            <th>工具</th>
            <th>执行次数</th>
            <th>成功</th>
            <th>失败</th>
            <th>平均耗时</th>
          </tr>
        </thead>
        <tbody id="tool-stats-table">
          <tr><td colspan="5" style="text-align:center;color:#888;">加载中...</td></tr>
        </tbody>
      </table>
    </div>
  </div>

  <button class="refresh-btn" id="refresh-btn" onclick="refreshData()">🔄</button>

  <script>
    // 格式化时间
    function formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit', 
        second: '2-digit' 
      });
    }

    // 格式化持续时间
    function formatDuration(ms) {
      if (ms < 1000) return ms + 'ms';
      return (ms / 1000).toFixed(2) + 's';
    }

    // 获取状态标签
    function getStatusBadge(status) {
      const statusClass = {
        'success': 'status-success',
        'error': 'status-error',
        'partial': 'status-partial'
      }[status] || 'status-partial';
      
      const statusText = {
        'success': '成功',
        'error': '失败',
        'partial': '部分成功'
      }[status] || status;
      
      return \`<span class="status-badge \${statusClass}">\${statusText}</span>\`;
    }

    // 加载数据
    async function refreshData() {
      const btn = document.getElementById('refresh-btn');
      btn.classList.add('spinning');

      try {
        const response = await fetch('/api/metrics/realtime');
        const data = await response.json();
        
        updateStats(data.statistics);
        updateAgentExecutions(data.recentAgentExecutions);
        updateAPICalls(data.recentAPICalls);
        updateToolExecutions(data.recentToolExecutions);
        updateAPIStats(data.statistics.last24Hours.apiCalls.byEndpoint);
        updateToolStats(data.statistics.last24Hours.toolExecutions.byTool);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        btn.classList.remove('spinning');
      }
    }

    // 更新统计数据
    function updateStats(stats) {
      document.getElementById('api-calls-1h').textContent = stats.lastHour.apiCalls.total;
      document.getElementById('api-success-rate-1h').textContent = 
        stats.lastHour.apiCalls.total > 0 
          ? Math.round((stats.lastHour.apiCalls.success / stats.lastHour.apiCalls.total) * 100)
          : 0;
      
      document.getElementById('agent-executions-1h').textContent = stats.lastHour.agentExecutions.total;
      document.getElementById('agent-avg-duration-1h').textContent = 
        stats.lastHour.agentExecutions.avgDuration;
      
      document.getElementById('api-avg-duration').textContent = 
        stats.lastHour.apiCalls.avgDuration;
      
      document.getElementById('total-queries').textContent = 
        stats.allTime.agentExecutions.total;
    }

    // 更新 Agent 执行表格
    function updateAgentExecutions(executions) {
      const tbody = document.getElementById('agent-executions-table');
      if (executions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = executions.map(e => \`
        <tr>
          <td class="timestamp">\${formatTime(e.timestamp)}</td>
          <td class="query-text" title="\${e.query}">\${e.query}</td>
          <td>\${e.toolsUsed.join(', ') || '-'}</td>
          <td>\${getStatusBadge(e.status)}</td>
          <td class="duration">\${formatDuration(e.totalDuration)}</td>
        </tr>
      \`).join('');
    }

    // 更新 API 调用表格
    function updateAPICalls(calls) {
      const tbody = document.getElementById('api-calls-table');
      if (calls.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:#888;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = calls.map(c => {
        // 格式化参数显示
        const paramsStr = c.params ? Object.entries(c.params)
          .filter(([k]) => k !== 'key') // 过滤API Key
          .map(([k, v]) => k + '=' + v)
          .join(', ') : '-';
        
        // 格式化响应大小
        const sizeStr = c.responseSize ? formatBytes(c.responseSize) : '-';
        
        const truncatedParams = paramsStr.length > 40 ? paramsStr.slice(0, 40) + '...' : paramsStr;
        
        return '\
        <tr>\
          <td class="timestamp">' + formatTime(c.timestamp) + '</td>\
          <td>' + c.apiName + '</td>\
          <td><span class="endpoint">' + c.endpoint + '</span></td>\
          <td class="params" title="' + paramsStr + '">' + truncatedParams + '</td>\
          <td>' + getStatusBadge(c.status) + '</td>\
          <td class="duration">' + formatDuration(c.duration) + '</td>\
          <td>' + sizeStr + '</td>\
        </tr>';
      }).join('');
    }

    // 格式化字节大小
    function formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    // 更新工具执行表格
    function updateToolExecutions(executions) {
      const tbody = document.getElementById('tool-executions-table');
      if (executions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = executions.map(e => \`
        <tr>
          <td class="timestamp">\${formatTime(e.timestamp)}</td>
          <td>\${e.toolName}</td>
          <td>\${e.queryId.slice(0, 8)}...</td>
          <td>\${getStatusBadge(e.status)}</td>
          <td class="duration">\${formatDuration(e.duration)}</td>
        </tr>
      \`).join('');
    }

    // 更新 API 统计
    function updateAPIStats(byEndpoint) {
      const tbody = document.getElementById('api-stats-table');
      const entries = Object.entries(byEndpoint);
      
      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = entries.map(([endpoint, stats]) => \`
        <tr>
          <td><span class="endpoint">\${endpoint}</span></td>
          <td>\${stats.total}</td>
          <td>\${stats.success}</td>
          <td>\${stats.error}</td>
          <td class="duration">\${stats.avgDuration}ms</td>
        </tr>
      \`).join('');
    }

    // 更新工具统计
    function updateToolStats(byTool) {
      const tbody = document.getElementById('tool-stats-table');
      const entries = Object.entries(byTool);
      
      if (entries.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#888;">暂无数据</td></tr>';
        return;
      }

      tbody.innerHTML = entries.map(([tool, stats]) => \`
        <tr>
          <td>\${tool}</td>
          <td>\${stats.total}</td>
          <td>\${stats.success}</td>
          <td>\${stats.error}</td>
          <td class="duration">\${stats.avgDuration}ms</td>
        </tr>
      \`).join('');
    }

    // 自动刷新
    refreshData();
    setInterval(refreshData, 10000); // 每10秒自动刷新
  </script>
</body>
</html>`;
  }
}
