# AGENTS.md — LLM Wiki Graph 维护规则

> 任何 LLM Agent（Hermes、Codex、Claude Code）在读写本仓库时必须遵守。
> graph.json 是**构建产物**，不手改——真相源在 Gbrain。

## 铁律

1. **Gbrain 是真相源** — 所有内容（页面、link、tag）在 Gbrain 维护
2. **graph.json 是导出物** — 从 Gbrain 自动生成，提交到本仓库供可视化消费
3. **不手改 graph.json** — 发现数据不对 → 修 Gbrain → 重新导出

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
1. mcp_gbrain_list_pages → 获取全部页面
2. 按 slug 前缀 + type 自动分类 → clusters
3. 每个页面 → 一个 node（id 做 slug 映射）
4. mcp_gbrain_get_links → 每条 link → 一条 edge（source/target 做 slug 映射）
5. 输出 graph.json + git commit + push
```

## 知识团（cluster）分类规则

按 slug 前缀自动归类：

| slug 前缀 | cluster |
|-----------|---------|
| `design-theory/` | 游戏设计 |
| `design-thinking/` | 游戏设计 |
| `game-design/` | 游戏设计 |
| `reverse-engineering/` | 逆向工程 |
| `projects/soccer-*` | Soccer NO.1 |
| `skills/` | 技能与工具 |
| `reference/` | 参考资料 |
| 无前缀 + LLM Wiki 关键词 | LLM Wiki 知识图谱 |

## 维护日志

每次 graph.json 更新后，在 commit message 中注明：
- 节点数变化（+N / -M）
- 边数变化
- 来源（手动 / gbrain-export / agent-lint）

## 参考

- Gbrain Ingest 规则：加载 Hermes skill `llm-wiki` → Gbrain Backend 章节
- 完整理念：https://gist.github.com/Karpathy/442a6bf555914893e9891c11519de94f
