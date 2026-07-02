# 维护日志

> Chronological record. Append-only. Format: `## [YYYY-MM-DD] action | subject`

## [2026-07-02] lint | Pages 部署失败诊断

**对比法定位根因：**

| 构建 | SHA | 状态 | 变更内容 |
|------|-----|------|---------|
| 成功 | fbd2c43 | ✅ success | AGENTS.md |
| 失败 | 65c3220 | ❌ failure | scripts/export-graph.py |
| 失败 | 75daf64 | ❌ failure | v5.0 情报团 |
| 取消 | 62c319e | cancelled | 空提交重试 |
| 取消 | f4cdb79 | cancelled | 时间戳更新 |
| 等待 | 7fc5ed0 | pending | .nojekyll 修复 |

**对比结论**：`scripts/export-graph.py` 后所有构建失败。GitHub Pages 默认跑 Jekyll，遇到 `.py` 文件处理失败。根因：**缺少 `.nojekyll`**。

**修复**：添加 `.nojekyll` 禁用 Jekyll 处理。等待 Pages 重新部署。

## [2026-07-02] create | LLM Wiki Graph v4.x

- v4.0: 65节点 9知识团，全量 Gbrain 数据
- v4.1: 35条新连线，游戏设计/逆向工程/Soccer 团内部连通
- v5.0: 新增"情报与报告"知识团（6节点），71节点 10知识团

## [2026-07-02] create | LLM Wiki 基础设施

- AGENTS.md: Agent 维护规则（slug 映射/D3 污染/导出流程）
- scripts/export-graph.py: Gbrain→graph.json 导出脚本
- d3.v7.min.js: D3 本地化，无 CDN 依赖
- .skills/graph-colorize: Ar9av 参考
- .skills/wiki-export: Ar9av 参考
