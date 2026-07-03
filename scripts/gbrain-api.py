"""
gbrain-api.py — 轻量 HTTP API，从 Gbrain MCP 拉数据返回 JSON
部署在 ECS，配合 systemd 保活。供 llm-wiki-graph 页面和 AI Agent 使用。

端点：
  GET /api/status       — Gbrain 统计信息
  GET /api/nodes        — 全量节点（graph.json 数据源）
  GET /api/clusters     — 知识团列表
  GET /api/lint         — Lint 结果（stale/contested/orphan）
  GET /api/recent       — 最近更新
  GET /api/health       — 服务健康检查

部署：
  scp gbrain-api.py root@ecs:/root/
  sudo cp /root/gbrain-api.service /etc/systemd/system/
  sudo systemctl daemon-reload
  sudo systemctl enable --now gbrain-api
"""

import json
import subprocess
import sys
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

# ── Gbrain CLI path ──
BRAIN = os.environ.get("GBRAIN_BIN", "gbrain")

def gbrain(args):
    """Call gbrain CLI and return parsed JSON"""
    cmd = [BRAIN] + args
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return {"error": result.stderr.strip()}
        return json.loads(result.stdout) if result.stdout.strip() else []
    except subprocess.TimeoutExpired:
        return {"error": "Gbrain CLI timeout"}
    except json.JSONDecodeError:
        return {"error": "Gbrain returned invalid JSON"}
    except Exception as e:
        return {"error": str(e)}

class APIHandler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def _json(self, data, code=200):
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.end_headers()
        self.wfile.write(json.dumps(data, ensure_ascii=False, indent=2).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path
        params = parse_qs(urlparse(self.path).query)

        if path == "/api/health":
            self._json({"status": "ok", "service": "gbrain-api"})

        elif path == "/api/status":
            stats = gbrain(["stats"])
            self._json(stats)

        elif path == "/api/nodes":
            limit = params.get("limit", ["200"])[0]
            pages = gbrain(["list_pages", "--limit", str(limit), "--sort", "slug"])
            self._json(pages)

        elif path == "/api/clusters":
            pages = gbrain(["list_pages", "--limit", "300", "--sort", "slug"])
            if isinstance(pages, list):
                clusters = {}
                for p in pages:
                    slug = p.get("slug", "")
                    prefix = slug.split("/")[0] if "/" in slug else "root"
                    clusters.setdefault(prefix, []).append(p["slug"])
                self._json({
                    "total_pages": len(pages),
                    "clusters": {k: len(v) for k, v in sorted(clusters.items())}
                })
            else:
                self._json(pages)

        elif path == "/api/lint":
            # Get stale, contested, orphan pages
            all_pages = gbrain(["list_pages", "--limit", "500"])
            if not isinstance(all_pages, list):
                self._json({"error": "Failed to fetch pages"})
                return

            # Find orphans
            orphans = gbrain(["find_orphans"])
            orphan_slugs = set()
            if isinstance(orphans, dict) and "orphans" in orphans:
                orphan_slugs = {o["slug"] for o in orphans["orphans"]}

            stale = []
            orphan = []
            normal = []

            for p in all_pages:
                slug = p.get("slug", "")
                status = p.get("status", "active")
                if status in ("stale", "needs-review"):
                    stale.append({"slug": slug, "title": p.get("title", ""), "status": status, "updated": p.get("updated_at", "")})
                elif slug in orphan_slugs:
                    orphan.append({"slug": slug, "title": p.get("title", ""), "updated": p.get("updated_at", "")})

            self._json({
                "stale_count": len(stale),
                "stale": stale[:50],
                "orphan_count": len(orphan),
                "orphans": orphan[:50],
            })

        elif path == "/api/recent":
            recent = gbrain(["list_pages", "--limit", "20", "--sort", "updated_desc"])
            self._json(recent)

        else:
            self._json({"error": "Not found", "endpoints": [
                "/api/health", "/api/status", "/api/nodes", "/api/clusters",
                "/api/lint", "/api/recent"
            ]}, 404)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "9885"))
    server = HTTPServer(("0.0.0.0", port), APIHandler)
    print(f"gbrain-api running on port {port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        server.server_close()
