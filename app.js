/* 模型参数查询 — 数据来自 models.dev（每日自动更新），图标来自 LobeHub Icons */
(function () {
  var META_URL = 'data/meta.json';
  var DATA_URL = 'data/models.json';
  var ICONS_URL = 'icons.json';
  var PAGE_SIZE = 8;
  var MAX_RESULTS = 60;

  var $input = document.getElementById('model-search');
  var $results = document.getElementById('results');
  var $status = document.getElementById('data-status');
  var $date = document.getElementById('data-date');

  var index = [];
  var ICON_MAP = {};
  var lastGroups = [];
  var lastQuery = '';
  var curPage = 1;

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  // 详细数字 + 缩写括号：163840 (163.8k)，不加千分位逗号
  function fmtNumFull(n) {
    if (n == null) return '—';
    var abbr = String(n);
    if (n >= 1e6) abbr = (Math.round(n / 1e4) / 100) + 'M';
    else if (n >= 1e3) abbr = (Math.round(n / 100) / 10) + 'k';
    return abbr === String(n) ? String(n) : String(n) + ' (' + abbr + ')';
  }
  function fmtPrice(p) {
    if (p == null) return '—';
    return '$' + p;
  }
  var MODALITY_CN = { text: '文本', image: '图像', pdf: 'PDF', audio: '音频', video: '视频' };
  function fmtMods(arr) {
    if (!arr || !arr.length) return '—';
    return arr.map(function (x) { return MODALITY_CN[x] || x; }).join('、');
  }
  function stat(label, value) {
    return '<div class="md-stat"><span class="md-stat-label">' + esc(label) +
      '</span><span class="md-stat-value">' + esc(value) + '</span></div>';
  }
  // 归一化名称：DeepSeek-V3.1 / DeepSeek V3.1 / deepseek_v3.1 视为同一模型
  function normName(name) {
    return name.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '');
  }
  function iconFor(pid) {
    return ICON_MAP[pid] || 'icons/_default.svg';
  }
  function imgTag(pid, cls) {
    return '<img class="' + cls + '" src="' + esc(iconFor(pid)) +
      '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
  }
  // 卡片标题图标：取模型厂商（模型 id 的 vendor 前缀，如 anthropic/claude-x -> anthropic），
  // 而不是分组内排第一的渠道；厂商无图标时回退到渠道图标
  var VENDOR_ALIAS = {mistralai: 'mistral', 'deepseekai': 'deepseek', zaiorg: 'zai'};
  // 模型家族图标优先于公司图标（如 Claude 模型用 Claude 标而非 Anthropic 公司标）
  var MODEL_ICONS = [[/claude/i, 'icons/claude-color.svg'], [/gemini/i, 'icons/gemini-color.svg']];
  function titleIconFor(canon) {
    var label = (canon.name || '') + ' ' + (canon.id || '');
    for (var i = 0; i < MODEL_ICONS.length; i++) {
      if (MODEL_ICONS[i][0].test(label)) return MODEL_ICONS[i][1];
    }
    var mid = canon.id || '';
    var key = mid.indexOf('/') !== -1
      ? mid.split('/')[0].toLowerCase().replace(/[^a-z0-9]/g, '') : '';
    key = VENDOR_ALIAS[key] || key;
    if (key) {
      if (ICON_MAP[key]) return ICON_MAP[key];
      for (var pid in ICON_MAP) {
        if (pid.toLowerCase().replace(/[^a-z0-9]/g, '') === key) return ICON_MAP[pid];
      }
    }
    return iconFor(canon.provider);
  }
  function imgTagTitle(canon) {
    return '<img class="md-card-icon" src="' + esc(titleIconFor(canon)) +
      '" alt="" loading="lazy" onerror="this.style.display=\'none\'">';
  }

  function buildIndex(data) {
    index = [];
    Object.keys(data).forEach(function (pid) {
      var prov = data[pid];
      var pname = prov.name || pid;
      var models = prov.models || {};
      Object.keys(models).forEach(function (mid) {
        var m = models[mid];
        var name = m.name || mid;
        index.push({
          name: name, id: mid, provider: pid, providerName: pname, doc: prov.doc || '',
          hay: (name + ' ' + mid).toLowerCase(),
          nameLower: name.toLowerCase(),
          norm: normName(name),
          m: m
        });
      });
    });
  }

  function search(q) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    var ql = q.toLowerCase();
    var first = tokens[0];
    var hits = [];
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      var ok = true;
      for (var t = 0; t < tokens.length; t++) {
        if (e.hay.indexOf(tokens[t]) === -1) { ok = false; break; }
      }
      if (!ok) continue;
      var nl = e.nameLower;
      var score = 10;
      if (nl === ql) score = 100;
      else if (nl.indexOf(first) === 0) score = 50;
      else if (nl.indexOf(first) !== -1) score = 30;
      // 官方渠道加权：provider 与关键词相关时优先
      if ((e.provider + ' ' + e.providerName).toLowerCase().indexOf(first) !== -1) score += 15;
      hits.push([score, e]);
    }
    var groups = new Map();
    hits.forEach(function (h) {
      var score = h[0], e = h[1];
      if (!groups.has(e.norm)) groups.set(e.norm, { entries: [], best: 0, latest: '' });
      var g = groups.get(e.norm);
      g.entries.push([score, e]);
      if (score > g.best) g.best = score;
      var rd = e.m.release_date || '';
      if (rd > g.latest) g.latest = rd;
    });
    var arr = Array.from(groups.values());
    arr.sort(function (a, b) {
      return (b.best - a.best) ||
        (b.latest < a.latest ? -1 : b.latest > a.latest ? 1 : 0) ||
        (a.entries[0][1].name.length - b.entries[0][1].name.length);
    });
    return arr.slice(0, MAX_RESULTS).map(function (g) {
      g.entries.sort(function (a, b) { return b[0] - a[0]; });
      return g;
    });
  }

  function badges(m) {
    var b = [];
    if (m.status === 'deprecated') b.push(['已废弃', 'md-badge-danger']);
    else if (m.status === 'beta') b.push(['Beta', 'md-badge-warn']);
    else if (m.status === 'alpha') b.push(['Alpha', 'md-badge-warn']);
    if (m.tool_call) b.push(['Tool Call', '']);
    if (m.reasoning) b.push(['推理', '']);
    if (m.attachment) b.push(['附件', '']);
    if (m.structured_output) b.push(['结构化输出', '']);
    if (m.open_weights) b.push(['开源权重', '']);
    return b.map(function (x) { return '<span class="md-badge' + (x[1] ? ' ' + x[1] : '') + '">' + esc(x[0]) + '</span>'; }).join('');
  }
  var DOC_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';

  function render(groups, q) {
    lastGroups = groups;
    lastQuery = q;
    curPage = 1;
    renderPage();
  }

  function renderPage() {
    clearPager();
    if (!lastQuery.trim()) {
      $results.innerHTML = '<p class="md-empty">在上方输入关键词开始搜索</p>';
      return;
    }
    if (!lastGroups.length) {
      $results.innerHTML = '<p class="md-empty">没找到「' + esc(lastQuery) + '」，换个关键词试试</p>';
      return;
    }
    var totalPages = Math.max(1, Math.ceil(lastGroups.length / PAGE_SIZE));
    if (curPage > totalPages) curPage = totalPages;
    var start = (curPage - 1) * PAGE_SIZE;
    $results.innerHTML = renderCards(lastGroups.slice(start, start + PAGE_SIZE));
    if (totalPages > 1) buildPager(totalPages);
  }

  function clearPager() {
    var old = document.getElementById('md-pager');
    if (old) old.remove();
  }

  function buildPager(totalPages) {
    var pager = document.createElement('div');
    pager.id = 'md-pager';
    pager.className = 'md-pager';
    var html = '<button class="md-page-btn" data-pg="prev"' + (curPage === 1 ? ' disabled' : '') + '>← 上一页</button>';
    for (var p = 1; p <= totalPages; p++) {
      html += '<button class="md-page-btn' + (p === curPage ? ' md-page-active' : '') + '" data-pg="' + p + '">' + p + '</button>';
    }
    html += '<button class="md-page-btn" data-pg="next"' + (curPage === totalPages ? ' disabled' : '') + '>下一页 →</button>';
    html += '<span class="md-page-info">第 ' + curPage + ' / ' + totalPages + ' 页，共 ' + lastGroups.length + ' 个模型</span>';
    pager.innerHTML = html;
    pager.addEventListener('click', function (ev) {
      var btn = ev.target.closest('button[data-pg]');
      if (!btn || btn.disabled) return;
      var v = btn.getAttribute('data-pg');
      if (v === 'prev') curPage = Math.max(1, curPage - 1);
      else if (v === 'next') curPage = Math.min(totalPages, curPage + 1);
      else curPage = parseInt(v, 10);
      renderPage();
      $input.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    $results.after(pager);
  }

  function renderCards(groups) {
    return groups.map(function (g) {
      var canon = g.entries[0][1];
      var m = canon.m;
      var lim = m.limit || {};
      var mods = m.modalities || {};
      var seen = {};
      var provRows = g.entries.map(function (pair) {
        var e = pair[1];
        if (seen[e.provider]) return '';
        seen[e.provider] = true;
        var c = e.m.cost || {};
        var cacheHtml = '';
        if (c.cache_read != null || c.cache_write != null) {
          var cr = c.cache_read != null ? '读 ' + fmtPrice(c.cache_read) : '';
          var cw = c.cache_write != null ? '写 ' + fmtPrice(c.cache_write) : '';
          cacheHtml = ' <span class="md-cache">缓存' + cr + (cr && cw ? ' · ' : '') + cw + '</span>';
        }
        var docHtml = e.doc ? ' <a class="md-doc-link" href="' + esc(e.doc) + '" target="_blank" rel="noopener" title="官方文档">' + DOC_SVG + '</a>' : '';
        return '<div class="md-prov-row">' + imgTag(e.provider, 'md-prov-icon') +
          '<span class="md-prov-name">' + esc(e.providerName) + docHtml + '</span>' +
          '<span class="md-prov-id">' + esc(e.id) + '</span>' +
          '<span class="md-prov-price">输入 ' + fmtPrice(c.input) + ' / 输出 ' + fmtPrice(c.output) + ' <em>$/1M tokens</em>' + cacheHtml + '</span></div>';
      }).join('');
      return '<article class="md-card">' +
        '<div class="md-card-head">' + imgTagTitle(canon) +
        '<h3 class="md-card-title">' + esc(canon.name) + '</h3></div>' +
        (m.description ? '<p class="md-desc">' + esc(m.description) + '</p>' : '') +
        '<div class="md-stat-grid">' +
        stat('上下文窗口', fmtNumFull(lim.context)) +
        stat('最大输出', fmtNumFull(lim.output)) +
        stat('输入模态', fmtMods(mods.input)) +
        stat('输出模态', fmtMods(mods.output)) +
        stat('知识截止', m.knowledge || '—') +
        stat('发布时间', m.release_date || '—') +
        '</div>' +
        (badges(m) ? '<div class="md-badges">' + badges(m) + '</div>' : '') +
        '<div class="md-prov-list">' + provRows + '</div>' +
        '</article>';
    }).join('');
  }

  var timer = null;
  $input.addEventListener('input', function () {
    clearTimeout(timer);
    timer = setTimeout(function () { render(search($input.value), $input.value); }, 180);
  });

  function setStatus(t) { $status.textContent = t; }

  async function init() {
    var meta = null;
    try {
      var r = await fetch(META_URL, { cache: 'no-store' });
      if (r.ok) meta = await r.json();
    } catch (e) { /* 忽略 */ }
    var ver = (meta && meta.updated_at) || 'unknown';
    $date.textContent = ver.slice(0, 10);
    try {
      var ir = await fetch(ICONS_URL, { cache: 'no-store' });
      if (ir.ok) ICON_MAP = await ir.json();
    } catch (e) { /* 无图标映射就用默认占位 */ }

    var KEY = 'modellookup_' + ver;
    var data = null;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { /* 缓存不可用则重新拉取 */ }
    if (!data) {
      try {
        setStatus('首次加载模型库（约 6MB，请稍候）…');
        var dr = await fetch(DATA_URL);
        if (!dr.ok) throw new Error('HTTP ' + dr.status);
        data = await dr.json();
        try {
          localStorage.setItem(KEY, JSON.stringify(data));
          // 清理旧版本缓存
          for (var i = localStorage.length - 1; i >= 0; i--) {
            var k = localStorage.key(i);
            if (k && k.indexOf('modellookup_') === 0 && k !== KEY) localStorage.removeItem(k);
          }
        } catch (e) { /* 配额不足就只放内存 */ }
      } catch (e) {
        setStatus('模型库加载失败，请检查网络后刷新重试');
        return;
      }
    }
    buildIndex(data);
    setStatus('模型库已就绪（' + index.length + ' 个条目，数据更新于 ' + ver.slice(0, 10) + '）');
    if ($input.value.trim()) render(search($input.value), $input.value);
  }

  init();
})();
