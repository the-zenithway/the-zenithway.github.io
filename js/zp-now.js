/* Right Now: the one page that says what to do next, and why.
 * It does not hold anything of its own. It ranks what already exists in the student's log (ZP.rightNow in zp-store.js):
 * mentor tasks, due reviews, entries to write, the student's own calendar, and the chapter flow. The ranking rule is printed at the
 * bottom of the page so the order is never a mystery. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, esc = UI.esc;
  var TIER = { 1: 'Required', 2: 'Reviews', 3: 'Inbox', 4: 'Your calendar', 5: 'Suggested', 6: 'Plan' };

  function rel(ms, now) {
    var d = ms - now, a = Math.abs(d), m = Math.round(a / 60000), h = Math.round(a / 36e5), dd = Math.round(a / 864e5);
    var t = m < 60 ? m + ' min' : h < 36 ? h + ' h' : dd + ' days';
    return d >= 0 ? 'in ' + t : t + ' ago';
  }
  function clock(hm) { if (!hm) return ''; var p = hm.split(':'), h = +p[0]; return ((h + 11) % 12 + 1) + ':' + p[1] + ' ' + (h < 12 ? 'am' : 'pm'); }

  function mount(host, ctx) {
    var student = ctx.student, course = ctx.course, cid = encodeURIComponent(course.id);
    var store = ZP.open(student.username, course.id), data, plan = null, D, R, news = [], reporting = null, sentNote = '';
    function costOf(pid) { var q = data && data.byId[pid]; return q && q.frq ? CFG.MIN_PER_FRQ : CFG.MIN_PER_QUESTION; }
    function compute() { D = ZP.derive(store.events(), data.info); R = ZP.rightNow(D, { plan: plan, course: course.id, costOf: costOf }); }

    function chips(it) {
      var out = [];
      if (it.dueText) out.push('<span class="zp-badge ' + (/overdue|was /.test(it.dueText) ? 'late' : 'warn') + '">' + esc(it.dueText) + '</span>');
      if (it.progress) out.push('<span class="zp-badge">' + esc(it.progress) + '</span>');
      if (it.minutes) out.push('<span class="zp-badge">about ' + Math.max(1, Math.round(it.minutes)) + ' min</span>');
      if (it.sprint) out.push('<span class="zp-badge warn">Sprint</span>');
      return out.join(' ');
    }
    function actions(it, big) {
      var go = it.href ? '<a class="zp-btn' + (big ? ' primary' : '') + '" href="' + esc(it.href) + '">' + (it.kind === 'reviews' ? 'Start reviews' : it.kind === 'inbox' ? 'Write them' : it.kind === 'plan' ? 'Go' : 'Open') + (big ? ' →' : '') + '</a>' : '';
      var done = '';
      if (it.kind === 'task' && it.manual) done = '<button type="button" class="zp-btn" data-act="tdone" data-key="' + esc(it.task.key) + '">Mark done</button>';
      else if (it.kind === 'cal' && it.manual) done = '<button type="button" class="zp-btn" data-act="cdone" data-key="' + esc(it.cal.key) + '">Done</button>';
      return go + done;
    }
    function nowCard(it) {
      if (!it) return '<section class="zp-nowcard clear"><p class="zp-eyebrow">All clear</p><h2>Nothing is waiting for you.</h2><p class="zp-muted">No tasks, no reviews due, nothing on your calendar for today. Run a mock, flag problems in Browse, or write a concept card for the chapter you are on.</p>' +
        '<div class="zp-row"><a class="zp-btn primary" href="practice.html?course=' + cid + '#mock">Run a mock</a><a class="zp-btn" href="practice.html?course=' + cid + '#browse">Browse problems</a></div></section>';
      var cls = it.tier === 1 ? 'req' : it.tier === 5 ? 'sug' : '';
      return '<section class="zp-nowcard ' + cls + '"><p class="zp-eyebrow">' + (it.tier === 1 ? 'Required by ' + UI.mentorName() : 'Do this now') + '</p><h2>' + esc(it.title) + '</h2>' +
        (it.detail ? '<p class="zp-nowdetail">' + UI.esc(it.detail).replace(/\n/g, '<br>') + '</p>' : '') + '<div class="zp-nowchips">' + chips(it) + '</div>' +
        '<p class="zp-why">Why this is first: ' + esc(it.why) + '.</p><div class="zp-row">' + actions(it, true) + '</div></section>';
    }
    function restList() {
      if (!R.rest.length) return '';
      return '<section class="zp-panel"><h2>Then</h2><ol class="zp-nowlist">' + R.rest.map(function (it) {
        return '<li><span class="zp-tier t' + it.tier + '">' + TIER[it.tier] + '</span><div class="zp-nowitem"><b>' + esc(it.title) + '</b>' + (it.detail && it.kind !== 'task' ? '<span class="zp-muted"> · ' + esc(it.detail.split('\n')[0].slice(0, 110)) + '</span>' : '') +
          '<div class="zp-nowchips">' + chips(it) + '</div></div><div class="zp-nowact">' + actions(it, false) + '</div></li>';
      }).join('') + '</ol></section>';
    }
    // After "Mark done" on a task: it is recorded for the mentor straight away; this offers a line about how it went (optional).
    function reportPanel() {
      if (sentNote) return '<div class="zp-remind msg"><b>' + esc(sentNote) + '</b><span>' + esc(UI.mentorName()) + ' will see it.</span></div>';
      if (!reporting) return '';
      return '<section class="zp-panel zp-report"><p class="zp-eyebrow">Marked done · ' + esc(UI.mentorName()) + ' can see it</p><h2>Tell ' + esc(UI.mentorName()) + ' how it went</h2>' +
        '<p class="zp-muted">"' + esc(reporting.title) + '" is done. A line helps them: what you finished, what was hard, anything you left.</p>' +
        '<label class="zp-field"><textarea id="zp-rtext" class="zp-tex" rows="3" maxlength="1500" placeholder="e.g. Finished all of it. Number 7 took me three tries."></textarea></label>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="rsend">Send to my mentor</button><a class="zp-btn" href="mentor.html?course=' + cid + '">Open Mentor</a><button type="button" class="zp-linkbtn" data-act="rskip">Not now</button></div></section>';
    }
    function banners() {
      var b = [], now = Date.now();
      R.upcoming.forEach(function (u) {
        var c = u.c, soon = u.at - now <= 864e5;
        b.push('<div class="zp-remind' + (soon ? ' soon' : '') + '"><b>' + esc(c.title) + '</b><span>' + (c.date === ZP.dayKey(now) ? 'today' : c.date === ZP.dayKey(now + 864e5) ? 'tomorrow' : esc(UI.fmtISO(c.date))) + (c.time ? ' at ' + esc(clock(c.time)) : '') + ' · ' + rel(u.at, now) + '</span></div>');
      });
      if (R.unread) b.push('<a class="zp-remind msg" href="mentor.html?course=' + cid + '"><b>' + R.unread + ' new from ' + esc(UI.mentorName()) + '</b><span>Open the thread →</span></a>');
      var answered = D.props.filter(function (p) { return p.status !== 'pending' && p.reply && p.reply.t > D.read.student; });
      answered.forEach(function (p) { b.push('<a class="zp-remind msg" href="mentor.html?course=' + cid + '"><b>' + esc(p.msg.prop && p.msg.prop.title || 'Your proposal') + ': ' + p.status + '</b><span>' + (p.status === 'accepted' ? 'It is on your calendar' : 'See the reply') + ' →</span></a>'); });
      if (R.behind) b.push('<div class="zp-remind late"><b>' + esc(R.behind.text) + '</b><span>The plan is a guide, not a grade. Tell your mentor if the dates are unrealistic.</span></div>');
      return b.length ? '<div class="zp-reminds">' + b.join('') + '</div>' : '';
    }
    function mentorNote() {
      var last = D.msgs.filter(function (m) { return m.from === 'teacher' && ['nudge', 'motivation', 'advice', 'resource', 'message'].indexOf(m.kind) >= 0 && !m.legacy; }).slice(-2).reverse();
      var ann = news.slice(0, 2);
      if (!last.length && !ann.length) return '';
      return '<section class="zp-panel"><h2>From ' + esc(UI.mentorName()) + '</h2>' + last.map(function (m) {
        return '<div class="zp-mnote' + (m.t > D.read.student ? ' new' : '') + '"><p class="zp-muted">' + esc(UI.fmtDate(m.t)) + (m.kind !== 'message' ? ' · ' + esc(m.kind) : '') + '</p><p>' + root.ZPMentor.richText(m.text) + '</p>' + (m.url ? '<p><a class="zp-link" href="' + esc(m.url) + '" target="_blank" rel="noopener">Open resource ↗</a></p>' : '') + '</div>';
      }).join('') + ann.map(function (a) { return '<div class="zp-mnote"><p class="zp-muted">Class announcement · ' + esc(UI.fmtDate(new Date(a.createdAt).getTime())) + '</p><p><b>' + esc(a.title) + '</b><br>' + esc(a.message) + '</p></div>'; }).join('') +
        '<p><a class="zp-link" href="mentor.html?course=' + cid + '">Open the conversation →</a></p></section>';
    }
    function today() {
      var st = ZP.stats(D, data.info), s = st.streak, n = s.today;
      return '<div class="zp-nowfoot"><span><b>' + n + '</b> done today</span><span><b>' + s.current + '</b>-day streak</span><span><b>' + st.queue.due + '</b> reviews due</span>' +
        '<a class="zp-link" href="profile.html?course=' + cid + '">Profile →</a></div>';
    }
    function rules() {
      return '<details class="zp-panel zp-rules"><summary><b>How this page decides what comes first</b></summary>' +
        '<p>Nothing on this page is set by hand each day. It ranks what already exists and shows the top item as your next move. The order is always this:</p>' +
        '<table class="zp-table"><thead><tr><th></th><th>What</th><th>Why it sits here</th></tr></thead><tbody>' +
        '<tr><td><span class="zp-tier t1">1 Required</span></td><td>Tasks your mentor marked required</td><td>A mentor only forces something for a reason: a deadline, a sprint, a gap. Overdue first, then soonest due, then the ones with no date.</td></tr>' +
        '<tr><td><span class="zp-tier t2">2 Reviews</span></td><td>Reviews that have come due</td><td>Spaced reviews work on a schedule. Each day you wait, you forget more. Your daily share fits a ' + D.req.dailyReviewMin + '-minute budget.</td></tr>' +
        '<tr><td><span class="zp-tier t3">3 Inbox</span></td><td>Entries waiting to be written</td><td>A missed or flagged problem only starts its review once you write the entry.</td></tr>' +
        '<tr><td><span class="zp-tier t4">4 Calendar</span></td><td>Your own to-dos, mocks and events dated today or earlier</td><td>You set them, so they count, but they do not outrank what your mentor required or what is decaying.</td></tr>' +
        '<tr><td><span class="zp-tier t5">5 Suggested</span></td><td>Mentor tasks that are not required</td><td>Worth doing, no penalty for choosing the items above first.</td></tr>' +
        '<tr><td><span class="zp-tier t6">6 Plan</span></td><td>The next step in your chapter flow (Book, Problems, Review, Test, Close), or a mock when every chapter is done</td><td>The default when nothing above needs you. The plan\'s dates only tell you whether you are on track.</td></tr></tbody></table>' +
        '<p class="zp-muted">Inside a tier the earlier deadline wins. A task finishes by itself when its work is done (every problem in the set tried, the stage complete), or you can mark it done. Reminders for events show at the top for the two days before.</p></details>';
    }
    function render() {
      compute();
      var d = new Date(), name = student.name.split(' ')[0];
      host.innerHTML = '<div class="zp-crumb"><span>Right now</span>' + UI.saveStatus(store) + '</div><h1>Hey ' + esc(name) + '</h1><p class="zp-muted">' + esc(course.name) + ' · ' + esc(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][d.getDay()]) + ', ' + esc(UI.fmtDate(d.getTime())) + '</p>' +
        reportPanel() + banners() + nowCard(R.top) + restList() + today() + mentorNote() + rules();
      UI.renderMath(host);
    }
    host.onclick = function (e) {
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'tdone') {
        var tk = D.tasks.filter(function (t) { return t.key === b.dataset.key; })[0];
        store.append('task_done', { key: b.dataset.key }); reporting = tk ? { key: tk.key, title: tk.title } : null; sentNote = ''; render();
        var rt = host.querySelector('#zp-rtext'); if (rt) rt.focus();
      }
      else if (b.dataset.act === 'rsend') {
        var ta = host.querySelector('#zp-rtext'), text = ta.value.trim(); if (!text) return ta.focus();
        store.append('msg', { from: 'student', kind: 'progress', text: text, ref: 'task:' + reporting.key, refLabel: 'Done: ' + reporting.title });
        sentNote = 'Sent to ' + UI.mentorName() + '.'; reporting = null; render();
      }
      else if (b.dataset.act === 'rskip') { reporting = null; render(); }
      else if (b.dataset.act === 'cdone') { store.append('cal_done', { key: b.dataset.key, done: true }); render(); }
    };
    host.innerHTML = '<p role="status">Loading…</p>';
    function loadAnnouncements() {
      if (typeof ANNOUNCEMENTS_URL === 'undefined' || typeof classesForStudent_ !== 'function') return Promise.resolve();
      var ids = classesForStudent_(student).map(function (c) { return c.id; }); if (!ids.length) return Promise.resolve();
      return fetch(ANNOUNCEMENTS_URL).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }).then(function (all) {
        news = all.filter(function (a) { return a.audience === 'class' && a.status === 'Active' && ids.indexOf(a.classId) >= 0 && Date.now() - new Date(a.createdAt).getTime() < 14 * 864e5; }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
      });
    }
    Promise.all([root.ZPBanks.load(course.id), store.load(), root.ZPPlan ? root.ZPPlan.load(student.username, course.id).catch(function () { return null; }) : null, loadAnnouncements()]).then(function (r) { data = r[0]; plan = r[2]; render(); })
      .catch(function (e) { host.innerHTML = UI.emptyState('Could not load Right Now', esc(e.message)); });
    store.onChange(function () { var el = host.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
    document.addEventListener('visibilitychange', function () { if (!document.hidden && data) render(); });
  }

  root.ZPNow = { mount: mount };
})(window);
