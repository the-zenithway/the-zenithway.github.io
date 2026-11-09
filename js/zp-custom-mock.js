/* Custom mock builder (Practice > Mock), modelled on the SAT site's Mock Exam / Test builder:
 *   - sections like the real exam (each can be switched off; question count and minutes are editable),
 *   - which banks to draw from, and a scope (everything / not tried yet / not answered right) that falls back to the full pool when it runs thin,
 *   - a per-chapter weight table (0 leaves a chapter out) with Even / Weak chapters first / Reset, like the SAT site's per-skill table,
 *   - the result is a fixed mock with the same sections, timers and results page as the official ones, saved under "Your custom mocks".
 * The pure part (plan) is exported for tests; mount() draws the panel. Definitions are kept in this browser by the hub (js/zp-hub.js). */
(function (root) {
  'use strict';
  var UI = root.ZPUI, esc = UI ? UI.esc : function (s) { return String(s); };

  function shuffle(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function srcOf(q, info) { return q.kind === 'F' ? 'F' : q.frq ? 'C' : (info.setOf && info.setOf[q.id]) ? 'S' : q.kind; } // MCQ: T / C / S(et); FRQ: F (AP archive) / C (chapter bank)
  function chOf(q, info) { return (info.setOf && info.setOf[q.id]) || q.chapter; }
  function calcOk(sec, q) { return sec.calculator === true ? q.calc === 'yes' : sec.calculator === false ? q.calc === 'no' : true; }

  function defaults(exam, avail) {
    var secs = {};
    exam.sections.forEach(function (s) { secs[s.id] = { on: s.available !== false && (avail[s.kind] || false), count: s.count, minutes: s.minutes }; });
    return { name: '', secs: secs, src: { T: true, S: true, C: false }, fsrc: { F: true, C: false }, scope: 'all', weights: {} };
  }

  // Everything a section could draw from, before the scope filter. opts: {data, info, D, cfg, sec, used (ids already in this mock)}
  function pool(o, relaxed) {
    var cfg = o.cfg, sec = o.sec, info = o.info, D = o.D;
    return o.data.problems.filter(function (q) {
      if (q.blocked || o.used[q.id] || (sec.kind === 'frq') !== !!q.frq || !calcOk(sec, q)) return false;
      var s = srcOf(q, info);
      if (sec.kind === 'frq' ? !cfg.fsrc[s] : !cfg.src[s]) return false;
      if (sec.kind === 'mcq' && cfg.weights[chOf(q, info)] === 0) return false;
      if (!relaxed && cfg.scope === 'unseen') return !D.q[q.id];
      if (!relaxed && cfg.scope === 'notright') return !(D.q[q.id] && D.q[q.id].last && D.q[q.id].last.correct);
      return true;
    });
  }

  // n problems spread over chapters in proportion to their weights, capped by what each chapter has (largest remainder).
  function allocate(list, n, weights, info) {
    var groups = {}; shuffle(list).forEach(function (q) { (groups[chOf(q, info)] = groups[chOf(q, info)] || []).push(q.id); });
    var out = [], left = n;
    function w(k) { return weights[k] === undefined ? 1 : weights[k]; }
    for (var guard = 0; left > 0 && guard < 50; guard++) {
      var keys = Object.keys(groups).filter(function (k) { return groups[k].length && w(k) > 0; });
      if (!keys.length) break;
      var tw = keys.reduce(function (a, k) { return a + w(k); }, 0), shares = keys.map(function (k) { var x = left * w(k) / tw; return { k: k, x: x, n: Math.min(Math.floor(x), groups[k].length) }; });
      var rem = left - shares.reduce(function (a, s) { return a + s.n; }, 0);
      shares.sort(function (a, b) { return (b.x - Math.floor(b.x)) - (a.x - Math.floor(a.x)); });
      for (var i = 0; rem > 0 && i < shares.length * 2; i++) { var s = shares[i % shares.length]; if (s.n < groups[s.k].length) { s.n++; rem--; } }
      var got = 0; shares.forEach(function (s) { for (var j = 0; j < s.n; j++) { out.push(groups[s.k].shift()); got++; } });
      if (!got) break; left -= got;
    }
    return out;
  }

  // Build a plan from a config: {sections: {id: ids}, defs: [section specs actually used], notes: [text], short: bool}.
  function plan(o) {
    var cfg = o.cfg, used = {}, sections = {}, defs = [], notes = [];
    o.exam.sections.forEach(function (sec) {
      var c = cfg.secs[sec.id]; if (!c || !c.on || !(c.count > 0)) return;
      var base = { data: o.data, info: o.info, D: o.D, cfg: cfg, sec: sec, used: used };
      var picked = allocate(pool(base, false), c.count, cfg.weights, o.info), filled = 0;
      if (picked.length < c.count && cfg.scope !== 'all') { // scope ran thin: top up from the full pool, like the SAT site
        picked.forEach(function (id) { used[id] = 1; });
        var more = allocate(pool(base, true), c.count - picked.length, cfg.weights, o.info); filled = more.length; picked = picked.concat(more);
      }
      if (!picked.length) { notes.push(sec.name + ': nothing matches, left out.'); return; }
      if (picked.length < c.count) notes.push(sec.name + ': only ' + picked.length + ' of ' + c.count + ' problems are available.');
      if (filled) notes.push(sec.name + ': ' + filled + ' problem' + (filled === 1 ? '' : 's') + ' you have already done were added to fill it.');
      picked.forEach(function (id) { used[id] = 1; });
      sections[sec.id] = sec.kind === 'mcq' ? shuffle(picked) : picked;
      defs.push({ id: sec.id, name: sec.name, kind: sec.kind, count: picked.length, minutes: Math.max(1, Math.round(c.minutes)), calculator: sec.calculator, available: true });
    });
    return { sections: sections, defs: defs, notes: notes, empty: !defs.length };
  }

  function toMock(p, name, uid, exam) {
    return { mock: { id: 'cm-' + uid, name: name, sections: p.sections },
      exam: { name: 'Custom mock', sections: p.defs, scoring: Object.assign({}, exam.scoring, { noEstimate: true }),
        notes: ['A mock you built: the same sections and timers as the real exam, but your own length and topics, so it gets no AP estimate.', 'Free-response questions are worked on paper and self-scored at the end.'] },
      created: Date.now() };
  }

  /* ---------- panel ---------- */
  // o: {host, data, info, exam, derive(), stats(), cfg, save(cfg), onCreate(def)}
  function mount(o) {
    var host = o.host, cfg = o.cfg;
    function D() { return o.derive(); }
    function avail() { var base = { data: o.data, info: o.info, D: D(), cfg: Object.assign({}, cfg, { scope: 'all', weights: {} }), used: {} }; var a = {}; o.exam.sections.forEach(function (s) { a[s.id] = pool(Object.assign({ sec: s }, base), true).length; }); return a; }
    function chapterTable() {
      var base = { data: o.data, info: o.info, D: D(), cfg: Object.assign({}, cfg, { weights: {} }), used: {} }, rows = {};
      o.exam.sections.filter(function (s) { return s.kind === 'mcq'; }).forEach(function (s) { pool(Object.assign({ sec: s }, base), false).forEach(function (q) { var k = chOf(q, o.info); rows[k] = (rows[k] || 0) + 1; }); });
      return Object.keys(rows).sort(function (a, b) { var A = parseInt(a, 10), B = parseInt(b, 10); return (isNaN(A) ? 99 : A) - (isNaN(B) ? 99 : B) || (a < b ? -1 : 1); }).map(function (k) { return [k, rows[k]]; });
    }
    function draw() {
      var av = avail(), hasF = o.data.problems.some(function (q) { return q.kind === 'F' && q.frq; }), ST = o.stats();
      var secRows = o.exam.sections.map(function (s) {
        var c = cfg.secs[s.id] || { on: false, count: s.count, minutes: s.minutes }, off = s.available === false || !av[s.id];
        return '<tr><td><label><input type="checkbox" data-cm="on" data-sec="' + esc(s.id) + '"' + (c.on && !off ? ' checked' : '') + (off ? ' disabled' : '') + '> ' + esc(s.name) + '</label></td>' +
          '<td><input type="number" min="1" max="' + Math.max(1, av[s.id]) + '" value="' + c.count + '" data-cm="count" data-sec="' + esc(s.id) + '" style="width:70px"' + (off ? ' disabled' : '') + '></td>' +
          '<td><input type="number" min="1" max="300" value="' + c.minutes + '" data-cm="minutes" data-sec="' + esc(s.id) + '" style="width:70px"' + (off ? ' disabled' : '') + '></td><td class="zp-muted">' + (off ? 'none available' : av[s.id] + ' available') + '</td></tr>';
      }).join('');
      function chip(group, key, label, on) { return '<label class="zp-chip' + (on ? ' on' : '') + '"><input type="checkbox" data-cm="' + group + '" data-key="' + key + '"' + (on ? ' checked' : '') + ' hidden>' + label + '</label>'; }
      var hasT = o.data.problems.some(function (q) { return q.kind === 'T'; }), hasC = o.data.problems.some(function (q) { return q.kind === 'C' && !q.frq && !(o.info.setOf && o.info.setOf[q.id]); }), hasS = (o.info.sets || []).some(function (x) { return !x.frq && !x.ap; });
      var hasCf = o.data.problems.some(function (q) { return q.kind === 'C' && q.frq; });
      var src = [hasT ? chip('src', 'T', 'Chapter test problems', cfg.src.T) : '', hasC ? chip('src', 'C', 'Chapter problems', cfg.src.C) : '', hasS ? chip('src', 'S', 'Mixed sets (C11)', cfg.src.S) : ''].join('');
      var fsrc = [hasF ? chip('fsrc', 'F', 'AP free-response archive', cfg.fsrc.F) : '', hasCf ? chip('fsrc', 'C', 'Chapter free-response bank', cfg.fsrc.C) : ''].join('');
      var wrows = chapterTable().map(function (r) {
        var k = r[0], wv = cfg.weights[k] === undefined ? 1 : cfg.weights[k], pct = ST.byChapter[k] && ST.byChapter[k].pct != null ? ' · ' + Math.round(100 * ST.byChapter[k].pct) + '% right' : '';
        return '<tr><td>' + esc(/^\d+$/.test(k) ? 'Ch ' + k + (o.info.chapters[k] ? ' · ' + o.info.chapters[k].title : '') : k) + '</td><td class="zp-muted">' + r[1] + ' problems' + pct + '</td><td><input type="number" min="0" max="9" step="1" value="' + wv + '" data-cm="weight" data-key="' + esc(k) + '" style="width:60px"></td></tr>';
      }).join('');
      var p = plan({ cfg: cfg, data: o.data, info: o.info, D: D(), exam: o.exam }), tq = p.defs.reduce(function (a, s) { return a + s.count; }, 0), tm = p.defs.reduce(function (a, s) { return a + s.minutes; }, 0);
      host.innerHTML = '<section class="zp-panel"><h2>Build your own mock</h2><p class="zp-muted">Real exam structure, your own length and topics. Switch sections on or off, set how many questions and minutes each gets, and choose where the problems come from. The mock is fixed once you create it, with the same timers and results page as the official ones.</p>' +
        '<label class="zp-field"><span>Name (optional)</span><input type="text" data-cm="name" maxlength="60" value="' + esc(cfg.name) + '" placeholder="e.g. Integrals and series warm-up"></label>' +
        '<table class="zp-table"><thead><tr><th>Section</th><th>Questions</th><th>Minutes</th><th></th></tr></thead><tbody>' + secRows + '</tbody></table>' +
        '<div class="zp-filters"><label>Multiple choice from<span class="zp-chips">' + (src || '<span class="zp-muted">none</span>') + '</span></label>' + (fsrc ? '<label>Free response from<span class="zp-chips">' + fsrc + '</span></label>' : '') +
        '<label>Only<select data-cm="scope"><option value="all"' + (cfg.scope === 'all' ? ' selected' : '') + '>All problems</option><option value="unseen"' + (cfg.scope === 'unseen' ? ' selected' : '') + '>Not tried yet</option><option value="notright"' + (cfg.scope === 'notright' ? ' selected' : '') + '>Not answered right yet</option></select></label></div>' +
        '<details' + (Object.keys(cfg.weights).length ? ' open' : '') + '><summary class="zp-muted">Chapter weights (how the multiple-choice questions are spread; 0 leaves a chapter out)</summary>' +
        '<p><button type="button" class="photo-tray-clear" data-cm="even">Even</button> <button type="button" class="photo-tray-clear" data-cm="weak">Weak chapters first</button> <button type="button" class="photo-tray-clear" data-cm="reset">Reset</button></p>' +
        '<table class="zp-table"><tbody>' + (wrows || '<tr><td class="zp-muted">No problems match.</td></tr>') + '</tbody></table></details>' +
        '<p class="zp-muted"><b>' + tq + ' question' + (tq === 1 ? '' : 's') + ' · ' + tm + ' minutes</b>' + (p.notes.length ? '<br>' + p.notes.map(esc).join('<br>') : '') + '</p>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-cm="create"' + (p.empty ? ' disabled' : '') + '>Create mock</button></div></section>';
    }
    host.onchange = function (e) {
      var t = e.target, k = t.dataset.cm; if (!k) return;
      if (k === 'on') cfg.secs[t.dataset.sec].on = t.checked;
      else if (k === 'count') cfg.secs[t.dataset.sec].count = Math.max(1, Math.round(+t.value || 1));
      else if (k === 'minutes') cfg.secs[t.dataset.sec].minutes = Math.max(1, Math.round(+t.value || 1));
      else if (k === 'src' || k === 'fsrc') cfg[k][t.dataset.key] = t.checked;
      else if (k === 'scope') cfg.scope = t.value;
      else if (k === 'name') { cfg.name = t.value; o.save(cfg); return; }
      else if (k === 'weight') { var v = Math.max(0, Math.min(9, Math.round(+t.value))); cfg.weights[t.dataset.key] = isNaN(v) ? 1 : v; }
      else return;
      o.save(cfg); draw();
    };
    host.onclick = function (e) {
      var b = e.target.closest('[data-cm]'); if (!b || b.tagName === 'INPUT' || b.tagName === 'SELECT') return;
      var k = b.dataset.cm;
      if (k === 'even' || k === 'reset') cfg.weights = {};
      else if (k === 'weak') { var ST = o.stats(); cfg.weights = {}; chapterTable().forEach(function (r) { var s = ST.byChapter[r[0]]; cfg.weights[r[0]] = s && s.pct != null ? Math.max(1, Math.round(1 + 4 * (1 - s.pct))) : 2; }); }
      else if (k === 'create') {
        var p = plan({ cfg: cfg, data: o.data, info: o.info, D: D(), exam: o.exam }); if (p.empty) return;
        var n = (o.nextNumber ? o.nextNumber() : 1), name = (cfg.name || '').trim() || 'Custom mock ' + n;
        o.onCreate(toMock(p, name, root.ZP.uid(), o.exam)); return;
      } else return;
      o.save(cfg); draw();
    };
    draw();
  }

  root.ZPCustomMock = { mount: mount, plan: plan, toMock: toMock, defaults: defaults, allocate: allocate };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.ZPCustomMock;
})(typeof window === 'undefined' ? globalThis : window);
