/* Long-term plan: one dated roadmap per student x course. The teacher builds it (auto-generate, then tweak);
 * students and parents view it. Stored as a small document: on the student-data endpoint when configured,
 * otherwise in this browser only. Library (ZPPlan) + calendar.html UI (ZPPlan.mountCalendar). */
(function (root) {
  'use strict';
  var ZP = root.ZP, CFG = root.ZP_CONFIG, UI = root.ZPUI, esc = UI.esc;
  var LOCAL = 'zenith:zp:v1:plan:';

  function key(username, course) { return 'plan:' + username + ':' + course; }
  function load(username, course) {
    var k = key(username, course), local = null;
    try { local = JSON.parse(localStorage.getItem(LOCAL + k)); } catch (e) { local = null; }
    if (CFG.CLOUD_RAW_URL) { // plans are committed files too: read them straight from GitHub (404 = no plan saved yet)
      var file = CFG.CLOUD_RAW_URL.replace(/\/+$/, '') + '/docs/' + k.replace(/[^A-Za-z0-9_.-]/g, '__') + '.json?_=' + Date.now();
      return root.ZP.fetchT(file, null, 5000).then(function (r) { return r.ok ? r.json() : null; }).then(function (d) { return d && d.value ? d.value : local; }).catch(function () { return local; });
    }
    if (!CFG.DATA_URL) return Promise.resolve(local);
    return (root.ZP && root.ZP.fetchT ? root.ZP.fetchT(CFG.DATA_URL + '?action=doc&key=' + encodeURIComponent(k), null, 4000) : fetch(CFG.DATA_URL + '?action=doc&key=' + encodeURIComponent(k))).then(function (r) { return r.json(); })
      .then(function (res) { return res.ok ? (res.value || null) : local; }).catch(function () { return local; });
  }
  function save(username, course, plan, by) {
    var k = key(username, course);
    plan.updatedAt = Date.now(); plan.updatedBy = by || '';
    try { localStorage.setItem(LOCAL + k, JSON.stringify(plan)); } catch (e) { /* storage blocked */ }
    if (!CFG.DATA_URL) return Promise.resolve({ ok: true, local: true });
    return fetch(CFG.DATA_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'putDoc', key: k, value: plan, by: by || '' }) })
      .then(function (r) { return r.json(); });
  }

  /* ---------- gantt ---------- */
  function ganttHTML(plan) {
    var ms = (plan.milestones || []).filter(function (m) { return m.start; });
    if (!ms.length) return '<p class="zp-muted">No milestones yet.</p>';
    var todayISO = ZP.toISO(Date.now());
    var min = ms.reduce(function (a, m) { return m.start < a ? m.start : a; }, ms[0].start);
    var max = ms.reduce(function (a, m) { var e = m.end || m.start; return e > a ? e : a; }, ms[0].end || ms[0].start);
    min = ZP.addDays(min, -2); max = ZP.addDays(max, 2);
    var span = Math.max(1, ZP.daysBetween(min, max));
    function pct(iso) { return Math.max(0, Math.min(100, 100 * ZP.daysBetween(min, iso) / span)); }
    var scale = '', cur = min.slice(0, 7) + '-01';
    while (cur <= max) {
      if (cur >= min) scale += '<span style="left:' + pct(cur).toFixed(2) + '%">' + UI.fmtISO(cur).split(' ')[0] + (cur.slice(5, 7) === '01' ? ' ' + cur.slice(0, 4) : '') + '</span>';
      var p = cur.split('-'), y = +p[0], m = +p[1] + 1; if (m > 12) { m = 1; y++; }
      cur = y + '-' + String(m).padStart(2, '0') + '-01';
    }
    var tline = todayISO >= min && todayISO <= max ? '<div class="zp-today-line" style="left:' + pct(todayISO).toFixed(2) + '%" title="Today"></div>' : '';
    var rows = ms.map(function (m) {
      var l = pct(m.start), w = Math.max(0.8, pct(m.end || m.start) - l);
      return '<div class="zp-grow"><div class="zp-gl" title="' + esc(m.label) + '">' + esc(m.label) + '</div><div class="zp-gtrack"><div class="zp-gbar ' + esc(m.type) + '" style="left:' + l.toFixed(2) + '%;width:' + w.toFixed(2) + '%" title="' + esc(m.label + ' · ' + UI.fmtISO(m.start) + (m.end && m.end !== m.start ? ' – ' + UI.fmtISO(m.end) : '')) + '"></div>' + tline + '</div></div>';
    }).join('');
    return '<div class="zp-gantt"><div class="zp-gantt-scale">' + scale + '</div>' + rows + '</div>';
  }

  /* ---------- calendar.html section ---------- */
  // only (optional) {username, course}: lock the editor to one student and course (the teacher's student page).
  function mountCalendar(host, person, only) {
    var editable = person.role === 'teacher' || person.role === 'admin';
    var who = null, courseId = null, plan = null;

    function studentsFor() {
      if (person.role === 'student') return STUDENTS.filter(function (s) { return s.username === person.username; });
      if (person.role === 'parent') { var p = PARENTS.filter(function (x) { return x.username === person.username; })[0]; return STUDENTS.filter(function (s) { return p && (p.linkedStudents || []).indexOf(s.username) >= 0; }); }
      return STUDENTS.filter(function (s) { return (s.courses || []).some(function (c) { return CFG.COURSES[c.id]; }); });
    }
    var roster = studentsFor().filter(function (s) { return (s.courses || []).some(function (c) { return CFG.COURSES[c.id]; }); });
    if (!roster.length) { host.innerHTML = ''; return; }
    if (only) roster = roster.filter(function (r) { return r.username === only.username; });
    if (!roster.length) { host.innerHTML = ''; return; }
    who = roster[0].username; if (only) courseId = only.course;

    function coursesOf(u) { var s = STUDENTS.filter(function (x) { return x.username === u; })[0]; return ((s && s.courses) || []).filter(function (c) { return CFG.COURSES[c.id]; }); }
    function pick() { var cs = coursesOf(who); if (!cs.some(function (c) { return c.id === courseId; })) courseId = cs[0].id; }

    function reload() {
      pick();
      host.innerHTML = '<section class="zp-plan"><h2 class="teacher-section-title">Long-term plan</h2><p class="zp-muted">Loading…</p></section>';
      load(who, courseId).then(function (p) { plan = p; render(); });
    }
    function render() {
      var cs = coursesOf(who), s = STUDENTS.filter(function (x) { return x.username === who; })[0];
      var picker = '';
      if (roster.length > 1 && !only) picker += '<label class="zp-field inline"><span>Student</span><select id="zp-plan-who">' + roster.map(function (r) { return '<option value="' + esc(r.username) + '"' + (r.username === who ? ' selected' : '') + '>' + esc(r.name) + '</option>'; }).join('') + '</select></label> ';
      if (cs.length > 1 && !only) picker += '<label class="zp-field inline"><span>Course</span><select id="zp-plan-course">' + cs.map(function (c) { return '<option value="' + esc(c.id) + '"' + (c.id === courseId ? ' selected' : '') + '>' + esc(c.name) + '</option>'; }).join('') + '</select></label>';
      var note = !CFG.DATA_URL ? '<p class="zp-localnote">Plans are saved in this browser only until the student-data script is deployed (see automation/README.md). Students and parents on other devices will not see them yet.</p>' : '';
      var body;
      if (!plan) {
        body = editable ? '<p>No plan for ' + esc(s.name) + ' yet. Set a start date and the AP exam date and we will spread the chapters out; you can then adjust any date.</p>' + formHTML(null)
          : '<p class="zp-muted">Your teacher has not set up a long-term plan for this course yet.</p>';
      } else {
        body = ganttHTML(plan) + (editable ? editHTML() : listHTML());
      }
      host.innerHTML = '<section class="zp-plan"><h2 class="teacher-section-title">Long-term plan</h2>' + picker + note + body + '<div id="zp-plan-msg" class="zp-muted"></div></section>';
    }
    function listHTML() {
      return '<ul class="zp-signals">' + plan.milestones.map(function (m) { return '<li><b>' + esc(m.label) + '</b> · ' + UI.fmtISO(m.start) + (m.end && m.end !== m.start ? ' – ' + UI.fmtISO(m.end) : '') + '</li>'; }).join('') + '</ul>' +
        '<p class="zp-muted">Updated ' + (plan.updatedAt ? UI.fmtDate(plan.updatedAt) : '') + '. Questions about a date? Message your teacher.</p>';
    }
    function formHTML(p) {
      p = p || {};
      return '<div class="zp-planform"><label class="zp-field"><span>Start date</span><input type="date" id="zp-pstart" value="' + esc(p.start || '') + '"></label>' +
        '<label class="zp-field"><span>AP exam date</span><input type="date" id="zp-pexam" value="' + esc(p.exam || '') + '"></label>' +
        '<label class="zp-field"><span>Days per chapter</span><input type="number" id="zp-ppace" min="3" max="30" value="' + esc(p.pace || 9) + '"></label>' +
        '<label class="zp-field"><span>Overlap (days)</span><input type="number" id="zp-poverlap" min="0" max="6" value="' + esc(p.overlap == null ? 2 : p.overlap) + '"></label>' +
        '<div><button type="button" class="zp-btn primary" data-act="gen">' + (plan ? 'Regenerate' : 'Generate plan') + '</button></div></div>';
    }
    function editHTML() {
      var rows = plan.milestones.map(function (m, i) {
        return '<div class="zp-mrow" data-i="' + i + '"><select data-f="type">' + ['chapter', 'mock', 'exam', 'custom'].map(function (t) { return '<option' + (m.type === t ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select>' +
          '<input type="text" data-f="label" value="' + esc(m.label) + '" aria-label="Label"><input type="date" data-f="start" value="' + esc(m.start) + '" aria-label="Start"><input type="date" data-f="end" value="' + esc(m.end || m.start) + '" aria-label="End">' +
          '<button type="button" class="zp-btn" data-act="del" aria-label="Remove milestone">×</button></div>';
      }).join('');
      return '<h3>Edit milestones</h3>' + rows + '<div class="zp-row"><button type="button" class="zp-btn" data-act="add">Add milestone</button><button type="button" class="zp-btn primary" data-act="save">Save plan</button></div>' +
        '<details><summary class="zp-muted">Regenerate from dates</summary>' + formHTML(plan) + '</details>';
    }
    function readRows() {
      var rows = host.querySelectorAll('.zp-mrow');
      plan.milestones = Array.prototype.map.call(rows, function (r, i) {
        var old = plan.milestones[+r.dataset.i] || {};
        function f(k) { return r.querySelector('[data-f="' + k + '"]').value; }
        var s = f('start'), e = f('end') || s; if (e < s) e = s;
        return { id: old.id || 'm' + Date.now() + i, type: f('type'), ch: old.ch, label: f('label') || 'Milestone', start: s, end: e };
      }).filter(function (m) { return m.start; }).sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    }
    function msg(t) { var el = document.getElementById('zp-plan-msg'); if (el) el.textContent = t; }

    host.onchange = function (e) {
      if (e.target.id === 'zp-plan-who') { who = e.target.value; reload(); }
      else if (e.target.id === 'zp-plan-course') { courseId = e.target.value; reload(); }
    };
    host.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act;
      if (a === 'gen') {
        var start = document.getElementById('zp-pstart').value;
        if (!start) { msg('Pick a start date first.'); return; }
        if (plan && !confirm('Regenerating replaces every milestone, including edits. Continue?')) return;
        b.disabled = true; msg('Reading the chapter list…');
        ZPBanks.load(courseId).then(function (data) {
          var chapters = data.info.order.map(function (c) { return { ch: c, title: data.info.chapters[c].title, hasT: data.info.chapters[c].hasT }; });
          var r = ZP.generatePlan(chapters, { start: start, exam: document.getElementById('zp-pexam').value, pace: document.getElementById('zp-ppace').value, overlap: document.getElementById('zp-poverlap').value });
          plan = r.plan; return save(who, courseId, plan, person.username).then(function () { render(); msg(r.warnings.join(' ') || 'Plan generated and saved. Adjust any date below.'); });
        }).catch(function (err) { b.disabled = false; msg('Could not generate: ' + err.message); });
      } else if (a === 'add') {
        readRows(); var last = plan.milestones[plan.milestones.length - 1];
        plan.milestones.push({ id: 'm' + Date.now(), type: 'custom', label: 'New milestone', start: last ? last.start : ZP.toISO(Date.now()), end: last ? last.start : ZP.toISO(Date.now()) });
        render();
      } else if (a === 'del') {
        readRows(); plan.milestones.splice(+b.closest('.zp-mrow').dataset.i, 1); render();
      } else if (a === 'save') {
        readRows(); b.disabled = true;
        save(who, courseId, plan, person.username).then(function (r) {
          if (!r.ok) throw new Error(r.error || 'save failed');
          render(); msg('Saved.');
        }).catch(function (err) { b.disabled = false; msg('Could not save: ' + err.message); });
      }
    };
    reload();
  }

  root.ZPPlan = { load: load, save: save, ganttHTML: ganttHTML, mountCalendar: mountCalendar };
})(window);
