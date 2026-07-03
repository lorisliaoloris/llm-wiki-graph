# 树状知识导航侧边栏 — 需求规格

> 版本: v1.1 | 状态: 待实施

## 架构定位

本侧边栏是 LLM Wiki 三层架构中的**可视化层**，不是独立功能。

```
原始资料层（只读）
  └─ 书籍、文章、GitHub issue、经验记录
       ↓ Ingest（Agent 按 llm-wiki skill 规范摄入）
Wiki 层（Gbrain — 真相源）
  └─ Markdown 页面 + frontmatter + typed link + timeline
       ↓ 导出脚本 + ECS API
可视化层（llm-wiki-graph — 本项目）
  ├─ graph.json（静态快照）→ D3 力导向图
  └─ 本侧边栏（动态导航）→ Schema/Log/Sources/Index/Lint
       ↓ 浏览
     人（你 / Agent）
```

### 侧边栏各模块的数据链路

| 侧边栏模块 | 数据从哪来 | 走什么通路 | 实时性 |
|-----------|----------|----------|:--:|
| 图谱总览 | graph.json | Gbrain → 导出脚本 → GitHub Pages | 延迟（分钟级） |
| Schema | AGENTS.md | GitHub raw → HTTPS fetch | 准实时 |
| Log | log.md | GitHub raw → HTTPS fetch | 准实时 |
| Sources | Gbrain pages | ECS API (:9885) → HTTPS guard → 分类渲染 | 实时 |
| Index | graphData.clusters | graph.json 加载后自动渲染 | 同图谱 |
| Lint | Gbrain lint | ECS API (:9885) → HTTPS guard | 实时 |
| 刷新按钮 | GitHub Actions | workflow_dispatch → rebuild Pages | 延迟（1-2分钟） |

### 与 llm-wiki skill 的关系

`llm-wiki` skill（Hermes skill v4.0）定义了知识操作规范：
- Ingest 流程（put_page → search → add_link → add_timeline）
- Cross-Linker（自动发现关联）
- Lint 规则（矛盾检测、过期标记、衰减分类）
- 写入保护（追加不覆盖）

本侧边栏的 Schema/Log/Sources/Index/Lint 五个入口，各自对应 llm-wiki 的一项核心操作：
- Schema = llm-wiki 的规则层 → 告诉 Agent "怎么做"
- Log = llm-wiki 的 log.md → 记录 "做了什么"
- Sources = llm-wiki 的原始资料清单 → 追踪 "从哪来"
- Index = llm-wiki 的 index.md → 浏览 "有什么"
- Lint = llm-wiki 的 Lint 操作 → 诊断 "哪里有问题"

### 与 Gbrain 的关系

Gbrain (ECS, Tailscale IP 100.85.182.75) 是知识内容的真相源：
- 所有页面、link、tag、timeline 都在 Gbrain 维护
- graph.json 是 Gbrain 的构建产物（导出脚本自动生成）
- ECS API (port 9885) 为侧边栏提供实时查询能力
- Gbrain MCP proxy (port 9881) 为 Agent 提供内容读写能力

ror 截断脚本
5|
6|
### 项目托管：GitHub Pages 静态站点

本项目是纯静态网站，托管在 GitHub Pages：
- 仓库：github.com/lorisliaoloris/llm-wiki-graph
- 站点：https://lorisliaoloris.github.io/llm-wiki-graph/
- 部署：git push main -> GitHub Action -> gh-pages 分支 -> Pages CDN

GitHub Pages 特有约束：
- 纯静态：不能跑后端/调 MCP -> ECS API 做桥梁
- HTTPS only：HTTP API 被拦截 -> 前端 protocol 判断降级
- Jekyll 默认：.py/scripts/ 导致构建失败 -> .nojekyll 文件
- CDN 缓存 10min：推送后不立即更新 -> workflow_dispatch + 自动刷新
- deploy 超时：大文件推送超时 -> peaceiris/actions-gh-pages + timeout-minutes:30

仓库文件结构：
  index.html / graph.json / d3.v7.min.js / .nojekyll
  AGENTS.md / SPEC.md / log.md / README.md
  scripts/ (export-graph.py / gbrain-api.py / deploy guide)
  templates/ (AGENT_POLICY.md)
  .github/workflows/ (deploy.yml)


---

# llm-wiki 侧边栏可视化层：全景架构设计说明书

> 高阶设计书 (HLD)，可直接交付 AI 工程师执行。基于 SPEC v1.1 扩展。

## 1. 系统拓扑与网络边界解决方案

由于宿主环境在 GitHub Pages（强制 HTTPS），而真相源在 ECS 内网（Tailscale HTTP IP），直接发起 fetch 会触发浏览器的 Mixed Content（混合内容拦截）与 CORS（跨域限制）。

### 核心解法：Tailscale HTTPS 隧道方案

为了不破坏纯静态站点的轻量化，严禁引入复杂的公共反向代理。启用 Tailscale Serve and Cert：
- 在 ECS 上执行 tailscale cert，为该节点申请 Tailscale 官方授信的合法域名
- 使用 tailscale serve 将 9885 端口映射至该 HTTPS 域名的 443 端口
- 前端策略：侧边栏统一配置抽象的 BASE_URL

## 2. 前端软件架构分层

三层解耦架构：
- View Layer (UI 渲染层)：SchemaView / LogView / SourcesView / IndexView / LintView
- Store Layer (状态管理层)：全局单一状态机 + 异步 Action 编排中心
- Repository Layer (数据访问层)：HttpAdapter + StorageAdapter

## 3. UI 设计核心原则

- 交互一致性：侧边栏固定悬浮布局，Tab 切换时仅内部内容区滚动，主框架保持静止
- 消除视觉噪音：过滤不必要动效，严禁未加载完成导致布局塌陷

## 4. 数据链路与状态机设计

全局状态数据结构 (Store Schema)：

window.WikiSidebarStore = {
  state: {
    sidebarVisible: false,
    currentTab: "index",
    loading: false,
    error: null,
    workflowStatus: "idle",
    data: { schema: null, log: null, sources: null, index: null, lint: null }
  },
  listeners: [],
  setState(newState) { },
  async dispatch(action, payload) { }
}

### 模块运行机制与防御策略

| 模块 | 数据源 | 防御策略 |
|------|--------|---------|
| Schema | fetch AGENTS.md | Markdown 解析异常时回退纯文本 |
| Log | fetch log.md | 仅解析前 100 行，提供查看全部按钮 |
| Sources | ECS API /api/sources | MAX_DEPTH=5 递归安全阀，防止栈溢出 |
| Index | graphData.clusters | 等待 window.graphLoaded 信号 |
| Lint | ECS API /api/lint | 字段缺失填充 default unknown，不中断渲染 |

## 5. 开发指令

核心约束：
1. 模块化隔离：新建 sidebar.js + sidebar.css，严禁改动 d3.v7.min.js
2. 防御性编程：所有 DOM 操作包裹安全检查，JSON 字段存在性检查
3. 交互一致性：侧边栏固定定位，宽度固定，Tab 切换时内容区独立滚动
4. 网络适配器：统一 Repository 对象，timeout 5000ms，失败统一 catch

### 骨架代码

// sidebar.js
const SIDEBAR_CONFIG = { API_BASE: "https://gbrain.your-tailnet.ts.net", TIMEOUT: 5000 };

const WikiRepository = {
    async fetchWithTimeout(url, options = {}) {
        const ctrl = new AbortController();
        const id = setTimeout(() => ctrl.abort(), SIDEBAR_CONFIG.TIMEOUT);
        try { const r = await fetch(url, {...options, signal: ctrl.signal}); clearTimeout(id); if(!r.ok) throw new Error(r.status); return r; }
        catch(e) { clearTimeout(id); throw e; }
    },
    async getRemoteLint() {
        try { const r = await this.fetchWithTimeout(SIDEBAR_CONFIG.API_BASE + "/api/lint"); return await r.json(); }
        catch(e) { return { status: "error", msg: "无法连接到 Gbrain 服务" }; }
    }
};

function renderTreeNodes(nodes, depth = 0) {
    if (!nodes || depth > 5) return "";
    return nodes.map(n =>
        n.title + (n.children ? renderTreeNodes(n.children, depth + 1) : "")
    ).join("");
}

document.addEventListener("DOMContentLoaded", () => { initSidebarComponent(); });

## 6. 架构优势

1. 彻底规避 Mixed Content：Tailscale Serve + Cert 内网 TLS，无需公网中转
2. 彻底消灭前端崩溃：MAX_DEPTH 限制 + catch 降级 + 状态机 DOM 控制
3. 完美对齐使用习惯：固定定位无抖动，视觉噪音最小化
