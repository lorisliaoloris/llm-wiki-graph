# AGENT_POLICY.md — Agent 运行策略模板

> 每个 Agent 角色需要一份 POLICY.md 定义执行边界。
> Agent 加载此文件后，任何超出边界的操作都视为违规，需拒绝执行并报告。

## 模型选择

| 场景 | 模型 | 原因 |
|------|------|------|
| 长程任务（>10步，需上下文连贯） | deepseek-v4-pro | 1M context，不丢信息 |
| 短任务（<5步，快速响应） | glm-4-flash | 成本低，速度快 |
| 需要推理/分析 | deepseek-v4-pro | 推理能力强 |
| 简单检索/格式转换 | glm-4-flash | 不需要强推理 |

## 工具权限

### 允许
- mcp_gbrain_query
- mcp_gbrain_search
- mcp_gbrain_get_page
- mcp_gbrain_list_pages
- mcp_gbrain_put_page
- mcp_gbrain_add_link
- mcp_gbrain_add_tag
- mcp_gbrain_add_timeline_entry
- mcp_gbrain_get_links
- mcp_gbrain_get_backlinks
- read_file
- write_file
- web_search

### 禁止
- mcp_gbrain_delete_page
- mcp_gbrain_remove_link
- terminal（rm, del, 删除操作）
- 任何对外部服务的 POST/PUT 未经验证

## 执行边界

| 参数 | 限制 |
|------|:--:|
| max_tool_calls | 20 |
| timeout_per_task | 120s |
| max_pages_per_ingest | 5 |

## 写入规则

1. **put_page 后必须**：search 关联页面 → add_link → add_timeline_entry（若有事件）
2. **add_link 后必须**：反向链接
3. **更新页面时**：追加不覆盖，废弃内容 `<!-- deprecated -->`
4. **创建页面前**：先 search 确认不重复

## 违规处理

| 违规 | 处理 |
|------|------|
| 调用禁止工具 | 拒绝执行，报告"Policy 禁止此操作" |
| 超时 | 返回已完成部分 + "任务超时，剩余未完成" |
| 超出 max_pages | 报告"批量过大，请分批" |
| 未建反向链接 | `add_link` 回滚，报告"incomplete: missing backlink" |

## 域定义

<!-- 每个 Agent 填写自己的域 -->

```
domain_slug_prefixes:
  - design-theory/
  - game-design/
  - design-thinking/

domain_tags:
  - domain-game-design
```

## 模型切换规则

<!-- 可选：根据任务复杂度自动切换模型 -->

```
if task.steps > 10 → deepseek-v4-pro
if task.steps <= 5 AND task.type in [search, tag, format] → glm-4-flash
if task.type in [analysis, synthesis, lint] → deepseek-v4-pro
```
