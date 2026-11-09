/* roadmap.html: the derived "Today" strip and the chapter path (stage dots per chapter). Nothing here is hand-set. */
(async function () {
  'use strict';
  var strip = document.getElementById('zp-today'), path = document.getElementById('zp-chapter-path');
  if (!strip || !path || typeof getCurrentStudent !== 'function') return;
  var chaptersBtn = document.querySelector('#roadmap-view-switch [data-view="chapters"]');
  var student = getCurrentStudent(); if (!student) return;
  var ZP = window.ZP, UI = window.ZPUI, CFG = window.ZP_CONFIG, esc = UI.esc;
  var courseId = new URLSearchParams(location.search).get('course') || localStorage.getItem('activeCourseId');
  var course = (student.courses || []).filter(function (c) { return c.id === courseId; })[0];
  if (!course || !CFG.COURSES[courseId] || (CFG.LEGACY_ROADMAP || []).indexOf(courseId) >= 0) return; // other courses (and legacy-roadmap ones) keep the plain roadmap
  var cid = encodeURIComponent(courseId);
  var data, store, plan = null;
  try { data = await ZPBanks.load(courseId); } catch (e) { return; }
  store = ZP.open(student.username, courseId); await store.load();
  try { plan = await ZPPlan.load(student.username, courseId); } catch (e) { plan = null; }
  var D = ZP.derive(store.events(), data.info), T = ZP.today(D, plan);
  var HASH = { B: 'b', C: 'c', R: 'r', T: 't', X: 'x' };
  var a = T.action, href;
  if (a.kind === 'warmup') href = 'notebook.html?course=' + cid + '&view=redo&mode=warmup&ch=' + encodeURIComponent(a.ch);
  else if (a.kind === 'due') href = 'notebook.html?course=' + cid + '&view=redo';
  else if (a.kind === 'stage') href = 'chapter.html?course=' + cid + '&ch=' + encodeURIComponent(a.ch) + '#' + HASH[a.stage];
  else if (a.kind === 'item') href = ZP.itemHref(a.item, courseId);
  else href = 'practice.html?course=' + cid + '#mock';
  var extra = [];
  if (T.due.length && a.kind !== 'due') extra.push(T.due.length + ' review' + (T.due.length > 1 ? 's' : '') + ' due');
  if (T.warmup.length && a.kind !== 'warmup') extra.push('warm-up ready');
  var track = T.onTrack ? '<span class="zp-track ' + T.onTrack.state + '">' + esc(T.onTrack.text) + '</span>' : '';
  strip.innerHTML = '<div><p class="zp-eyebrow">Today</p><h2>' + esc(a.label) + track + '</h2><p class="zp-muted">' + esc(a.detail) + (extra.length ? ' · ' + esc(extra.join(' · ')) : '') + '</p></div>' +
    '<a class="zp-btn primary" href="' + href + '">' + (a.kind === 'done' ? 'Run a mock' : 'Go') + '</a>';
  strip.className = 'zp-today'; strip.hidden = false;

  var info = data.info, LABEL = { B: 'B', C: 'C', R: 'R', T: 'T', X: 'N' }, CU = D.curriculum;
  function chapterRow(c) {
    var S = D.stages[c], m = info.chapters[c];
    var dots = ['B', 'C', 'R', 'T', 'X'].map(function (k) {
      var s = S[k]; var cls = !s ? 'na' : s.done ? 'done' : s.optional ? 'opt' : (S.next === k ? 'active' : '');
      return '<span class="zp-dot ' + cls + '" title="' + (s ? ZP.STAGE_NAME[k] + (s.done ? ' · done' : s.optional ? ' · optional' : '') : 'not part of this chapter') + '">' + LABEL[k] + '</span>';
    }).join('');
    var right = S.complete ? (S.X.done ? 'Closed' : 'Complete') : c === D.current ? 'Current' : '';
    var ms = plan && (plan.milestones || []).filter(function (x) { return x.type === 'chapter' && String(x.ch) === String(c); })[0];
    return '<a class="zp-prow' + (c === D.current ? ' cur' : '') + '" href="chapter.html?course=' + cid + '&ch=' + encodeURIComponent(c) + '#hub"><span class="zp-muted">Ch ' + esc(c) + '</span><span>' + esc(m.title) + '</span>' +
      '<span class="zp-dots">' + dots + '</span><span class="zp-muted">' + esc(right || (ms ? 'by ' + UI.fmtISO(ms.end) : '')) + '</span></a>';
  }
  // Checkpoints and the Chapter M items: one status dot, a label and where it stands.
  function itemRow(r) {
    var cls = r.done ? 'done' : r.optional ? 'opt' : (CU.next && CU.next.id === r.id ? 'active' : '');
    var right = r.done ? 'Done' : r.kind === 'set' ? (r.cur ? r.cur + ' / ' + r.total : r.total + ' problems') : r.kind === 'checkpoint' ? (r.optional ? 'Optional' : r.due ? 'Due now' : 'After Ch ' + r.chapters[r.chapters.length - 1]) : (r.optional ? 'Optional' : 'Not taken');
    var sub = r.kind === 'checkpoint' ? '40 problems · 80 min' : r.kind === 'mock' ? (/^ap-/.test(r.id) ? 'Past AP free response · 90 min' : 'Full mock') : 'Fixed set';
    return '<a id="zp-row-' + esc(r.id) + '" class="zp-prow zp-pitem' + (r.kind === 'checkpoint' ? ' cp' : '') + (CU.next && CU.next.id === r.id ? ' cur' : '') + '" href="' + ZP.itemHref(r, courseId) + '"><span class="zp-muted">' + esc(r.label) + '</span><span>' + esc(r.title) + ' <span class="zp-muted">· ' + sub + '</span></span>' +
      '<span class="zp-dots"><span class="zp-dot ' + cls + '" title="' + esc(r.title) + '">' + (r.kind === 'checkpoint' ? '\u2605' : r.kind === 'set' ? 'S' : 'M') + '</span></span><span class="zp-muted">' + esc(right) + '</span></a>';
  }
  function mHead() {
    var M = CU.m; return '<div class="zp-mhead" id="zp-row-M"><b>' + esc(M.title) + '</b><span class="zp-muted">' + M.done + ' of ' + M.total + ' done' + (CU.selfStudy ? ' · all optional' : M.unlocked ? '' : ' · opens after Chapter ' + info.order[info.order.length - 1]) + '</span></div>';
  }
  var head = CU ? 'Chapters · B Book · C Problems · R Review · N Concepts Notebook · T Test (optional) · \u2605 Checkpoint · Chapter M Exam block' : 'Chapters · B Book · C Problems · R Review · T Test · N Concepts Notebook';
  var html = '', mOpen = false;
  if (!CU) html = info.order.map(chapterRow).join('');
  else CU.rows.forEach(function (r) {
    if (r.kind === 'chapter') html += chapterRow(r.ch);
    else if (r.group === 'M') { if (!mOpen) { html += mHead(); mOpen = true; } html += itemRow(r); }
    else html += itemRow(r);
  });
  path.innerHTML = '<div class="zp-path-head">' + head + '</div>' + html;
  // Curve view: the chapters of the platform, coloured by derived progress; a click opens that chapter. With a curriculum the checkpoints
  // sit between chapters and Chapter M closes the curve.
  if (typeof renderRoadmapCurve === 'function') {
    var curve = [];
    function node(label, status, title, href) { curve.push({ label: label, status: status, title: title, href: href }); }
    var order = CU ? CU.rows.filter(function (r) { return r.group !== 'M'; }) : info.order.map(function (c) { return { kind: 'chapter', ch: c }; });
    curve = [];
    order.forEach(function (r) {
      if (r.kind === 'chapter') {
        var c = r.ch, S = D.stages[c], started = S.seq.some(function (k) { return S[k].started || S[k].done; }), done = S.seq.filter(function (k) { return S[k].done; }).length;
        node(c, S.complete ? 'Complete' : (started || c === D.current) ? 'Unlocked' : 'Locked', 'Chapter ' + c + ' · ' + info.chapters[c].title + ' — ' + done + ' of ' + S.seq.length + ' stages done', 'chapter.html?course=' + cid + '&ch=' + encodeURIComponent(c) + '#hub');
      } else node(r.label, r.done ? 'Complete' : (r.due && !r.optional) ? 'Unlocked' : 'Locked', r.title + (r.done ? ' — taken' : r.optional ? ' — optional for you' : r.due ? ' — due now' : ' — opens after its chapters') + ' (click to open it)', ZP.itemHref(r, courseId));
    });
    if (CU && CU.m.total) {
      var M = CU.m, nextM = M.rows.filter(function (r) { return !r.done; })[0];
      node('M', M.complete ? 'Complete' : (M.done || M.unlocked) ? 'Unlocked' : 'Locked', M.title + ' — ' + M.done + ' of ' + M.total + ' done (click to see it in the chapter list)', '#zp-row-M');
    }
    renderRoadmapCurve(course, { groups: curve, legend: [['Complete', 'Done'], ['Unlocked', 'In progress'], ['Locked', 'Not started']] });
  }
  // #zp-row-<id> (from the Curve): show the chapter list and scroll to that row.
  function showRow() {
    var m = /^#zp-row-(.+)$/.exec(location.hash || ''); if (!m) return;
    if (chaptersBtn) chaptersBtn.click();
    var el = document.getElementById('zp-row-' + m[1]); if (!el) return;
    el.scrollIntoView({ block: 'center' }); el.classList.add('zp-flash'); setTimeout(function () { el.classList.remove('zp-flash'); }, 2200);
  }
  window.addEventListener('hashchange', showRow); showRow();
  var curveSvg = document.getElementById('roadmap-curve-svg'); if (curveSvg) curveSvg.addEventListener('click', function () { setTimeout(showRow, 0); });
  window.ZPToday = { derived: D };
})();
