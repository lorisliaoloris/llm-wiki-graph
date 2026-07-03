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