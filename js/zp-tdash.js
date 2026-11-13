/* Mentor Desk (teacher.html): everything waiting on the teacher, and every student at a glance.
 * It reads each student's event log (ZP.loadAll) and derives the rest. Nothing is hand-entered here: messages, proposed sessions,
 * unreviewed tests / mocks / entries, overdue required tasks and stalled students all come from the logs.
 * Shared helpers for the per-student page (zp-tstudent.js) live on ZPTeach. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc, DAY = ZP.DAY;

  function who() { try { return localStorage.getItem('loggedInUsername') || ''; } catch (e) { return ''; } }
  // A teacher who left "view as student" mode without pressing Exit must still be able to write.
  function clearViewAs() { try { sessionStorage.removeItem('zenith:viewas'); } catch (e) { /* ignore */ } }
  function studentRec(u) { return STUDENTS.filter(function (s) { return s.username === u; })[0] || { username: u, name: u, courses: [] }; }
  function courseName(id) { var s = STUDENTS.filter(function (x) { return (x.courses || []).some(function (c) { return c.id === id; }); })[0]; var c = s && s.courses.filter(function (x) { return x.id === id; })[0]; return c ? c.name : id; }
  // Normal track = on a class roster (js/data.js CLASSES). Self-study track and "gone" come from data/student-tracks.json:
  // gone students are dropped from every teacher view, self-study students are listed apart and get no queue items.
  // Every student on the self-study track: the ones data/student-tracks.json names, plus everyone who is on no class roster and has not
  // "left for good" (so a student who signs up and picks a self-study course shows up here with no hand-editing).
  function selfStudyUsers(tracks) {
    tracks = tracks || {}; var gone = tracks.gone || [], out = (tracks.selfStudy || []).slice(), inClass = {};
    CLASSES.forEach(function (c) { (c.studentUsernames || []).forEach(function (u) { inClass[u] = 1; }); });
    STUDENTS.forEach(function (s) { if (!inClass[s.username] && gone.indexOf(s.username) < 0 && out.indexOf(s.username) < 0) out.push(s.username); });
    return out;
  }
  // Self-study students with nothing the platform can show progress for yet (no course, or only a course without platform tracking).
  function idleSelfStudy(tracks) {
    var gone = (tracks || {}).gone || [];
    return selfStudyUsers(tracks).filter(function (u) { return gone.indexOf(u) < 0; }).map(studentRec).filter(function (st) { return !(st.courses || []).some(function (c) { return CFG.COURSES[c.id]; }); });
  }
  function roster(teacher, tracks) {
    tracks = tracks || {}; var gone = tracks.gone || [], self = selfStudyUsers(tracks), seen = {}, out = [];
    function add(u, course, cname, className, isSelf) {
      var k = u + '|' + course; if (seen[k] || gone.indexOf(u) >= 0) return; seen[k] = 1;
      var st = studentRec(u); if (!(st.courses || []).some(function (x) { return x.id === course; })) return;
      out.push({ key: k, username: u, name: st.name, course: course, cname: cname, className: className, former: isSelf, track: isSelf ? 'self-study' : 'class' });
    }
    teacherClasses_(teacher).filter(function (c) { return CFG.COURSES[c.courseId]; }).forEach(function (c) {
      (c.studentUsernames || []).forEach(function (u) { if (self.indexOf(u) < 0) add(u, c.courseId, courseName(c.courseId), c.name, false); });
      (c.formerStudentUsernames || []).concat(c.studentUsernames || []).forEach(function (u) { if (self.indexOf(u) >= 0) add(u, c.courseId, courseName(c.courseId), '', true); });
    });
    self.forEach(function (u) { (studentRec(u).courses || []).filter(function (c) { return CFG.COURSES[c.id]; }).forEach(function (c) { add(u, c.id, courseName(c.id), '', true); }); });
    return out;
  }
  // -> {groups:{key:{...roster entry, events, info, data, D, st}}, loaded}
  function loadGroups(teacher) {
    var groups = {}, list, trk;
    return fetch('data/student-tracks.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }).then(function (tracks) { trk = tracks; list = roster(teacher, tracks); return ZP.loadAll(list.map(function (r) { return { username: r.username, course: r.course }; })); }).then(function (loaded) {
      list.forEach(function (r) { groups[r.key] = Object.assign({ events: [] }, r); });
      loaded.rows.forEach(function (e) { var g = groups[e.username + '|' + e.course]; if (g) g.events.push(e); });
      var courses = {}; list.forEach(function (r) { courses[r.course] = 1; });
      return Promise.all(Object.keys(courses).map(function (c) { return root.ZPBanks.load(c).then(function (d) { courses[c] = d; }); })).then(function () {
        Object.keys(groups).forEach(function (k) { var g = groups[k]; g.data = courses[g.course]; refresh(g); });
        return { groups: groups, loaded: loaded, list: list, idle: idleSelfStudy(trk) };
      });
    });
  }
  function refresh(g) { g.D = ZP.derive(g.events, g.data.info, Date.now()); g.st = ZP.stats(g.D, g.data.info, Date.now()); return g; }
  function push(g, ev) { g.events.push(ev); refresh(g); return ev; }
  function stageText(D) {
    if (!D.current) return 'All chapters closed';
    var S = D.stages[D.current], k = S.next; return 'Ch ' + D.current + ' · ' + (k ? ZP.STAGE_NAME[k] : 'Close');
  }
  function planState(g, plans) {
    var p = plans && plans[g.key]; if (!p) return null;
    return ZP.planStatus(p, g.D.current, g.D.current ? g.D.stages[g.D.current].complete : true, Date.now());
  }
  var BLOCKS = '▁▂▃▄▅▆▇█';
  function sparkline(act, now) {
    var vals = [], max = 1, i, d;
    for (i = 13; i >= 0; i--) { d = ZP.dayKey(now - i * DAY); vals.push(act[d] || 0); if ((act[d] || 0) > max) max = act[d]; }
    return vals.map(function (v) { return v ? BLOCKS[Math.min(7, Math.ceil(v / max * 7))] : '·'; }).join('');
  }
  function ago(ms) { return ms ? UI.ago(ms) : 'never'; }
  function sub(sbs, D) { return sbs.filter(function (s) { return !D.fb[s.id]; }); }

  /* ---------- the queue ---------- */
  var KIND_ORDER = { proposal: 0, debrief: 0, frq: 0, message: 1, test: 2, mock: 2, task: 2, done: 3, notes: 3, stalled: 4 };
  function queue(groups) {
    var items = [], now = Date.now();
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], D = g.D, base = { key: k, name: g.name, cname: g.cname, username: g.username, course: g.course, former: g.former };
      if (g.former) return; // self-study track: no Mentor, so nothing is ever waiting on the teacher
      D.props.filter(function (p) { return p.status === 'pending'; }).forEach(function (p) { items.push(Object.assign({}, base, { kind: 'proposal', t: p.msg.t, msg: p.msg })); });
      var unreadMsgs = D.unread.teacher.filter(function (m) { return m.kind !== 'proposal' && !/^(task|frq|debrief):/.test(m.ref || ''); }); // task reports show on their own item // proposals have their own item
      if (unreadMsgs.length) items.push(Object.assign({}, base, { kind: 'message', t: unreadMsgs[unreadMsgs.length - 1].t, msgs: unreadMsgs }));
      if (g.former) return;
      D.tasks.filter(function (t) { return t.done && t.doneBy === 'you' && !t.legacy && !D.fb['task:' + t.key]; }).forEach(function (t) {
        var rep = D.msgs.filter(function (m) { return m.from !== 'teacher' && m.ref === 'task:' + t.key; }).pop();
        items.push(Object.assign({}, base, { kind: 'done', t: (D.taskDone[t.key] || {}).t || t.t, text: 'Marked done: ' + t.title + (t.forced ? ' (required)' : ''), report: rep ? rep.text : '', refs: ['task:' + t.key] }));
      });
      var tests = [].concat.apply([], Object.keys(D.tests).map(function (c) { return D.tests[c]; })).concat(D.customTests);
      sub(tests, D).forEach(function (s) { items.push(Object.assign({}, base, { kind: 'test', t: s.t, text: (s.kind === 'TEST' ? 'Custom test' : 'Ch ' + s.ch + ' test') + ': ' + s.score.correct + '/' + s.score.total, refs: [s.id] })); });
      sub(D.mocks, D).forEach(function (s) { items.push(Object.assign({}, base, { kind: D.debrief[s.id] ? 'debrief' : 'mock', t: s.t, text: (D.debrief[s.id] ? 'Debrief requested · ' : '') + (s.title || 'Mock') + ': ' + s.score.correct + '/' + s.score.total, refs: [s.id] })); });
      var waitingFrq = Object.keys(D.frqAsk).map(function (k) { return D.frqAsk[k]; }).filter(function (a) { return a.status === 'waiting'; });
      if (waitingFrq.length) items.push(Object.assign({}, base, { kind: 'frq', t: Math.max.apply(null, waitingFrq.map(function (a) { return a.askedAt; })), text: 'Asked for feedback on ' + waitingFrq.length + ' free-response answer' + (waitingFrq.length > 1 ? 's' : '') + ': ' + waitingFrq.slice(0, 4).map(function (a) { return (g.data.byId[a.pid] ? g.data.byId[a.pid].code : a.pid); }).join(', '), refs: [] }));
      var notes = Object.keys(D.notes).map(function (p) { return D.notes[p]; }).filter(function (n) { return !D.fb['entry:' + n.pid] && !D.fb[n.id] && ZP.entryComplete(n) && ZP.trackOf(n) === 'actual' && !n.legacy; });
      if (notes.length) items.push(Object.assign({}, base, { kind: 'notes', t: Math.max.apply(null, notes.map(function (n) { return n.t; })), text: notes.length + ' Actual entr' + (notes.length > 1 ? 'ies' : 'y') + ' without a comment', refs: notes.map(function (n) { return n.id; }) }));
      D.tasks.filter(function (t) { return t.status === 'overdue' && t.forced && !t.legacy; }).forEach(function (t) { items.push(Object.assign({}, base, { kind: 'task', t: t.dueAt, text: 'Required task overdue: ' + t.title + (t.total ? ' (' + t.cur + '/' + t.total + ')' : ''), refs: [] })); });
      var idle = D.lastT ? Math.floor((now - D.lastT) / DAY) : 0;
      if (D.lastT && D.current && idle >= CFG.STALLED_DAYS) items.push(Object.assign({}, base, { kind: 'stalled', t: D.lastT, text: 'No activity for ' + idle + ' days (Ch ' + D.current + ', ' + ZP.STAGE_NAME[D.stages[D.current].next || 'X'] + ')', refs: [] }));
    });
    items.sort(function (a, b) { return KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || b.t - a.t; });
    return items;
  }
  var KIND_LABEL = { proposal: 'Proposed session', message: 'New message', debrief: 'Debrief', frq: 'FRQ feedback', test: 'Test', mock: 'Mock', task: 'Overdue', done: 'Task done', notes: 'Entries', stalled: 'Stalled' };
  function studentLink(it, tab) { return 'teacher-student.html?student=' + encodeURIComponent(it.username) + '&course=' + encodeURIComponent(it.course) + (tab ? '#' + tab : ''); }
  function itemHTML(it, i) {
    var body = '', acts = '';
    if (it.kind === 'proposal') {
      var p = it.msg.prop || {};
      body = '<b>' + esc(p.title || 'Session') + '</b> · ' + esc(p.date || '') + (p.time ? ' ' + esc(p.time) : '') + (p.len ? ' · ' + esc(p.len) + ' min' : '') + (it.msg.text ? '<br><span class="zp-muted">' + esc(it.msg.text) + '</span>' : '');
      acts = '<input type="text" class="zp-inl" data-note="' + i + '" placeholder="Note back (optional)" aria-label="Note"><button type="button" class="zp-btn primary" data-act="accept" data-i="' + i + '">Accept</button><button type="button" class="zp-btn" data-act="decline" data-i="' + i + '">Decline</button>';
    } else if (it.kind === 'message') {
      var last = it.msgs[it.msgs.length - 1];
      body = '<span class="zp-muted">' + it.msgs.length + ' new · ' + esc(root.ZPMentor.stamp(last.t)) + '</span><br>' + root.ZPMentor.richText((last.text || (last.files && last.files.length ? '(sent a photo)' : '(no text)')).slice(0, 220)) + (it.msgs.some(function (m) { return m.files && m.files.length; }) ? ' <span class="zp-badge">photo</span>' : '');
      acts = '<details class="zp-reply"><summary class="zp-btn">Reply</summary><textarea class="zp-tex" data-reply="' + i + '" rows="2" maxlength="3000" placeholder="Write back…"></textarea><div class="zp-row"><button type="button" class="zp-btn primary" data-act="reply" data-i="' + i + '">Send</button></div></details><button type="button" class="zp-btn" data-act="read" data-i="' + i + '">Mark read</button>';
    } else {
      body = esc(it.text) + (it.kind === 'done' ? (it.report ? '<br><span class="zp-muted">Their report:</span> ' + root.ZPMentor.richText(it.report) : '<br><span class="zp-muted">No report sent.</span>') : '');
      if (it.refs && it.refs.length) acts = '<button type="button" class="zp-btn" data-act="sent" data-i="' + i + '">' + (it.kind === 'done' ? 'Got it' : 'Feedback sent') + '</button>';
    }
    return '<div class="zp-tq-item"><div><span class="zp-badge ' + (it.kind === 'proposal' || it.kind === 'message' ? 'warn' : '') + '">' + KIND_LABEL[it.kind] + '</span> <b>' + esc(it.name) + '</b> <span class="zp-muted">· ' + esc(it.cname) + (it.former ? ' · self-study' : '') + ' · ' + UI.ago(it.t) + '</span><br>' + body + '</div>' +
      '<div class="zp-row zp-tqact">' + acts + '<a class="zp-btn" href="' + studentLink(it, it.kind === 'message' ? 'talk' : it.kind === 'notes' ? 'work' : it.kind === 'proposal' ? 'plan' : 'work') + '">Open</a></div></div>';
  }

  /* ---------- students ---------- */
  function tableHTML(groups, plans) {
    var now = Date.now(), lastTrack = '', rows = Object.keys(groups).map(function (k) { return groups[k]; }).sort(function (a, b) { return (a.former - b.former) || a.name.localeCompare(b.name); }).map(function (g) {
      var D = g.D, st = g.st, ps = planState(g, plans), q = st.queue, acc = st.overall.pct;
      var waiting = D.unread.teacher.length + D.props.filter(function (p) { return p.status === 'pending'; }).length;
      var sect = g.track !== lastTrack ? '<tr class="zp-trackrow"><th colspan="7">' + (g.former ? 'Self-study track' : 'Class') + '</th></tr>' : ''; lastTrack = g.track;
      return sect + '<tr><td><a href="teacher-student.html?student=' + encodeURIComponent(g.username) + '&course=' + encodeURIComponent(g.course) + '"><b>' + esc(g.name) + '</b></a><br><span class="zp-muted">' + esc(g.cname) + '</span></td>' +
        '<td>' + esc(stageText(D)) + (ps ? '<br><span class="zp-track ' + ps.state + '">' + esc(ps.text) + '</span>' : '') + '</td>' +
        '<td class="zp-mono">' + sparkline(D.activity, now) + '<br><span class="zp-muted">' + st.streak.current + '-day streak</span></td>' +
        '<td>' + (acc == null ? '–' : Math.round(acc * 100) + '%') + '<br><span class="zp-muted">' + st.overall.seen + ' answered</span></td>' +
        '<td>' + q.due + (q.needsNote ? ' <span class="zp-muted">· ' + q.needsNote + ' to write</span>' : '') + '</td>' +
        '<td>' + ago(D.lastT) + (waiting ? '<br><span class="zp-badge warn">' + waiting + ' waiting</span>' : '') + '</td>' +
        '<td><a class="zp-btn" href="roadmap.html?course=' + encodeURIComponent(g.course) + '&viewas=' + encodeURIComponent(g.username) + '">View as student</a></td></tr>';
    }).join('');
    return '<div class="zp-tablewrap"><table class="zp-table zp-students"><thead><tr><th>Student</th><th>Where</th><th>Last 14 days</th><th>Accuracy</th><th>Reviews due</th><th>Last active</th><th></th></tr></thead><tbody>' + (rows || '<tr><td colspan="7" class="zp-muted">No students on the platform yet.</td></tr>') + '</tbody></table></div>';
  }

  function idleHTML(idle) {
    if (!idle || !idle.length) return '';
    return '<h3 style="margin-top:22px">Self-study students with no tracked course yet</h3><p class="zp-muted">Signed up, but have not started a course the platform tracks (or only added one with the old roadmap).</p><ul class="zp-idle">' +
      idle.map(function (st) { var cs = (st.courses || []).map(function (c) { return esc(c.name); }).join(', '); return '<li><b>' + esc(st.name || st.username) + '</b> <span class="zp-muted">@' + esc(st.username) + (cs ? ' · ' + cs + ' (old roadmap, not tracked)' : ' · no course yet') + '</span></li>'; }).join('') + '</ul>';
  }

  /* ---------- reported problems ---------- */
  function reportsHTML(groups, fixed) {
    var map = {};
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      Object.keys(g.D.reports).forEach(function (pid) {
        g.D.reports[pid].forEach(function (r) {
          var key = g.course + '|' + pid, row = map[key] || (map[key] = { key: key, pid: pid, n: 0, why: {}, texts: [], who: {}, last: 0, data: g.data });
          row.n++; row.last = Math.max(row.last, r.t); row.who[g.name] = 1; (r.reasons || []).forEach(function (w) { row.why[w] = 1; }); if (r.text) row.texts.push(r.text);
        });
      });
    });
    var list = Object.keys(map).map(function (k) { return map[k]; }).filter(function (r) { return !(fixed[r.key] && fixed[r.key] >= r.last); }).sort(function (a, b) { return b.n - a.n; });
    return { list: list, html: list.length ? '<div class="zp-tq">' + list.map(function (r, i) {
      var Q = r.data.byId[r.pid], nm = function (k) { var f = UI.REPORT_REASONS.filter(function (x) { return x[0] === k; })[0]; return f ? f[1] : k; };
      return '<div class="zp-tq-item"><div><b>' + esc(r.pid) + '</b> <span class="zp-muted">· ' + r.n + ' report' + (r.n > 1 ? 's' : '') + ' · ' + esc(Object.keys(r.who).join(', ')) + '</span><br>' + esc(Object.keys(r.why).map(nm).join(', ')) + (r.texts.length ? '<br><span class="zp-muted">"' + esc(r.texts.slice(0, 2).join('" / "')) + '"</span>' : '') + (Q ? '<br><span class="zp-muted">' + esc(UI.shortStem(Q, 100)) + '</span>' : '') + '</div><div class="zp-row"><button type="button" class="zp-btn" data-act="fixed" data-i="' + i + '">Mark fixed</button></div></div>';
    }).join('') + '</div>' : '<p class="zp-muted">No open reports.</p>' };
  }

  /* ---------- the page ---------- */
  function mountDesk(host, teacher) {
    clearViewAs();
    var state = { groups: null, plans: {}, items: [], loaded: null, reports: [], fixed: {}, tab: (location.hash || '#queue').slice(1) };
    if (['queue', 'students', 'tools'].indexOf(state.tab) < 0) state.tab = 'queue';
    var FIXED_KEY = 'zenith:zp:v1:doc:reports:fixed';
    try { state.fixed = JSON.parse(localStorage.getItem(FIXED_KEY)) || {}; } catch (e) { state.fixed = {}; }

    function tiles() {
      var gs = Object.keys(state.groups).map(function (k) { return state.groups[k]; }).filter(function (g) { return !g.former; });
      var unread = gs.reduce(function (n, g) { return n + g.D.unread.teacher.filter(function (m) { return m.kind !== 'proposal' && !/^(task|frq|debrief):/.test(m.ref || ''); }).length; }, 0), stalled = state.items.filter(function (i) { return i.kind === 'stalled'; }).length;
      return '<div class="zp-stats"><div><b>' + gs.length + '</b><span>students</span></div><div><b>' + state.items.length + '</b><span>waiting on you</span></div><div><b>' + unread + '</b><span>unread messages</span></div><div><b>' + stalled + '</b><span>stalled</span></div></div>';
    }
    function render() {
      // park the class tools before the desk body is replaced, so re-rendering never destroys them
      var parkT = document.getElementById('teacher-tools'), parkH = document.getElementById('teacher-tools-holder'); if (parkT && parkH) parkH.appendChild(parkT);
      state.items = queue(state.groups);
      var banner = state.loaded.source === 'local' ? '<p class="zp-localnote">Showing work saved in this browser only. Deploy automation/zenith-student-data.gs and set DATA_URL in js/zp-config.js and every student shows up from any device.</p>' : '';
      var tabs = '<nav class="zp-tabs" role="tablist">' + [['queue', 'Progress queue' + (state.items.length ? ' (' + state.items.length + ')' : '')], ['students', 'Students'], ['tools', 'Class tools']].map(function (t) { return '<a href="#' + t[0] + '" role="tab" class="' + (state.tab === t[0] ? 'on' : '') + '" data-tab="' + t[0] + '">' + t[1] + '</a>'; }).join('') + '</nav>';
      var body;
      if (state.tab === 'students') body = '<h2>Students</h2><p class="zp-muted">Open a student for their full record, assign work, set requirements and talk. "View as student" shows exactly what they see, read-only.</p>' + tableHTML(state.groups, state.plans) + idleHTML(state.idle);
      else if (state.tab === 'tools') body = '<h2>Class tools</h2><p class="zp-muted">Class-wide things: student requests, email reminders and announcements. Everything about one student\'s work is on their own page.</p>';
      else {
        var rep = reportsHTML(state.groups, state.fixed); state.reports = rep.list;
        body = '<h2>Progress queue</h2><p class="zp-muted">Everything waiting on you, most urgent first: proposed sessions and debriefs, then new messages, tests and mocks, overdue required tasks, Actual entries, and students who have gone quiet.</p>' +
          '<div class="zp-tq">' + (state.items.length ? state.items.map(itemHTML).join('') : UI.emptyState('Nothing needs you right now', 'Every test and mock has feedback, no new messages, nobody has stalled.')) + '</div>' +
          '<h2 style="margin-top:28px">Reported problems</h2>' + (rep.list.length ? '<p class="zp-muted">Students flagged these. Fix them in the bank, then mark them fixed.</p>' : '') + rep.html;
      }
      host.innerHTML = '<div class="zp-crumb"><span>Mentor Desk</span></div><h1>Hey ' + esc(teacher.name.split(' ')[0]) + '</h1>' + banner + tiles() + tabs + '<div class="zp-deskbody">' + body + '</div>';
      // The class tools (requests, email schedule, announcements) are kept in a hidden holder and shown inside this tab.
      var tools = document.getElementById('teacher-tools'), holder = document.getElementById('teacher-tools-holder');
      if (tools && state.tab === 'tools') host.querySelector('.zp-deskbody').appendChild(tools); else if (tools && holder && tools.parentNode !== holder) holder.appendChild(tools);
      UI.renderMath(host);
    }
    host.onclick = function (e) {
      var t = e.target.closest('[data-tab]'); if (t) { e.preventDefault(); state.tab = t.dataset.tab; history.replaceState(null, '', '#' + state.tab); return render(); }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var it = state.items[+b.dataset.i], g = it && state.groups[it.key], st = g && ZP.open(g.username, g.course);
      if (b.dataset.act === 'fixed') { var r = state.reports[+b.dataset.i]; state.fixed[r.key] = Date.now(); try { localStorage.setItem(FIXED_KEY, JSON.stringify(state.fixed)); } catch (x) { /* blocked */ } if (CFG.DATA_URL) fetch(CFG.DATA_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'putDoc', key: 'reports:fixed', value: state.fixed, by: teacher.username }) }).catch(function () { /* local copy kept */ }); return render(); }
      if (!it) return;
      if (b.dataset.act === 'read') { push(g, st.append('msg_read', { by: 'teacher', upTo: Date.now() })); render(); }
      else if (b.dataset.act === 'reply') {
        var ta = host.querySelector('[data-reply="' + b.dataset.i + '"]'), text = ta.value.trim(); if (!text) return ta.focus();
        push(g, st.append('msg', { from: 'teacher', kind: 'message', text: text })); push(g, st.append('msg_read', { by: 'teacher', upTo: Date.now() })); render();
      } else if (b.dataset.act === 'sent') { it.refs.forEach(function (r) { push(g, st.append('fb_sent', { ref: r })); }); if (it.kind === 'done') push(g, st.append('msg_read', { by: 'teacher', upTo: Date.now() })); render(); }
      else if (b.dataset.act === 'accept' || b.dataset.act === 'decline') {
        var note = (host.querySelector('[data-note="' + b.dataset.i + '"]') || {}).value || '', ok = b.dataset.act === 'accept', p = it.msg.prop || {};
        push(g, st.append('prop_reply', { ref: it.msg.id, status: ok ? 'accepted' : 'declined', note: note }));
        if (ok) push(g, st.append('cal_item', { key: 'p' + it.msg.id, date: p.date, time: p.time || '', title: p.title || 'Session', kind: 'event', len: p.len || 60, remind: [1440, 60], done: false }));
        render();
      }
    };
    host.innerHTML = '<p role="status">Loading students…</p>';
    window.addEventListener('hashchange', function () { var h = (location.hash || '#queue').slice(1); if (['queue', 'students', 'tools'].indexOf(h) >= 0 && state.groups) { state.tab = h; render(); } });
    loadGroups(teacher).then(function (r) {
      state.groups = r.groups; state.loaded = r.loaded; state.idle = r.idle || [];
      return Promise.all(Object.keys(r.groups).map(function (k) { var g = r.groups[k]; return root.ZPPlan.load(g.username, g.course).then(function (p) { state.plans[k] = p; }).catch(function () { /* no plan */ }); }));
    }).then(render).catch(function (e) { host.innerHTML = UI.emptyState('Could not read student data', esc(e.message)); });
    if (CFG.DATA_URL) fetch(CFG.DATA_URL + '?action=doc&key=' + encodeURIComponent('reports:fixed')).then(function (r) { return r.json(); }).then(function (res) { if (res.ok && res.value) { state.fixed = res.value; if (state.groups) render(); } }).catch(function () { /* keep local */ });
  }

  root.ZPTeach = { mountDesk: mountDesk, roster: roster, selfStudyUsers: selfStudyUsers, idleSelfStudy: idleSelfStudy, loadGroups: loadGroups, refresh: refresh, push: push, clearViewAs: clearViewAs, stageText: stageText, planState: planState, sparkline: sparkline, studentRec: studentRec, courseName: courseName, who: who };
})(window);
