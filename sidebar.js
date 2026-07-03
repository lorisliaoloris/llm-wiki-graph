/* sidebar.js — LLM Wiki 树状知识导航侧边栏 v1.1
 * Vanilla JS, 零依赖, 防御性编程
 * 数据层: WikiRepository → Store Layer: WikiSidebarStore → View Layer: renderXxx()
 */
(function () {
  'use strict';

  // ── Config ──
  // API_BASE: ECS gbrain-api 地址 (Tailscale Serve HTTPS)
  var API_BASE = 'https://izwz92eih9oi6zh7ekxfy5z.tailba2386.ts.net:8443';
  var API_TIMEOUT = 8000;
  var LOG_MAX_LINES = 100;
  var TREE_MAX_DEPTH = 5;

  // ── AbortController for tab switching ──
  var _currentAborter = null;

  // ── Store ──
  var WikiSidebarStore = {
    _state: {
      activeTab: 'index',
      loading: false,
      error: null,
      data: { schema: null, log: null, sources: null, index: null, lint: null }
    },
    _listeners: [],

    get: function (key) { return this._state[key]; },

    set: function (key, value) {
      var prev = this._state[key];
      this._state[key] = value;
      if (prev !== value) {
        this._listeners.forEach(function (l) { l(key, value, prev); });
      }
    },

    batch: function (updates) {
      var self = this;
      var keys = Object.keys(updates);
      keys.forEach(function (k) { self._state[k] = updates[k]; });
      this._listeners.forEach(function (l) { l('*', null, null); });
    },

    subscribe: function (fn) {
      this._listeners.push(fn);
    }
  };

  // ── Repository ──
  var WikiRepository = {
    _fetch: function (url, options) {
      if (_currentAborter) { _currentAborter.abort(); }
      _currentAborter = new AbortController();
      var ctrl = _currentAborter;
      var timer = setTimeout(function () { ctrl.abort(); }, API_TIMEOUT);

      return fetch(url, Object.assign({ signal: ctrl.signal }, options || {}))
        .then(function (r) {
          clearTimeout(timer);
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r;
        })
        .catch(function (e) {
          clearTimeout(timer);
          if (e.name === 'AbortError') {
            throw new Error('timeout');
          }
          throw e;
        });
    },

    getSchema: function () {
      return this._fetch('https://raw.githubusercontent.com/lorisliaoloris/llm-wiki-graph/main/AGENTS.md')
        .then(function (r) { return r.text(); });
    },

    getLog: function () {
      return this._fetch('https://raw.githubusercontent.com/lorisliaoloris/llm-wiki-graph/main/log.md')
        .then(function (r) { return r.text(); });
    },

    getSources: function () {
      if (!API_BASE) { return Promise.reject(new Error('offline')); }
      return this._fetch(API_BASE + '/api/sources')
        .then(function (r) { return r.json(); });
    },

    getLint: function () {
      if (!API_BASE) { return Promise.reject(new Error('offline')); }
      return this._fetch(API_BASE + '/api/lint')
        .then(function (r) { return r.json(); });
    },

    triggerRefresh: function () {
      if (!API_BASE) { return Promise.reject(new Error('offline')); }
      // GitHub Actions workflow_dispatch requires a PAT
      // This is fire-and-forget; token should be set via env or config
      return Promise.reject(new Error('Refresh trigger requires PAT configuration'));
    }
  };

  // ── DOM helpers ──
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };
  var tabContent = null;
  var nodeDetail = null;

  function getEl(id) {
    var el = document.getElementById(id);
    if (!el) { console.warn('[Sidebar] element #' + id + ' not found'); }
    return el;
  }

  // ── Tab switching ──
  function switchTab(tabName) {
    if (tabContent) { tabContent.classList.add('visible'); }
    WikiSidebarStore.set('activeTab', tabName);

    // Update tab bar active state
    $$('.nav-tab').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });

    // Hide node detail when switching to nav tab
    if (nodeDetail) { nodeDetail.classList.remove('visible'); }

    loadTabContent(tabName);
  }

  function loadTabContent(tabName) {
    if (!tabContent) { return; }
    tabContent.innerHTML = '<div class="tab-loading">⏳ 加载中...</div>';
    tabContent.classList.add('visible');
    WikiSidebarStore.batch({ loading: true, error: null });

    switch (tabName) {
      case 'schema':
        WikiRepository.getSchema()
          .then(function (md) { renderMarkdown(md, tabContent); WikiSidebarStore.set('data.schema', md); })
          .catch(function (e) { showTabError(tabContent, '无法加载 AGENTS.md: ' + htmlEscape(e.message)); });
        break;
      case 'log':
        WikiRepository.getLog()
          .then(function (md) { renderLog(md, tabContent); WikiSidebarStore.set('data.log', md); })
          .catch(function (e) { showTabError(tabContent, '无法加载 log.md: ' + htmlEscape(e.message)); });
        break;
      case 'sources':
        WikiRepository.getSources()
          .then(function (tree) { renderSources(tree, tabContent); WikiSidebarStore.set('data.sources', tree); })
          .catch(function (e) {
            if (e.message === 'offline') {
              showTabError(tabContent, 'ECS API 未配置 (API_BASE 为空)<br><small>配置 Tailscale Serve 后启用实时查询</small>');
            } else {
              showTabError(tabContent, '无法加载 Source 树: ' + htmlEscape(e.message));
            }
          });
        break;
      case 'index':
        renderIndex(tabContent);
        break;
      case 'lint':
        WikiRepository.getLint()
          .then(function (data) { renderLint(data, tabContent); WikiSidebarStore.set('data.lint', data); })
          .catch(function (e) {
            if (e.message === 'offline') {
              showTabError(tabContent, 'ECS API 未配置 (API_BASE 为空)<br><small>配置 Tailscale Serve 后启用实时诊断</small>');
            } else {
              showTabError(tabContent, '无法加载 Lint 数据: ' + htmlEscape(e.message));
            }
          });
        break;
    }
    WikiSidebarStore.set('loading', false);
  }

  function showTabError(el, msgHtml) {
    if (!el) { return; }
    el.innerHTML = '<div class="tab-error">⚠️ ' + msgHtml + '</div>';
    el.classList.add('visible');
  }

  function htmlEscape(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Markdown renderer (simple, no dependencies) ──
  function renderMarkdown(md, el) {
    if (!el || !md) { return; }
    // Very basic markdown → HTML conversion
    var html = md
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')

      // Inline code
      .replace(/`([^`]+)`/g, '<code>$1</code>')

      // Headers
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')

      // Bold / italic
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')

      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')

      // Blockquotes
      .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')

      // Horizontal rules
      .replace(/^---$/gm, '<hr>')

      // Tables (basic: | a | b |)
      .replace(/^\|(.+)\|$/gm, function (line) {
        var cells = line.split('|').filter(function (c) { return c.trim(); });
        var isHeader = line.indexOf('---') > -1;
        if (isHeader) { return ''; }
        return '<tr>' + cells.map(function (c) {
          return '<td>' + c.trim() + '</td>';
        }).join('') + '</tr>';
      })

      // Lists
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')

      // Paragraphs (double newline)
      .replace(/\n\n/g, '</p><p>');

    // Wrap lists
    html = '<p>' + html + '</p>';
    html = html.replace(/<p><li>/g, '<ul><li>').replace(/<\/li><\/p>/g, '</li></ul>');
    html = html.replace(/<p><blockquote>/g, '<blockquote>').replace(/<\/blockquote><\/p>/g, '</blockquote>');
    html = html.replace(/<p><tr>/g, '<table><tr>').replace(/<\/tr><\/p>/g, '</tr></table>');
    html = html.replace(/<p><hr><\/p>/g, '<hr>');

    el.innerHTML = '<div class="markdown-body">' + html + '</div>';
    el.classList.add('visible');
  }

  // ── Log view ──
  function renderLog(md, el) {
    if (!el) { return; }
    var lines = md.split('\n');
    var preview = lines.slice(0, LOG_MAX_LINES).join('\n');
    var hasMore = lines.length > LOG_MAX_LINES;

    renderMarkdown(preview, el);
    if (hasMore) {
      var btn = document.createElement('button');
      btn.className = 'view-all-btn';
      btn.textContent = '查看全部日志 (' + lines.length + ' 行)';
      btn.onclick = function () {
        renderMarkdown(md, el);
        btn.remove();
      };
      el.appendChild(btn);
    }
  }

  // ── Sources tree view ──
  function renderSources(tree, el) {
    if (!el || !tree) { return; }
    if (!tree.length) {
      el.innerHTML = '<div class="tab-empty">暂无 Source 数据</div>';
      el.classList.add('visible');
      return;
    }
    var html = '<ul class="source-tree">' + renderTreeNodes(tree, 0) + '</ul>';
    el.innerHTML = html;
    el.classList.add('visible');

    // Wire up toggle clicks
    $$('.tree-toggle').forEach(function (toggle) {
      toggle.addEventListener('click', function (e) {
        e.stopPropagation();
        var li = toggle.closest('li');
        if (!li) { return; }
        var ul = li.querySelector(':scope > ul');
        if (!ul) { return; }
        var isHidden = ul.style.display === 'none';
        ul.style.display = isHidden ? '' : 'none';
        toggle.classList.toggle('expanded', isHidden);
      });
    });
  }

  function renderTreeNodes(nodes, depth) {
    if (!nodes || depth > TREE_MAX_DEPTH) { return ''; }
    var html = '';
    nodes.forEach(function (n) {
      var hasKids = n.children && n.children.length > 0;
      var toggleClass = hasKids ? 'expanded' : 'leaf';
      html += '<li>';
      html += '<div class="tree-node">';
      html += '<span class="tree-toggle ' + toggleClass + '">▶</span>';
      html += '<span class="tree-name">' + htmlEscape(n.name) + '</span>';
      html += '<span class="tree-count">' + n.count + '</span>';
      html += '</div>';
      if (hasKids) {
        html += '<ul>' + renderTreeNodes(n.children, depth + 1) + '</ul>';
      }
      html += '</li>';
    });
    return html;
  }

  // ── Index view ──
  function renderIndex(el) {
    if (!el) { return; }
    // Read from global graphData (set by existing index.html)
    if (typeof graphData === 'undefined' || graphData === null || !graphData.clusters) {
      el.innerHTML = '<div class="tab-empty">图谱数据尚未加载<br><small>等待 graph.json 载入...</small></div>';
      el.classList.add('visible');
      return;
    }

    var clusters = graphData.clusters;
    var html = '<div class="lint-section"><h3>' + clusters.length + ' 个知识团</h3></div>';
    clusters.forEach(function (c) {
      var children = graphData.nodes.filter(function (n) { return n.cluster === c.id; });
      html += '<div class="cluster-item" onclick="if(window.navigateToCluster){window.navigateToCluster(\'' + c.id + '\')}">';
      html += '<span class="cluster-dot" style="background:' + (c.color || '#7aa2f7') + '"></span>';
      html += '<div class="cluster-info">';
      html += '<div class="cluster-label">' + htmlEscape(c.label) + '</div>';
      html += '<div class="cluster-summary">' + htmlEscape(c.summary || '') + '</div>';
      html += '</div>';
      html += '<span class="cluster-count">' + children.length + ' 节点</span>';
      html += '</div>';
    });
    el.innerHTML = html;
    el.classList.add('visible');
  }

  // ── Lint view ──
  function renderLint(data, el) {
    if (!el) { return; }
    if (!data || data.error) {
      el.innerHTML = '<div class="tab-error">⚠️ 诊断数据不可用: ' + htmlEscape((data && data.error) || 'unknown') + '</div>';
      el.classList.add('visible');
      return;
    }

    var staleCount = data.stale_count || 0;
    var orphanCount = data.orphan_count || 0;
    var html = '';

    if (staleCount === 0 && orphanCount === 0 && !data.contested_count) {
      el.innerHTML = '<div class="tab-empty">✅ 所有页面健康，无异常</div>';
      el.classList.add('visible');
      return;
    }

    // Stale items
    html += '<div class="lint-section"><h3>⚠️ 可能过时 (' + staleCount + ')</h3>';
    (data.stale || []).slice(0, 50).forEach(function (item) {
      html += '<div class="lint-item stale">';
      html += '<span class="lint-dot"></span>';
      html += '<span class="lint-slug">' + htmlEscape(item.slug) + '</span>';
      html += '<span class="lint-meta">' + htmlEscape(item.status || '') + '</span>';
      html += '</div>';
    });
    if (staleCount > 50) { html += '<div style="font-size:11px;color:var(--text-dim);padding:4px 10px;">... 还有 ' + (staleCount - 50) + ' 条</div>'; }
    html += '</div>';

    // Orphan items
    html += '<div class="lint-section"><h3>👻 孤立页面 (' + orphanCount + ')</h3>';
    (data.orphans || []).slice(0, 50).forEach(function (item) {
      html += '<div class="lint-item orphan">';
      html += '<span class="lint-dot"></span>';
      html += '<span class="lint-slug">' + htmlEscape(item.slug) + '</span>';
      html += '</div>';
    });
    if (orphanCount > 50) { html += '<div style="font-size:11px;color:var(--text-dim);padding:4px 10px;">... 还有 ' + (orphanCount - 50) + ' 条</div>'; }
    html += '</div>';

    el.innerHTML = html;
    el.classList.add('visible');
  }

  // ── Refresh button ──
  function handleRefresh() {
    var btn = $('.nav-tab-refresh');
    if (!btn) { return; }
    btn.disabled = true;
    btn.textContent = '⏳ 触发中...';

    WikiRepository.triggerRefresh()
      .then(function () {
        btn.textContent = '✅ 已触发';
        setTimeout(function () { btn.textContent = '🔄 刷新'; btn.disabled = false; }, 10000);
      })
      .catch(function () {
        btn.textContent = '🔒 需 PAT';
        setTimeout(function () { btn.textContent = '🔄 刷新'; btn.disabled = false; }, 3000);
      });
  }

  // ── Init ──
  function init() {
    tabContent = getEl('nav-tab-content');
    nodeDetail = getEl('node-detail');

    if (!tabContent) {
      console.warn('[Sidebar] #nav-tab-content not found — sidebar init aborted');
      return;
    }

    // Tab click handlers
    $$('.nav-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        var tabName = tab.dataset.tab;
        if (tabName) { switchTab(tabName); }
      });
    });

    // Refresh button
    var refreshBtn = $('.nav-tab-refresh');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', handleRefresh);
    }

    // Load default tab
    switchTab(WikiSidebarStore.get('activeTab'));

    // Re-render Index tab when graphData loads (async)
    window.addEventListener('graphDataLoaded', function () {
      if (WikiSidebarStore.get('activeTab') === 'index') {
        renderIndex(tabContent);
      }
    });

    // Hook into existing node selection: when node detail shows, hide tab content
    var observer = new MutationObserver(function () {
      if (nodeDetail && nodeDetail.classList.contains('visible') && tabContent) {
        tabContent.classList.remove('visible');
      }
    });
    if (nodeDetail) {
      observer.observe(nodeDetail, { attributes: true, attributeFilter: ['class'] });
    }
  }

  // ── Start on DOM ready ──
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // ── Expose for index.html ──
  window.navigateToCluster = function (clusterId) {
    if (typeof showClusterDetail === 'function') {
      showClusterDetail(clusterId);
    }
  };

  window.WikiSidebarStore = WikiSidebarStore;
})();
