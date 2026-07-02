"""
wiki-export — Gbrain → graph.json 导出脚本

用法：由 Hermes Agent 在主循环中调用 MCP 工具执行，
      或作为文档记录导出逻辑供其他 Agent 参考。

设计参考：Ar9av/obsidian-wiki (⭐2596) 的 wiki-export skill
模式：Materialized View — graph.json 是 Gbrain 的构建产物

铁律：
- 不手改 graph.json — 所有数据从 Gbrain 导出
- Slug 映射：Gbrain 用 design-theory/game-feel-swink，graph.json 用 design-theory-game-feel-swink (/→-)
- D3 会改写 edge.source/target，读时必须 typeof 兜底
"""

import json
import re

# ═══════════════════════════════════════════════
# Phase 1: 从 Gbrain 获取全量页面
# ═══════════════════════════════════════════════
# Hermes 调用: mcp_gbrain_list_pages(limit=300, sort="slug")
# 返回: [{slug, type, title, updated_at}, ...]

# ═══════════════════════════════════════════════
# Phase 2: Slug 映射 + 集群分类
# ═══════════════════════════════════════════════

def gbrain_to_graph_id(slug: str) -> str:
    """Gbrain slug → graph.json node ID"""
    return slug.replace('/', '-')

def classify_cluster(slug: str, ptype: str) -> str:
    """按 slug 前缀 + type 自动归类"""
    s = slug.lower()
    # LLM Wiki
    if any(k in s for k in ['llm-wiki','compound','three-layer','source-immut',
        'update-over','query-reflux','ingest','lint','anti-bloat','graph-json',
        'karpathy','reverse-engineering-methodology','gbrain','obsidian',
        'hermes-agent','llm-wiki-graph']):
        return 'LLM Wiki 知识图谱'
    if any(k in s for k in ['design-theory','design-thinking','game-design']):
        return '游戏设计'
    if s.startswith('reverse-engineering/'):
        return '逆向工程'
    if 'soccer' in s:
        return 'Soccer NO.1'
    if s.startswith('skills/'):
        return '技能与工具'
    if s.startswith('cf8/'):
        return 'CF8 开发'
    if s.startswith('reference/'):
        return '参考资料'
    if s.startswith('books/'):
        return '书籍'
    if s.startswith('ddia/') or s.startswith('chapter'):
        return 'DDIA 读书笔记'
    if s.startswith('linux-ops/'):
        return 'Linux 运维'
    if s.startswith('hermes-tips/'):
        return 'Hermes 技巧'
    if s.startswith('glucose/') or 'diabetes' in s:
        return '血糖管理'
    return '其他'

# Gbrain type → graph.json type 映射
TYPE_MAP = {
    'concept':'concept','entity':'entity','question':'question',
    'reference':'entity','note':'concept','skill':'concept',
    'plan':'concept','spec':'concept','project':'entity',
    'design-thinking':'concept','game-design':'concept',
    'daily':'entity','research':'concept','soul':'entity',
    'agent':'entity','linux-ops':'concept','wiki/book':'entity',
}

CLUSTER_COLORS = [
    '#4fc3f7','#ffb74d','#9ccc65','#b39ddb','#ef5350',
    '#26c6da','#ab47bc','#66bb6a','#ff7043','#42a5f5',
    '#ec407a','#8d6e63','#78909c','#7e57c2','#29b6f6'
]

# ═══════════════════════════════════════════════
# Phase 3: 获取链接并构建边
# ═══════════════════════════════════════════════
# Hermes 调用: 对每个有 link 的页面调 mcp_gbrain_get_links(slug)
# 返回: [{from, to, link_type, context}, ...]
# 边映射：Gbrain link_type → graph.json edge.type

LINK_TYPE_MAP = {
    'defines':'defines','references':'references','implements':'implements',
    'builds':'builds','complements':'complements','raises':'raises',
    'addresses':'addresses','relates':'relates','indexes':'indexes',
    'implemented_by':'implemented_by','visualized_by':'visualized_by',
    'uses':'uses','maintains':'maintains','enables':'enables',
    'parallels':'parallels',
}

# ═══════════════════════════════════════════════
# Phase 4: 组装 → 输出 graph.json
# ═══════════════════════════════════════════════

def build_graph(pages: list, links: dict) -> dict:
    """
    pages: [{slug, type, title}, ...] from Phase 1
    links: {slug: [{from, to, link_type, context}], ...} from Phase 3
    """
    # 集群
    cluster_data = {}
    for p in pages:
        cn = classify_cluster(p['slug'], p['type'])
        cluster_data.setdefault(cn, []).append(p)

    # 节点
    nodes = []
    for p in pages:
        nodes.append({
            "id": gbrain_to_graph_id(p['slug']),
            "label": p['title'][:28],
            "type": TYPE_MAP.get(p['type'], 'concept'),
            "cluster": classify_cluster(p['slug'], p['type']).replace(' ','-').replace('/','-'),
            "summary": f"[{p['type']}] {p['slug']}",
            "status": "active",
            "tags": [p['type']]
        })

    # 知识团
    clusters = []
    for i, (cname, cpages) in enumerate(sorted(cluster_data.items(), key=lambda x: -len(x[1]))):
        color = CLUSTER_COLORS[i % len(CLUSTER_COLORS)]
        cid = cname.replace(' ','-').replace('/','-')
        clusters.append({
            "id": cid,
            "label": cname,
            "summary": f"{len(cpages)}个页面",
            "color": color
        })

    # 边
    edges = []
    node_ids = {n['id'] for n in nodes}
    for slug, page_links in links.items():
        from_id = gbrain_to_graph_id(slug)
        for link in page_links:
            to_slug = link.get('to_slug', link.get('to', ''))
            to_id = gbrain_to_graph_id(to_slug)
            if from_id in node_ids and to_id in node_ids:
                edges.append({
                    "source": from_id,
                    "target": to_id,
                    "type": LINK_TYPE_MAP.get(link.get('link_type',''), 'relates'),
                    "label": link.get('context', link.get('link_type',''))[:12]
                })

    return {
        "meta": {
            "title": "知识图谱 · 全量",
            "description": f"从 Gbrain 自动导出 — {len(nodes)}节点 {len(clusters)}知识团 {len(edges)}连线",
            "lastUpdated": "2026-07-02",
            "version": "5.0-auto",
            "source": "gbrain-export-script"
        },
        "clusters": clusters,
        "nodes": nodes,
        "edges": edges
    }


# ═══════════════════════════════════════════════
# 使用示例（Hermes Agent 执行）
# ═══════════════════════════════════════════════
"""
# 1. 获取全量页面
pages = mcp_gbrain_list_pages(limit=300, sort="slug")

# 2. 获取链接（按需，只对有 link 的页面）
links = {}
for p in pages:
    try:
        result = mcp_gbrain_get_links(slug=p['slug'])
        if result:
            links[p['slug']] = result
    except:
        pass

# 3. 构建 + 写入
graph = build_graph(pages, links)
write_file("C:/Users/loris/llm-wiki-graph-local/graph.json",
           json.dumps(graph, ensure_ascii=False, indent=2))

# 4. 提交
git add graph.json
git commit -m "export: Gbrain全量导出 N节点 M连线"
git push
"""
