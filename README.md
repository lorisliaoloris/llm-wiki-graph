# LLM Wiki Graph

> 知识图谱可视化工程——将 `graph.json` 渲染为交互式力导向图。
> LLM Agent 维护数据，人浏览和决策。部署在 GitHub Pages。

## 快速开始

```bash
# 本地预览
python -m http.server 8080
# 打开 http://localhost:8080
```

## 核心理念

这不是资料库，不是 RAG 索引，而是**介于原始资料和即时问答之间的 Wiki 层的可视化**。

| 层 | 负责方 | 说明 |
|----|--------|------|
| 原始资料 | 人 | 只读，source of truth |
| 知识图谱 (Wiki) | LLM | 编译、连接、修正、维护 |
| 可视化 (**本项目**) | 浏览器 | 以力导向图呈现链接结构 |

详见 [LLM Wiki 理念约束](https://gist.github.com/Karpathy/442a6bf555914893e9891c11519de94f)（Andrej Karpathy）。

## graph.json Schema

LLM Agent 在每次 Ingest/Query/Lint 后更新此文件。

### 顶层

```json
{
  "meta": {
    "title": "知识图谱标题",
    "description": "一句话描述",
    "lastUpdated": "YYYY-MM-DD",
    "version": "1.0"
  },
  "nodes": [...],
  "edges": [...]
}
```

### 节点 (nodes)

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `id` | ✅ | string | 唯一标识，kebab-case |
| `label` | ✅ | string | 显示名称 |
| `type` | ✅ | enum | `concept`\|`entity`\|`trend`\|`question`\|`index` |
| `summary` | ✅ | string | 一句话描述（显示在 tooltip 和侧边栏） |
| `status` | 选填 | enum | `active`\|`thin`\|`stale`\|`candidate`\|`merged` |
| `tags` | 选填 | string[] | 标签数组 |
| `source` | 选填 | string | 原始资料 URL 或路径 |

### 边 (edges)

| 字段 | 必填 | 类型 | 说明 |
|------|------|------|------|
| `source` | ✅ | string | 源节点 id |
| `target` | ✅ | string | 目标节点 id |
| `type` | ✅ | enum | `defines`\|`references`\|`implements`\|`uses`\|`builds`\|`raises`\|`addresses`\|`parallels`\|`complements`\|`enables`\|`relates` |
| `label` | 选填 | string | 边上的文字标签 |

## LLM Agent 维护规则

Agent 读取并维护 `graph.json` 时，必须遵循以下规则：

### 1. 更新优先于新建

- 新知识优先更新已有节点的 `summary` 字段
- 只在旧节点无法容纳时才创建新节点
- 不为了"结构完整"创建空壳节点

### 2. 每条边必须有意义

- `defines`：A 定义了 B 的概念/规则
- `references`：A 引用/提及了 B
- `implements`：A 实现了 B 的理念
- `uses`：A 使用了工具 B
- `builds`：A 构建/创建了 B
- `raises`：A 提出了问题 B
- `addresses`：A 回应/解决了 B
- `parallels`：A 与 B 结构同构
- `complements`：A 与 B 互补
- `enables`：A 使 B 成为可能
- `relates`：通用关联（最后选择）

### 3. 维护 log

每次修改 graph.json 后，更新 `meta.lastUpdated` 字段。

### 4. 修剪

定期检查：
- `status: thin` 超过 30 天的节点 → 合并或删除
- `status: stale` 的节点 → 确认是否仍然成立
- 没有任何边的孤立节点 → 建立连接或删除

### 5. 规模控制

- 节点数控制在 200 以内（力导向图在此规模下性能最佳）
- 超出时，优先合并相似节点、删除低价值节点

## 部署

推送到 `main` 分支，在 GitHub 仓库 Settings → Pages 中：
- Source: Deploy from a branch
- Branch: `main`, folder: `/ (root)`

## 技术栈

- **D3.js v7** — 力导向图渲染
- **纯 HTML/CSS/JS** — 零构建步骤，零依赖安装
- **GitHub Pages** — 静态托管

## 功能

- 🔍 搜索节点（自动高亮并展示详情）
- 🏷️ 按类型筛选（概念/实体/趋势/问题/索引）
- 🖱️ 拖拽节点、缩放平移
- 📋 点击节点查看详情 + 关联列表
- 🎨 选中节点的关联边高亮
- ⌨️ Esc 取消选中
- 📱 响应式布局
- 🌙 深色主题
