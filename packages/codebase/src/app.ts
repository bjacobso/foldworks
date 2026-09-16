export const appHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <title>Codebase</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f5f6f8; --panel: #fff; --panel-2: #f8f9fb; --text: #1b1d21;
      --muted: #6c717b; --border: #e1e4e9; --accent: #315ee7; --accent-soft: #edf2ff;
      --green: #157f3d; --green-bg: #eaf8ef; --red: #b4232e; --red-bg: #fff0f1;
      --amber: #9a6000; --shadow: 0 1px 2px rgba(20, 24, 32, .04), 0 8px 30px rgba(20, 24, 32, .05);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root { color-scheme: dark; --bg: #111317; --panel: #181b20; --panel-2: #1d2026; --text: #eef0f4; --muted: #9aa0aa; --border: #2c3038; --accent: #84a2ff; --accent-soft: #202b4a; --green: #6bd28d; --green-bg: #14291c; --red: #ff8790; --red-bg: #351a1e; --amber: #f0bd61; --shadow: none; }
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body { margin: 0; overflow: hidden; background: var(--bg); color: var(--text); font: 13px/1.5 var(--sans); }
    button, input { font: inherit; }
    button { color: inherit; }
    .app { display: grid; grid-template-rows: 52px minmax(0,1fr); height: 100%; }
    .topbar { display: flex; align-items: center; gap: 14px; padding: 0 16px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--panel) 92%, transparent); backdrop-filter: blur(14px); }
    .brand { display: flex; align-items: center; gap: 9px; min-width: 238px; font-weight: 680; letter-spacing: -.01em; }
    .mark { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 8px; background: var(--text); color: var(--panel); font: 700 14px var(--mono); }
    .repo-meta { display: flex; align-items: center; gap: 8px; color: var(--muted); }
    .pill { padding: 3px 8px; border: 1px solid var(--border); border-radius: 999px; background: var(--panel-2); font: 11px var(--mono); }
    .live { display: inline-flex; align-items: center; gap: 6px; margin-left: auto; color: var(--muted); font-size: 12px; }
    .live::before { content: ""; width: 7px; height: 7px; border-radius: 50%; background: #25a65a; box-shadow: 0 0 0 3px color-mix(in srgb, #25a65a 16%, transparent); }
    .shell { min-height: 0; display: grid; grid-template-columns: 270px minmax(420px,1fr) 260px; }
    .sidebar, .inspector { min-height: 0; overflow: auto; background: var(--panel); }
    .sidebar { border-right: 1px solid var(--border); padding: 12px; }
    .inspector { border-left: 1px solid var(--border); padding: 16px; }
    .search { width: 100%; height: 34px; border: 1px solid var(--border); border-radius: 9px; padding: 0 10px; outline: none; background: var(--panel-2); color: var(--text); }
    .search:focus { border-color: var(--accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 15%, transparent); }
    .switcher { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px; padding: 3px; margin: 10px 0 14px; border-radius: 9px; background: var(--panel-2); }
    .switcher button, .tabs button { border: 0; background: transparent; border-radius: 7px; padding: 6px 8px; cursor: pointer; color: var(--muted); }
    .switcher button.active { background: var(--panel); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .section-title { margin: 15px 5px 6px; color: var(--muted); font-size: 11px; font-weight: 650; letter-spacing: .06em; text-transform: uppercase; }
    .nav-list { display: flex; flex-direction: column; gap: 2px; }
    .nav-item { display: grid; grid-template-columns: 18px minmax(0,1fr) auto; gap: 6px; align-items: center; width: 100%; min-height: 31px; padding: 5px 7px; border: 0; border-radius: 7px; background: transparent; text-align: left; cursor: pointer; }
    .nav-item:hover { background: var(--panel-2); }
    .nav-item.active { background: var(--accent-soft); color: var(--accent); }
    .nav-icon { color: var(--muted); font-family: var(--mono); }
    .nav-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .count { color: var(--muted); font-size: 11px; }
    .main { min-width: 0; min-height: 0; overflow: auto; }
    .main-header { position: sticky; z-index: 3; top: 0; display: flex; align-items: center; min-height: 49px; padding: 0 20px; border-bottom: 1px solid var(--border); background: color-mix(in srgb, var(--panel) 94%, transparent); backdrop-filter: blur(12px); }
    .breadcrumbs { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 12px var(--mono); }
    .tabs { display: flex; gap: 2px; margin-left: auto; }
    .tabs button.active { background: var(--accent-soft); color: var(--accent); }
    .diff-switch { display: inline-flex; gap: 3px; margin-bottom: 12px; padding: 3px; border: 1px solid var(--border); border-radius: 9px; background: var(--panel-2); }
    .diff-switch button { border: 0; border-radius: 6px; padding: 5px 10px; background: transparent; color: var(--muted); cursor: pointer; }
    .diff-switch button.active { background: var(--panel); color: var(--text); box-shadow: 0 1px 3px rgba(0,0,0,.08); }
    .content { max-width: 1040px; margin: 0 auto; padding: 28px 34px 70px; }
    .empty { display: grid; place-items: center; min-height: 60vh; color: var(--muted); text-align: center; }
    .empty strong { display: block; margin-bottom: 5px; color: var(--text); font-size: 16px; }
    .loading { opacity: .7; }
    .markdown { max-width: 780px; font-size: 14px; line-height: 1.7; }
    .markdown h1 { margin: 0 0 20px; font-size: 30px; letter-spacing: -.035em; }
    .markdown h2 { margin: 34px 0 12px; padding-bottom: 7px; border-bottom: 1px solid var(--border); font-size: 20px; letter-spacing: -.02em; }
    .markdown h3 { margin: 26px 0 9px; font-size: 16px; }
    .markdown p { margin: 10px 0; }
    .markdown a { color: var(--accent); }
    .markdown code { padding: 2px 5px; border-radius: 5px; background: var(--panel-2); font: 12px var(--mono); }
    .markdown pre { overflow: auto; padding: 15px; border: 1px solid var(--border); border-radius: 10px; background: var(--panel-2); }
    .markdown pre code { padding: 0; background: transparent; }
    .markdown blockquote { margin: 16px 0; padding-left: 14px; border-left: 3px solid var(--accent); color: var(--muted); }
    .markdown li { margin: 4px 0; }
    .code-card { overflow: hidden; border: 1px solid var(--border); border-radius: 11px; background: var(--panel); box-shadow: var(--shadow); }
    .code-meta { display: flex; justify-content: space-between; padding: 8px 13px; border-bottom: 1px solid var(--border); background: var(--panel-2); color: var(--muted); font: 11px var(--mono); }
    .code { overflow: auto; margin: 0; padding: 10px 0 18px; font: 12px/1.65 var(--mono); tab-size: 2; }
    .line { display: grid; grid-template-columns: 50px minmax(max-content,1fr); min-height: 20px; padding-right: 16px; }
    .ln { position: sticky; left: 0; padding-right: 13px; background: var(--panel); color: color-mix(in srgb, var(--muted) 65%, transparent); text-align: right; user-select: none; }
    .lc { padding-left: 13px; white-space: pre; }
    .diff .line { grid-template-columns: 64px minmax(max-content,1fr); }
    .diff .add { background: var(--green-bg); color: var(--green); }
    .diff .del { background: var(--red-bg); color: var(--red); }
    .diff .hunk { background: var(--accent-soft); color: var(--accent); }
    .diff .file { margin-top: 12px; border-top: 1px solid var(--border); background: var(--panel-2); font-weight: 650; }
    .diff .add .ln, .diff .del .ln, .diff .hunk .ln, .diff .file .ln { background: transparent; }
    .history { display: flex; flex-direction: column; }
    .commit { display: grid; grid-template-columns: 80px minmax(0,1fr) auto; gap: 14px; padding: 13px 4px; border-bottom: 1px solid var(--border); }
    .hash { color: var(--accent); font: 12px var(--mono); }
    .subject { font-weight: 540; }
    .byline, .date { color: var(--muted); font-size: 12px; }
    .inspector h2 { margin: 0 0 4px; font-size: 16px; }
    .inspector h3 { margin: 22px 0 8px; color: var(--muted); font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
    .inspector p { margin: 5px 0; color: var(--muted); }
    .fact { display: flex; justify-content: space-between; gap: 14px; padding: 7px 0; border-bottom: 1px solid var(--border); }
    .fact span:last-child { min-width: 0; overflow-wrap: anywhere; text-align: right; font-family: var(--mono); }
    .chip-list { display: flex; flex-wrap: wrap; gap: 5px; }
    .chip { max-width: 100%; overflow: hidden; text-overflow: ellipsis; padding: 3px 7px; border-radius: 6px; background: var(--panel-2); color: var(--muted); font: 11px var(--mono); }
    .change-kind { width: 17px; text-align: center; color: var(--amber); font: 650 11px var(--mono); }
    .error { padding: 14px; border: 1px solid color-mix(in srgb, var(--red) 35%, var(--border)); border-radius: 9px; background: var(--red-bg); color: var(--red); }
    @media (max-width: 980px) { .shell { grid-template-columns: 240px minmax(0,1fr); } .inspector { display: none; } }
    @media (max-width: 680px) { .shell { grid-template-columns: 1fr; } .sidebar { display: none; } .brand { min-width: 0; } .repo-meta .pill:first-child { display: none; } .content { padding: 22px 16px 60px; } }
  </style>
</head>
<body>
  <div class="app">
    <header class="topbar">
      <div class="brand"><span class="mark">⌘</span><span id="title">Codebase</span></div>
      <div class="repo-meta"><span class="pill" id="branch">loading</span><span class="pill" id="head">…</span></div>
      <div class="live" id="live">Live</div>
    </header>
    <div class="shell">
      <aside class="sidebar">
        <input class="search" id="search" type="search" placeholder="Search the repository…" aria-label="Search repository">
        <div class="switcher" id="switcher">
          <button class="active" data-nav="packages">Packages</button>
          <button data-nav="files">Files</button>
          <button data-nav="changes">Changes</button>
        </div>
        <div id="navigation" class="loading">Loading repository…</div>
      </aside>
      <main class="main">
        <div class="main-header"><div class="breadcrumbs" id="breadcrumbs">Repository overview</div><div class="tabs" id="tabs"></div></div>
        <div class="content" id="content"><div class="empty">Loading the codebase…</div></div>
      </main>
      <aside class="inspector" id="inspector"></aside>
    </div>
  </div>
  <script>
    (function () {
      var state = { snapshot: null, nav: 'packages', selectedPath: 'README.md', selectedPackage: null, tab: 'overview', scope: 'unstaged', query: '' };
      var navigation = document.getElementById('navigation');
      var content = document.getElementById('content');
      var inspector = document.getElementById('inspector');
      var tabs = document.getElementById('tabs');
      var breadcrumbs = document.getElementById('breadcrumbs');
      var escapeHtml = function (value) { return String(value).replace(/[&<>"']/g, function (c) { return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); };
      var api = async function (path) { var response = await fetch(path); var body = await response.json(); if (!response.ok) throw new Error(body.error || 'Request failed'); return body; };
      var iconFor = function (path) { if (/\.md$/i.test(path)) return '¶'; if (/package\.json$/.test(path)) return '{}'; if (/\.(ts|tsx|js|jsx|mjs)$/.test(path)) return '◇'; if (/\.(css|scss)$/.test(path)) return '#'; return '·'; };
      var kindLetter = function (kind) { return ({added:'A',copied:'C',deleted:'D',modified:'M',renamed:'R','type-changed':'T',unmerged:'U',unknown:'?'})[kind] || '?'; };
      var formatDate = function (value) { try { return new Intl.DateTimeFormat(undefined, {dateStyle:'medium'}).format(new Date(value)); } catch (_) { return value; } };
      var markdownPath = '';
      var resolveMarkdownLink = function (target) {
        if (/^https?:\/\//i.test(target)) return target;
        var clean = target.split('#')[0].split('?')[0]; if (!clean) return '#';
        var base = markdownPath.includes('/') ? markdownPath.slice(0, markdownPath.lastIndexOf('/') + 1) : '';
        var parts = (clean.startsWith('/') ? clean.slice(1) : base + clean).split('/'); var normalized = [];
        parts.forEach(function (part) { if (!part || part === '.') return; if (part === '..') normalized.pop(); else normalized.push(part); });
        var path = normalized.join('/'); var pkg = state.snapshot && state.snapshot.packages.find(function (item) { return item.path === path; });
        if (pkg) return '#package=' + encodeURIComponent(path);
        if (state.snapshot && state.snapshot.files.includes(path)) return '#file=' + encodeURIComponent(path);
        if (state.snapshot && state.snapshot.files.includes(path + '/README.md')) return '#file=' + encodeURIComponent(path + '/README.md');
        return '#file=' + encodeURIComponent(path);
      };
      var inlineMarkdown = function (value) {
        return escapeHtml(value)
          .replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')
          .replace(/\[([^\]]+)\]\(([^\s)]+)\)/g, function (_match, label, target) { var href = resolveMarkdownLink(target); var external = /^https?:\/\//i.test(href); return '<a href="' + href + '"' + (external ? ' target="_blank" rel="noreferrer"' : '') + '>' + label + '</a>'; });
      };
      var markdown = function (text, path) {
        markdownPath = path; var lines = text.replace(/\r\n/g, '\n').split('\n'); var html = []; var inCode = false; var list = null; var listItems = []; var paragraph = [];
        var closeParagraph = function () { if (paragraph.length) { html.push('<p>' + inlineMarkdown(paragraph.join(' ')) + '</p>'); paragraph = []; } };
        var closeList = function () { if (list) { html.push('<' + list + '>' + listItems.map(function (item) { return '<li>' + inlineMarkdown(item) + '</li>'; }).join('') + '</' + list + '>'); list = null; listItems = []; } };
        lines.forEach(function (line) {
          if (/^\x60\x60\x60/.test(line)) { closeParagraph(); closeList(); inCode = !inCode; html.push(inCode ? '<pre><code>' : '</code></pre>'); return; }
          if (inCode) { html.push(escapeHtml(line) + '\n'); return; }
          var heading = /^(#{1,3})\s+(.+)$/.exec(line); if (heading) { closeParagraph(); closeList(); var level = heading[1].length; html.push('<h' + level + '>' + inlineMarkdown(heading[2]) + '</h' + level + '>'); return; }
          var bullet = /^\s*[-*]\s+(.+)$/.exec(line); if (bullet) { closeParagraph(); if (list !== 'ul') { closeList(); list = 'ul'; } listItems.push(bullet[1]); return; }
          var numbered = /^\s*\d+[.)]\s+(.+)$/.exec(line); if (numbered) { closeParagraph(); if (list !== 'ol') { closeList(); list = 'ol'; } listItems.push(numbered[1]); return; }
          if (list && /^\s{2,}\S/.test(line) && listItems.length) { listItems[listItems.length - 1] += ' ' + line.trim(); return; }
          if (!line.trim()) { closeParagraph(); closeList(); return; }
          closeList();
          if (/^>\s?/.test(line)) { closeParagraph(); html.push('<blockquote>' + inlineMarkdown(line.replace(/^>\s?/, '')) + '</blockquote>'); }
          else if (/^---+$/.test(line)) { closeParagraph(); html.push('<hr>'); }
          else paragraph.push(line.trim());
        }); closeParagraph(); closeList(); if (inCode) html.push('</code></pre>'); markdownPath = ''; return html.join('');
      };
      var codeLines = function (text) { return text.split('\n').map(function (line, index) { return '<span class="line"><span class="ln">' + (index + 1) + '</span><span class="lc">' + (line ? escapeHtml(line) : ' ') + '</span></span>'; }).join(''); };
      var diffLines = function (text) {
        if (!text) return '<div class="empty"><div><strong>No changes here</strong>The selected diff is clean.</div></div>';
        return text.split('\n').map(function (line, index) { var type = line.startsWith('diff --git') ? 'file' : line.startsWith('@@') ? 'hunk' : line.startsWith('+') && !line.startsWith('+++') ? 'add' : line.startsWith('-') && !line.startsWith('---') ? 'del' : ''; return '<span class="line ' + type + '"><span class="ln">' + (index + 1) + '</span><span class="lc">' + (line ? escapeHtml(line) : ' ') + '</span></span>'; }).join('');
      };
      var activePackage = function () { if (!state.snapshot) return null; return state.snapshot.packages.find(function (item) { return item.path === state.selectedPackage; }) || null; };
      var matches = function (value) { return !state.query || value.toLowerCase().includes(state.query.toLowerCase()); };
      var renderNavigation = function () {
        if (!state.snapshot) return; var html = [];
        if (state.nav === 'packages') {
          html.push('<div class="section-title">Workspace packages</div><div class="nav-list">');
          state.snapshot.packages.filter(function (item) { return matches(item.name + ' ' + item.path); }).forEach(function (item) { html.push('<button class="nav-item ' + (state.selectedPackage === item.path ? 'active' : '') + '" data-package="' + escapeHtml(item.path) + '"><span class="nav-icon">□</span><span class="nav-label">' + escapeHtml(item.name) + '</span></button>'); }); html.push('</div>');
          html.push('<div class="section-title">Documentation</div><div class="nav-list">'); state.snapshot.documents.filter(function (item) { return matches(item.title + ' ' + item.path); }).slice(0, 80).forEach(function (item) { html.push('<button class="nav-item ' + (state.selectedPath === item.path ? 'active' : '') + '" data-file="' + escapeHtml(item.path) + '"><span class="nav-icon">¶</span><span class="nav-label">' + escapeHtml(item.title) + '</span></button>'); }); html.push('</div>');
        } else if (state.nav === 'files') {
          html.push('<div class="section-title">Repository files · ' + state.snapshot.files.length + '</div><div class="nav-list">'); state.snapshot.files.filter(matches).slice(0, 300).forEach(function (path) { html.push('<button class="nav-item ' + (state.selectedPath === path ? 'active' : '') + '" data-file="' + escapeHtml(path) + '"><span class="nav-icon">' + iconFor(path) + '</span><span class="nav-label">' + escapeHtml(path) + '</span></button>'); }); html.push('</div>');
        } else {
          ['staged','unstaged','untracked'].forEach(function (group) { var entries = state.snapshot.changes.filter(function (change) { return change.state === group && matches(change.path); }); html.push('<div class="section-title">' + group + ' · ' + entries.length + '</div><div class="nav-list">'); entries.forEach(function (change) { var scope = group === 'staged' ? 'staged' : group === 'untracked' ? 'source' : 'unstaged'; html.push('<button class="nav-item ' + (state.selectedPath === change.path && (state.tab === 'changes' || scope === 'source') ? 'active' : '') + '" data-change="' + escapeHtml(change.path) + '" data-scope="' + scope + '"><span class="change-kind">' + kindLetter(change.kind) + '</span><span class="nav-label">' + escapeHtml(change.path) + '</span></button>'); }); html.push('</div>'); });
        }
        navigation.classList.remove('loading'); navigation.innerHTML = html.join('');
      };
      var renderTabs = function () {
        var items = state.selectedPackage !== null ? [['overview','Overview'],['source','Source'],['changes','Changes'],['history','History']] : [['source','Source'],['changes','Changes'],['history','History']];
        tabs.innerHTML = items.map(function (item) { return '<button data-tab="' + item[0] + '" class="' + (state.tab === item[0] ? 'active' : '') + '">' + item[1] + '</button>'; }).join('');
      };
      var renderInspector = function () {
        if (!state.snapshot) return; var pkg = activePackage(); var selectedChanges = state.snapshot.changes.filter(function (item) { return item.path === state.selectedPath; });
        var html = '<h2>' + escapeHtml(pkg ? pkg.name : state.selectedPath || state.snapshot.title) + '</h2>';
        if (pkg && pkg.description) html += '<p>' + escapeHtml(pkg.description) + '</p>';
        html += '<h3>Repository</h3><div class="fact"><span>Branch</span><span>' + escapeHtml(state.snapshot.branch) + '</span></div><div class="fact"><span>Revision</span><span>' + escapeHtml(state.snapshot.head) + '</span></div><div class="fact"><span>Base</span><span>' + escapeHtml(state.snapshot.baseRef) + '</span></div>';
        if (selectedChanges.length) html += '<h3>Working tree</h3><div class="chip-list">' + selectedChanges.map(function (item) { return '<span class="chip">' + item.state + ' · ' + item.kind + '</span>'; }).join('') + '</div>';
        if (pkg) { var docs = state.snapshot.documents.filter(function (item) { return item.packagePath === pkg.path; }); html += '<h3>Package</h3><div class="fact"><span>Path</span><span>' + escapeHtml(pkg.path || '.') + '</span></div><div class="fact"><span>Version</span><span>' + escapeHtml(pkg.version || 'private') + '</span></div><div class="fact"><span>Docs</span><span>' + docs.length + '</span></div><h3>Dependencies</h3><div class="chip-list">' + (pkg.dependencies.length ? pkg.dependencies.map(function (item) { return '<span class="chip">' + escapeHtml(item) + '</span>'; }).join('') : '<span class="chip">None</span>') + '</div>'; }
        inspector.innerHTML = html;
      };
      var showError = function (error) { content.innerHTML = '<div class="error">' + escapeHtml(error instanceof Error ? error.message : String(error)) + '</div>'; };
      var renderContent = async function () {
        if (!state.snapshot) return; renderTabs(); renderInspector(); var pkg = activePackage(); var path = state.selectedPath;
        if (pkg && (state.tab === 'overview' || state.tab === 'source')) path = pkg.readme || (pkg.path ? pkg.path + '/package.json' : 'package.json');
        else if (pkg) path = pkg.path || undefined;
        breadcrumbs.textContent = pkg ? pkg.name + ' / ' + state.tab : (path || 'Repository') + ' / ' + state.tab;
        content.innerHTML = '<div class="empty loading">Loading…</div>';
        try {
          if (state.tab === 'changes') {
            var diff = await api('/api/diff?scope=' + encodeURIComponent(state.scope) + (path ? '&path=' + encodeURIComponent(path) : ''));
            var scopeSwitch = '<div class="diff-switch" aria-label="Diff scope"><button data-scope-choice="unstaged" class="' + (state.scope === 'unstaged' ? 'active' : '') + '">Unstaged</button><button data-scope-choice="staged" class="' + (state.scope === 'staged' ? 'active' : '') + '">Staged</button><button data-scope-choice="branch" class="' + (state.scope === 'branch' ? 'active' : '') + '">Branch</button></div>';
            content.innerHTML = scopeSwitch + '<div class="code-card"><div class="code-meta"><span>' + escapeHtml(diff.scope + (diff.path ? ' · ' + diff.path : '')) + '</span><span>base ' + escapeHtml(diff.baseRef) + '</span></div><pre class="code diff">' + diffLines(diff.text) + '</pre></div>'; return;
          }
          if (state.tab === 'history') {
            var commits = await api('/api/history' + (path ? '?path=' + encodeURIComponent(path) : ''));
            content.innerHTML = commits.length ? '<div class="history">' + commits.map(function (commit) { return '<div class="commit"><span class="hash">' + escapeHtml(commit.shortHash) + '</span><div><div class="subject">' + escapeHtml(commit.subject) + '</div><div class="byline">' + escapeHtml(commit.author) + '</div></div><span class="date">' + escapeHtml(formatDate(commit.authoredAt)) + '</span></div>'; }).join('') + '</div>' : '<div class="empty"><div><strong>No history found</strong>This file may be untracked.</div></div>'; return;
          }
          if (!path) { content.innerHTML = '<div class="empty"><div><strong>Select something to explore</strong>Choose a package, document, or source file.</div></div>'; return; }
          var file = await api('/api/file?path=' + encodeURIComponent(path));
          if (state.tab === 'overview' && file.language === 'markdown' || state.selectedPackage === null && file.language === 'markdown' && state.tab === 'source') content.innerHTML = '<article class="markdown">' + markdown(file.text, file.path) + '</article>';
          else content.innerHTML = '<div class="code-card"><div class="code-meta"><span>' + escapeHtml(file.path) + '</span><span>' + escapeHtml(file.language) + ' · ' + file.size.toLocaleString() + ' bytes</span></div><pre class="code">' + codeLines(file.text) + '</pre></div>';
        } catch (error) { showError(error); }
      };
      var selectFile = function (path) { state.selectedPath = path; state.selectedPackage = null; state.tab = 'source'; location.hash = 'file=' + encodeURIComponent(path); renderNavigation(); void renderContent(); };
      var selectPackage = function (path) { var pkg = state.snapshot.packages.find(function (item) { return item.path === path; }); state.selectedPackage = path; state.selectedPath = pkg && pkg.readme ? pkg.readme : (path ? path + '/package.json' : 'package.json'); state.tab = 'overview'; location.hash = 'package=' + encodeURIComponent(path); renderNavigation(); void renderContent(); };
      document.addEventListener('click', function (event) { var target = event.target.closest('button'); if (!target) return;
        if (target.dataset.nav) { state.nav = target.dataset.nav; document.querySelectorAll('[data-nav]').forEach(function (node) { node.classList.toggle('active', node.dataset.nav === state.nav); }); renderNavigation(); }
        else if (target.dataset.package !== undefined) selectPackage(target.dataset.package);
        else if (target.dataset.file) selectFile(target.dataset.file);
        else if (target.dataset.change) { if (target.dataset.scope === 'source') selectFile(target.dataset.change); else { state.selectedPath = target.dataset.change; state.selectedPackage = null; state.scope = target.dataset.scope || 'unstaged'; state.tab = 'changes'; renderNavigation(); void renderContent(); } }
        else if (target.dataset.tab) { state.tab = target.dataset.tab; void renderContent(); }
        else if (target.dataset.scopeChoice) { state.scope = target.dataset.scopeChoice; void renderContent(); }
      });
      document.getElementById('search').addEventListener('input', function (event) { state.query = event.target.value; renderNavigation(); });
      var applyHash = function () { var hash = decodeURIComponent(location.hash.slice(1)); if (hash.startsWith('file=')) { state.selectedPath = hash.slice(5); state.selectedPackage = null; state.tab = 'source'; } else if (hash.startsWith('package=')) { state.selectedPackage = hash.slice(8); state.tab = 'overview'; } };
      var load = async function (refreshOnly) { try { state.snapshot = await api('/api/snapshot'); applyHash(); document.title = state.snapshot.title + ' · Codebase'; document.getElementById('title').textContent = state.snapshot.title; document.getElementById('branch').textContent = state.snapshot.branch; document.getElementById('head').textContent = state.snapshot.head; renderNavigation(); if (!refreshOnly) await renderContent(); else renderInspector(); } catch (error) { showError(error); } };
      window.addEventListener('hashchange', function () { applyHash(); renderNavigation(); void renderContent(); });
      var events = new EventSource('/api/events'); events.addEventListener('change', function () { document.getElementById('live').textContent = 'Refreshing'; window.clearTimeout(state.refreshTimer); state.refreshTimer = window.setTimeout(function () { void load(true).finally(function () { document.getElementById('live').textContent = 'Live'; }); }, 180); }); events.onerror = function () { document.getElementById('live').textContent = 'Reconnecting'; };
      void load(false);
    }());
  </script>
</body>
</html>`;
