/* Trainer hub (practice.html): four tabs on one page.
 *   Browse    every problem we have: search, filter, open one (or the whole list) in the runner.
 *   Practice  untimed, instant feedback, the answer one tap away. Any problems you choose.
 *   Test      timed, no feedback until submit, then a review. Any problems you choose.
 *   Mock      a fixed AP-format exam: sections with their own timers, MCQ + free response.
 * Practice and Test share one setup form; a Mock has no setup because it is fixed on purpose. */
(async function () {
  'use strict';
  requireLogin();
  var ctx = ZPUI.resolveContext();
  var main = document.getElementById('zp-main');
  ZPUI.guard(main);
  var lo = document.getElementById('logout-btn'); if (lo) lo.addEventListener('click', logout);
  if (!ctx) return;
  var ZP = window.ZP, UI = window.ZPUI, CFG = window.ZP_CONFIG, esc = UI.esc;
  if (!ctx.course) { main.innerHTML = UI.emptyState('Trainer needs a course with problem banks', 'Available for AP Calculus BC and AP Chemistry.', '<a class="zp-btn primary" href="portal.html">Back to courses</a>'); return; }
  var cid = encodeURIComponent(ctx.course.id);
  var data, exams = {};
  try {
    data = await ZPBanks.load(ctx.course.id);
    exams = await fetch('data/mock-exams.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; });
  } catch (e) { main.innerHTML = UI.emptyState('Could not load the problem banks', esc(e.message)); return; }
  var store = ZP.open(ctx.student.username, ctx.course.id); await store.load();
  var info = data.info, D, ST, exam = exams[ctx.course.id] || null, running = null;
  function derive() { D = ZP.derive(store.events(), info); return D; }
  derive();
  var hasFRQ = data.problems.some(function (q) { return q.frq && !q.blocked; });
  var hasC = data.problems.some(function (q) { return q.kind === 'C' && !q.blocked; });
  var hasT = data.problems.some(function (q) { return q.kind === 'T' && !q.blocked; });
  var hasF = data.problems.some(function (q) { return q.kind === 'F' && !q.blocked; });
  // #mock:<id> / #set:<id> (from the chapter list, Today and Right Now) open that mock or fixed set directly.
  var launch = null;
  function parseHash() {
    var h = (location.hash || '#browse').slice(1), m = /^(mock|set):(.+)$/.exec(h);
    if (m) { launch = { t: m[1], id: decodeURIComponent(m[2]) }; h = m[1] === 'mock' ? 'mock' : 'practice'; } else launch = null;
    return ['browse', 'practice', 'test', 'mock'].indexOf(h) < 0 ? 'browse' : h;
  }
  var tab = parseHash();
  // `ret` (set by links from the course view or a chapter) is where Back / finish returns to; with a #mock / #set launch the page shows only
  // that run (no Practice tabs), so going back leads where the student came from instead of to the Practice page.
  var ret = (function () { var r = ctx.params.get('ret') || ''; return /^[a-z0-9-]+\.html(\?[\w=&%.\-]*)?(#[\w:\-]*)?$/i.test(r) ? r : ''; })();
  var retLabel = /^roadmap/.test(ret) ? 'Course' : /^chapter/.test(ret) ? 'Chapter' : /^mentor/.test(ret) ? 'Mentor' : 'Back';
  var focus = !!(ret && launch);
  function goBack() { if (ret) { location.href = ret; return; } render(); }
  var reqIds = {}; (info.curriculum && info.curriculum.exam ? info.curriculum.exam.items : []).concat(info.curriculum ? info.curriculum.checkpoints || [] : []).forEach(function (x) { reqIds[x.id] = 1; });
  // Class-track students take the three required full mocks from the course view (Chapter M); self-study students can also take them here.
  var selfStudy = true; try { if (typeof isSelfStudy_ === 'function') selfStudy = !!(await isSelfStudy_(ctx.student)); } catch (e) { selfStudy = true; }
  var courseOnly = {}; if (!selfStudy) Object.keys(reqIds).forEach(function (id) { if (/^mock\d+$/.test(id)) courseOnly[id] = 1; });
  function reqBadge(id) { return reqIds[id] && !selfStudy ? ' <span class="zp-badge warn">Required</span>' : ''; }

  /* ---------- saved setup (per mode) ---------- */
  var cfgKey = function (mode) { return 'zenith:zp:v1:setup:' + store.username + ':' + store.course + ':' + mode; };
  var savedKey = 'zenith:zp:v1:setups:' + store.username + ':' + store.course;
  function jget(k, d) { try { var v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } }
  function jset(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } }
  function allKeys() { return info.order.concat((info.sets || []).map(function (x) { return x.id; })); }
  function keyOf(q) { return (info.setOf && info.setOf[q.id]) || q.chapter; }
  function chLabel(q) { if (q.kind === 'F') return 'AP ' + q.tags.year + ' FRQ ' + q.tags.number; return (info.setOf && info.setOf[q.id]) || 'Ch ' + q.chapter; }
  function defaults(mode) {
    return { pools: { C: hasC, T: hasT, F: hasF }, type: 'mcq', chapters: allKeys(), filter: 'all', weak: false, count: mode === 'test' ? 30 : 20, shuffle: true, minutes: 0, calc: '', yfrom: '', yto: '', unit: '' };
  }
  var cfgs = { practice: Object.assign(defaults('practice'), jget(cfgKey('practice'), {})), test: Object.assign(defaults('test'), jget(cfgKey('test'), {})) };
  var wantCh = ctx.params.get('ch');
  if (wantCh && info.chapters[wantCh]) { cfgs.practice.chapters = [wantCh]; cfgs.practice.filter = 'all'; }

  /* ---------- selection ---------- */
  function pool(cfg, ignoreChapters) {
    derive();
    var dueIds = {}; ZP.dueEntries(D).forEach(function (e) { dueIds[e.pid] = 1; });
    var seen = {}; Object.keys(D.prob).forEach(function (k) { if (D.prob[k].answered) seen[k] = 1; });
    [].concat.apply([], Object.keys(D.tests).map(function (k) { return D.tests[k]; })).concat(D.customTests, D.mocks).forEach(function (s) { (s.pids || []).forEach(function (id) { seen[id] = 1; }); });
    return data.problems.filter(function (q) {
      if (q.blocked || !cfg.pools[q.kind]) return false;
      if ((cfg.type === 'frq') !== !!q.frq) return false;
      if (cfg.calc && q.calc !== cfg.calc) return false;
      if (q.kind === 'F') { var tg = q.tags || {}; if (cfg.yfrom && tg.year < +cfg.yfrom) return false; if (cfg.yto && tg.year > +cfg.yto) return false; if (cfg.unit && (tg.units || []).indexOf(+cfg.unit) < 0) return false; }
      if (!ignoreChapters && cfg.chapters.indexOf(keyOf(q)) < 0) return false;
      if (cfg.filter === 'unseen') return !D.q[q.id];
      if (cfg.filter === 'notright') return !(D.q[q.id] && D.q[q.id].last && D.q[q.id].last.correct);
      if (cfg.filter === 'done') return !!(D.q[q.id] && D.q[q.id].last && D.q[q.id].last.correct);
      if (cfg.filter === 'missed') return !!D.entries[q.id];
      if (cfg.filter === 'due') return !!dueIds[q.id];
      if (cfg.filter === 'hints') return D.prob[q.id] && D.prob[q.id].maxHint >= 4;
      return true;
    });
  }
  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pick(cfg) {
    var p = pool(cfg), n = Math.min(cfg.count, p.length);
    if (cfg.weak) {
      // Weighted draw: chapters you are weakest in are more likely, but nothing is excluded.
      ST = ZP.stats(D, info);
      var rest = shuffle(p), out = [];
      while (out.length < n && rest.length) {
        var w = rest.map(function (q) { var r = ST.byChapter[q.chapter]; return r && r.pct != null ? 1 + 2 * (1 - r.pct) : 1.5; });
        var sum = w.reduce(function (a, b) { return a + b; }, 0), x = Math.random() * sum, k = 0;
        while (k < w.length - 1 && x > w[k]) { x -= w[k]; k++; }
        out.push(rest.splice(k, 1)[0]);
      }
      return out.map(function (q) { return q.id; });
    }
    var ids = (cfg.shuffle ? shuffle(p) : p).slice(0, n).map(function (q) { return q.id; });
    return ids;
  }

  /* ---------- chrome ---------- */
  function head() {
    var due = ZP.dueEntries(derive()).length;
    var banner = due ? '<p class="zp-banner"><span><b>' + due + ' review' + (due > 1 ? 's' : '') + ' due.</b> Spaced redos go first.</span><a class="zp-btn" href="notebook.html?course=' + cid + '&view=redo">Open review queue</a></p>' : '';
    if (focus) return '<div class="zp-crumb"><a class="zp-link" href="' + esc(ret) + '">← ' + retLabel + '</a><span>' + esc(ctx.course.name) + '</span>' + UI.saveStatus(store) + '</div>' + banner;
    return (ret ? '<p><a class="zp-link" href="' + esc(ret) + '">← ' + retLabel + '</a></p>' : '') + '<div class="zp-crumb"><span>' + esc(ctx.course.name) + '</span>' + UI.saveStatus(store) + '</div><h1>Trainer</h1>' + UI.courseSwitcher(ctx, 'practice.html') +
      '<nav class="zp-tabs"><a class="' + (tab === 'browse' ? 'on' : '') + '" href="#browse">Browse</a><a class="' + (tab === 'practice' ? 'on' : '') + '" href="#practice">Practice</a><a class="' + (tab === 'test' ? 'on' : '') + '" href="#test">Test</a><a class="' + (tab === 'mock' ? 'on' : '') + '" href="#mock">Mock</a></nav>' + (tab === 'browse' ? '' : findBar()) +
      banner;
  }
  var BLURB = {
    browse: 'Every problem we have, in one place. Search by ID or words, filter by source, chapter, status, and more, then open one or work through the whole list.',
    practice: 'Untimed. The answer is one tap away, and every attempt feeds your notebook and stats. Like the chapter problems, but you choose the set.',
    test: 'Timed, with no feedback until you submit. Pick the topics and length yourself, then review your misses the same way as a chapter test.',
    mock: 'Exams in the real AP format, with sections, timers, and free response. The official ones are fixed so scores are comparable; you can also build your own below.'
  };

  /* ---------- setup (practice + test) ---------- */
  function yearOpts(cur, any) { var o = '<option value="">' + any + '</option>'; for (var y = 2025; y >= 1998; y--) if (y !== 2020) o += '<option value="' + y + '"' + (String(cur) === String(y) ? ' selected' : '') + '>' + y + '</option>'; return o; }
  function setupView(mode) {
    var cfg = cfgs[mode], p = pool(cfg), all = pool(cfg, true);
    var counts = {}; all.forEach(function (q) { counts[keyOf(q)] = (counts[keyOf(q)] || 0) + 1; });
    var ST2 = ZP.stats(D, info);
    var setById = {}; (info.sets || []).forEach(function (x) { setById[x.id] = x; });
    var chips = allKeys().filter(function (c) { return counts[c]; }).map(function (c) {
      var r = ST2.byChapter[c] || ST2.bySet[c], on = cfg.chapters.indexOf(c) >= 0, pct = r && r.pct != null ? ' · ' + Math.round(100 * r.pct) + '%' : '';
      var name = setById[c] ? c + ' · ' + setById[c].title : c + ' · ' + info.chapters[c].title;
      return '<label class="zp-chip' + (on ? ' on' : '') + '"><input type="checkbox" data-ch="' + esc(c) + '"' + (on ? ' checked' : '') + ' hidden>' + esc(name) + ' <span class="zp-muted">(' + counts[c] + pct + ')</span></label>';
    }).join('');
    var n = Math.min(cfg.count, p.length), mins = cfg.minutes || ZPTest.roundTo5(n * CFG.MIN_PER_QUESTION);
    var saved = jget(savedKey, []).filter(function (s) { return s.mode === mode; });
    var FILTERS = [['all', 'All problems'], ['unseen', 'Not tried yet'], ['notright', 'Not answered right yet'], ['done', 'Done (last answer right)'], ['missed', 'Ones I missed'], ['hints', 'Ones where I opened the answer'], ['due', 'Due for review']];
    main.innerHTML = head() + '<p class="zp-muted">' + BLURB[mode] + '</p>' + (mode === 'practice' ? resumeHTML() : '') +
      '<section class="zp-panel"><h2>Build a ' + (mode === 'practice' ? 'practice set' : 'test') + '</h2>' +
      '<div class="zp-filters">' +
        ([hasC, hasT, hasF].filter(Boolean).length > 1 ? '<label>From<span class="zp-chips">' + [['C', 'Chapter problems', hasC], ['T', 'Test problems', hasT], ['F', 'AP free-response archive', hasF]].filter(function (x) { return x[2]; }).map(function (x) { return '<label class="zp-chip' + (cfg.pools[x[0]] ? ' on' : '') + '"><input type="checkbox" data-pool="' + x[0] + '" ' + (cfg.pools[x[0]] ? 'checked' : '') + ' hidden>' + x[1] + '</label>'; }).join('') + '</span></label>' : '') +
        (hasFRQ ? '<label>Type<select data-f="type"><option value="mcq"' + (cfg.type === 'mcq' ? ' selected' : '') + '>Multiple choice</option><option value="frq"' + (cfg.type === 'frq' ? ' selected' : '') + '>Free response</option></select></label>' : '') +
        '<label>Calculator<select data-f="calc"><option value="">Either</option><option value="no"' + (cfg.calc === 'no' ? ' selected' : '') + '>No calculator</option><option value="yes"' + (cfg.calc === 'yes' ? ' selected' : '') + '>Calculator</option></select></label>' +
        (hasF && cfg.pools.F ? '<label>AP year from<select data-f="yfrom">' + yearOpts(cfg.yfrom, 'Any') + '</select></label><label>to<select data-f="yto">' + yearOpts(cfg.yto, 'Any') + '</select></label><label>AP unit<select data-f="unit"><option value="">Any</option>' + [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (u) { return '<option value="' + u + '"' + (String(cfg.unit) === String(u) ? ' selected' : '') + '>Unit ' + u + '</option>'; }).join('') + '</select></label>' : '') +
        '<label>Only<select data-f="filter">' + FILTERS.map(function (f) { return '<option value="' + f[0] + '"' + (cfg.filter === f[0] ? ' selected' : '') + '>' + f[1] + '</option>'; }).join('') + '</select></label></div>' +
      '<p class="zp-label">Chapters <button type="button" class="photo-tray-clear" data-act="all">All</button> <button type="button" class="photo-tray-clear" data-act="none">None</button> <button type="button" class="photo-tray-clear" data-act="weakest">Weakest 3</button></p>' +
      '<div class="zp-chips">' + (chips || '<span class="zp-muted">No problems match these filters.</span>') + '</div>' +
      '<div class="zp-filters"><label>How many<input type="number" data-f="count" min="1" max="' + Math.max(1, p.length) + '" value="' + n + '" style="width:90px"></label>' +
        (mode === 'test' ? '<label>Minutes<input type="number" data-f="minutes" min="5" max="240" value="' + mins + '" style="width:90px"></label>' : '') +
        '<label class="zp-chip' + (cfg.shuffle ? ' on' : '') + '"><input type="checkbox" data-f="shuffle" ' + (cfg.shuffle ? 'checked' : '') + ' hidden>Shuffle</label>' +
        '<label class="zp-chip' + (cfg.weak ? ' on' : '') + '" title="Draw more from the chapters you are weakest in"><input type="checkbox" data-f="weak" ' + (cfg.weak ? 'checked' : '') + ' hidden>Bias toward weak topics</label></div>' +
      '<p class="zp-muted">' + p.length + ' problem' + (p.length === 1 ? '' : 's') + ' match' + (p.length === 1 ? 'es' : '') + '.' + (mode === 'test' ? ' Suggested ' + ZPTest.roundTo5(n * CFG.MIN_PER_QUESTION) + ' min.' : '') + '</p>' +
      '<div class="zp-row">' + UI.btn('Start ' + mode, 'start', 'primary', p.length ? '' : 'disabled') + '</div></section>' +
      '<section class="zp-panel"><h2>Saved setups</h2>' + (saved.length ? '<div class="zp-chips">' + saved.map(function (s, i) {
        return '<span class="zp-chip"><button type="button" class="photo-tray-clear" data-act="apply" data-i="' + i + '">' + esc(s.name) + '</button> <button type="button" class="photo-tray-clear" data-act="del" data-i="' + i + '" aria-label="Delete ' + esc(s.name) + '">×</button></span>'; }).join('') + '</div>' : '<p class="zp-muted">Save the setup you use often, like "Derivatives, weak spots, 20".</p>') +
      '<div class="zp-addrow"><input type="text" id="zp-setupname" maxlength="40" placeholder="Name this setup"><button type="button" class="zp-btn" data-act="save">Save current</button></div></section>' +
      recordsHTML('test', mode);
    UI.renderMath(main);
  }
  // Find any problem by its ID (C1A3, T4B12, C11-A7) or by words in it, like the SAT site's search.
  function findBar() {
    return '<div class="zp-findbar"><label class="zp-field"><span class="zp-muted">Find a problem by ID (C1A3, T4B12, C11-A7) or by words in it</span><input type="text" id="zp-find" placeholder="C1A3, T4B12, or words like &quot;domain of&quot;" autocomplete="off"></label><div id="zp-find-out"></div></div>';
  }
  function findRun(qstr) {
    var out = document.getElementById('zp-find-out'); if (!out) return;
    var n = ZP.normCode(qstr), words = qstr.trim().toLowerCase();
    if (!n) { out.innerHTML = ''; return; }
    derive();
    var hits = data.problems.filter(function (q) { return !q.blocked && (ZP.normCode(q.code).indexOf(n) >= 0 || (words.length >= 3 && q.stem.toLowerCase().indexOf(words) >= 0)); })
      .sort(function (a, b) { var ea = ZP.normCode(a.code) === n ? 0 : 1, eb = ZP.normCode(b.code) === n ? 0 : 1; return ea - eb || a.code.localeCompare(b.code, undefined, { numeric: true }); });
    out.innerHTML = hits.length ? hits.slice(0, 25).map(function (q) {
      return '<div class="zp-rightrow"><span>' + UI.codeBadge(q) + ' ' + esc(UI.shortStem(q, 90)) + '</span><span>' + UI.statusBadge(D, q.id) + ' <button type="button" class="zp-btn" data-act="find-open" data-pid="' + esc(q.id) + '">Open</button></span></div>';
    }).join('') + (hits.length > 25 ? '<p class="zp-muted">Showing 25 of ' + hits.length + '. Type more to narrow it down.</p>' : '') : '<p class="zp-muted">No problem matches.</p>';
    UI.renderMath(out);
  }
  // Records: tests and mocks keep one per sitting so they can be reviewed later; deleting one only removes it from the list (rec_del). Your progress on each
  // problem (attempts, flags, entries) is separate and stays.
  // "FRQ 2 / 6 scored · 1 with the mentor": questions without a score are never counted as wrong.
  function frqStatus(r) {
    var n = (r.frqPids || []).length; if (!n) return '';
    var sc = D.frqScores[r.id] || {}, scored = Object.keys(sc).length, wait = (r.frqPids || []).filter(function (p) { var a = D.frqAsk[r.id + '|' + p]; return a && a.status === 'waiting'; }).length;
    return ((r.score && r.score.total) ? ' · ' : '') + 'FRQ ' + scored + ' / ' + n + ' scored' + (wait ? ' · ' + wait + ' with the mentor' : '');
  }
  function recordsHTML(kind) {
    derive();
    var list = (kind === 'mock' ? D.mocks : D.customTests).slice().sort(function (a, b) { return b.t - a.t; });
    if (!list.length) return '';
    return '<section class="zp-panel"><h2>' + (kind === 'mock' ? 'Mock records' : 'Test records') + '</h2><p class="zp-muted">Kept so you can review them later. Deleting a record only removes it from this list: your progress on each problem stays.</p>' +
      '<table class="zp-table"><tbody>' + list.map(function (r) {
        return '<tr><td>' + UI.fmtDate(r.t) + '</td><td>' + esc(r.title || (kind === 'mock' ? 'Mock' : 'Test')) + '</td><td>' + (r.score && r.score.total ? r.score.correct + ' / ' + r.score.total : (r.frqPids || []).length ? '' : 'Free response') + frqStatus(r) + '</td>' +
          '<td><button type="button" class="photo-tray-clear" data-act="results" data-id="' + esc(r.id) + '">Results</button> <button type="button" class="photo-tray-clear" data-act="rec-del" data-id="' + esc(r.id) + '">Delete</button></td></tr>';
      }).join('') + '</tbody></table></section>';
  }
  // A practice set in progress is remembered (the problem list and title); each answer is already saved as you go, so resuming picks up at the first problem you have not answered.
  var pracKey = 'zenith:zp:v1:' + store.username + ':' + store.course + ':active:practice';
  function clearPractice() { try { localStorage.removeItem(pracKey); } catch (e) { /* ignore */ } }
  function resumeHTML() {
    var a = jget(pracKey, null); if (!a || !a.ids || a.ids.length < 2) return '';
    derive(); var done = a.ids.filter(function (id) { return D.prob[id] && D.prob[id].answered; }).length;
    if (done >= a.ids.length) { clearPractice(); return ''; }
    return '<section class="zp-panel"><h2>Resume your practice</h2><p>' + esc(a.title || 'Practice') + ' · <b>' + done + ' of ' + a.ids.length + '</b> done. Your answers are saved as you go.</p><div class="zp-row">' + UI.btn('Resume', 'pr-resume', 'primary') + UI.btn('Discard', 'pr-drop') + '</div></section>';
  }

  /* ---------- mock tab ---------- */
  // Past AP free-response exams as mocks: one per year, the six printed questions split into Part A (calculator) and
  // Part B (no calculator) with that era's real timing (2008+: 2 + 4 questions, 30 + 60 min; 1998-2007: 3 + 3, 45 + 45).
  var apMocks = {};
  (function buildApMocks() {
    if (!hasF) return;
    var byYear = {};
    data.problems.forEach(function (q) { if (q.kind === 'F' && !q.blocked) (byYear[q.tags.year] = byYear[q.tags.year] || []).push(q); });
    Object.keys(byYear).forEach(function (y) {
      y = +y; var qs = byYear[y].sort(function (a, b) { return a.tags.number - b.tags.number; });
      var A = qs.filter(function (q) { return q.tags.calculator === 'yes'; }), B = qs.filter(function (q) { return q.tags.calculator !== 'yes'; });
      var old = y <= 2007, secs = [], sections = {};
      if (A.length) { secs.push({ id: '2A', name: 'Section II, Part A: free response (calculator)', kind: 'frq', count: A.length, minutes: old ? 45 : 30, calculator: true, available: true }); sections['2A'] = A.map(function (q) { return q.id; }); }
      if (B.length) { secs.push({ id: '2B', name: 'Section II, Part B: free response (no calculator)', kind: 'frq', count: B.length, minutes: old ? 45 : 60, calculator: false, available: true }); sections['2B'] = B.map(function (q) { return q.id; }); }
      var id = 'ap-' + y;
      apMocks[id] = { year: y, mock: { id: id, name: y + ' AP Calculus BC free response', sections: sections }, n: qs.length,
        exam: { name: 'AP Calculus BC · ' + y + ' free response', sections: secs, scoring: { mcqWeight: 0, frqWeight: 1, frqMaxEach: 9, bands: exam ? exam.scoring.bands : [[0.62, 5], [0.49, 4], [0.37, 3], [0.26, 2], [0, 1]] },
          notes: ['The real questions from the ' + y + ' exam. Work on paper, then score yourself against the official scoring guidelines (linked on each question) at the end.'] } };
    });
  })();
  // Cumulative checkpoints (scripts/build_mock_exams.cjs): one 80-minute multiple-choice sitting each, no AP estimate since it is partial.
  var cpMocks = {};
  (exam && exam.checkpoints || []).forEach(function (cp) {
    var pids = cp.pids.filter(function (id) { return data.byId[id] && !data.byId[id].blocked; });
    if (!pids.length) return;
    cpMocks[cp.id] = { cp: cp, n: pids.length, mock: { id: cp.id, name: cp.name.replace(/-/g, '\u2013'), sections: { CP: pids } },
      exam: { name: 'Cumulative checkpoint', sections: [{ id: 'CP', name: 'Checkpoint: multiple choice', kind: 'mcq', count: pids.length, minutes: cp.minutes, calculator: null, available: true }],
        scoring: { mcqWeight: 1, frqWeight: 0, frqMaxEach: 9, noEstimate: true, bands: exam.scoring.bands },
        notes: ['About two thirds of these problems are no-calculator and one third allow a calculator (each problem says which). Eighty minutes straight, like a mock, and no feedback until you finish.', 'It covers chapters ' + cp.chapters.join(', ') + '. Every miss goes to your review queue.'] } };
  });
  // Custom mocks the student built (js/zp-custom-mock.js): fixed definitions kept in this browser, taken like any other mock.
  var cmKey = 'zenith:zp:v1:cmocks:' + store.username + ':' + store.course;
  function customMocks() { return jget(cmKey, []); }
  function cmOf(id) { return customMocks().filter(function (d) { return d.mock.id === id; })[0] || null; }
  function mockStatus(mid) {
    var subs = D.mocks.filter(function (s) { return s.mockId === mid; }), last = subs[subs.length - 1];
    var active = jget('zenith:zp:v1:' + store.username + ':' + store.course + ':active:mock:' + mid, null);
    return { last: last, active: active };
  }
  function mockButtons(mid, st) {
    return (st.active ? UI.btn('Resume', 'mock-start', 'primary', 'data-id="' + esc(mid) + '"') : st.last ? '' : UI.btn('Start', 'mock-start', 'primary', 'data-id="' + esc(mid) + '"')) +
      (st.last ? UI.btn('Results and review', 'mock-results', 'primary', 'data-id="' + esc(st.last.id) + '" data-mock="' + esc(mid) + '"') : '');
  }
  function mockBadge(st) { return st.active ? '<span class="zp-badge warn">In progress</span>' : st.last ? '<span class="zp-badge ok">Taken ' + UI.fmtDate(st.last.t) + '</span>' : '<span class="zp-badge">Not taken</span>'; }
  function mockView() {
    derive();
    var full = '', cpHtml = '';
    // The cumulative checkpoints are not listed here: they sit in the roadmap's chapter list (cpMocks above still runs them when opened from there).
    var courseNote = ''; // class-track students get no panel about the three full mocks: they are only in the roadmap (Chapter M), nothing to explain here
    if (exam && exam.mocks.filter(function (m) { return !courseOnly[m.id]; }).length) {
      full = '<section class="zp-panel"><h2>Full-length mocks</h2><p class="zp-muted">Real AP format, with sections, timers and free response. Built from our problem banks, fixed so scores are comparable. One shot per mock.</p>' +
        exam.mocks.filter(function (m) { return !courseOnly[m.id]; }).map(function (m) {
          var st = mockStatus(m.id), last = st.last;
          var parts = exam.sections.filter(function (s) { return m.sections[s.id]; }).map(function (s) { return m.sections[s.id].length + ' ' + (s.kind === 'mcq' ? 'MCQ' : 'FRQ'); }).join(' · ');
          var mins = exam.sections.filter(function (s) { return m.sections[s.id]; }).reduce(function (n, s) { return n + s.minutes; }, 0);
          return '<article class="zp-entry"><div class="zp-entry-top"><b>' + esc(m.name) + '</b>' + reqBadge(m.id) + '<span>' + parts + ' · ' + mins + ' min</span>' + mockBadge(st) + '</div>' +
            (last && last.score.total ? '<h3>MCQ ' + last.score.correct + ' / ' + last.score.total + '</h3>' : '') + '<div class="zp-row">' + mockButtons(m.id, st) + '</div></article>';
        }).join('') +
        '<details><summary class="zp-muted">Exam format</summary><table class="zp-table"><thead><tr><th>Section</th><th>Questions</th><th>Time</th></tr></thead><tbody>' + exam.sections.map(function (s) {
          return '<tr><td>' + esc(s.name) + (s.available ? '' : ' <span class="zp-badge">not available yet</span>') + '</td><td>' + s.count + '</td><td>' + s.minutes + ' min</td></tr>'; }).join('') + '</tbody></table></details>' +
        (exam.notes || []).map(function (n) { return '<p class="zp-muted">' + esc(n) + '</p>'; }).join('') + '</section>';
    }
    var apIds = Object.keys(apMocks).sort(function (a, b) { return apMocks[b].year - apMocks[a].year; });
    var ap = apIds.length ? '<section class="zp-panel"><h2>Past AP free-response exams</h2><p class="zp-muted">Every released Calculus BC free-response section, ' + apMocks[apIds[apIds.length - 1]].year + ' to ' + apMocks[apIds[0]].year + '. Real questions, real timing, no feedback until the end, then you score yourself against the official scoring guidelines.</p>' +
      '<div class="zp-apgrid">' + apIds.map(function (id) {
        var m = apMocks[id], st = mockStatus(id), mins = m.exam.sections.reduce(function (n, s) { return n + s.minutes; }, 0);
        var split = m.exam.sections.map(function (s) { return s.count; }).join(' + ');
        return '<article class="zp-apcard"><div><b>' + m.year + '</b> ' + reqBadge(id) + ' ' + mockBadge(st) + '<br><span class="zp-muted">' + split + ' FRQ · ' + mins + ' min</span></div><div class="zp-row">' + mockButtons(id, st) + '</div></article>';
      }).join('') + '</div></section>' : '';
    if (!full && !ap && !cpHtml && !exam && !courseNote) { main.innerHTML = head() + '<p class="zp-muted">' + BLURB.mock + '</p>' + UI.emptyState('No mock exams yet', 'Fixed mocks are generated from the problem banks (scripts/build_mock_exams.cjs). This course does not have enough problems for one yet.'); return; }
    var cms = customMocks(), cmHtml = cms.length ? '<section class="zp-panel"><h2>Your custom mocks</h2><p class="zp-muted">Mocks you built. Each is fixed once created, with the same sections and timers as the real thing. One shot each; build another to go again.</p>' + cms.slice().reverse().map(function (d) {
      var st = mockStatus(d.mock.id), last = st.last, parts = d.exam.sections.map(function (x) { return d.mock.sections[x.id].length + ' ' + (x.kind === 'mcq' ? 'MCQ' : 'FRQ'); }).join(' · '), mins = d.exam.sections.reduce(function (n, x) { return n + x.minutes; }, 0);
      return '<article class="zp-entry"><div class="zp-entry-top"><b>' + esc(d.mock.name) + '</b><span>' + parts + ' · ' + mins + ' min</span>' + mockBadge(st) + '</div>' + (last && last.score.total ? '<h3>MCQ ' + last.score.correct + ' / ' + last.score.total + '</h3>' : '') +
        '<div class="zp-row">' + mockButtons(d.mock.id, st) + UI.btn('Remove', 'cm-del', '', 'data-id="' + esc(d.mock.id) + '"') + '</div></article>';
    }).join('') + '</section>' : '';
    var cmBox = exam ? '<div id="zp-cm"></div>' : '';
    // Self-study students see their own mocks first, then the full mocks.
    main.innerHTML = head() + '<p class="zp-muted">' + BLURB.mock + '</p>' + courseNote + cpHtml + (selfStudy ? cmHtml + cmBox + full : full + cmHtml + cmBox) + ap + recordsHTML('mock');
    if (exam && document.getElementById('zp-cm')) {
      var bd = ZPCustomMock.defaults(exam, { mcq: true, frq: true }), bs = jget(cfgKey('mockbuild'), {}), bcfg = Object.assign(bd, bs, { secs: Object.assign(bd.secs, bs.secs || {}), src: Object.assign(bd.src, bs.src || {}), fsrc: Object.assign(bd.fsrc, bs.fsrc || {}), weights: bs.weights || {} });
      ZPCustomMock.mount({ host: document.getElementById('zp-cm'), data: data, info: info, exam: exam, derive: derive, stats: function () { return ZP.stats(derive(), info); }, cfg: bcfg, save: function (c) { jset(cfgKey('mockbuild'), c); },
        nextNumber: function () { return customMocks().length + 1; },
        onCreate: function (def) { var all = customMocks(); all.push(def); jset(cmKey, all); mockView(); window.scrollTo(0, 0); } });
    }
  }
  function runMock(id) {
    var am = apMocks[id] || cpMocks[id] || cmOf(id), m = am ? am.mock : exam.mocks.filter(function (x) { return x.id === id; })[0], ex = am ? am.exam : exam;
    main.innerHTML = head() + '<p><button type="button" class="zp-btn" data-act="back">← ' + (ret ? retLabel : 'All mocks') + '</button></p><div id="zp-run"></div>';
    running = ZPMock.mount({ host: document.getElementById('zp-run'), store: store, data: data, derive: derive, exam: ex, mock: m, onExit: function () { if (ret) goBack(); else mockView(); },
      onDone: function (subId) { showResults(subId); } });
  }
  function showResults(subId) {
    var sub = store.events().filter(function (e) { return e.id === subId; })[0];
    if (!sub) { render(); return; }
    var kind = sub.kind === 'MOCK' ? 'MOCK' : sub.kind === 'TEST' ? 'TEST' : 'T';
    main.innerHTML = head() + '<p><button type="button" class="zp-btn" data-act="back">← ' + (ret ? retLabel : 'Back') + '</button></p><div id="zp-run"></div>';
    ZPTest.mount({ host: document.getElementById('zp-run'), courseId: ctx.course.id, store: store, data: data, derive: derive, kind: kind, ch: sub.ch || '', pids: [], openSub: subId, mockId: sub.mockId || '',
      title: sub.title || (kind === 'T' ? 'Chapter ' + sub.ch + ' test' : 'Test'), onAgain: function () { if (ret) return goBack(); tab = kind === 'MOCK' ? 'mock' : 'test'; render(); } });
  }

  /* ---------- Browse (js/zp-browse.js) ---------- */
  var browseState = ZPBrowse.newState(data);
  function browseView() {
    main.innerHTML = head() + '<p class="zp-muted">' + BLURB.browse + '</p><div id="zp-bmount"></div>';
    running = ZPBrowse.mount({ host: document.getElementById('zp-bmount'), store: store, data: data, derive: derive, state: browseState, chLabel: chLabel,
      onPractice: function (ids, title) { runPractice(ids, title); },
      onTest: function (ids, minutes) { runTest(ids, minutes); } });
  }

  /* ---------- running practice / test ---------- */
  function runPractice(ids, title, startPid) {
    if (ids.length > 1) jset(pracKey, { ids: ids, title: title || 'Practice', t: Date.now() });
    main.innerHTML = '<div id="zp-run"></div>';
    var back = '<div class="zp-crumb"><button type="button" class="zp-btn" data-act="back">← ' + (ret ? retLabel : 'Setup') + '</button>' + UI.saveStatus(store) + '</div>';
    running = ZPRun.mount({ host: document.getElementById('zp-run'), store: store, data: data, derive: derive, ids: ids, startPid: startPid, head: back, title: title || 'Practice', ctx: 'practice', chLabel: chLabel,
      onFinish: function () { summary(ids); } });
  }
  function summary(ids) {
    clearPractice();
    derive();
    var att = ids.filter(function (id) { return D.prob[id] && D.prob[id].answered; }), right = att.filter(function (id) { return D.prob[id].first && D.prob[id].first.correct; }).length;
    var hinted = ids.filter(function (id) { return D.prob[id] && D.prob[id].maxHint >= 4; }).length;
    main.innerHTML = head() + '<section class="zp-panel zp-score"><p class="zp-eyebrow">Practice complete</p><h2>' + right + ' / ' + ids.length + ' <small>right on the first try</small></h2>' +
      '<div class="zp-stats"><div><b>' + att.length + '</b><span>attempted</span></div><div><b>' + hinted + '</b><span>opened the answer</span></div><div><b>' + ids.filter(function (id) { return D.entries[id] && D.entries[id].pending; }).length + '</b><span>flagged, to write up</span></div></div>' +
      '<div class="zp-row"><a class="zp-btn primary" href="notebook.html?course=' + cid + '&view=inbox">Write your entries</a>' + UI.btn(ret ? 'Back to ' + retLabel.toLowerCase() : 'Another set', 'back') + '</div></section>';
  }
  function runTest(ids, minutes) {
    main.innerHTML = head() + '<p><button type="button" class="zp-btn" data-act="back">← ' + (ret ? retLabel : 'Setup') + '</button></p><div id="zp-run"></div>';
    running = ZPTest.mount({ host: document.getElementById('zp-run'), courseId: ctx.course.id, store: store, data: data, derive: derive, kind: 'TEST', ch: '', pids: ids, minutes: minutes, title: 'Custom test · ' + ids.length + ' questions',
      onAgain: function () { goBack(); } });
  }


  /* ---------- events ---------- */
  function render() {
    if (running && running.cleanup) running.cleanup(); running = null;
    window.scrollTo(0, 0);
    if (tab === 'browse') browseView(); else if (tab === 'mock') mockView(); else setupView(tab);
  }
  main.onclick = function (e) {
    var b = e.target.closest('[data-act]'); if (!b) return;
    var a = b.dataset.act, cfg = cfgs[tab];
    if (a === 'back') goBack();
    else if (a === 'all') { cfg.chapters = allKeys(); jset(cfgKey(tab), cfg); setupView(tab); }
    else if (a === 'none') { cfg.chapters = []; jset(cfgKey(tab), cfg); setupView(tab); }
    else if (a === 'weakest') { ST = ZP.stats(D, info); var w = ST.weak.slice(0, 3); cfg.chapters = w.length ? w : cfg.chapters; jset(cfgKey(tab), cfg); setupView(tab); }
    else if (a === 'start') {
      var ids = pick(cfg); if (!ids.length) return;
      jset(cfgKey(tab), cfg);
      if (tab === 'practice') runPractice(ids); else runTest(ids, Math.max(5, Math.min(240, cfg.minutes || ZPTest.roundTo5(ids.length * CFG.MIN_PER_QUESTION))));
    } else if (a === 'save') {
      var nm = document.getElementById('zp-setupname').value.trim(); if (!nm) { document.getElementById('zp-setupname').focus(); return; }
      var list = jget(savedKey, []).filter(function (s) { return !(s.mode === tab && s.name === nm); }); list.push({ name: nm, mode: tab, cfg: JSON.parse(JSON.stringify(cfg)) }); jset(savedKey, list); setupView(tab);
    } else if (a === 'apply' || a === 'del') {
      var mine = jget(savedKey, []).filter(function (s) { return s.mode === tab; }), item = mine[+b.dataset.i]; if (!item) return;
      var all = jget(savedKey, []);
      if (a === 'apply') { cfgs[tab] = Object.assign(defaults(tab), item.cfg); jset(cfgKey(tab), cfgs[tab]); }
      else { all = all.filter(function (s) { return !(s.mode === item.mode && s.name === item.name); }); jset(savedKey, all); }
      setupView(tab);
    }
    else if (a === 'find-open') runPractice([b.dataset.pid], 'Problem ' + data.byId[b.dataset.pid].code);
    else if (a === 'mock-start') runMock(b.dataset.id);
    else if (a === 'pr-resume') { var pa = jget(pracKey, null); if (pa && pa.ids) runPractice(pa.ids, pa.title); }
    else if (a === 'pr-drop') { clearPractice(); setupView('practice'); }
    else if (a === 'rec-del') { if (confirm('Delete this record? Your progress on each problem stays; only the record leaves your list' + (tab === 'mock' ? ' (a required mock counts as not taken again)' : '') + '.')) { store.append('rec_del', { ref: b.dataset.id }); if (tab === 'mock') mockView(); else render(); } }
    else if (a === 'cm-del') { var cmd = cmOf(b.dataset.id); if (cmd && confirm('Remove "' + cmd.mock.name + '" from your list? Results you already have stay.')) { jset(cmKey, customMocks().filter(function (d) { return d.mock.id !== b.dataset.id; })); mockView(); } }
    else if (a === 'mock-results') showResults(b.dataset.id);
    else if (a === 'results') showResults(b.dataset.id);
  };
  main.oninput = function (e) {
    if (e.target.id === 'zp-find') findRun(e.target.value);
  };
  main.onchange = function (e) {
    var cfg = cfgs[tab], t = e.target;
    if (t.dataset.pool) cfg.pools[t.dataset.pool] = t.checked;
    else if (t.dataset.ch) { var i = cfg.chapters.indexOf(t.dataset.ch); if (t.checked && i < 0) cfg.chapters.push(t.dataset.ch); if (!t.checked && i >= 0) cfg.chapters.splice(i, 1); }
    else if (t.dataset.f === 'count') cfg.count = Math.max(1, +t.value || 1);
    else if (t.dataset.f === 'minutes') cfg.minutes = Math.max(0, +t.value || 0);
    else if (t.dataset.f === 'shuffle' || t.dataset.f === 'weak') cfg[t.dataset.f] = t.checked;
    else if (t.dataset.f) { cfg[t.dataset.f] = t.value; if (t.dataset.f === 'type') cfg.chapters = allKeys(); }
    else return;
    jset(cfgKey(tab), cfg); setupView(tab);
  };
  window.addEventListener('hashchange', function () { tab = parseHash(); render(); openLaunch(); });
  // Open the mock or fixed set named in the address (#mock:<id>, #set:<id>). A mock already taken shows the mock list instead of a retake.
  function openLaunch() {
    if (!launch) return;
    var l = launch; launch = null;
    if (courseOnly[l.id] && !ret) { location.href = 'roadmap.html?course=' + cid; return; } // class-track full mocks start from the course view
    if (l.t === 'set') { var st = (info.sets || []).filter(function (x) { return x.id === l.id; })[0]; if (st) runPractice(st.ids, st.id + ' \u00b7 ' + st.title); return; }
    if (!(apMocks[l.id] || cpMocks[l.id] || cmOf(l.id) || (exam && exam.mocks.some(function (x) { return x.id === l.id; })))) return;
    var ms = mockStatus(l.id);
    if (ms.last && !ms.active) { showResults(ms.last.id); return; }
    runMock(l.id);
  }
  store.onChange(function () { var el = document.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
  // A custom practice set from the mentor opens straight into the runner (Right Now links here with ?task=<key>).
  var wantTask = ctx.params.get('task');
  if (wantTask) {
    var tk = derive().tasks.filter(function (t) { return t.key === wantTask && t.kind === 'practice'; })[0];
    var tids = tk ? tk.pids.filter(function (id) { return data.byId[id] && !data.byId[id].blocked; }) : [];
    if (tids.length) { runPractice(tids, tk.title); return; }
  }
  // Links from Mentor feedback: ?q=<problem id> opens the problem, ?r=<test / mock record id> opens that record's results.
  var wantR = ctx.params.get('r'), wantQ = ctx.params.get('q');
  if (wantR && store.events().some(function (e) { return e.id === wantR; })) { focus = !!ret; showResults(wantR); return; }
  if (wantQ && data.byId[wantQ]) { focus = !!ret; runPractice([wantQ], 'Problem ' + data.byId[wantQ].code); return; }
  render();
  openLaunch();
})();
