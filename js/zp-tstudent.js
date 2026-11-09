/* One student, as their teacher sees them (teacher-student.html). Five tabs:
 *   Overview   what the data says: weak spots, mistake patterns, habits, progress by chapter, private notes
 *   Work       tests, mocks and Actual entries waiting for feedback; feedback goes into the student's Mentor thread
 *   Assign     tasks (custom practice set, chapter sprint, free task, required or suggested, with a deadline) and requirements
 *   Plan       the long-term plan, the calendar, and sessions the student proposed
 *   Talk       the conversation: messages, nudges, motivation, advice, resources
 * Everything is an event in the student's own log, so the student sees it on Right Now and in Mentor. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, CFG = root.ZP_CONFIG, T = root.ZPTeach, M = root.ZPMentor, esc = UI.esc;
  var DAY = ZP.DAY;

  function pct(x) { return x == null ? '–' : Math.round(100 * x) + '%'; }
  function bar(x, cls) { return '<span class="zp-bar"><span class="zp-bar-fill ' + (cls || '') + '" style="width:' + (x == null ? 0 : Math.round(100 * x)) + '%"></span></span>'; }
  function acc(r) { return r && r.n ? Math.round(100 * r.right / r.n) + '% (' + r.right + '/' + r.n + ')' : '–'; }
  function field(label, inner, cls) { return '<label class="zp-field ' + (cls || '') + '"><span>' + label + '</span>' + inner + '</label>'; }
  // A copy of a stored event without the fields append() sets itself.
  function strip(o) { var c = {}; Object.keys(o).forEach(function (k) { if (['id', 't', 'type', 'by'].indexOf(k) < 0) c[k] = o[k]; }); return c; }
  function opts(list, sel) { return list.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(sel) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join(''); }

  function mount(host, teacher, g, ctx) {
    var D, st, tab = (location.hash || '#overview').slice(1), store = ZP.open(g.username, g.course), data = g.data, info = data.info;
    var draft = { kind: 'practice', edit: '' }, talkKind = 'message', picked = [], plan = null;
    var TABS = [['overview', 'Overview'], ['work', 'Work'], ['assign', 'Assign'], ['plan', 'Plan & calendar'], ['talk', 'Talk']];
    // Self-study students have no Now page, Mentor or calendar, so there is nothing to assign, schedule or say: Overview only.
    if (g.former) TABS = [['overview', 'Overview']];
    if (!TABS.some(function (t) { return t[0] === tab; })) tab = 'overview';
    function derive() { T.refresh(g); D = g.D; st = g.st; }
    function add(type, payload) { var ev = store.append(type, payload); T.push(g, ev); derive(); return ev; }
    var cid = encodeURIComponent(g.course), un = encodeURIComponent(g.username), viewAs = function (page, extra) { return page + '?course=' + cid + '&viewas=' + un + (extra || ''); };

    /* ---------- header ---------- */
    function head() {
      var ps = T.planState(g, { [g.key]: plan }), unread = D.unread.teacher.length;
      return '<p class="zp-crumb"><a href="teacher.html">← Mentor Desk</a></p><div class="zp-hubhead"><div><p class="zp-eyebrow">' + esc(g.cname) + (g.former ? ' · self-study track' : '') + '</p><h1>' + esc(g.name) + '</h1>' +
        '<p class="zp-muted">' + esc(T.stageText(D)) + ' · last active ' + (D.lastT ? UI.ago(D.lastT) : 'never') + (ps ? ' · <span class="zp-track ' + ps.state + '">' + esc(ps.text) + '</span>' : '') + (unread ? ' · <b>' + unread + ' unread message' + (unread > 1 ? 's' : '') + '</b>' : '') + '</p></div>' +
        '<div class="zp-viewas"><span class="zp-label">View as ' + esc(g.name.split(' ')[0]) + ' (read-only)</span><div class="zp-row">' + (g.former ? '' : '<a class="zp-btn" href="' + viewAs('right-now.html') + '">Right Now</a>') + '<a class="zp-btn" href="' + viewAs('practice.html', '#browse') + '">Practice</a><a class="zp-btn" href="' + viewAs('notebook.html') + '">Notebook</a>' + (g.former ? '' : '<a class="zp-btn" href="' + viewAs('mentor.html') + '">Mentor</a>') + '<a class="zp-btn" href="' + viewAs('roadmap.html') + '">Roadmap</a></div></div></div>' +
        '<nav class="zp-tabs" role="tablist">' + TABS.map(function (t) { return '<a href="#' + t[0] + '" role="tab" data-tab="' + t[0] + '" class="' + (tab === t[0] ? 'on' : '') + '">' + t[1] + (t[0] === 'talk' && unread ? ' (' + unread + ')' : '') + '</a>'; }).join('') + '</nav>';
    }

    /* ---------- overview ---------- */
    function weakSpots() {
      var rows = st.weak.slice(0, 4).map(function (c) { var r = st.byChapter[c]; return '<tr><td>Ch ' + esc(c) + ' · ' + esc(r.title) + '</td><td>' + bar(r.pct, 'low') + ' ' + pct(r.pct) + '</td><td>' + r.seen + '</td><td>' + (r.hintPct == null ? '–' : pct(r.hintPct)) + '</td></tr>'; }).join('');
      var rep = Object.keys(D.q).map(function (p) { return D.q[p]; }).filter(function (r) { return r.wrong >= 2; }).sort(function (a, b) { return b.wrong - a.wrong; }).slice(0, 6).map(function (r) {
        var Q = data.byId[r.pid]; return '<li>' + (Q ? UI.codeBadge(Q) + ' ' + esc(UI.shortStem(Q, 70)) : esc(r.pid)) + ' <span class="zp-muted">· wrong ' + r.wrong + '×' + (D.entries[r.pid] ? ' · ' + (D.entries[r.pid].track || 'no entry') : '') + '</span></li>';
      }).join('');
      var cal = st.calib, calRows = ['sure', 'ok', 'guess'].filter(function (k) { return cal[k]; }).map(function (k) { return '<tr><td>' + esc(k) + '</td><td>' + acc(cal[k]) + '</td></tr>'; }).join('');
      return '<div class="zp-twocol"><section class="zp-panel"><h2>Weakest chapters</h2>' + (rows ? '<table class="zp-table"><thead><tr><th>Chapter</th><th>Accuracy</th><th>Answered</th><th>Opened answer</th></tr></thead><tbody>' + rows + '</tbody></table><p class="zp-muted">Needs at least 5 answers in a chapter.</p>' : '<p class="zp-muted">Not enough answers yet.</p>') + '</section>' +
        '<section class="zp-panel"><h2>Missed again and again</h2>' + (rep ? '<ul class="zp-signals">' + rep + '</ul>' : '<p class="zp-muted">No problem has been missed twice.</p>') + '</section></div>' +
        '<div class="zp-twocol"><section class="zp-panel"><h2>Calculator, format, speed</h2><table class="zp-table"><tbody><tr><td>No calculator</td><td>' + acc(st.byCalc.no) + '</td></tr><tr><td>Calculator</td><td>' + acc(st.byCalc.yes) + '</td></tr><tr><td>Multiple choice</td><td>' + acc(st.byType.mcq) + '</td></tr><tr><td>Free response</td><td>' + acc(st.byType.frq) + '</td></tr>' +
        '<tr><td>Seconds per question (no calc / calc)</td><td>' + (st.speed.no == null ? '–' : st.speed.no + 's') + ' / ' + (st.speed.yes == null ? '–' : st.speed.yes + 's') + '</td></tr></tbody></table><p class="zp-muted">AP pace is about 120s without a calculator and 180s with one.</p></section>' +
        '<section class="zp-panel"><h2>Does confidence match results?</h2>' + (calRows ? '<table class="zp-table"><tbody>' + calRows + '</tbody></table><p class="zp-muted">First-try accuracy by how sure they said they were. "Sure" much higher than "guess" means good self-knowledge; flat means they cannot tell what they know.</p>' : '<p class="zp-muted">They have not marked confidence yet.</p>') + '</section></div>';
    }
    function mistakePatterns() {
      var rows = info.order.filter(function (c) { return st.mixByCh[c]; }).map(function (c) {
        var m = st.mixByCh[c], tot = m.careless + m.actual, r = st.byChapter[c];
        return '<tr><td>Ch ' + esc(c) + ' · ' + esc(r.title) + '</td><td>' + m.careless + '</td><td>' + m.actual + '</td><td>' + bar(tot ? m.actual / tot : 0) + '</td></tr>';
      }).join('');
      var hrs = st.hours, best = hrs.map(function (h, i) { return { i: i, n: h.n, p: h.n >= 8 ? h.right / h.n : null }; }).filter(function (x) { return x.p != null; }).sort(function (a, b) { return b.p - a.p; });
      var when = best.length ? 'Sharpest around ' + best[0].i + ':00 (' + pct(best[0].p) + '), weakest around ' + best[best.length - 1].i + ':00 (' + pct(best[best.length - 1].p) + ').' : 'Too few answers to compare hours of the day.';
      return '<div class="zp-twocol"><section class="zp-panel"><h2>Careless or Actual, by chapter</h2>' + (rows ? '<table class="zp-table"><thead><tr><th>Chapter</th><th>Careless</th><th>Actual</th><th>Idea gaps</th></tr></thead><tbody>' + rows + '</tbody></table><p class="zp-muted">A long bar means the idea is missing there, not a slip. Mostly careless: slow down and check. Mostly actual: teach the idea.</p>' : '<p class="zp-muted">No entries written yet.</p>') + '</section>' +
        '<section class="zp-panel"><h2>Habits</h2><table class="zp-table"><tbody><tr><td>Study minutes (last 4 weeks)</td><td>' + st.studyWeeks.slice(-4).map(function (w) { return w.min; }).join(' · ') + '</td></tr><tr><td>Missed first time, right later</td><td>' + (st.recover.missedFirst ? st.recover.gotLater + ' of ' + st.recover.missedFirst + ' (' + pct(st.recover.gotLater / st.recover.missedFirst) + ')' : '–') + '</td></tr>' +
        '<tr><td>Streak</td><td>' + st.streak.current + ' days (longest ' + st.streak.longest + ')</td></tr></tbody></table><p class="zp-muted">' + esc(when) + '</p></section></div>';
    }
    function chapterTable() {
      var rows = info.order.map(function (c) {
        var S = D.stages[c], r = st.byChapter[c], dots = (S.seq || []).map(function (k) { return '<span class="zp-dot ' + (S[k].done ? 'done' : S[k].optional ? 'opt' : S.next === k ? 'active' : '') + '" title="' + ZP.STAGE_NAME[k] + (S[k].legacy ? ' (old roadmap)' : '') + '">' + k + '</span>'; }).join('');
        return '<tr><td>Ch ' + esc(c) + ' · ' + esc(info.chapters[c].title) + '</td><td><span class="zp-dots">' + dots + '</span></td><td>' + (r.seen ? pct(r.pct) + ' <span class="zp-muted">(' + r.seen + ')</span>' : '–') + '</td></tr>';
      }).join('');
      return '<section class="zp-panel"><h2>Progress by chapter</h2><div class="zp-tablewrap"><table class="zp-table"><thead><tr><th>Chapter</th><th>B C R T V X</th><th>Accuracy</th></tr></thead><tbody>' + rows + '</tbody></table></div>' + (D.hasLegacy ? '<p class="zp-muted">Stages carried over from the old roadmap show as done without question-level data.</p>' : '') + '</section>';
    }
    function notesPanel() {
      var list = D.tnotes.slice().reverse().map(function (n) { return '<div class="zp-mnote"><p class="zp-muted">' + UI.fmtDate(n.t) + (n.tag ? ' · ' + esc(n.tag) : '') + '</p><p>' + M.richText(n.text) + '</p></div>'; }).join('');
      return '<section class="zp-panel"><h2>Private notes <span class="zp-badge">only you see these</span></h2>' + (list || '<p class="zp-muted">Patterns you notice, predictions, what to raise next session.</p>') +
        field('New note', '<textarea id="zp-tnote" class="zp-tex" rows="2" maxlength="1500"></textarea>') + '<div class="zp-row"><button type="button" class="zp-btn" data-act="tnote">Save note</button></div></section>';
    }
    function overview() {
      var o = st.overall, q = st.queue, tiles = [[o.seen, 'answered'], [pct(o.pct), 'accuracy'], [pct(o.hintPct), 'opened the answer'], [q.due, 'reviews due'], [q.needsNote, 'entries to write'], [pct(q.avgRetention), 'est. retention'], [st.sessions.length, 'tests and mocks']];
      return '<div class="zp-stats">' + tiles.map(function (t) { return '<div><b>' + t[0] + '</b><span>' + t[1] + '</span></div>'; }).join('') + '</div>' +
        '<section class="zp-panel"><h2>Activity</h2>' + UI.streakHTML(st) + UI.heatmapHTML(D.activity, 26) + '</section>' +
        '<div class="zp-twocol"><section class="zp-panel"><h2>Accuracy, week by week</h2>' + UI.sparkHTML(st.trend.map(function (b, i) { return { label: i === st.trend.length - 1 ? 'this week' : (st.trend.length - 1 - i) + ' wk ago', v: b.pct }; })) + '</section>' +
        '<section class="zp-panel"><h2>Reviews due, next 14 days</h2>' + UI.barsHTML(st.forecast.map(function (f, i) { return { label: i === 0 ? 'now' : f.day.slice(8), n: f.n, tip: f.day + ': ' + f.n }; })) + '</section></div>' +
        weakSpots() + mistakePatterns() + chapterTable() + notesPanel();
    }

    /* ---------- work: feedback ---------- */
    function wrongRows(s) {
      var rows = (s.pids || []).filter(function (p) { return s.result && s.result[p] && s.result[p] !== 'correct'; }).slice(0, 12).map(function (p) {
        var Q = data.byId[p]; return '<tr><td>' + (Q ? UI.codeBadge(Q) : esc(p)) + '</td><td>' + (Q ? esc(UI.shortStem(Q, 60)) : '') + '</td><td>' + esc((s.answers || {})[p] || '(none)') + (Q && Q.correct ? ' <span class="zp-muted">→ ' + esc(Q.correct) + '</span>' : '') + '</td><td>' + Math.round(((s.ms || {})[p] || 0) / 1000) + 's</td></tr>';
      }).join('');
      var fr = (s.frqPids || []).map(function (p) { var sc = (D.frqScores[s.id] || {})[p]; var Q = data.byId[p]; return '<tr><td>' + (Q ? UI.codeBadge(Q) : esc(p)) + '</td><td colspan="2">Free response</td><td>' + (sc == null ? 'not scored' : sc + ' pts') + '</td></tr>'; }).join('');
      return rows || fr ? '<div class="zp-tablewrap"><table class="zp-table"><thead><tr><th>Problem</th><th>Stem</th><th>Their answer</th><th>Time</th></tr></thead><tbody>' + rows + fr + '</tbody></table></div>' : '<p class="zp-muted">No misses recorded.</p>';
    }
    function feedbackItems() {
      var out = [], tests = [].concat.apply([], Object.keys(D.tests).map(function (c) { return D.tests[c]; })).concat(D.customTests, D.mocks);
      tests.forEach(function (s) {
        var label = s.kind === 'MOCK' ? (s.title || 'Mock') : s.kind === 'TEST' ? 'Custom test' : 'Ch ' + s.ch + ' test', rv = D.tReviews[s.id];
        out.push({ ref: s.id, sent: [s.id], done: !!D.fb[s.id] || fbMsg(s.id), t: s.t, label: label + ' · ' + s.score.correct + '/' + s.score.total, kind: s.kind === 'MOCK' ? 'Mock' : 'Test',
          body: '<p class="zp-muted">' + UI.fmtDate(s.t) + ' · ' + UI.mmss(s.usedSec || 0) + ' of ' + s.minutes + ':00' + (D.debrief[s.id] ? ' · <b>asked for a debrief</b>' : '') + (rv && rv.rule ? '<br>Their rule for next time: "' + esc(rv.rule) + '"' : '') + '</p>' + wrongRows(s) });
      });
      // Free-response answers the student sent for feedback: their typed text / LaTeX source and photos, the problem and where its official scoring guidelines are.
      Object.keys(D.frqAsk).map(function (k) { return D.frqAsk[k]; }).forEach(function (a) {
        var Q = data.byId[a.pid]; if (!Q) return;
        var sb = a.aid ? D.subById[a.aid] : null, max = (sb && sb.spec && sb.spec.scoring && sb.spec.scoring.frqMaxEach) || 9, where = a.aid ? (sb && sb.title ? sb.title : 'Mock') : 'Practice';
        var links = [Q.scoringUrl ? '<a class="zp-link" href="' + esc(Q.scoringUrl) + '" target="_blank" rel="noopener">Official scoring guidelines ↗</a>' : '', Q.samplesUrl ? '<a class="zp-link" href="' + esc(Q.samplesUrl) + '" target="_blank" rel="noopener">Sample student responses ↗</a>' : ''].filter(Boolean).join(' · ');
        var imgs = (a.images || []).map(function (im) { var u = im.url || im.data || ''; return u ? '<a href="' + esc(u) + '" target="_blank" rel="noopener"><img src="' + esc(u) + '" alt="' + esc(im.name || 'Their work') + '" class="zp-frqimg" loading="lazy"></a>' : ''; }).join('');
        out.push({ ref: a.ref, refLabel: Q.code, pid: a.pid, frq: { aid: a.aid, pid: a.pid, ch: a.ch || Q.chapter, max: max, score: a.score }, sent: [a.ref], done: a.status === 'answered', t: a.askedAt, label: Q.code + ' · ' + where + ' · ' + UI.shortStem(Q, 60), kind: 'FRQ',
          body: '<p class="zp-muted">' + esc(where) + ' free response · asked ' + UI.fmtDate(a.askedAt) + (a.score != null ? ' · scored ' + a.score + ' / ' + max : '') + '</p>' + (links ? '<p>' + links + '</p>' : '') +
            '<details><summary>Problem and official solution</summary>' + UI.stemHTML(Q) + UI.solutionHTML(Q) + '</details><p class="zp-label">Their answer</p>' +
            (a.text ? '<div class="zp-frqtext">' + esc(a.text) + '</div><details><summary class="zp-muted">LaTeX source</summary><pre class="zp-frqsrc">' + esc(a.text) + '</pre></details>' : '<p class="zp-muted">(nothing typed)</p>') +
            (imgs ? '<div class="zp-cimgs">' + imgs + '</div>' : '<p class="zp-muted">(no photo attached)</p>') });
      });
      Object.keys(D.notes).map(function (p) { return D.notes[p]; }).filter(function (n) { return ZP.entryComplete(n) && ZP.trackOf(n) === 'actual' && !n.legacy; }).forEach(function (n) {
        var Q = data.byId[n.pid];
        out.push({ ref: 'entry:' + n.pid, refLabel: Q ? Q.code : n.pid, sent: [n.id], done: !!D.fb[n.id] || fbMsg('entry:' + n.pid), t: n.t, label: (Q ? Q.code + ' · ' + UI.shortStem(Q, 60) : n.pid), kind: 'Entry',
          body: '<dl class="zp-entry">' + [['What I missed / next time', n.stuck], ['Main idea', n.idea], ['When I see… I try…', n.signal]].filter(function (x) { return x[1]; }).map(function (x) { return '<dt>' + x[0] + '</dt><dd>' + M.richText(x[1]) + '</dd>'; }).join('') + '</dl>' });
      });
      return out.sort(function (a, b) { return (a.done - b.done) || b.t - a.t; });
    }
    function fbMsg(ref) { return D.msgs.some(function (m) { return m.from === 'teacher' && m.ref === ref; }); }
    var openFb = '';
    function work() {
      var items = feedbackItems(), todo = items.filter(function (i) { return !i.done; });
      return '<h2>Feedback queue <span class="zp-badge ' + (todo.length ? 'warn' : '') + '">' + todo.length + ' waiting</span></h2><p class="zp-muted">Your comment goes into ' + esc(g.name.split(' ')[0]) + '\'s Mentor thread and shows next to the work it is about. Math works: use the buttons above the box.</p>' +
        (items.length ? '<div class="zp-tq">' + items.slice(0, 30).map(function (it, i) {
          var open = openFb === it.ref;
          return '<div class="zp-tq-item zp-fbitem' + (it.done ? ' done' : '') + '"><div><span class="zp-badge ' + (it.done ? 'ok' : 'warn') + '">' + it.kind + (it.done ? ' · answered' : '') + '</span> <b>' + esc(it.label) + '</b> <span class="zp-muted">· ' + UI.ago(it.t) + '</span>' +
            (open ? it.body + (it.frq ? '<label class="zp-field inline"><span>Score (0 to ' + it.frq.max + ')</span><input type="number" data-fbscore min="0" max="' + it.frq.max + '" step="1"' + (it.frq.score != null ? ' value="' + esc(it.frq.score) + '"' : '') + '></label>' : '') + '<label class="zp-field"><span>Your feedback</span><textarea class="zp-tex" data-fbtext rows="4" maxlength="3000" placeholder="What went well, the pattern you see, what to do next."></textarea></label><div class="zp-row"><button type="button" class="zp-btn primary" data-act="fbsend" data-i="' + i + '">Send feedback</button>' + (it.done ? '' : '<button type="button" class="zp-btn" data-act="fbmark" data-i="' + i + '">Mark done without a comment</button>') + '</div>' : '') + '</div>' +
            '<div class="zp-row"><button type="button" class="zp-btn" data-act="fbopen" data-i="' + i + '">' + (open ? 'Close' : it.done ? 'View' : 'Review') + '</button></div></div>';
        }).join('') + '</div>' : UI.emptyState('Nothing submitted yet', esc(g.name) + ' has not taken a test or mock, or written an Actual entry.'));
    }

    /* ---------- assign ---------- */
    function codeIndex() { var ix = {}; data.problems.forEach(function (q) { ix[ZP.normCode(q.code)] = q; ix[ZP.normCode(q.id)] = q; }); return ix; }
    function parseCodes(text) {
      var ix = codeIndex(), found = [], missing = [];
      String(text || '').split(/[\s,;]+/).filter(Boolean).forEach(function (tok) { var q = ix[ZP.normCode(tok)]; if (q && !q.blocked) { if (found.indexOf(q.id) < 0) found.push(q.id); } else missing.push(tok); });
      return { ids: found, missing: missing };
    }
    function autoPick(n) {
      var weak = st.weak.slice(0, 3); if (!weak.length && D.current) weak = [D.current];
      var cand = data.problems.filter(function (q) { return !q.blocked && !q.frq && q.kind !== 'F' && weak.indexOf(q.chapter) >= 0 && (!D.q[q.id] || (D.q[q.id].wrong > 0 && D.pstatus[q.id] !== 'done')); });
      cand.sort(function (a, b) { return ((D.q[b.id] ? 1 : 0) - (D.q[a.id] ? 1 : 0)) || (a.id < b.id ? -1 : 1); });
      return cand.slice(0, n).map(function (q) { return q.code; });
    }
    // What the student reported when they marked the task done (their line in Mentor, tied to the task).
    function taskReport(t) {
      var r = D.msgs.filter(function (m) { return m.from !== 'teacher' && m.ref === 'task:' + t.key; }).pop();
      return r ? '<br><span class="zp-muted">Their report:</span> ' + M.richText(r.text) : '';
    }
    function taskRow(t) {
      var cls = t.status === 'overdue' ? 'late' : t.done ? 'ok' : 'warn';
      return '<div class="zp-taskrow' + (t.done ? ' done' : '') + '"><div><span class="zp-badge ' + cls + '">' + (t.done ? 'Done' + (t.doneBy ? ' by ' + (t.doneBy === 'you' ? 'student' : 'you') : '') : t.status === 'overdue' ? 'Overdue' : 'Open') + '</span> <span class="zp-badge ' + (t.forced ? 'warn' : '') + '">' + (t.forced ? 'Required' : 'Suggested') + '</span>' + (t.sprint ? ' <span class="zp-badge warn">Sprint</span>' : '') + ' <b>' + esc(t.title) + '</b>' +
        '<br><span class="zp-muted">' + (t.kind === 'practice' ? 'Practice set · ' + t.cur + '/' + t.total + ' tried' : t.kind === 'stage' ? 'Ch ' + esc(t.ch) + ' ' + (t.stage === 'ALL' ? 'whole chapter' : esc(ZP.STAGE_NAME[t.stage] || t.stage)) + ' · ' + t.cur + '/' + t.total : 'Free task') + (t.due ? ' · due ' + esc(t.due) + (t.dueTime ? ' ' + esc(t.dueTime) : '') : '') + (t.legacy ? ' · from the old roadmap' : '') + '</span>' + taskReport(t) + '</div>' +
        '<div class="zp-row">' + (t.done ? '' : '<button type="button" class="zp-btn" data-act="tmark" data-key="' + esc(t.key) + '">Mark done</button>') + '<button type="button" class="zp-btn" data-act="tedit" data-key="' + esc(t.key) + '">Edit</button><button type="button" class="zp-linkbtn" data-act="tdel" data-key="' + esc(t.key) + '">Delete</button></div></div>';
    }
    function taskForm() {
      var d = draft, same = Object.keys(g.groupsRef || {}).map(function (k) { return g.groupsRef[k]; }).filter(function (x) { return x.course === g.course && x.username !== g.username && !x.former; });
      var chOpts = info.order.map(function (c) { return [c, 'Ch ' + c + ' · ' + info.chapters[c].title]; }), stOpts = [['ALL', 'Whole chapter'], ['B', 'Book'], ['C', 'Problems'], ['R', 'Review'], ['T', 'Test'], ['V', 'Review (test)'], ['X', 'Close']];
      return '<section class="zp-panel"><h2>' + (d.edit ? 'Edit task' : 'New task') + '</h2>' +
        '<div class="zp-chips" role="group" aria-label="Task type">' + [['practice', 'Custom practice set'], ['stage', 'Chapter sprint'], ['free', 'Free task']].map(function (k) { return '<button type="button" class="zp-chip' + (d.kind === k[0] ? ' on' : '') + '" data-tk="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        field('Title', '<input type="text" id="zp-ttitle" maxlength="100" value="' + esc(d.title || '') + '" placeholder="' + (d.kind === 'practice' ? 'e.g. Chain rule: the ones you keep missing' : d.kind === 'stage' ? 'e.g. Grind Chapter 5 problems' : 'e.g. Rewrite your Chapter 3 summary') + '">') +
        field('Instructions (shown on their Right Now)', '<textarea id="zp-tinstr" class="zp-tex" rows="3" maxlength="1500">' + esc(d.instr || '') + '</textarea>') +
        (d.kind === 'practice' ? field('Problems (codes like C5A12, T3B4, separated by spaces or commas)', '<textarea id="zp-tpids" rows="3" placeholder="C5A12 C5A14 T3B4">' + esc(d.codes || '') + '</textarea>') + '<div class="zp-row"><button type="button" class="zp-btn" data-act="autopick">Fill with 10 from their weak spots</button><span class="zp-muted" id="zp-tpidsmsg"></span></div>' : '') +
        (d.kind === 'stage' ? '<div class="zp-propgrid">' + field('Chapter', '<select id="zp-tch">' + opts(chOpts, d.ch || D.current || info.order[0]) + '</select>') + field('Until this is done', '<select id="zp-tstage">' + opts(stOpts, d.stage || 'C') + '</select>') + '</div>' : '') +
        '<div class="zp-propgrid">' + field('Due date', '<input type="date" id="zp-tdue" value="' + esc(d.due || '') + '">') + field('Due time', '<input type="time" id="zp-tduet" value="' + esc(d.dueTime || '') + '">') + field('Minutes (estimate)', '<input type="number" id="zp-tmin" min="0" max="600" step="5" value="' + esc(d.minutes || '') + '">') + '</div>' +
        '<div class="zp-chips"><label class="zp-check"><input type="checkbox" id="zp-tforced"' + (d.forced === false ? '' : ' checked') + '> Required <span class="zp-muted">(goes above reviews on Right Now)</span></label>' + (d.kind === 'stage' ? '<label class="zp-check"><input type="checkbox" id="zp-tsprint"' + (d.sprint !== false ? ' checked' : '') + '> Sprint <span class="zp-muted">(shows the deadline as a countdown)</span></label>' : '') + '</div>' +
        (!d.edit && same.length ? '<details class="zp-more"><summary>Also give it to others in this class</summary><div class="zp-chips">' + same.map(function (x) { return '<label class="zp-check"><input type="checkbox" data-also="' + esc(x.key) + '"> ' + esc(x.name) + '</label>'; }).join('') + '</div></details>' : '') +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="tsave">' + (d.edit ? 'Save changes' : 'Assign') + '</button>' + (d.edit ? '<button type="button" class="zp-btn" data-act="tcancel">Cancel</button>' : '') + '<span class="zp-muted" id="zp-tmsg" role="status"></span></div></section>';
    }
    function criteriaForm() {
      var def = ZP.reqDefaults(), cur = D.req, set = D.criteriaSet;
      var rows = [['carelessChars', 'Careless entry: characters', 'Minimum in the one box'], ['actualChars', 'Actual entry: characters', 'Minimum in each of the two boxes'], ['conceptWords', 'Concept card: words', 'Minimum before it counts as written'], ['summaryWords', 'Chapter summary: words', 'Minimum to close a chapter'], ['dailyReviewMin', 'Daily review budget: minutes', 'How much review fits in one day']];
      return '<section class="zp-panel"><h2>Requirements for ' + esc(g.name.split(' ')[0]) + '</h2><p class="zp-muted">What counts as "written enough". Applies to this student only, takes effect immediately, and the student sees the new numbers in the notebook. Leave a field empty to use the default (' + esc(rows.map(function (r) { return def[r[0]]; }).join(' / ')) + ').</p>' +
        '<div class="zp-critgrid">' + rows.map(function (r) { return field(r[1], '<input type="number" data-crit="' + r[0] + '" min="' + ZP.REQ_LIMITS[r[0]][0] + '" max="' + ZP.REQ_LIMITS[r[0]][1] + '" value="' + (set[r[0]] != null ? set[r[0]] : '') + '" placeholder="' + def[r[0]] + '">') + '<span class="zp-muted zp-critnote">' + r[2] + (set[r[0]] != null ? ' · now ' + cur[r[0]] : '') + '</span>'; }).join('') + '</div>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="critsave">Save requirements</button><span class="zp-muted" id="zp-critmsg" role="status"></span></div></section>';
    }
    function assign() {
      var open = D.tasks.filter(function (t) { return !t.done; }), done = D.tasks.filter(function (t) { return t.done; });
      return taskForm() + '<section class="zp-panel"><h2>Tasks</h2>' + (open.length ? open.map(taskRow).join('') : '<p class="zp-muted">No open tasks. ' + esc(g.name.split(' ')[0]) + '\'s Right Now follows the chapter flow and the review queue.</p>') +
        (done.length ? '<details class="zp-more"><summary>' + done.length + ' finished</summary>' + done.map(taskRow).join('') + '</details>' : '') + '</section>' + criteriaForm();
    }
    function readTask() {
      var d = draft, v = function (id) { var el = host.querySelector('#' + id); return el ? el.value : ''; };
      d.title = v('zp-ttitle').trim(); d.instr = v('zp-tinstr').trim(); d.due = v('zp-tdue'); d.dueTime = v('zp-tduet'); d.minutes = +v('zp-tmin') || 0;
      var f = host.querySelector('#zp-tforced'); d.forced = f ? f.checked : true; var sp = host.querySelector('#zp-tsprint'); d.sprint = sp ? sp.checked : false;
      if (d.kind === 'practice') d.codes = v('zp-tpids'); if (d.kind === 'stage') { d.ch = v('zp-tch'); d.stage = v('zp-tstage'); }
      return d;
    }
    function saveTask() {
      var d = readTask(), msg = host.querySelector('#zp-tmsg'), say = function (t) { msg.textContent = t; };
      if (!d.title) return say('Give it a title.');
      var base = { title: d.title, instr: d.instr, kind: d.kind, due: d.due, dueTime: d.dueTime, forced: d.forced, minutes: d.minutes, sprint: d.kind === 'stage' && d.sprint };
      if (d.kind === 'practice') { var pr = parseCodes(d.codes); if (!pr.ids.length) return say('Add at least one valid problem code.'); if (pr.missing.length) say('Skipped unknown codes: ' + pr.missing.slice(0, 5).join(', ')); base.pids = pr.ids; }
      else if (d.kind === 'stage') { base.ch = d.ch || D.current || info.order[0]; base.stage = d.stage || 'C'; }
      var targets = [{ g: g, store: store }];
      if (!d.edit) Array.prototype.forEach.call(host.querySelectorAll('[data-also]:checked'), function (c) { var o = g.groupsRef[c.dataset.also]; if (o) targets.push({ g: o, store: ZP.open(o.username, o.course) }); });
      targets.forEach(function (t) { var ev = t.store.append('task', Object.assign({ key: d.edit || ('t' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5)) }, base)); T.push(t.g, ev); });
      draft = { kind: d.kind, edit: '' }; derive(); render();
    }

    /* ---------- plan & calendar ---------- */
    function calList() {
      var today = ZP.dayKey(Date.now()), items = Object.keys(D.cal).map(function (k) { return D.cal[k]; }).filter(function (c) { return !c.deleted && (c.date >= today || !c.done); }).sort(function (a, b) { return (a.date + (a.time || '')) < (b.date + (b.time || '')) ? -1 : 1; });
      return items.length ? items.slice(0, 25).map(function (c) {
        return '<div class="zp-agrow' + (c.done ? ' done' : '') + '"><span class="zp-badge ' + (c.by ? 'warn' : '') + '">' + (c.by ? 'Mentor' : 'Student') + '</span><span class="zp-badge">' + esc(({ todo: 'To-do', event: 'Event', mock: 'Mock' })[c.kind] || c.kind) + '</span><span class="zp-agtitle"><b>' + esc(c.title) + '</b> <span class="zp-muted">' + esc(UI.fmtISO(c.date)) + (c.time ? ' ' + esc(c.time) : '') + (c.len ? ' · ' + c.len + ' min' : '') + (c.remind && c.remind.length ? ' · reminds ' + c.remind.map(function (m) { return m >= 1440 ? m / 1440 + 'd' : m >= 60 ? m / 60 + 'h' : m + 'm'; }).join(', ') + ' before' : '') + '</span></span>' +
          (c.by ? '<button type="button" class="zp-linkbtn" data-act="cdel" data-key="' + esc(c.key) + '">Delete</button>' : '') + '</div>';
      }).join('') : '<p class="zp-muted">Nothing scheduled.</p>';
    }
    function proposals() {
      var pend = D.props.filter(function (p) { return p.status === 'pending'; });
      if (!pend.length) return '';
      return '<section class="zp-panel"><h2>Proposed by ' + esc(g.name.split(' ')[0]) + '</h2>' + pend.map(function (p) {
        var x = p.msg.prop || {};
        return '<div class="zp-taskrow"><div><b>' + esc(x.title || 'Session') + '</b> · ' + esc(x.date || '') + (x.time ? ' ' + esc(x.time) : '') + (x.len ? ' · ' + x.len + ' min' : '') + (p.msg.text ? '<br><span class="zp-muted">' + esc(p.msg.text) + '</span>' : '') + '</div><div class="zp-row"><input type="text" class="zp-inl" data-pnote="' + esc(p.msg.id) + '" placeholder="Note back (optional)"><button type="button" class="zp-btn primary" data-act="paccept" data-id="' + esc(p.msg.id) + '">Accept</button><button type="button" class="zp-btn" data-act="pdecline" data-id="' + esc(p.msg.id) + '">Decline</button></div></div>';
      }).join('') + '</section>';
    }
    function schedForm() {
      return '<section class="zp-panel"><h2>Put something on ' + esc(g.name.split(' ')[0]) + '\'s calendar</h2><p class="zp-muted">It shows on their Right Now, with a reminder banner for the two days before. Reminders are shown on the site; tick the box to also send an email.</p>' +
        '<div class="zp-propgrid">' + field('What', '<input type="text" id="zp-stitle" maxlength="100" placeholder="e.g. Session: review Chapter 5 test">') + field('Kind', '<select id="zp-skind">' + opts([['event', 'Session / event'], ['mock', 'Mock exam'], ['todo', 'To-do']], 'event') + '</select>') + '</div>' +
        '<div class="zp-propgrid">' + field('Date', '<input type="date" id="zp-sdate" value="' + esc(ZP.dayKey(Date.now())) + '">') + field('Time', '<input type="time" id="zp-stime">') + field('Minutes', '<input type="number" id="zp-slen" min="15" max="300" step="15" value="60">') + field('Remind', '<select id="zp-sremind">' + opts([['1440,60', '1 day and 1 hour before'], ['1440', '1 day before'], ['60', '1 hour before'], ['', 'No reminder']], '1440,60') + '</select>') + '</div>' +
        '<label class="zp-check"><input type="checkbox" id="zp-smail"> Also email a reminder the day before' + (g.former ? '' : '') + '</label>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="ssave">Add to calendar</button><span class="zp-muted" id="zp-smsg" role="status"></span></div></section>';
    }
    function planTab() {
      return proposals() + schedForm() + '<section class="zp-panel"><h2>Calendar</h2>' + calList() + '</section><div id="zp-plan-host"></div>';
    }
    function saveSched() {
      var v = function (id) { return host.querySelector('#' + id).value; }, msg = host.querySelector('#zp-smsg'), title = v('zp-stitle').trim(), date = v('zp-sdate');
      if (!title || !date) { msg.textContent = 'Add what and when.'; return; }
      var rem = v('zp-sremind') ? v('zp-sremind').split(',').map(Number) : [], time = v('zp-stime');
      add('cal_item', { key: 'm' + Date.now().toString(36), date: date, time: time, title: title, kind: v('zp-skind'), len: +v('zp-slen') || 0, remind: rem, done: false });
      if (host.querySelector('#zp-smail').checked) {
        var when = new Date(date + 'T' + (time || '09:00') + ':00').getTime() - DAY;
        if (when > Date.now() && typeof TEACHER_DATA_WRITE_URL !== 'undefined' && TEACHER_DATA_WRITE_URL) {
          fetch(TEACHER_DATA_WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'scheduleNotification', payload: { username: teacher.username, name: teacher.name, recipientUsernames: [g.username], recipientNames: [g.name], subject: 'Reminder: ' + title, message: title + ' is on ' + date + (time ? ' at ' + time : '') + '. See your Right Now page for details.', sendAt: new Date(when).toISOString() } }) }).catch(function () { /* the calendar item is saved either way */ });
        }
      }
      render();
    }

    /* ---------- talk ---------- */
    var TEMPLATES = { nudge: ['You have not practiced in a few days. Even 15 minutes of reviews keeps the streak and the memory alive. Start with the review queue.', 'The next chapter is waiting. Pick one stage today and finish it.'],
      motivation: ['Your last test was a clear step up. The work is showing. Keep the same routine this week.', 'This chapter is the hard one. Everyone slows down here. Slow is fine; stopping is not.'],
      advice: ['Before you start a problem, write the one idea you think it tests. If you cannot name it, that is the thing to look up.', 'On tests, mark the question and move on at 2 minutes. Come back with whatever time is left.'], resource: [''], message: [''] };
    function talk() {
      var kinds = M.TEACHER_KINDS;
      return '<div class="zp-twocol zp-mentorcols"><section class="zp-panel"><h2>Send</h2><div class="zp-chips">' + kinds.filter(function (k) { return k[0] !== 'feedback'; }).map(function (k) { return '<button type="button" class="zp-chip' + (talkKind === k[0] ? ' on' : '') + '" data-tkind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        (TEMPLATES[talkKind] && TEMPLATES[talkKind][0] ? field('Start from a template', '<select id="zp-ttpl"><option value="">(write your own)</option>' + TEMPLATES[talkKind].map(function (t, i) { return '<option value="' + i + '">' + esc(t.slice(0, 70)) + '…</option>'; }).join('') + '</select>') : '') +
        (talkKind === 'resource' ? field('Link', '<input type="url" id="zp-turl" placeholder="https://">') : '') +
        field('Message', '<textarea id="zp-tmsgtext" class="zp-tex" rows="4" maxlength="3000"></textarea>') +
        '<div class="zp-photobox"><input type="file" id="zp-tfile" accept="image/*" multiple hidden><button type="button" class="zp-btn" data-act="tpick">Attach photos</button><span class="zp-muted" id="zp-tpicked"></span></div>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="tsend">Send</button><span class="zp-muted" id="zp-tsendmsg" role="status"></span></div></section>' +
        '<section class="zp-panel"><h2>Latest from ' + esc(g.name.split(' ')[0]) + '</h2>' + (D.msgs.filter(function (m) { return m.from !== 'teacher'; }).slice(-3).reverse().map(function (m) { return '<div class="zp-mnote' + (m.t > D.read.teacher && !m.legacy ? ' new' : '') + '"><p class="zp-muted">' + M.stamp(m.t) + '</p><p>' + M.richText((m.text || '').slice(0, 300)) + '</p></div>'; }).join('') || '<p class="zp-muted">Nothing yet.</p>') + '</section></div>' +
        '<section class="zp-panel"><h2>Conversation</h2>' + M.threadHTML(D, 'teacher', { all: true }) + '</section>';
    }

    function body() { return tab === 'work' ? work() : tab === 'assign' ? assign() : tab === 'plan' ? planTab() : tab === 'talk' ? talk() : overview(); }
    function render() {
      var keepY = window.scrollY;
      host.innerHTML = head() + '<div class="zp-deskbody">' + body() + '</div>';
      UI.renderMath(host);
      if (tab === 'plan' && root.ZPPlan) root.ZPPlan.mountCalendar(host.querySelector('#zp-plan-host'), { role: 'teacher', username: teacher.username }, { username: g.username, course: g.course });
      if (tab === 'talk' && D.unread.teacher.length) { add('msg_read', { by: 'teacher', upTo: Date.now() }); }
      window.scrollTo(0, keepY);
    }

    host.onclick = function (e) {
      var tb = e.target.closest('[data-tab]'); if (tb) { e.preventDefault(); tab = tb.dataset.tab; history.replaceState(null, '', '#' + tab); render(); return window.scrollTo(0, 0); }
      var tk = e.target.closest('[data-tk]'); if (tk) { readTask(); draft.kind = tk.dataset.tk; return render(); }
      var tkind = e.target.closest('[data-tkind]'); if (tkind) { talkKind = tkind.dataset.tkind; return render(); }
      var b = e.target.closest('[data-act]'); if (!b) return;
      var a = b.dataset.act, key = b.dataset.key;
      if (a === 'tnote') { var ta = host.querySelector('#zp-tnote'); if (ta.value.trim()) { add('tnote', { text: ta.value.trim(), tag: '' }); render(); } }
      else if (a === 'fbopen') { var it = feedbackItems()[+b.dataset.i]; openFb = openFb === it.ref ? '' : it.ref; render(); }
      else if (a === 'fbsend' || a === 'fbmark') {
        var f = feedbackItems()[+b.dataset.i], txt = (host.querySelector('[data-fbtext]') || {}).value || '';
        if (a === 'fbsend') {
          var scEl = host.querySelector('[data-fbscore]'), hasScore = !!(f.frq && scEl && scEl.value !== ''), sv = hasScore ? Math.max(0, Math.min(f.frq.max, Math.round(+scEl.value))) : null;
          if (!txt.trim() && !hasScore) return host.querySelector('[data-fbtext]').focus();
          // A free-response score is final: it replaces the student's own and becomes the problem's score. The note cites the problem so the student can open it.
          if (hasScore) add('frq_score', { aid: f.frq.aid, pid: f.frq.pid, ch: f.frq.ch, score: sv, max: f.frq.max });
          add('msg', { from: 'teacher', kind: 'feedback', text: ((hasScore ? 'Score: ' + sv + ' / ' + f.frq.max + '\n' : '') + txt.trim()).trim(), ref: f.ref, refLabel: f.refLabel || f.label, pid: f.pid || '' });
        }
        f.sent.forEach(function (r) { add('fb_sent', { ref: r }); }); openFb = ''; render();
      }
      else if (a === 'autopick') { var codes = autoPick(10); host.querySelector('#zp-tpids').value = codes.join(' '); host.querySelector('#zp-tpidsmsg').textContent = codes.length ? codes.length + ' problems from their weakest chapters (missed or not yet tried).' : 'Nothing to pick: no weak chapters yet.'; }
      else if (a === 'tsave') saveTask();
      else if (a === 'tcancel') { draft = { kind: draft.kind, edit: '' }; render(); }
      else if (a === 'tmark') { add('task_done', { key: key }); render(); }
      else if (a === 'tdel') { var t0 = D.taskDefs[key]; if (t0 && confirm('Delete this task?')) { add('task', Object.assign(strip(t0), { deleted: true })); render(); } }
      else if (a === 'tedit') { var t1 = D.tasks.filter(function (x) { return x.key === key; })[0]; if (t1) { draft = { kind: t1.kind, edit: key, title: t1.title, instr: t1.instr, due: t1.due, dueTime: t1.dueTime, minutes: t1.minutes, forced: t1.forced, sprint: t1.sprint, ch: t1.ch, stage: t1.stage, codes: t1.pids.map(function (p) { return data.byId[p] ? data.byId[p].code : p; }).join(' ') }; render(); window.scrollTo(0, 0); } }
      else if (a === 'critsave') {
        var set = {}; Array.prototype.forEach.call(host.querySelectorAll('[data-crit]'), function (i) { var cur = D.criteriaSet[i.dataset.crit]; if (i.value === '') { if (cur != null) set[i.dataset.crit] = null; } else if (+i.value !== cur) set[i.dataset.crit] = +i.value; });
        if (!Object.keys(set).length) { host.querySelector('#zp-critmsg').textContent = 'No changes.'; return; }
        add('criteria', { set: set }); render(); host.querySelector('#zp-critmsg').textContent = 'Saved. ' + esc(g.name.split(' ')[0]) + ' sees it now.';
      }
      else if (a === 'ssave') saveSched();
      else if (a === 'cdel') { var c = D.cal[key]; if (c) { add('cal_item', Object.assign(strip(c), { deleted: true })); render(); } }
      else if (a === 'paccept' || a === 'pdecline') {
        var pm = D.props.filter(function (p) { return p.msg.id === b.dataset.id; })[0]; if (!pm) return;
        var note = (host.querySelector('[data-pnote="' + b.dataset.id + '"]') || {}).value || '', ok = a === 'paccept', px = pm.msg.prop || {};
        add('prop_reply', { ref: pm.msg.id, status: ok ? 'accepted' : 'declined', note: note });
        if (ok) add('cal_item', { key: 'p' + pm.msg.id, date: px.date, time: px.time || '', title: px.title || 'Session', kind: 'event', len: px.len || 60, remind: [1440, 60], done: false });
        render();
      }
      else if (a === 'tpick') host.querySelector('#zp-tfile').click();
      else if (a === 'tsend') {
        var text = host.querySelector('#zp-tmsgtext').value.trim(), url = (host.querySelector('#zp-turl') || {}).value || '', say = function (t) { host.querySelector('#zp-tsendmsg').textContent = t; };
        if (!text && !picked.length && !url) return say('Write something first.');
        say('Sending…');
        M.sendPhotos(picked).then(function (files) { var m = { from: 'teacher', kind: talkKind, text: text }; if (url) m.url = url.trim(); if (files.length) m.files = files; add('msg', m); picked = []; render(); })
          .catch(function (er) { say('Could not send: ' + er.message); });
      }
    };
    host.onchange = function (e) {
      if (e.target.id === 'zp-ttpl') { var tpl = TEMPLATES[talkKind][+e.target.value]; if (tpl != null) { var ta = host.querySelector('#zp-tmsgtext'); ta.value = tpl; ta.dispatchEvent(new Event('input')); } }
      else if (e.target.id === 'zp-tfile') {
        var files = Array.prototype.slice.call(e.target.files).slice(0, M.MAX_PHOTOS); e.target.value = '';
        Promise.all(files.map(M.readPhoto)).then(function (ps) { picked = picked.concat(ps); host.querySelector('#zp-tpicked').textContent = picked.length + ' photo' + (picked.length > 1 ? 's' : '') + ' ready'; });
      }
    };
    host.oninput = function (e) {
      if (e.target.id === 'zp-tpids') { var r = parseCodes(e.target.value), el = host.querySelector('#zp-tpidsmsg'); el.textContent = r.ids.length + ' problem' + (r.ids.length === 1 ? '' : 's') + (r.missing.length ? ' · not found: ' + r.missing.slice(0, 4).join(', ') : ''); }
    };
    Promise.all([store.load(), root.ZPPlan.load(g.username, g.course).catch(function () { return null; })]).then(function (r) {
      // the log may have grown (remote load): rebuild from the store's events
      g.events = store.events().slice(); plan = r[1]; derive(); render();
    }).catch(function () { derive(); render(); });
    derive(); host.innerHTML = '<p role="status">Loading…</p>';
    window.addEventListener('hashchange', function () { var h = (location.hash || '#overview').slice(1); if (TABS.some(function (t) { return t[0] === h; })) { tab = h; render(); } });
  }

  function mountPage(host, teacher) {
    T.clearViewAs();
    var p = new URLSearchParams(location.search), u = p.get('student') || p.get('username'), c = p.get('course');
    host.innerHTML = '<p role="status">Loading…</p>';
    T.loadGroups(teacher).then(function (r) {
      var g = r.groups[u + '|' + c]; if (!g) { host.innerHTML = UI.emptyState('Could not find that student', 'Go back to the <a href="teacher.html">Mentor Desk</a> and open them from the list.'); return; }
      g.groupsRef = r.groups; mount(host, teacher, g, r);
    }).catch(function (e) { host.innerHTML = UI.emptyState('Could not read student data', esc(e.message)); });
  }

  root.ZPTStudent = { mountPage: mountPage };
})(window);
