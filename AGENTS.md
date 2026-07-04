# AGENTS.md — LLM Wiki Graph 维护规则

> 任何 LLM Agent（Hermes、Codex、Claude Code）在读写本仓库时必须遵守。
> graph.json 是**构建产物**，不手改——真相源在 Gbrain。

## 铁律

1. **Gbrain 是真相源** — 所有内容（页面、link、tag、summary）在 Gbrain 维护
2. **graph.json 是导出物** — 从 Gbrain 自动生成，提交到本仓库供可视化消费
3. **不手改 graph.json** — 发现数据不对 → 修 Gbrain → 重新导出
4. **每个页面必须有 summary** — `summary` 是 frontmatter 必填字段，作为图谱节点的描述文字

## Slug 映射（新 Agent 最容易踩的坑）

| 层 | 格式 | 示例 |
|----|------|------|
| Gbrain page slug | 路径式，`/` 分隔 | `design-theory/game-feel-swink` |
| graph.json node.id | 扁平式，`/` 替换为 `-` | `design-theory-game-feel-swink` |

```
Gbrain → graph.json:  slug.replaceAll('/', '-')
graph.json → Gbrain:  尝试直接匹配 → 失败则用 mcp_gbrain_resolve_slugs 模糊匹配
```

## D3 数据污染（必读）

D3 的 force simulation 会原地改写 `edge.source` / `edge.target` 从字符串变成节点对象。
之后任何读 `e.source` 的代码必须先判类型：

```js
const sid = typeof e.source === 'object' ? e.source.id : e.source;
const tid = typeof e.target === 'object' ? e.target.id : e.target;
```

## graph.json 生成流程

```
1. mcp_gbrain_list_pages（按 type 分组拉取）→ 获取全部页面
2. mcp_gbrain_get_page → 提取 summary（frontmatter > 第一句完整话）
3. mcp_gbrain_get_tags → 获取每个页面的 tag
4. 按 slug 前缀 + tag 自动分类 → clusters
5. 每个页面 → 一个 node（id 做 slug 映射，含 summary + slug）
6. mcp_gbrain_get_links → 每条 link → 一条 edge（source/target 做 slug 映射）
7. 输出 graph.json + git commit + push
```

## Gbrain 页面要求（各 Agent 必读）

创建或更新 Gbrain 页面时，必须包含以下 frontmatter：

```yaml
---
title: "页面标题（28 字以内，作为图谱节点标签）"
slug: domain/page-name
type: concept | entity | reference | note | book
summary: "一句完整的话描述本页内容。图谱点击节点时显示。"
tags: [tag1, tag2, tag3]
---
```

**summary 铁律**：
- 必须写，不能留空
- 一句完整的话，不是截断，不是标签列表
- 自包含——不看标题也能理解
- 具体——说清楚是什么、为什么重要

详情见 Hermes skill `llm-wiki` 最新版。

## 知识团（cluster）分类规则

**优先级：slug 前缀 > tag 关键词 > 默认归入「其他」**

| slug 前缀 | cluster |
|-----------|---------|
| `reverse-engineering/` | 逆向工程 |
| `cf8/` | CF8 开发 |
| `linux-ops/` | Linux 运维 |
| `art-tech/`、`art/` | 美术与技术 |
| `ddia/`、`chapter*/` | DDIA 读书笔记 |
| `books/javascript/` | JavaScript 前端工程化 |
| `books/`（非 javascript） | Godot 引擎 |
| `design-theory/`、`design-thinking/`、`game-design/` | 游戏设计 |
| `projects/soccer-*`、`football-knowledge/` | Soccer NO.1 |
| `skills/`、`inventory/`、`tools/` | 技能与工具 |
| `reference/`、`specs/` | 参考资料 |
| `hermes-tips/`、`agents/`、`openclaw/` | Hermes 技巧 |
| `glucose/` | 血糖管理 |
| `bug/` | 故障记录 |
| `java-concurrency/` | Java 并发 |
| `anatomy_of_a_redis/`、`commands_in_redis/` | Redis 剖析 |
| `game-patterns/` | Godot 引擎 |
| LLM Wiki 关键词 | LLM Wiki 知识图谱 |

**无 slug 前缀匹配时**，按 tag 关键词分配：
- `game-design`、`soccer`、`cm4`、`足球` → 游戏设计
- `linux`、`server`、`kernel`、`sysctl`、`devops`、`ecs` → Linux 运维
- `art`、`美术`、`ui`、`svg` → 美术与技术
- 其余 → 其他

**tag 的作用**：各 Agent 给自己的页面打 tag → 导出脚本按 tag 归类 → 节点出现在正确的知识团中。不打 tag = 永远在「其他」。

## 维护日志

每次 graph.json 更新后，在 commit message 中注明：
- 节点数变化（+N / -M）
- 边数变化
- 来源（手动 / gbrain-export / agent-lint）


## GitHub Pages .nojekyll（必读）

GitHub Pages 默认用 Jekyll 构建站点。如果仓库里有 Jekyll 不认识的
文件类型（如 、 目录），构建会静默失败，回退到上一个
成功的版本——但不会报错。

**症状**：多次 push 后首页一直不更新，但 raw.githubusercontent.com 上的
文件是最新的。

**根因**：缺少  文件。

**修复**：在仓库根目录创建空的  文件并推送。
只做一次，之后所有构建都会跳过 Jekyll。



**自查**：如果 graph.json 已更新但 Pages 不显示，先检查有无 。


## 调试经验（Agent 必读）

### D3 渲染 bug

| 症状 | 根因 | 修复 |
|------|------|------|
| 导航后边线消失 | D3 force 改写 edge.source/target（字符串→对象），clusterMap 查不到 |  |
| 反复钻取后图混乱 |  叠加监听器（D3 的  不替换旧 handler） |  先清再绑 |
| 首次加载  报错 |  全局变量首次调用时为 undefined |  |
| 快速导航后图错位 | rAF 回调引用旧 zoom 实例（闭包过期） |  杀残留 |

### MSYS2 路径陷阱

在 MSYS/git-bash 的 Python 中使用  会被解析为 。
**必须用  格式**。否则所有文件写入到错误位置，git 看不到变更。

### GitHub Pages 部署失败

| 症状 | 根因 | 修复 |
|------|------|------|
| 首页不变但 raw 文件正确 | 缺  → Jekyll 构建失败 |  |
| Build 成功但 deploy 超时 | Pages CDN 推送堵塞 |  +  |

**对比法自查**：对比最后一次成功构建 vs 首次失败构建的 diff，定位引入问题的 commit。

### 远程调试

Edge CDP:  → CDP 注入 JS 验证页面状态。
computer_use 不可用时，CDP 是降级方案。


## 调试经验（Agent 必读）

### D3 渲染 bug

| 症状 | 根因 | 修复 |
|------|------|------|
| 导航后边线消失 | D3 force 改写 edge.source/target(字符串→对象), clusterMap查不到 | typeof e.source === "object" ? e.source.id : e.source |
| 反复钻取后图混乱 | d3.zoom() 叠加监听器(D3的call不替换旧handler) | svg.on(".zoom", null) 先清再绑 |
| 首次加载 selectAll 报错 | svg 全局变量首次为 undefined | if (svg) svg.selectAll("*").remove() |
| 快速导航后图错位 | rAF 回调引用旧 zoom 实例(闭包过期) | cancelAnimationFrame(pendingRaf) |

### MSYS2 路径陷阱

MSYS/git-bash 的 Python 中 /c/Users/... 被解析为 C:\\c\\Users\\...
必须用 C:/Users/... 格式。否则所有文件写入错误位置,git 看不到变更。

### GitHub Pages 部署失败

| 症状 | 原因 | 修复 |
|------|------|------|
| 首页不变但 raw 正确 | 缺 .nojekyll → Jekyll 构建失败 | touch .nojekyll |
| Build成功 deploy超时 | Pages CDN 推送堵塞 | peaceiris/actions-gh-pages + timeout-minutes:30 |
| 连续多个构建全部 failure | 根因不是CDN缓存,查部署状态API | 对比法:最后一次成功vs首次失败commit diff |

### 远程调试方法

CDP连接: msedge --remote-debugging-port=9222 → browser_cdp 注入JS验证页面状态。
computer_use 不可用时,CDP 是降级方案。

## 参考

- Gbrain Ingest 规则：加载 Hermes skill `llm-wiki` → Gbrain Backend 章节
- 完整理念：https://gist.github.com/Karpathy/442a6bf555914893e9891c11519de94f
