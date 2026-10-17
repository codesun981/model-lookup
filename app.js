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
  var timelineGroups = [];
  var curTab = 'search';
  var lastQuery = '';
  var curPage = 1;
  var LAB_ALIAS = {qwen:'alibaba', mistralai:'mistral', 'deepseek-ai':'deepseek', 'z-ai':'zhipuai', 'zai-org':'zhipuai', 'meta-llama':'meta', 'x-ai':'xai'};
  var LABS = [
    ['openai','OpenAI','GPT 系列，推理、代码、多模态与 agent 应用的生产级标准'],
    ['alibaba','阿里巴巴','Qwen 系：开源与托管的多语言模型，覆盖推理、代码、视觉、音频'],
    ['google','Google','Gemini 与 Gemma：前沿多模态推理 + 长上下文 + 开源选项'],
    ['mistral','Mistral','开源权重研究 + 企业级部署，代码 agent 与文档智能'],
    ['anthropic','Anthropic','Claude：可靠、可解释、可操控，擅长代码与长程 agent'],
    ['nvidia','NVIDIA','Nemotron：开放权重，推理、RAG、安全与多模态 agent'],
    ['deepseek','DeepSeek','高性价比的开源推理模型，代码数学强'],
    ['zhipuai','智谱','GLM：长时 coding、终端任务、混合推理，价格激进'],
    ['xai','xAI','Grok：工具调用、低幻觉推理、代码与媒体 API'],
    ['meta','Meta','Llama：开放权重，多语言多模态，可定制'],
    ['tencent','腾讯','混元：大 MoE，推理、代码、长上下文'],
    ['minimax','MiniMax','代码 agent、办公与多模态，偏实用生产力'],
    ['moonshotai','月之暗面','Kimi：长上下文 agent'],
    ['perplexity','Perplexity','Sonar：搜索即模型能力，带引用回答'],
    ['cohere','Cohere','企业级 AI：多语言、RAG、安全 agent'],
    ['xiaomi','小米','MiMo：代码 agent 与真实世界自动化'],
    ['poolside','Poolside','开放权重基础模型'],
    ['sakana','Sakana AI','模型路由，多 agent 系统'],
    ['reflection','Reflection','开放智能，稀疏 MoE'],
    ['stepfun','阶跃星辰','Step：快速多模态 agent'],
    ['vispark','Vispark','面向印度的多模态基础模型，1M 上下文'],
    ['arcee-ai','Arcee AI','开放权重语言模型，高效推理']
  ];
  var LAB_ICON = {sakana:'icons/sakana-color.svg'};
  var curLab = '';
  var listHeadHtml = '';
  function labIcon(id) { return LAB_ICON[id] || ('icons/' + id + '.svg'); }
  var LAB_BRAND = [['qwen','alibaba'],['deepseek','deepseek'],['claude','anthropic'],['gemini','google'],['gemma','google'],
    ['gpt','openai'],['chatgpt','openai'],['llama','meta'],['mistral','mistral'],['mixtral','mistral'],['ministral','mistral'],
    ['grok','xai'],['kimi','moonshotai'],['glm','zhipuai'],['hunyuan','tencent'],['minimax','minimax'],['nemotron','nvidia'],
    ['sonar','perplexity'],['cohere','cohere'],['sakana','sakana'],['reflection','reflection'],['arcee','arcee-ai'],
    ['stepfun','stepfun'],['vispark','vispark'],['poolside','poolside'],['xiaomi','xiaomi']];
  function labOf(e) {
    var mid = e.id || '', pre = mid.indexOf('/') !== -1 ? mid.split('/')[0].toLowerCase() : '';
    pre = LAB_ALIAS[pre] || pre;
    for (var i = 0; i < LABS.length; i++) if (LABS[i][0] === pre) return pre;
    var n = ' ' + (e.norm || '') + ' ';
    for (var j = 0; j < LAB_BRAND.length; j++) {
      if (n.indexOf(' ' + LAB_BRAND[j][0] + ' ') !== -1) return LAB_BRAND[j][1];
    }
    return '';
  }
  function labGroups(lab) {
    var groups = new Map();
    index.forEach(function (e) {
      if (lab && labOf(e) !== lab) return;
      var g = groups.get(e.norm);
      if (!g) { g = { entries: [], best: 0, latest: '' }; groups.set(e.norm, g); }
      g.entries.push([0, e]);
      var rd = e.m.release_date || '';
      if (rd > g.latest) g.latest = rd;
    });
    var arr = Array.from(groups.values());
    arr.sort(function (a, b) { return (b.latest < a.latest ? -1 : b.latest > a.latest ? 1 : 0); });
    return arr;
  }
  function labHead(id) {
    if (!id) return '';
    var L = null;
    for (var i = 0; i < LABS.length; i++) if (LABS[i][0] === id) L = LABS[i];
    if (!L) return '';
    var n = labGroups(id).length;
    return '<div class="md-lab-head"><img class="md-card-icon" src="' + labIcon(id) + '" alt="" onerror="this.style.display=\'none\'">' +
      '<div><div class="md-lab-name">' + esc(L[1]) + ' <span style="color:#9aa0a6;font-weight:400;font-size:.78rem">' + n + ' 个模型</span></div>' +
      '<div class="md-lab-desc">' + esc(L[2]) + '</div></div>' +
      '<button class="md-lab-clear" data-clearlab="1">× 清除</button></div>';
  }
  function buildLabChips() {
    var el = document.getElementById('lab-row');
    if (!el) return;
    var html = '<button class="md-lab-chip md-lab-active" data-lab="">全部</button>';
    LABS.forEach(function (L) {
      html += '<button class="md-lab-chip" data-lab="' + L[0] + '"><img src="' + labIcon(L[0]) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' + esc(L[1]) + '</button>';
    });
    el.innerHTML = html;
    clampLabs();
  }
  function clampLabs() {
    var el = document.getElementById('lab-row');
    var t = document.getElementById('lab-toggle');
    if (!el || !t) return;
    el.classList.add('md-collapsed');
    var tops = [], last = -1;
    for (var i = 0; i < el.children.length; i++) {
      var tp = el.children[i].offsetTop;
      if (tp !== last) { tops.push(tp); last = tp; }
      if (tops.length === 2) break;
    }
    if (tops.length < 2) {
      el.classList.remove('md-collapsed');
      el.style.removeProperty('--lab-clamp');
      t.style.display = 'none';
      return;
    }
    el.style.setProperty('--lab-clamp', Math.max(0, tops[1] - 1) + 'px');
    t.style.display = '';
    t.textContent = '\u5c55\u5f00\u5168\u90e8 \u2304';
  }
  function setLab(id) {
    curLab = id;
    var chips = document.querySelectorAll('.md-lab-chip');
    for (var i = 0; i < chips.length; i++) chips[i].classList.toggle('md-lab-active', chips[i].getAttribute('data-lab') === id);
    buildTimeline();
    listHeadHtml = labHead(id);
    if (curTab === 'timeline') { renderTimeline(); return; }
    var q = $input.value.trim();
    if (q) render(search(q), q);
    else if (id) render(labGroups(id), 'lab:' + id);
    else { listHeadHtml = ''; $results.innerHTML = '<p class="md-empty">输入模型名称开始搜索，或点选上方 lab 浏览该厂商模型</p>'; }
  }

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
    return ICON_MAP[pid] || 'icons/pomelo.svg';
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

  function localDay(offset) {
    var d = new Date(Date.now() + (offset || 0) * 864e5);
    var p = function (n) { return (n < 10 ? '0' : '') + n; };
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  }
  function buildTimeline() {
    var groups = new Map();
    index.forEach(function (e) {
      var g = groups.get(e.norm);
      if (!g) { g = { entries: [], latest: '', canon: e, providers: new Set(), labs: new Set() }; groups.set(e.norm, g); }
      g.entries.push(e);
      g.providers.add(e.provider);
      var lb0 = labOf(e);
      if (lb0) g.labs.add(lb0);
      var rd = e.m.release_date || '';
      if (rd > g.latest) g.latest = rd;
    });
    var cut = localDay(-30);
    timelineGroups = [];
    groups.forEach(function (g) {
      if (g.latest < cut) return;
      if (curLab && !g.labs.has(curLab)) return;
      timelineGroups.push(g);
    });
    timelineGroups.sort(function (a, b) { return b.latest < a.latest ? -1 : b.latest > a.latest ? 1 : 0; });
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
        var hay = (name + ' ' + mid + ' ' + pid + ' ' + pname).toLowerCase();
        index.push({
          name: name, id: mid, provider: pid, providerName: pname, doc: prov.doc || '',
          hay: hay,
          words: hay.split(/[^a-z0-9]+/).filter(function (w) { return w.length >= 4; }),
          nameLower: name.toLowerCase(),
          norm: normName(name),
          m: m
        });
      });
    });
  }

  var CN_ALIAS = {
    '智谱': 'glm', '豆包': 'doubao', '字节': 'doubao', '字节跳动': 'doubao',
    '阿里': 'qwen', '阿里巴巴': 'qwen', '通义': 'qwen', '通义千问': 'qwen',
    '月之暗面': 'kimi', '深度求索': 'deepseek', '幻方': 'deepseek',
    '腾讯': 'hunyuan', '混元': 'hunyuan',
    '百度': 'ernie', '文心': 'ernie', '文心一言': 'ernie',
    '华为': 'pangu', '盘古': 'pangu',
    '讯飞': 'spark', '星火': 'spark', '科大讯飞': 'spark',
    '百川': 'baichuan', '百川智能': 'baichuan',
    '零一万物': 'yi', '面壁': 'minicpm', '面壁智能': 'minicpm',
    '阶跃星辰': 'step', '跃问': 'step', '小米': 'mimo',
    '谷歌': 'gemini', '微软': 'phi', '英伟达': 'nemotron', '马斯克': 'grok',
    '思考': 'thinking', '推理': 'reasoning', '视觉': 'vision', '图像': 'vision'
  };
  var CN_KEYS = Object.keys(CN_ALIAS).sort(function (a, b) { return b.length - a.length; });
  function tokenAlts(t) {
    var alts = [t];
    for (var i = 0; i < CN_KEYS.length; i++) {
      if (t.indexOf(CN_KEYS[i]) !== -1) {
        var ex = CN_ALIAS[CN_KEYS[i]];
        if (alts.indexOf(ex) === -1) alts.push(ex);
        break;
      }
    }
    return alts;
  }
  function levBound(a, b, maxD) {
    var m = a.length, n = b.length;
    if (Math.abs(m - n) > maxD) return maxD + 1;
    var prev = new Array(n + 1), cur = new Array(n + 1), i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur[0] = i;
      var rowMin = i, ai = a.charCodeAt(i - 1);
      for (j = 1; j <= n; j++) {
        var cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
        var v = prev[j] + 1, v2 = cur[j - 1] + 1, v3 = prev[j - 1] + cost;
        if (v2 < v) v = v2;
        if (v3 < v) v = v3;
        cur[j] = v;
        if (v < rowMin) rowMin = v;
      }
      if (rowMin > maxD) return maxD + 1;
      var tmp = prev; prev = cur; cur = tmp;
    }
    return prev[n];
  }
  // 返回 {q: 2 精确 / 1 模糊 / 0 未命中, alt: 命中的词}
  function matchToken(e, alts) {
    var i, j;
    for (i = 0; i < alts.length; i++) {
      if (e.hay.indexOf(alts[i]) !== -1) return { q: 2, alt: alts[i] };
    }
    for (j = 0; j < alts.length; j++) {
      var t = alts[j];
      if (t.length < 4 || /[\u4e00-\u9fa5]/.test(t)) continue;
      var maxD = t.length <= 5 ? 1 : 2, words = e.words;
      for (var w = 0; w < words.length; w++) {
        var wd = words[w];
        if (Math.abs(wd.length - t.length) > maxD) continue;
        if (levBound(wd, t, maxD) <= maxD) return { q: 1, alt: t };
      }
    }
    return { q: 0, alt: '' };
  }
  function search(q) {
    var tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!tokens.length) return [];
    var tokAlts = tokens.map(tokenAlts);
    var groups = new Map();
    for (var i = 0; i < index.length; i++) {
      var e = index[i];
      if (curLab && labOf(e) !== curLab) continue;
      var gm = 0, em = 0, posB = 0, t, a;
      for (t = 0; t < tokAlts.length; t++) {
        var mr = matchToken(e, tokAlts[t]);
        if (mr.q > 0) {
          gm++;
          if (mr.q === 2) em++;
          var nl = e.nameLower;
          if (nl.indexOf(mr.alt) === 0) posB = Math.max(posB, 15);
          else if (nl.indexOf(mr.alt) !== -1) posB = Math.max(posB, 8);
        }
      }
      if (gm === 0) continue;
      var offB = 0, ph = (e.provider + ' ' + e.providerName).toLowerCase();
      for (t = 0; t < tokAlts.length && !offB; t++) {
        for (a = 0; a < tokAlts[t].length; a++) {
          if (ph.indexOf(tokAlts[t][a]) !== -1) { offB = 15; break; }
        }
      }
      var score = gm * 100 + em * 20 + posB + offB;
      var g = groups.get(e.norm);
      if (!g) { g = { entries: [], best: -1, latest: '' }; groups.set(e.norm, g); }
      g.entries.push([score, e]);
      if (score > g.best) g.best = score;
      var rd = e.m.release_date || '';
      if (rd > g.latest) g.latest = rd;
    }
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
  function renderTimeline() {
    clearPager();
    if (!timelineGroups.length) {
      $results.innerHTML = '<p class="md-empty">近 30 天暂无新模型发布</p>';
      return;
    }
    var today = localDay(0), yest = localDay(-1), html = '', lastDate = '', dayOpen = false;
    timelineGroups.forEach(function (g) {
      if (g.latest !== lastDate) {
        if (dayOpen) html += '</div></div>';
        lastDate = g.latest;
        var tag = lastDate === today ? '今天' : lastDate === yest ? '昨天' : lastDate.slice(5).replace('-', '/');
        html += '<div class="md-tl-day"><div class="md-tl-date"><i></i>' + esc(lastDate) + '<span>' + esc(tag) + '</span></div><div class="md-tl-pills">';
        dayOpen = true;
      }
      var e = g.canon;
      html += '<button class="md-tl-pill" data-norm="' + esc(e.norm) + '">' + imgTagTitle(e) +
        '<span>' + esc(e.name) + '</span></button>';
    });
    if (dayOpen) html += '</div></div>';
    $results.innerHTML = '<div class="md-tl-head">近 30 天新发布 <b>' + timelineGroups.length + '</b> 个模型</div>' + html;
  }
  function setTab(t) {
    curTab = t;
    var tabs = document.querySelectorAll('.md-tab');
    for (var i = 0; i < tabs.length; i++) {
      tabs[i].classList.toggle('md-tab-active', tabs[i].getAttribute('data-tab') === t);
    }
    if (t === 'timeline') { renderTimeline(); return; }
    listHeadHtml = labHead(curLab);
    if ($input.value.trim()) render(search($input.value), $input.value);
    else if (curLab) render(labGroups(curLab), 'lab:' + curLab);
    else $results.innerHTML = '<p class="md-empty">输入模型名称开始搜索，或点选上方 lab 浏览该厂商模型</p>';
  }

  function renderPage() {
    clearPager();
    if (!lastQuery.trim()) {
      $results.innerHTML = '<p class="md-empty">在上方输入关键词开始搜索</p>';
      return;
    }
    if (!lastGroups.length) {
      var sugHtml = '';
      var qt = lastQuery.trim();
      if (qt && qt.indexOf('lab:') !== 0) {
        var qtoks = qt.split(/\s+/).filter(Boolean);
        if (qtoks.length > 1) {
          var short = qtoks.slice(0, -1).join(' ');
          sugHtml = '<div style="text-align:center;margin-top:.9rem;"><button class="md-empty-sug" data-retry="' + esc(short) + '">试试只搜「' + esc(short) + '」</button></div>';
        } else {
          sugHtml = '<div style="text-align:center;margin-top:.9rem;font-size:.8rem;color:#9aa0a6">也可以点选上方 lab 按厂商浏览</div>';
        }
      }
      $results.innerHTML = '<p class="md-empty">没找到「' + esc(lastQuery) + '」，换个关键词试试</p>' + sugHtml;
      return;
    }
    var totalPages = Math.max(1, Math.ceil(lastGroups.length / PAGE_SIZE));
    if (curPage > totalPages) curPage = totalPages;
    var start = (curPage - 1) * PAGE_SIZE;
    $results.innerHTML = listHeadHtml + renderCards(lastGroups.slice(start, start + PAGE_SIZE));
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
    timer = setTimeout(function () {
      if (curTab !== 'search') setTab('search');
      render(search($input.value), $input.value);
    }, 180);
  });
  $results.addEventListener('click', function (ev) {
    if (ev.target.closest && ev.target.closest('[data-clearlab]')) { setLab(''); return; }
    var retry = ev.target.closest ? ev.target.closest('[data-retry]') : null;
    if (retry) {
      $input.value = retry.getAttribute('data-retry');
      render(search($input.value), $input.value);
      return;
    }
    var row = ev.target.closest ? ev.target.closest('.md-tl-pill') : null;
    if (!row || curTab !== 'timeline') return;
    var norm = row.getAttribute('data-norm');
    var g = null;
    for (var i = 0; i < timelineGroups.length; i++) {
      if (timelineGroups[i].canon.norm === norm) { g = timelineGroups[i]; break; }
    }
    if (!g) return;
    $input.value = g.canon.name;
    setTab('search');
  });
  document.querySelectorAll('.md-tab').forEach(function (btn) {
    btn.addEventListener('click', function () { setTab(btn.getAttribute('data-tab')); });
  });
  var labRow = document.getElementById('lab-row');
  if (labRow) labRow.addEventListener('click', function (ev) {
    var chip = ev.target.closest ? ev.target.closest('.md-lab-chip') : null;
    if (chip) setLab(chip.getAttribute('data-lab'));
  });
  var labToggle = document.getElementById('lab-toggle');
  if (labToggle) labToggle.addEventListener('click', function () {
    var el = document.getElementById('lab-row');
    if (!el) return;
    var collapsed = el.classList.toggle('md-collapsed');
    labToggle.textContent = collapsed ? '\u5c55\u5f00\u5168\u90e8 \u2304' : '\u6536\u8d77 \u2303';
  });
  var labRsz = null;
  window.addEventListener('resize', function () {
    if (labRsz) clearTimeout(labRsz);
    labRsz = setTimeout(function () {
      var el = document.getElementById('lab-row');
      if (el && el.classList.contains('md-collapsed')) clampLabs();
    }, 200);
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
    buildLabChips();
    buildTimeline();
    setStatus('模型库已就绪（' + index.length + ' 个条目，数据更新于 ' + ver.slice(0, 10) + '）');
    if ($input.value.trim()) render(search($input.value), $input.value);
  }

  init();
})();
