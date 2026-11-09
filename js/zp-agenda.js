/* "My agenda" on the calendar page: the student's own to-dos, events and planned mocks, merged with the long-term plan's
 * milestones and the reviews that are due, in one list for the next three weeks.
 * Personal items are events in the student's own log (type cal_item, latest per key wins), so they sync like everything else. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, esc = UI.esc;
  var KINDS = { todo: 'To-do', event: 'Event', mock: 'Mock' };
  var DAYS_AHEAD = 21;

  function iso(ms) { return ZP.toISO(ms); }
  function dayLabel(d, today) {
    if (d < today) return 'Overdue';
    if (d === today) return 'Today';
    if (d === ZP.addDays(today, 1)) return 'Tomorrow';
    var p = d.split('-'), dt = new Date(+p[0], +p[1] - 1, +p[2]);
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dt.getDay()] + ' ' + UI.fmtISO(d);
  }

  function mount(host, ctx) {
    var store = ZP.open(ctx.student.username, ctx.course.id), plan = null, cid = encodeURIComponent(ctx.course.id);
    // Local calendar day, not UTC, so "today" matches the student's clock.
    function todayKey() { return ZP.dayKey(Date.now()); }
    // Items come from the derived log, so ones the mentor put on the calendar (marked by `by`) show up too, with ticks kept separate.
    function items() {
      var D = ZP.derive(store.events(), { order: [], chapters: {} });
      return Object.keys(D.cal).map(function (k) { return D.cal[k]; }).filter(function (e) { return !e.deleted; });
    }
    function agenda() {
      var today = todayKey(), end = ZP.addDays(today, DAYS_AHEAD), rows = [];
      items().forEach(function (e) {
        if (e.done && e.date < today) return;
        if (e.date <= end) rows.push({ date: e.date < today && !e.done ? 'overdue' : e.date, kind: e.kind, title: e.title + (e.time ? ' · ' + e.time : ''), key: e.key, done: !!e.done, mine: !e.by, byMentor: !!e.by });
      });
      ((plan && plan.milestones) || []).forEach(function (m) {
        if (m.type === 'chapter') {
          if (m.start >= today && m.start <= end) rows.push({ date: m.start, kind: 'plan', title: 'Start ' + m.label, mine: false });
          if (m.end >= today && m.end <= end) rows.push({ date: m.end, kind: 'plan', title: 'Finish ' + m.label, mine: false });
        } else if (m.start >= today && m.start <= end) rows.push({ date: m.start, kind: m.type === 'exam' ? 'exam' : m.type === 'mock' ? 'mock' : 'plan', title: m.label, mine: false, href: m.type === 'mock' ? 'practice.html?course=' + cid + '#mock' : '' });
      });
      var D = ZP.derive(store.events(), { order: [], chapters: {} }), due = ZP.dueEntries(D).length;
      if (due) rows.push({ date: today, kind: 'review', title: due + ' review' + (due > 1 ? 's' : '') + ' due', mine: false, href: 'notebook.html?course=' + cid + '&view=redo' });
      return rows.sort(function (a, b) { var da = a.date === 'overdue' ? '0' : a.date, db = b.date === 'overdue' ? '0' : b.date; return da < db ? -1 : da > db ? 1 : 0; });
    }
    function render() {
      var today = todayKey(), rows = agenda(), last = null, html = '';
      rows.forEach(function (r) {
        var label = r.date === 'overdue' ? 'Overdue' : dayLabel(r.date, today);
        if (label !== last) { html += '<h3 class="zp-agday">' + esc(label) + '</h3>'; last = label; }
        var badge = r.kind === 'plan' ? 'Plan' : r.kind === 'review' ? 'Review' : r.kind === 'exam' ? 'Exam' : KINDS[r.kind] || r.kind;
        html += '<div class="zp-agrow' + (r.done ? ' done' : '') + '">' + ((r.mine || r.byMentor) && r.kind === 'todo' ? '<input type="checkbox" data-done="' + esc(r.key) + '"' + (r.done ? ' checked' : '') + ' aria-label="Done">' : '<span class="zp-agdot"></span>') +
          '<span class="zp-badge ' + (r.kind === 'plan' ? '' : 'warn') + '">' + esc(r.byMentor ? 'Mentor ' + badge.toLowerCase() : badge) + '</span><span class="zp-agtitle">' + (r.href ? '<a href="' + esc(r.href) + '">' + esc(r.title) + '</a>' : esc(r.title)) + '</span>' +
          (r.mine ? '<button type="button" class="zp-linkbtn" data-del="' + esc(r.key) + '" aria-label="Delete">Delete</button>' : '') + '</div>';
      });
      host.innerHTML = '<section class="zp-panel"><h2>My agenda</h2><p class="zp-muted">The next three weeks: your own to-dos and events, planned mocks, the plan\'s chapter dates, and reviews due.</p>' +
        (html || '<p class="zp-muted">Nothing planned yet. Add a to-do or schedule a mock below.</p>') +
        '<div class="zp-agadd"><select id="zp-agkind" aria-label="Kind">' + Object.keys(KINDS).map(function (k) { return '<option value="' + k + '">' + KINDS[k] + '</option>'; }).join('') + '</select>' +
        '<input type="date" id="zp-agdate" value="' + esc(today) + '" aria-label="Date"><input type="text" id="zp-agtitle" maxlength="100" placeholder="e.g. Finish Chapter 5 problems, or Full mock 2" aria-label="Title"><button type="button" class="zp-btn primary" data-act="ag-add">Add</button></div></section>';
    }
    host.onclick = function (e) {
      var a = e.target.closest('[data-act="ag-add"]');
      if (a) {
        var t = document.getElementById('zp-agtitle').value.trim(), d = document.getElementById('zp-agdate').value, k = document.getElementById('zp-agkind').value;
        if (!t || !d) { document.getElementById(t ? 'zp-agdate' : 'zp-agtitle').focus(); return; }
        store.append('cal_item', { key: 'c' + Date.now().toString(36), date: d, title: t, kind: k, done: false }); return render();
      }
      var del = e.target.closest('[data-del]');
      if (del) { var cur = items().filter(function (x) { return x.key === del.dataset.del; })[0]; if (cur) store.append('cal_item', { key: cur.key, date: cur.date, time: cur.time || '', title: cur.title, kind: cur.kind, done: cur.done, deleted: true }); render(); }
    };
    host.onchange = function (e) {
      var c = e.target.closest('[data-done]'); if (!c) return;
      var cur = items().filter(function (x) { return x.key === c.dataset.done; })[0]; if (cur) store.append('cal_done', { key: cur.key, done: c.checked }); render();
    };
    store.load().then(function () { return root.ZPPlan ? ZPPlan.load(ctx.student.username, ctx.course.id) : null; }).then(function (p) { plan = p; render(); }).catch(function () { render(); });
  }

  root.ZPAgenda = { mount: mount };
})(window);
