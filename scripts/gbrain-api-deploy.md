# gbrain-api 部署指南（给 ECS 的 Linux Agent）

## 背景

llm-wiki-graph（GitHub Pages 可视化）需要实时从 Gbrain 拉数据。
Gbrain 已经通过 MCP proxy 对外暴露，但只能走 MCP 协议（JSON-RPC）。
现在需要一个简单的 HTTP REST API，让前端页面能直接 `fetch` 查询。

## 要部署的文件

从仓库 `lorisliaoloris/llm-wiki-graph` 拉取：

```
scripts/gbrain-api.py       → /root/gbrain-api.py   （API 服务器）
scripts/gbrain-api.service  → /etc/systemd/system/gbrain-api.service  （保活）
```

## gbrain-api.py 做什么

一个 Python HTTP server，监听 0.0.0.0:9885，提供 6 个 GET 端点。
内部调用 `gbrain` CLI 获取数据，返回 JSON。
不存储任何数据——每次请求实时查询 Gbrain。

### 端点

| 路径 | 用途 | 调用方 |
|------|------|--------|
| `/api/health` | 健康检查 | 监控 |
| `/api/status` | Gbrain 统计 | AI/页面 |
| `/api/nodes?limit=300` | 全量页面 | 页面（graph.json 数据源） |
| `/api/clusters` | 知识团分类统计 | 页面 |
| `/api/lint` | stale + orphan 列表 | 页面 Lint 面板 |
| `/api/recent` | 最近更新 | 页面 hot 面板 |

## 为什么是这个端口

- 9880: gbrain serve (已有的 HTTP MCP)
- 9881: gbrain-mcp-proxy (已有的代理)
- 9885: gbrain-api (新增，不冲突)

## 依赖

- Python 3.6+ (ECS 已有)
- `gbrain` CLI 可用（已在 /root/.bun/bin/gbrain）
- 不需要额外 pip install

## 部署步骤

```bash
# 1. 从 raw URL 下载
curl -sL https://raw.githubusercontent.com/lorisliaoloris/llm-wiki-graph/main/scripts/gbrain-api.py -o /root/gbrain-api.py
curl -sL https://raw.githubusercontent.com/lorisliaoloris/llm-wiki-graph/main/scripts/gbrain-api.service -o /root/gbrain-api.service

# 2. 确认 Gbrain CLI 可用
ls -la /root/.bun/bin/gbrain

# 3. ⚠️ 修改 service 文件里的 GBRAIN_BIN 路径(如果和实际路径不同)
# cat /root/gbrain-api.service 检查 Environment 行

# 4. 安装 systemd service
cp /root/gbrain-api.service /etc/systemd/system/gbrain-api.service
systemctl daemon-reload
systemctl enable gbrain-api
systemctl start gbrain-api

# 5. 验证
systemctl status gbrain-api
curl -s http://127.0.0.1:9885/api/health
# 期望: {"status": "ok", "service": "gbrain-api"}

curl -s http://127.0.0.1:9885/api/recent
# 期望: JSON 数组，最近更新的页面
```

## 验证清单

| 检查项 | 命令 | 期望 |
|--------|------|------|
| 服务启动 | `systemctl is-active gbrain-api` | active |
| 开机自启 | `systemctl is-enabled gbrain-api` | enabled |
| 健康检查 | `curl 127.0.0.1:9885/api/health` | `{"status":"ok"}` |
| 统计接口 | `curl 127.0.0.1:9885/api/status` | page_count > 0 |
| 页面接口 | `curl 127.0.0.1:9885/api/nodes?limit=5` | JSON 数组 |
| Lint 接口 | `curl 127.0.0.1:9885/api/lint` | stale_count, orphan_count |
| Tailscale IP 可达 | `curl 100.85.182.75:9885/api/health` | 同上 |

## 常见问题

### gbrain 命令找不到
检查 service 文件里的 `GBRAIN_BIN` 路径。ECS 上可能是：
- `/root/.bun/bin/bun /root/.bun/bin/gbrain`
- 或直接用 `/root/.bun/bin/gbrain`
修改后 `systemctl daemon-reload && systemctl restart gbrain-api`

### 端口被占用
`ss -tlnp | grep 9885` 检查。如果被占用，修改脚本里的 PORT 环境变量。

### API 返回空
检查 `gbrain stats` 是否能正常执行。如果 gbrain serve 没启动，CLI 操作会超时。
