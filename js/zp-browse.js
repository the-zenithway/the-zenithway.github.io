/* Browse: every problem we have, laid out like the SAT site's Browse.
 *   left    facets with live counts (source, chapter, type, calculator, status, AP unit, AP year, my sets)
 *   top     search (ID or words) and sort
 *   list    a card per problem with a checkbox; the selection survives searching and filtering
 *   bar     bulk actions on the selection: practice, timed test, flag for review, save as a set, copy IDs
 *   click   a card opens the problem in a popup (the normal runner: answer, flag, copy, prev/next through the list)
 * State lives in the object the hub passes in, so it survives switching tabs. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc;
  var PAGE = 40, POPUP_CAP = 800;

  // data (optional) lets the saved defaults skip a filter the course does not have (Chemistry has no calculator tag).
  function newState(data) {
    var S = { q: '', sort: 'default', f: { src: [], ch: [], type: [], calc: [], status: [], unit: [], mine: [] }, yfrom: '', yto: '', page: 0, sel: {} };
    var ST = root.ZPSettings; if (!ST) return S;
    var cfg = ST.get().browse, hasCalc = !data || data.problems.some(function (q) { return q.calc; }), hasFRQ = !data || data.problems.some(function (q) { return q.frq; });
    if (cfg.calc && hasCalc) S.f.calc = [cfg.calc];
    if (cfg.type && hasFRQ) S.f.type = [cfg.type];
    if (cfg.status) S.f.status = [cfg.status];
    if (cfg.sort) S.sort = cfg.sort;
    var back = cfg.remember ? ST.recalledBrowse() : null;
    if (back && back.f) { Object.keys(S.f).forEach(function (k) { if (Array.isArray(back.f[k])) S.f[k] = back.f[k]; }); S.sort = back.sort || S.sort; S.yfrom = back.yfrom || ''; S.yto = back.yto || ''; }
    return S;
  }

  /* ---------- my sets (saved selections), kept in this browser ---------- */
  function setsKey(store) { return 'zenith:zp:v1:mysets:' + store.username + ':' + store.course; }
  function loadSets(store) { try { return JSON.parse(localStorage.getItem(setsKey(store))) || []; } catch (e) { return []; } }
  function saveSets(store, list) { try { localStorage.setItem(setsKey(store), JSON.stringify(list)); } catch (e) { /* storage blocked */ } }

  // opts: {host, store, data, derive(), state, onPractice(ids,title), onTest(ids,minutes), chLabel(q)}
  function mount(opts) {
    var host = opts.host, store = opts.store, data = opts.data, info = data.info, S = opts.state, D;
    var hasF = data.problems.some(function (q) { return q.kind === 'F'; });
    var hasFRQ = data.problems.some(function (q) { return q.frq; });
    var hasCalc = data.problems.some(function (q) { return q.calc; });
    var mySets = loadSets(store);
    var pool = data.problems.filter(function (q) { return !q.blocked; });

    /* ---------- facets ---------- */
    function srcKey(q) { return q.kind === 'F' ? 'APFRQ' : (info.setOf && info.setOf[q.id]) || q.kind; }
    function srcLabel(q) {
      if (q.kind === 'F') return 'AP ' + q.tags.year + ' · Q' + q.tags.number + ' · Unit' + (q.tags.units.length > 1 ? 's ' : ' ') + q.tags.units.join(', ');
      var set = info.setOf && info.setOf[q.id]; if (set) return set;
      return (q.kind === 'T' ? 'Test ' : 'Chapter ') + q.chapter;
    }
    function status(q) { return !D.q[q.id] ? 'new' : D.entries[q.id] && D.entries[q.id].pending ? 'inbox' : D.pstatus[q.id] || 'done'; }
    var SRCNAME = { C: 'Chapter problems', T: 'Test problems', APFRQ: 'AP free response' };
    function srcName(k) { var st = (info.sets || []).filter(function (x) { return x.id === k; })[0]; return SRCNAME[k] || (st ? st.id + ' · ' + st.title : k); }
    function mineIds(id) { var m = mySets.filter(function (x) { return x.id === id; })[0]; return m ? m.ids : []; }
    var FACETS = [
      { key: 'src', label: 'Source', values: function (q) { return [srcKey(q)]; },
        options: function () { return ['C', 'T'].concat((info.sets || []).filter(function (x) { return !x.ap; }).map(function (x) { return x.id; }), hasF ? ['APFRQ'] : []).map(function (k) { return [k, srcName(k)]; }); } },
      { key: 'ch', label: 'Chapter', values: function (q) { return q.kind !== 'F' && !(info.setOf && info.setOf[q.id]) ? [q.chapter] : []; },
        options: function () { return info.order.map(function (c) { return [c, c + ' · ' + info.chapters[c].title]; }); } },
      { key: 'type', label: 'Type', show: hasFRQ, values: function (q) { return [q.frq ? 'frq' : 'mcq']; }, options: function () { return [['mcq', 'Multiple choice'], ['frq', 'Free response']]; } },
      { key: 'calc', label: 'Calculator', show: hasCalc, values: function (q) { return [q.calc || 'none']; }, options: function () { return [['no', 'No calculator'], ['yes', 'Calculator'], ['none', 'Not tagged']]; } },
      { key: 'status', label: 'Status', values: function (q) { return [status(q)]; }, options: function () { return [['new', 'Not tried'], ['review', 'In review'], ['inbox', 'Needs an entry'], ['done', 'Done']]; } },
      { key: 'unit', label: 'AP unit', show: hasF, values: function (q) { return q.kind === 'F' ? q.tags.units.map(String) : []; },
        options: function () { return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(function (u) { return [String(u), 'Unit ' + u]; }); } },
      { key: 'mine', label: 'My sets', show: true, values: function (q) { return mySets.filter(function (m) { return m.ids.indexOf(q.id) >= 0; }).map(function (m) { return m.id; }); },
        options: function () { return mySets.map(function (m) { return [m.id, m.name]; }); } }
    ];
    function passFacet(f, q) { var sel = S.f[f.key]; if (!sel.length) return true; return f.values(q).some(function (v) { return sel.indexOf(v) >= 0; }); }
    function passYear(q) { if (!S.yfrom && !S.yto) return true; if (q.kind !== 'F') return false; return (!S.yfrom || q.tags.year >= +S.yfrom) && (!S.yto || q.tags.year <= +S.yto); }
    function passSearch(q) {
      var raw = S.q.trim().toLowerCase(); if (!raw) return true;
      var n = ZP.normCode(raw), code = ZP.normCode(q.code), hay = (q.stem || '').toLowerCase();
      if (code.indexOf(n) >= 0) return true;
      return raw.split(/\s+/).every(function (w) { return hay.indexOf(w) >= 0 || code.indexOf(ZP.normCode(w)) >= 0; });
    }
    function cmp(a, b) {
      var n = ZP.normCode(S.q), ea = n && ZP.normCode(a.code) === n ? 0 : 1, eb = n && ZP.normCode(b.code) === n ? 0 : 1;
      if (ea !== eb) return ea - eb;
      if (S.sort === 'status') { var ord = { inbox: 0, review: 1, new: 2, done: 3 }, d = ord[status(a)] - ord[status(b)]; if (d) return d; }
      if (a.kind === 'F' && b.kind === 'F') { var dy = (S.sort === 'apold' ? 1 : -1) * (a.tags.year - b.tags.year); return dy || (a.tags.number - b.tags.number); }
      if (S.sort === 'apnew' || S.sort === 'apold') { if (a.kind === 'F') return -1; if (b.kind === 'F') return 1; }
      return a.code.localeCompare(b.code, undefined, { numeric: true });
    }
    // One pass: which problems match everything, and for each facet the counts you would get if that facet were off.
    function compute() {
      D = opts.derive();
      var matched = [], counts = {}; FACETS.forEach(function (f) { counts[f.key] = {}; });
      pool.forEach(function (q) {
        var pf = FACETS.map(function (f) { return passFacet(f, q); }), rest = passYear(q) && passSearch(q), fails = pf.filter(function (x) { return !x; }).length;
        if (rest && !fails) matched.push(q);
        if (!rest) return;
        FACETS.forEach(function (f, i) { if (fails - (pf[i] ? 0 : 1) === 0) f.values(q).forEach(function (v) { counts[f.key][v] = (counts[f.key][v] || 0) + 1; }); });
      });
      matched.sort(cmp);
      return { matched: matched, counts: counts };
    }

    /* ---------- render ---------- */
    var R = null;
    function selIds() { return Object.keys(S.sel); }
    function sidebarHTML() {
      var years = []; for (var y = 2025; y >= 1998; y--) if (y !== 2020) years.push(y);
      function opt(v, l, cur) { return '<option value="' + v + '"' + (String(cur) === String(v) ? ' selected' : '') + '>' + l + '</option>'; }
      return FACETS.filter(function (f) { return f.show !== false; }).map(function (f) {
        var opts_ = f.options().filter(function (o) { return (R.counts[f.key][o[0]] || 0) > 0 || S.f[f.key].indexOf(o[0]) >= 0; });
        if (f.key === 'mine' && !mySets.length) return '';
        if (!opts_.length) return '';
        return '<div class="zp-fgroup"><h3>' + esc(f.label) + '</h3>' + opts_.map(function (o) {
          return '<label class="zp-fopt"><input type="checkbox" data-bf="' + f.key + '" data-v="' + esc(o[0]) + '"' + (S.f[f.key].indexOf(o[0]) >= 0 ? ' checked' : '') + '><span>' + esc(o[1]) + '</span><em>' + (R.counts[f.key][o[0]] || 0) + '</em>' +
            (f.key === 'mine' ? '<button type="button" class="zp-linkbtn" data-act="b-delset" data-id="' + esc(o[0]) + '" aria-label="Delete set">×</button>' : '') + '</label>';
        }).join('') + '</div>';
      }).join('') + (hasF ? '<div class="zp-fgroup"><h3>AP year</h3><div class="zp-yrs"><select data-yr="yfrom" aria-label="From year">' + opt('', 'From', S.yfrom) + years.slice().reverse().map(function (y) { return opt(y, y, S.yfrom); }).join('') + '</select><select data-yr="yto" aria-label="To year">' + opt('', 'To', S.yto) + years.map(function (y) { return opt(y, y, S.yto); }).join('') + '</select></div></div>' : '') +
        '<button type="button" class="zp-btn" data-act="b-clear">Clear filters</button>';
    }
    function cardHTML(q) {
      var checked = S.sel[q.id] ? ' checked' : '';
      return '<article class="zp-bcard" data-pid="' + esc(q.id) + '"><label class="zp-bsel" title="Select"><input type="checkbox" data-sel="' + esc(q.id) + '"' + checked + '></label>' +
        '<div class="zp-bmain"><div class="zp-btop">' + UI.codeBadge(q) + UI.statusBadge(D, q.id) + '<span class="zp-muted">' + esc(srcLabel(q)) + '</span>' +
        (q.calc ? '<span class="zp-badge">' + (q.calc === 'yes' ? 'Calculator' : 'No calculator') + '</span>' : '') + (q.frq ? '<span class="zp-badge">FRQ</span>' : '') + '</div>' +
        '<div class="zp-bstem">' + esc(UI.shortStem(q, 170)) + '</div></div></article>';
    }
    function bulkHTML() {
      var n = selIds().length, inView = R.matched.filter(function (q) { return S.sel[q.id]; }).length, all = R.matched.length > 0 && inView === R.matched.length;
      var mins = Math.max(5, ZPTestRound(n * CFG.MIN_PER_QUESTION));
      return '<div class="zp-bulk"><label class="zp-selall"><input type="checkbox" data-act="b-all"' + (all ? ' checked' : '') + (R.matched.length ? '' : ' disabled') + '><span>' + (n ? (n === inView ? n + ' selected' : n + ' selected (' + inView + ' in this view)') : 'Select all ' + R.matched.length) + '</span></label>' +
        (n ? '<div class="zp-bulkacts">' + UI.btn('Practice', 'b-practice', 'primary') +
          '<span class="zp-inl"><input type="number" id="zp-bmin" min="5" max="240" value="' + mins + '" aria-label="Minutes"><button type="button" class="zp-btn" data-act="b-test">Timed test</button></span>' +
          UI.btn('Flag for review', 'b-flag') +
          '<span class="zp-inl"><input type="text" id="zp-bname" maxlength="40" placeholder="Name this set" aria-label="Set name"><button type="button" class="zp-btn" data-act="b-save">Save as set</button></span>' +
          UI.btn('Copy IDs', 'b-copy') + UI.btn('Clear', 'b-unsel') + '</div>' : '') + '</div>';
    }
    function ZPTestRound(x) { return Math.round(x / 5) * 5; }
    function listHTML() {
      var pages = Math.max(1, Math.ceil(R.matched.length / PAGE)); if (S.page >= pages) S.page = pages - 1;
      var rows = R.matched.slice(S.page * PAGE, S.page * PAGE + PAGE).map(cardHTML).join('');
      var cnt = { new: 0, review: 0, inbox: 0, done: 0 }; R.matched.forEach(function (q) { cnt[status(q)]++; });
      return '<p class="zp-muted"><b>' + R.matched.length + '</b> problem' + (R.matched.length === 1 ? '' : 's') + (R.matched.length ? ' · ' + cnt.new + ' not tried · ' + (cnt.review + cnt.inbox) + ' in review · ' + cnt.done + ' done' : '') + '</p>' + bulkHTML() +
        (rows || UI.emptyState('Nothing matches', 'Try fewer filters or different words.')) +
        (pages > 1 ? '<div class="zp-row"><button type="button" class="zp-btn" data-act="b-prev"' + (S.page ? '' : ' disabled') + '>← Previous</button><span class="zp-muted">Page ' + (S.page + 1) + ' of ' + pages + '</span><button type="button" class="zp-btn" data-act="b-next"' + (S.page < pages - 1 ? '' : ' disabled') + '>Next →</button></div>' : '');
    }
    function paint(full) {
      R = compute();
      if (root.ZPSettings) root.ZPSettings.rememberBrowse(S); // only saves when "remember my filters" is on
      var side = document.getElementById('zp-bside'), list = document.getElementById('zp-blist');
      if (full || !side || !list) {
        // On a phone the filters start collapsed so the problem list is the first thing on screen; they stay open (and the summary hidden) on wide screens.
        var narrow = window.matchMedia ? window.matchMedia('(max-width: 860px)') : { matches: false };
        var prev = document.querySelector('.zp-bfilters'), filtersOpen = prev ? prev.open : !narrow.matches;
        host.innerHTML = '<div class="zp-bwrap"><details class="zp-bfilters"' + (filtersOpen ? ' open' : '') + '><summary class="zp-btn">Filters</summary><aside id="zp-bside" class="zp-bside"></aside></details>' +
          '<div class="zp-bmainwrap"><div class="zp-btool"><div class="zp-bsearch"><input type="text" id="zp-bq" value="' + esc(S.q) + '" placeholder="Search words, paste an ID like C1A3 or 25FRQ1" autocomplete="off" aria-label="Search"></div>' +
          '<select id="zp-bsort" aria-label="Sort"><option value="default">Sort: original order</option><option value="status">Sort: needs attention first</option>' + (hasF ? '<option value="apnew">Sort: AP newest first</option><option value="apold">Sort: AP oldest first</option>' : '') + '</select></div><div id="zp-blist"></div></div></div>';
        document.getElementById('zp-bsort').value = S.sort;
        // Turning a phone sideways / resizing to a wide window: the summary button is hidden there, so the filters must not stay collapsed.
        if (narrow.addEventListener && !root.__zpBrowseMQ) {
          root.__zpBrowseMQ = true;
          narrow.addEventListener('change', function (e) { var d = document.querySelector('.zp-bfilters'); if (d && !e.matches) d.open = true; });
        }
        side = document.getElementById('zp-bside'); list = document.getElementById('zp-blist');
      }
      side.innerHTML = sidebarHTML(); list.innerHTML = listHTML(); UI.renderMath(list);
    }

    /* ---------- popup: the runner in a dialog, walking the current list ---------- */
    var popup = null;
    function openPopup(pid) {
      var ids = R.matched.map(function (q) { return q.id; }), start = ids.indexOf(pid);
      if (ids.length > POPUP_CAP) { var from = Math.max(0, start - POPUP_CAP / 2); ids = ids.slice(from, from + POPUP_CAP); }
      var el = document.createElement('div'); el.className = 'zp-modal'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
      el.innerHTML = '<div class="zp-modalcard"><button type="button" class="zp-modalx" data-act="b-close" aria-label="Close">×</button><div id="zp-popmount"></div></div>';
      document.body.appendChild(el); document.body.classList.add('zp-modalopen');
      var run = root.ZPRun.mount({ host: el.querySelector('#zp-popmount'), store: store, data: data, derive: opts.derive, ids: ids, startPid: pid, popup: true, ctx: 'practice', chLabel: opts.chLabel,
        onFinish: closePopup });
      popup = { el: el, run: run };
      el.addEventListener('click', function (e) { if (e.target === el || e.target.closest('[data-act="b-close"]')) closePopup(); });
    }
    function closePopup() {
      if (!popup) return;
      if (popup.run && popup.run.cleanup) popup.run.cleanup();
      popup.el.remove(); popup = null; document.body.classList.remove('zp-modalopen');
      paint(false);
    }
    function onKey(e) {
      if (!popup) return;
      var KS = root.ZPSettings, is = function (id, fallback) { return KS ? KS.keyMatch(e, id) : e.key === fallback; };
      if (is('close', 'Escape')) { e.preventDefault(); return closePopup(); }
      var t = e.target; if (t && (/^(input|textarea|select)$/i.test(t.tagName) || t.isContentEditable)) return;
      if (is('next', 'ArrowRight') || is('prev', 'ArrowLeft')) { var b = popup.el.querySelector('[data-act="' + (is('next', 'ArrowRight') ? 'next' : 'prev') + '"]'); if (b && !b.disabled) { e.preventDefault(); b.click(); } }
    }
    document.addEventListener('keydown', onKey);

    /* ---------- events ---------- */
    host.onclick = function (e) {
      var b = e.target.closest('[data-act]');
      if (b && !b.disabled) {
        var a = b.dataset.act;
        if (a === 'b-clear') { var keep = S.sel; Object.assign(S, newState(data)); S.sel = keep; return paint(true); }
        if (a === 'b-prev') { S.page = Math.max(0, S.page - 1); return paint(false); }
        if (a === 'b-next') { S.page++; return paint(false); }
        if (a === 'b-unsel') { S.sel = {}; return paint(false); }
        if (a === 'b-practice') { var ids = selIds(); if (ids.length) opts.onPractice(order(ids), 'Selected problems'); return; }
        if (a === 'b-test') { var ids2 = selIds(), m = +(document.getElementById('zp-bmin') || {}).value || 20; if (ids2.length) opts.onTest(order(ids2), Math.max(5, Math.min(240, m))); return; }
        if (a === 'b-flag') { selIds().forEach(function (id) { var q = data.byId[id]; if (q) store.append('flag', { ch: q.chapter, pid: id, on: true }); }); return paint(false); }
        if (a === 'b-copy') { UI.copyText(selIds().join('\n'), b); return; }
        if (a === 'b-save') {
          var nm = (document.getElementById('zp-bname').value || '').trim(); if (!nm) { document.getElementById('zp-bname').focus(); return; }
          var ids3 = selIds(), id = 's' + Date.now().toString(36); mySets.push({ id: id, name: nm.slice(0, 40), ids: ids3 }); saveSets(store, mySets);
          S.sel = {}; S.f.mine = [id]; return paint(true);
        }
        if (a === 'b-delset') { e.preventDefault(); e.stopPropagation(); mySets = mySets.filter(function (x) { return x.id !== b.dataset.id; }); saveSets(store, mySets); S.f.mine = S.f.mine.filter(function (x) { return x !== b.dataset.id; }); return paint(false); }
        return;
      }
      if (e.target.closest('.zp-bsel') || e.target.closest('.zp-code')) return; // checkbox / ID chip keep their own behaviour
      var card = e.target.closest('.zp-bcard'); if (card) openPopup(card.dataset.pid);
    };
    // Keep the list order when starting from a selection (the order shown, not the order you ticked).
    function order(ids) { var set = {}; ids.forEach(function (i) { set[i] = 1; }); var shown = R.matched.map(function (q) { return q.id; }).filter(function (i) { return set[i]; }); ids.forEach(function (i) { if (shown.indexOf(i) < 0) shown.push(i); }); return shown; }
    host.onchange = function (e) {
      var t = e.target;
      if (t.dataset.bf) { var arr = S.f[t.dataset.bf], i = arr.indexOf(t.dataset.v); if (t.checked && i < 0) arr.push(t.dataset.v); if (!t.checked && i >= 0) arr.splice(i, 1); S.page = 0; return paint(false); }
      if (t.dataset.yr) { S[t.dataset.yr] = t.value; S.page = 0; return paint(false); }
      if (t.dataset.sel) { if (t.checked) S.sel[t.dataset.sel] = 1; else delete S.sel[t.dataset.sel]; var bar = document.querySelector('.zp-bulk'); if (bar) bar.outerHTML = bulkHTML(); return; }
      if (t.dataset.act === 'b-all') { R.matched.forEach(function (q) { if (t.checked) S.sel[q.id] = 1; else delete S.sel[q.id]; }); return paint(false); }
      if (t.id === 'zp-bsort') { S.sort = t.value; return paint(false); }
    };
    host.oninput = function (e) { if (e.target.id === 'zp-bq') { S.q = e.target.value; S.page = 0; clearTimeout(host.__t); host.__t = setTimeout(function () { paint(false); }, 180); } };
    paint(true);
    return { cleanup: function () { closePopup(); document.removeEventListener('keydown', onKey); } };
  }

  root.ZPBrowse = { mount: mount, newState: newState, loadSets: loadSets };
})(window);
