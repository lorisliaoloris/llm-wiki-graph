# 树状知识导航侧边栏 — 需求规格

> 版本: v1.0 | 状态: 待实施 | 基于 v4.3-godot 工作版本
> 上一次尝试: [失败记录] 根因是 debug panel JS 引用已被删除的 DOM 元素导致 TypeError 截断脚本

## 目标

将左侧从单一"图谱总览"改为 LLM Wiki 标准结构的**常驻树状导航**，按以下结构可展开：

```
📊 图谱总览              → 默认视图（D3 力导向图）
📋 Schema                → 点击右侧展示 AGENTS.md 内容
  └ 内容来自 raw.githubusercontent.com
📝 Log                   → 点击右侧展示 log.md 内容
  └ 2026-07-03
  └ 2026-07-02
📦 Sources               → 从 Gbrain API 自动分类
  └ 书籍与文献
  └ 研究与调研
  └ 技术文档
  └ 技能与工具
  └ Agent 记忆
  └ 经验教训
📚 Index                 → 从 graphData.clusters 自动生成
  └ LLM Wiki 知识图谱 (17)
  └ 游戏设计 (17)
  └ ...
📋 Lint 诊断             → 从 Gbrain API 获取
  └ 🟡 过期: X
  └ 🔴 矛盾: ?
  └ 👻 孤立: Y
```

## 数据源

| 导航项 | 数据从哪来 | 备注 |
|--------|----------|------|
| Schema | `fetch('raw.githubusercontent.com/.../AGENTS.md')` | HTTPS，无跨域问题 |
| Log | `fetch('raw.githubusercontent.com/.../log.md')` | HTTPS |
| Sources | `fetch('100.85.182.75:9885/api/nodes')` 或 graph.json 分类 | 首次加载 2 秒后执行 |
| Index | `graphData.clusters`（已加载的 graph.json） | 无需额外 fetch |
| Lint | `fetch('100.85.182.75:9885/api/lint')` | API 不可用时显示 "-" |

## 交互

1. **左侧常驻树**：所有节点始终可见，可展开/折叠，互不替换
2. **点击叶子节点**：右侧主区域从 D3 图切换为内容视图（`#cv` div，position:absolute 覆盖 SVG）
3. **点击"图谱总览"**：关闭内容视图，回到 D3 力导向图
4. **点击 Index 知识团**：直接在 D3 图中钻取该团
5. **API 不可用时**：Source/Lint 显示 "API 未连接"，不阻塞页面

## 实施约束

### ⚠️ 致命坑（上次失败根因）

1. **debug panel DOM 已被删除**
   - `index.html` 侧边栏区已无 `#debug-toggle`, `#debug-body`, `#dbg-*` 等元素
   - 但 JS 代码中 `compareState()` 函数和 `addEventListener('click')` 仍引用这些元素
   - **必须在本次实施时一并删除所有 debug panel 相关 JS 代码**

2. **`rfind('</script>')` 插入位置**
   - 使用 `html.rfind('</script>')` 找到最后一个 script 闭合标签
   - 树 JS 代码插入在该标签**之前**
   - **不要**使用 `rfind('loadGraph();')` —— 它在 JS 字符串中可能出现多次

3. **括号平衡**
   - 添加 JS 代码后必须验证 `{}/{}` 和 `()/()` 数量完全相等
   - 不依赖手动数——用正则提取 scrip 内容后 `count('{') == count('}')`

4. **Graph HTML 结构**
   - content-view div (`#cv`) 必须放在 `<svg id="graph-svg"></svg>` **之后**
   - 不能插在 SVG 前面——会破坏 SVG 的 DOM 解析
   - 不引入多余的 `</svg>` 标签

5. **HTTPS Mixed Content**
   - GitHub Pages 是 HTTPS，不能 fetch HTTP API
   - Sources/Lint 的 fetch 调用需要 `location.protocol === 'https:'` 判断
   - 或用 `try-catch` 静默降级

## 实施步骤（推荐顺序）

1. 从 `c225369` 的 `index.html` 开始
2. 删除所有 debug panel 相关 JS：
   - `compareState` 函数体
   - 所有 `compareState(...)` 调用
   - `debug-toggle.addEventListener(...)` 块
3. 添加树 CSS（插入 `</style>` 前）
4. 替换侧边栏 HTML（找到 `<div id="breadcrumb"` 到 `<div id="graph-container">` 之间的内容）
5. 添加 `#cv` div（插入 `<svg id="graph-svg"></svg>` 之后）
6. 添加树 JS 函数（插入最后一个 `</script>` 之前）
7. 验证：`(`与`)`数量相等，`{`与`}`数量相等
8. 本地 `python3 -m http.server` 测试
9. 推送
