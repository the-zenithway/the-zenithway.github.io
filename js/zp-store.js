/* Course platform core: event log storage, derived state, Today, long-term plan.
 *
 * Everything a student does is one append-only event. Chapter status, the review
 * queue, the notebook, Today and the teacher view are all DERIVED from that log,
 * never hand-set. derive() and the plan helpers are pure so they can be tested in
 * node (scripts/test_platform.cjs).
 *
 * Event types (all carry id, t, type; most carry ch = chapter string):
 *   ex        {ch,key,label,tap:'alone'|'hint'|'stuck',line}      B example reflection
 *   concept   {ch,key,name,text,images?}                          B concept card (closed-book draft); images [{url|data,name}] only when changed
 *   concept_order {ch,keys[]}                                     the student's sequence of concept cards in a chapter
 *   b_submit  {ch}
 *   c_hint    {ch,pid,level}   level 4 = the student opened the answer (levels 1-3 were the old hint ladder, no longer used)
 *   c_answer  {ch,pid,answer,correct,conf,ms,sess}                one attempt per problem per runner session (`sess`); a later event with the same sess replaces the earlier one
 *   c_miss    {ch,pid,miss}      c_note {ch,pid,text}
 *   redo      {ch,pid,answer,correct,src:'R'|'spaced'|'warmup'}
 *   note      {ch,pid,src,miss,approach,stuck,idea,signal,line}   발상노트 entry
 *   t_submit  {ch,kind:'T'|'MOCK',aid,pids,answers,ms,flags,result,chOf,minutes,score}
 *   rec_del   {ref}  hides a test / mock record (t_submit id) from the student's lists; per-problem progress is untouched
 *   t_review  {ch,aid,rule}
 *   cnote     {ch,summary,sections}      close {ch}               개념노트 / chapter close
 *   fb_sent   {ref}   debrief_req {aid}                           teacher / mock
 *   frq_ans   {aid,pid,ch,text,images,ask}  a free-response answer (typed / LaTeX + photos); ask:true asks the mentor for feedback (aid '' = a practice problem)
 *   frq_score {aid,pid,score,max}  a self-score; with `by` (mentor) it is final and a later self-score is ignored
 *
 * Mentor layer (student <-> teacher). Teacher-authored events carry `by` (the teacher's username), stamped by append():
 *   msg       {from:'student'|'teacher', kind, text, files[], ref, url, prop{date,time,len,title}, legacy}
 *             student kinds: message photo progress question proposal; teacher kinds: message nudge motivation advice resource feedback
 *   msg_read  {by:'teacher'|'student', upTo}                        read marker
 *   prop_reply{ref, status:'accepted'|'declined', note}             teacher answers a proposed session
 *   task      {key,title,instr,kind:'practice'|'stage'|'free',ch,stage,pids[],due,dueTime,forced,minutes,sprint,deleted}  latest per key wins
 *   task_done {key,undo}                                            student or teacher marks a task done
 *   criteria  {set:{carelessChars,actualChars,conceptWords,summaryWords,dailyReviewMin}}   per-student requirements; null resets a key
 *   cal_item  {key,date,time,title,kind,done,deleted,remind[]}      to-dos / events / mocks (student or teacher)
 *   cal_done  {key,done}                                            ticked / unticked, by whoever (keeps the item's author)
 *   tnote     {text,tag}                                            teacher-private note
 *   legacy_done {ch,stages[],optional[]}                            stages finished in the old system (no attempt data); `optional` stages (T, V, X) never block the chapter
 */
(function (root) {
  'use strict';
  var CFG = root.ZP_CONFIG || (typeof require === 'function' ? require('./zp-config.js') : {});
  var DAY = 864e5;

  // Display code for a problem id: '1CA3' -> 'C1A3', '11CA7' -> 'C11-A7'. Searchable, stable, readable.
  function code(id) { var m = /^(\d+)([CT])(.+)$/.exec(String(id)); return m ? m[2] + m[1] + (m[1].length > 1 ? '-' : '') + m[3] : String(id); }
  function normCode(s) { return String(s || '').toLowerCase().replace(/[\s\-_.#]/g, ''); }

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function len(s) { return typeof s === 'string' ? s.trim().length : 0; }
  function missType(key) { return (CFG.MISS_TYPES || []).filter(function (m) { return m.key === key; })[0] || null; }
  // A note counts as soon as it says something. The category and the "when I see..." line are optional.
  function noteValid(n) {
    return !!n && (len(n.idea) >= 3 || len(n.stuck) >= 3 || len(n.approach) >= 3 || len(n.signal) >= 3 || len(n.text) >= 3);
  }

  // The whole text of a problem's note, old (several boxes) or new (one 발상노트).
  function noteBody(n) {
    if (!n) return '';
    if (n.nkind) return String(n.text || '').trim();
    return [n.idea, n.signal, n.stuck, n.text].filter(function (x) { return len(x) > 0; }).map(function (x) { return String(x).trim(); }).join('\n');
  }
  // "When I see X, I will Y" -> X (the cue to recall the action from); '' when the note has no such shape.
  function ideaTrigger(text) {
    var m = /^(.{6,160}?)\s*(?:[,;:]|→|->|=>)?\s*(?:I\s+(?:will|try|should|would)\b|then\b)/i.exec(String(text || '').replace(/\s+/g, ' ').trim());
    return m && /\b(when|if|see|sees|whenever|보면|때)\b/i.test(m[1]) ? m[1].replace(/[,;:\s]+$/, '') : '';
  }
  // An entry is typed Careless or Actual. Careless needs one box (what went wrong + next time); Actual needs
  // "what I missed / next time" and the main idea, both with real content. Older notes without a type only
  // had to say something.
  function trackOf(n) {
    if (!n) return null;
    if (n.track === 'careless' || n.track === 'actual') return n.track;
    return ['careless', 'misread', 'time'].indexOf(n.miss) >= 0 ? 'careless' : 'actual';
  }
  // A local date ('YYYY-MM-DD') and optional 'HH:MM' as a timestamp; with no time it means the end of that day.
  function localTs(iso, hm) { if (!iso) return 0; var p = String(iso).split('-'), h = String(hm || '23:59').split(':'); return new Date(+p[0], +p[1] - 1, +p[2], +h[0] || 0, +h[1] || 0).getTime(); }
  function pad2(n) { return n < 10 ? '0' + n : '' + n; }
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function cardId(kind, ch, key) { return (kind === 'concept' ? 'k' : kind === 'idea' ? 'i' : 'x') + ':' + ch + ':' + key; }
  // What a student has to write before something counts. Defaults come from the config; a teacher can change them for one
  // student with a `criteria` event. derive() recomputes REQ from the log, so everything downstream (and req()) reflects it.
  var REQ_LIMITS = { carelessChars: [5, 400], actualChars: [5, 600], conceptWords: [0, 400], summaryWords: [0, 800], dailyReviewMin: [5, 90] };
  function reqDefaults() {
    return { carelessChars: CFG.MIN_CARELESS_CHARS || 15, actualChars: CFG.MIN_ACTUAL_CHARS || 30, conceptWords: CFG.MIN_CONCEPT_WORDS || 3, summaryWords: CFG.MIN_SUMMARY_WORDS || 20, dailyReviewMin: CFG.DAILY_REVIEW_MIN || 15 };
  }
  var REQ = reqDefaults();
  function req() { return REQ; }
  function words(s) { s = typeof s === 'string' ? s.trim() : ''; return s ? s.split(/\s+/).length : 0; }
  function entryComplete(n) {
    if (!n) return false;
    // One 발상노트 per problem (nkind: rule = 행동양식 "when I see ... I will ...", idea = main idea, other): a single text, Careless needs less than Actual.
    if (n.nkind) return len(n.text) >= (n.track === 'actual' ? REQ.actualChars : REQ.carelessChars);
    if (n.track === 'careless') return len(n.stuck) >= REQ.carelessChars;
    if (n.track === 'actual') return len(n.stuck) >= REQ.actualChars && len(n.idea) >= REQ.actualChars;
    return noteValid(n);
  }

  /* ---------- storage: this browser, plus optional Apps Script mirror ---------- */
  function jget(key) { try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; } }
  function jset(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; } }
  var PREFIX = 'zenith:zp:v1:';

  var legacyP = null;
  function legacyData() {
    if (!legacyP) legacyP = (typeof fetch === 'function' && typeof location !== 'undefined')
      ? fetch('data/legacy-import.json').then(function (r) { return r.ok ? r.json() : {}; }).catch(function () { return {}; }) : Promise.resolve({});
    return legacyP;
  }

  var REG = {}; // open stores by 'username|course', for the Sync now button
  function syncNow(username, course) { var s = REG[username + '|' + course]; return s ? s.syncNow() : Promise.resolve(0); }
  // fetch that gives up after `ms` (a slow or unreachable sync endpoint must never keep a page from showing what is already saved in this browser).
  function fetchT(url, opts, ms) {
    if (typeof AbortController === 'undefined') return fetch(url, opts);
    var c = new AbortController(), t = setTimeout(function () { c.abort(); }, ms);
    return fetch(url, Object.assign({}, opts || {}, { signal: c.signal })).then(function (r) { clearTimeout(t); return r; }, function (e) { clearTimeout(t); throw e; });
  }
  function open(username, course) {
    var key = PREFIX + username + ':' + course;
    var events = jget(key) || [];
    var queue = jget(key + ':q') || [];
    var listeners = [];
    var status = { remote: !!CFG.DATA_URL, pending: queue.length, error: '', localOnlyFailed: false };
    var flushing = false;
    // A teacher / admin viewing as this student (see js/app.js) must not write into the student's log.
    var readOnly = false;
    try { readOnly = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('zenith:viewas') === username && ['teacher', 'admin'].indexOf(localStorage.getItem('loggedInRole')) >= 0; } catch (e) { readOnly = false; }

    function save() {
      status.localOnlyFailed = !jset(key, events);
      jset(key + ':q', queue);
      status.pending = queue.length;
    }
    function notify() { listeners.forEach(function (fn) { try { fn(); } catch (e) { /* listener errors must not break the log */ } }); }
    /* ---------- sync (commit-based, like kyj-sat) ----------
     * Everything is saved in this browser first; pages never wait for the network. Writes go to the Apps Script (js/zp-config.js DATA_URL), which commits
     * them to the data branch of the repo; reads come straight from GitHub (CLOUD_RAW_URL), so no script has to wake up for a page to load.
     *   push  ~3 s after the first unsent change when nothing was sent for SYNC_PUSH_MINUTES (5), otherwise on the 5-minute beat; one commit per push;
     *         a last push when the tab is closed or hidden; "Sync now" sends immediately. Unsent changes survive a closed tab (they are queued here).
     *   pull  when a page opens if the last pull was more than SYNC_PULL_MINUTES (5) ago, every 5 minutes while open, and on "Sync now".
     * Events are only ever added and have unique ids, so merging devices is a union by id. */
    var PUSH_EVERY = (CFG.SYNC_PUSH_MINUTES || 5) * 60000, PULL_EVERY = (CFG.SYNC_PULL_MINUTES || 5) * 60000;
    var syncOn = !!(CFG.DATA_URL || CFG.CLOUD_RAW_URL);
    var lastPush = +(jget(key + ':push') || 0), lastPull = +(jget(key + ':pull') || 0), pushTimer = null, pulling = null;
    function flush() {
      if (!CFG.DATA_URL || flushing || !queue.length) return Promise.resolve();
      flushing = true; lastPush = Date.now(); jset(key + ':push', lastPush);
      var batch = queue.slice(0, 150); // the script takes at most 200 events per call; the rest goes on the next beat
      return fetchT(CFG.DATA_URL, {
        method: 'POST', headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({ action: 'append', username: username, course: course, events: batch })
      }, 30000).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'write failed');
        var sent = {}; batch.forEach(function (e) { sent[e.id] = 1; });
        queue = queue.filter(function (e) { return !sent[e.id]; });
        status.error = ''; save();
      }).catch(function (e) { status.error = e.message || 'offline'; })
        .then(function () { flushing = false; notify(); if (queue.length) pushSoon(); });
    }
    // Send soon, but never more often than once per SYNC_PUSH_MINUTES: a burst of work is one commit, not many.
    function pushSoon() {
      if (!CFG.DATA_URL || !queue.length || pushTimer || readOnly) return;
      pushTimer = setTimeout(function () { pushTimer = null; flush(); }, Math.max(3000, lastPush + PUSH_EVERY - Date.now()));
    }
    // Last push when the tab goes away. sendBeacon survives the page closing (64 KB limit); anything too big stays queued for next time, and the
    // script skips events it already has, so sending twice is harmless.
    function pushOnExit() {
      if (!CFG.DATA_URL || !queue.length || readOnly) return;
      var body = JSON.stringify({ action: 'append', username: username, course: course, events: queue.slice(0, 150) });
      try {
        if (body.length < 60000 && typeof navigator !== 'undefined' && navigator.sendBeacon) navigator.sendBeacon(CFG.DATA_URL, new Blob([body], { type: 'text/plain' }));
        else if (body.length < 60000) fetch(CFG.DATA_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true });
      } catch (e) { /* the queue is still saved here */ }
    }
    // Read what other devices wrote. Straight from GitHub when CLOUD_RAW_URL is set (a missing file just means nothing was synced yet).
    function pull() {
      if (!syncOn || pulling) return pulling || Promise.resolve();
      lastPull = Date.now(); jset(key + ':pull', lastPull); status.lastAdded = 0;
      var req = CFG.CLOUD_RAW_URL
        ? fetchT(CFG.CLOUD_RAW_URL.replace(/\/+$/, '') + '/' + encodeURIComponent(username) + '__' + encodeURIComponent(course) + '.json?_=' + Date.now(), null, 15000).then(function (r) { return r.status === 404 ? { events: [] } : r.ok ? r.json() : Promise.reject(new Error('read failed (' + r.status + ')')); })
        : fetchT(CFG.DATA_URL + '?action=events&username=' + encodeURIComponent(username) + '&course=' + encodeURIComponent(course), null, 20000).then(function (r) { return r.json(); }).then(function (res) { if (!res.ok) throw new Error(res.error || 'read failed'); return res; });
      pulling = req.then(function (res) {
        var seen = {}; events.forEach(function (e) { seen[e.id] = 1; });
        (res.events || []).forEach(function (e) { if (!seen[e.id]) { events.push(e); seen[e.id] = 1; status.lastAdded++; } });
        if (status.lastAdded) events.sort(function (a, b) { return a.t - b.t; });
        status.error = ''; save(); notify();
      }).catch(function (e) { status.error = e.message || 'offline'; notify(); }).then(function () { pulling = null; });
      return pulling;
    }
    // Teacher / admin accounts write into a student's log too (tasks, messages, criteria). Those events are stamped with `by`
    // so the student's own activity (streak, last-seen, stalled) can be told apart from the mentor's.
    function actor() {
      try { var role = localStorage.getItem('loggedInRole'); return !readOnly && (role === 'teacher' || role === 'admin') ? localStorage.getItem('loggedInUsername') || '' : ''; } catch (e) { return ''; }
    }
    // Progress carried over from the old roadmap (data/legacy-import.json, built by scripts/migrate_legacy.cjs). Merged by id, so it
    // is idempotent: every event is added once, on the first load, then syncs like anything else.
    function importLegacy() {
      return legacyData().then(function (all) {
        var list = all && all[username + '|' + course]; if (!list || !list.length) return;
        var seen = {}; events.forEach(function (e) { seen[e.id] = 1; });
        var added = 0;
        list.forEach(function (e) { if (!seen[e.id]) { events.push(e); seen[e.id] = 1; added++; if (!readOnly) queue.push(e); } });
        if (!added) return;
        events.sort(function (a, b) { return a.t - b.t; });
        if (!readOnly) { save(); pushSoon(); }
        notify();
      }).catch(function () { /* no import file: nothing to merge */ });
    }
    var api = {
      username: username, course: course, status: status,
      events: function () { return events; },
      onChange: function (fn) { listeners.push(fn); },
      append: function (type, data) {
        var ev = {}; ev.id = uid(); ev.t = Date.now(); ev.type = type;
        Object.keys(data || {}).forEach(function (k) { ev[k] = data[k]; });
        var who = actor(); if (who && !ev.by) ev.by = who;
        if (readOnly) return ev; // viewing as a student: nothing is saved
        events.push(ev); queue.push(ev); save(); notify(); pushSoon();
        return ev;
      },
      // Shows what is saved in this browser right away. A pull is started in the background only if the last one is old (so moving between pages
      // does not hit the network every time); it merges when it lands, and nothing here waits for it.
      load: function () {
        return importLegacy().then(function () {
          if (syncOn && !readOnly && Date.now() - lastPull >= PULL_EVERY - 5000) pull();
          if (queue.length) pushSoon();
          return api;
        });
      },
      // "Sync now": send everything unsent, then read what others wrote. Resolves with how many new events arrived.
      syncNow: function () {
        if (!syncOn) return Promise.resolve(0);
        return flush().then(function () { return pull(); }).then(function () { return status.lastAdded || 0; });
      }
    };
    REG[username + '|' + course] = api;
    if (syncOn && typeof document !== 'undefined' && !readOnly) {
      // The 5-minute beat: push what is unsent, pull what is new. Also when the tab comes back to the front, and a last push when it goes away.
      var beat = function () { if (document.hidden) return; var n = Date.now(); if (queue.length && n - lastPush >= PUSH_EVERY - 5000) flush(); if (n - lastPull >= PULL_EVERY - 5000) pull(); };
      document.addEventListener('visibilitychange', function () { if (document.hidden) pushOnExit(); else beat(); });
      window.addEventListener('pagehide', pushOnExit);
      setInterval(beat, 60000);
      if (queue.length) pushSoon();
    }
    return api;
  }

  // Teacher side: every student's events (from the endpoint, else from this browser).
  // Progress carried over from the old roadmap is merged in here too, so a teacher sees it without the student having opened the site.
  function withLegacy(out) {
    return legacyData().then(function (all) {
      var seen = {}; out.rows.forEach(function (e) { seen[e.id] = 1; });
      Object.keys(all || {}).forEach(function (k) {
        var p = k.split('|');
        (all[k] || []).forEach(function (e) { if (seen[e.id]) return; seen[e.id] = 1; var r = {}; Object.keys(e).forEach(function (x) { r[x] = e[x]; }); r.username = p[0]; r.course = p.slice(1).join('|'); out.rows.push(r); });
      });
      return out;
    });
  }
  // Teacher side. With CLOUD_RAW_URL and the list of (username, course) pairs the teacher page already knows from the class rosters, every log is
  // read straight from GitHub in parallel (no script involved); this browser's own copies are added too, so anything the teacher just wrote and has
  // not pushed yet shows up. Without CLOUD_RAW_URL it asks the Apps Script, and without either it reads this browser only.
  function loadAll(pairs) {
    if (CFG.CLOUD_RAW_URL && pairs && pairs.length) {
      var base = CFG.CLOUD_RAW_URL.replace(/\/+$/, ''), rows = [], seenIds = {};
      var one = function (pr) {
        return fetchT(base + '/' + encodeURIComponent(pr.username) + '__' + encodeURIComponent(pr.course) + '.json?_=' + Date.now(), null, 15000)
          .then(function (r) { return r.ok ? r.json() : { events: [] }; }).catch(function () { return { events: [] }; })
          .then(function (doc) {
            var local = jget(PREFIX + pr.username + ':' + pr.course) || [];
            (doc.events || []).concat(local).forEach(function (e) { var id = pr.username + '|' + pr.course + '|' + e.id; if (seenIds[id]) return; seenIds[id] = 1; var r = {}; Object.keys(e).forEach(function (x) { r[x] = e[x]; }); r.username = pr.username; r.course = pr.course; rows.push(r); });
          });
      };
      var queue2 = pairs.slice(), workers = [];
      for (var w = 0; w < 6; w++) workers.push((function next() { var pr = queue2.shift(); return pr ? one(pr).then(next) : Promise.resolve(); })());
      return Promise.all(workers).then(function () { return withLegacy({ source: 'remote', rows: rows }); });
    }
    if (CFG.DATA_URL) {
      return fetchT(CFG.DATA_URL + '?action=all', null, 20000).then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok) throw new Error(res.error || 'read failed');
        return withLegacy({ source: 'remote', rows: res.events || [] });
      });
    }
    var rows = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k.indexOf(PREFIX) !== 0 || /:q$/.test(k)) continue;
        var parts = k.slice(PREFIX.length).split(':');
        var evs = jget(k) || [];
        evs.forEach(function (e) { var r = {}; Object.keys(e).forEach(function (x) { r[x] = e[x]; }); r.username = parts[0]; r.course = parts.slice(1).join(':'); rows.push(r); });
      }
    } catch (e) { /* storage blocked */ }
    return withLegacy({ source: 'local', rows: rows });
  }

  /* ---------- FSRS-5 spaced repetition ----------
   * Same implementation and published default weights as the SAT site (kyj-sat). Day granularity:
   * every grade schedules a date at least one day out. ratings: 1 Again, 2 Hard, 3 Good, 4 Easy.
   * Weights are the stock defaults; the event log holds exactly the data FSRS needs to optimise
   * them per student once there are enough reviews. */
  var FSRS = (function () {
    var W = CFG.FSRS_WEIGHTS, DECAY = -0.5, FACTOR = 19 / 81, RETENTION = CFG.REQUEST_RETENTION || 0.9, MAXI = 730;
    function clampD(d) { return Math.min(10, Math.max(1, d)); }
    function initS(g) { return Math.max(0.1, W[g - 1]); }
    function initD(g) { return clampD(W[4] - Math.exp(W[5] * (g - 1)) + 1); }
    var EASY_D = initD(4);
    function nextD(d, g) { return clampD(W[7] * EASY_D + (1 - W[7]) * (d + (-W[6] * (g - 3)) * ((10 - d) / 9))); }
    function retr(days, s) { return s <= 0 ? 0 : Math.pow(1 + FACTOR * days / s, DECAY); }
    function sOk(s, d, r, g) {
      var hard = g === 2 ? W[15] : 1, easy = g === 4 ? W[16] : 1;
      return Math.max(0.1, s * (1 + (11 - d) * Math.pow(s, -W[9]) * (Math.exp(W[10] * (1 - r)) - 1) * hard * easy * Math.exp(W[8])));
    }
    function sFail(s, d, r) { return Math.max(0.1, Math.min(W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)), s)); }
    function interval(s, ret) { return Math.min(MAXI, Math.max(1, Math.round((s / FACTOR) * (Math.pow(ret || RETENTION, 1 / DECAY) - 1)))); }
    function blank() { return { state: 'new', stability: 0, difficulty: 0, due: null, last: null, reps: 0, lapses: 0, lastIntervalDays: 0 }; }
    function grade(card, g, now, ret) {
      var c = {}; Object.keys(card).forEach(function (k) { c[k] = card[k]; });
      if (c.state !== 'review' || !c.last) { c.difficulty = initD(g); c.stability = initS(g); }
      else {
        var r = retr(Math.max(0, (now - c.last) / DAY), c.stability), d2 = nextD(c.difficulty, g);
        c.stability = g === 1 ? sFail(c.stability, d2, r) : sOk(c.stability, d2, r, g);
        c.difficulty = d2;
      }
      c.lastIntervalDays = interval(c.stability, ret);
      c.state = 'review'; c.reps = (c.reps || 0) + 1; c.lapses = (c.lapses || 0) + (g === 1 ? 1 : 0);
      c.last = now; c.due = new Date(now + c.lastIntervalDays * DAY).toISOString();
      return c;
    }
    function preview(card, now, ret) { var o = {}; [1, 2, 3, 4].forEach(function (g) { o[g] = grade(card, g, now, ret).lastIntervalDays; }); return o; }
    function retrievability(card, now) { return card && card.last ? retr(Math.max(0, (now - card.last) / DAY), card.stability) : null; }
    return { blank: blank, grade: grade, preview: preview, retrievability: retrievability, interval: interval };
  })();

  /* ---------- derive ---------- */
  // info = { order:[ch...], chapters:{ ch:{ title, hasC, hasT, cIds[], tIds[], exKeys[], conceptKeys[] } } }
  function derive(events, info, now) {
    now = now || Date.now();
    var D = { ex: {}, concepts: {}, bSub: {}, prob: {}, notes: {}, noteFirst: {}, redos: {}, tests: {}, mocks: [], customTests: [], recDel: {}, frqScores: {}, frqAns: {}, frqAsk: {}, frqScoreBy: {}, frqPractice: {}, tReviews: {},
      cnotes: {}, closed: {}, fb: {}, debrief: {}, entries: {}, stages: {}, info: info, now: now, lastT: 0, q: {}, flags: {}, completeT: {}, reports: {}, cardFlags: {}, cardRedos: {}, cards: {}, cardOn: {}, subById: {}, activity: {},
      msgs: [], read: { teacher: 0, student: 0 }, propReply: {}, taskDefs: {}, taskDone: {}, cal: {}, tnotes: [], calDone: {}, conceptOrder: {}, ideas: {}, legacyOptional: {}, legacyDone: {}, criteriaSet: {}, req: null, tasks: [], unread: { teacher: [], student: [] }, props: [], hasLegacy: false };
    var evs = events.slice().sort(function (a, b) { return a.t - b.t; });
    // One attempt per problem per time it was opened: answers logged with the same `sess` (the runner session) on the same problem
    // count once, the latest one. So changing a free-response rating from Partly to Got it on the spot replaces the earlier rating.
    var lastBySess = {};
    evs.forEach(function (e) { if (e.type === 'c_answer' && e.sess) lastBySess[e.pid + '|' + e.sess] = e.id; });
    evs = evs.filter(function (e) { return !(e.type === 'c_answer' && e.sess && lastBySess[e.pid + '|' + e.sess] !== e.id); });
    // Per-student requirements: defaults, then every `criteria` event in order (null clears a key).
    var rq = reqDefaults();
    evs.forEach(function (e) {
      if (e.type !== 'criteria' || !e.set) return;
      Object.keys(e.set).forEach(function (k) {
        if (!REQ_LIMITS[k]) return;
        var v = e.set[k];
        if (v === null || v === '') { delete D.criteriaSet[k]; return; }
        v = Math.round(+v); if (isNaN(v)) return;
        D.criteriaSet[k] = Math.min(REQ_LIMITS[k][1], Math.max(REQ_LIMITS[k][0], v));
      });
    });
    Object.keys(D.criteriaSet).forEach(function (k) { rq[k] = D.criteriaSet[k]; });
    D.req = rq; REQ = rq;
    // One record per question, whatever the context: every attempt from practice, the chapter, review
    // redos, tests and mocks lands in q[pid].attempts, so "have I seen this, and how did it go?" has one answer.
    function qrec(pid, ch) { return D.q[pid] || (D.q[pid] = { pid: pid, ch: ch || '', attempts: [], n: 0, right: 0, wrong: 0, hintMax: 0, ms: 0, first: null, last: null, lastWrongT: 0 }); }
    function qatt(pid, ch, a) {
      var r = qrec(pid, ch); if (!r.ch && ch) r.ch = ch;
      r.attempts.push(a); r.n++; r.ms += a.ms || 0; r.last = a; if (!r.first) r.first = a;
      if (a.correct === true) r.right++; else if (a.correct === false) { r.wrong++; r.lastWrongT = a.t; }
    }
    // A self-scored free-response question in a mock / test is an attempt like any other, so its status is shared with every
    // other place the problem appears. 75% of the points or more counts as right. A re-score replaces the earlier attempt.
    var frqAtt = {};
    function refreshQ(r) {
      r.n = r.attempts.length; r.right = 0; r.wrong = 0; r.ms = 0; r.lastWrongT = 0; r.first = r.attempts[0] || null; r.last = r.attempts[r.n - 1] || null;
      r.attempts.forEach(function (a) { r.ms += a.ms || 0; if (a.correct === true) r.right++; else if (a.correct === false) { r.wrong++; r.lastWrongT = a.t; } });
    }
    // A mentor's score on a free-response problem practised outside a test or mock: it becomes the problem's latest attempt (right at 75% or more).
    function frqPracticeScore(e) {
      var max = +e.max || 9, key = 'p|' + e.pid, a = { t: e.t, ctx: 'practice', correct: +e.score >= Math.round(0.75 * max), answer: e.score + '/' + max, ms: 0, score: +e.score, by: e.by || '' };
      D.frqPractice[e.pid] = { score: +e.score, max: max, t: e.t, by: e.by || '' };
      var r = qrec(e.pid, e.ch || ''); if (frqAtt[key]) { r.attempts[r.attempts.indexOf(frqAtt[key])] = a; frqAtt[key] = a; refreshQ(r); } else { frqAtt[key] = a; qatt(e.pid, e.ch || '', a); }
    }
    function frqAttempt(e) {
      var sb = D.subById[e.aid]; if (!sb) return;
      var max = (sb.spec && sb.spec.scoring && sb.spec.scoring.frqMaxEach) || 9, key = e.aid + '|' + e.pid, ch = (sb.chOf || {})[e.pid] || sb.ch || '';
      var a = { t: e.t, ctx: sb.kind === 'MOCK' ? 'mock' : sb.kind === 'TEST' ? 'customtest' : 'test', correct: +e.score >= Math.round(0.75 * max), answer: e.score + '/' + max, ms: (sb.ms || {})[e.pid] || 0, score: +e.score };
      var r = qrec(e.pid, ch);
      if (frqAtt[key]) { r.attempts[r.attempts.indexOf(frqAtt[key])] = a; frqAtt[key] = a; refreshQ(r); }
      else { frqAtt[key] = a; qatt(e.pid, ch, a); }
    }
    function prob(pid, ch) { return D.prob[pid] || (D.prob[pid] = { pid: pid, ch: ch, attempts: 0, maxHint: 0, ms: 0, answered: false, first: null, correct: false, miss: '', note: '' }); }
    // Effort per local day, for the activity heatmap and the streak: one point per question answered, redo, card review or
    // entry written, plus every question in a submitted test or mock.
    function bump(t, n) { if (n > 0) { var k = dayKey(t); D.activity[k] = (D.activity[k] || 0) + n; } }
    var EFFORT = { c_answer: 1, redo: 1, card_redo: 1, note: 1, b_submit: 1, cnote: 1 };
    evs.forEach(function (e) {
      if (EFFORT[e.type]) bump(e.t, EFFORT[e.type]); else if (e.type === 't_submit') bump(e.t, (e.pids || []).length + (e.frqPids || []).length);
      // `by` marks something the mentor did; it is not the student being active.
      if (e.t > D.lastT && e.type !== 'fb_sent' && !e.by && e.type !== 'msg_read') D.lastT = e.t;
      if (e.legacy) D.hasLegacy = true;
      switch (e.type) {
        case 'msg': D.msgs.push(e); break;
        case 'msg_read': D.read[e.by === 'teacher' ? 'teacher' : 'student'] = Math.max(D.read[e.by === 'teacher' ? 'teacher' : 'student'], e.upTo || e.t); break;
        case 'prop_reply': D.propReply[e.ref] = e; break;
        case 'task': D.taskDefs[e.key] = e; break;
        case 'task_done': if (e.undo) delete D.taskDone[e.key]; else D.taskDone[e.key] = e; break;
        case 'cal_item': D.cal[e.key] = e; break;
        case 'cal_done': D.calDone[e.key] = e; break;
        case 'tnote': D.tnotes.push(e); break;
        case 'legacy_done':
          (e.stages || []).forEach(function (s) { (D.legacyDone[e.ch] = D.legacyDone[e.ch] || {})[s] = true; });
          (e.optional || []).forEach(function (s) { (D.legacyOptional[e.ch] = D.legacyOptional[e.ch] || {})[s] = true; });
          break;
        case 'ex': (D.ex[e.ch] = D.ex[e.ch] || {})[e.key] = e; break;
        case 'concept': {
          // A concept event only carries `images` when they changed; otherwise the earlier photos stay.
          var prevC = (D.concepts[e.ch] || {})[e.key], ce = e;
          if (prevC && e.images === undefined && prevC.images) { ce = {}; Object.keys(e).forEach(function (k) { ce[k] = e[k]; }); ce.images = prevC.images; }
          (D.concepts[e.ch] = D.concepts[e.ch] || {})[e.key] = ce; break;
        }
        case 'concept_order': D.conceptOrder[e.ch] = e.keys || []; break;
        case 'idea': D.ideas[e.key] = e; break; // a stand-alone 발상노트 (latest event per key wins; deleted:true removes it)
        case 'b_submit': D.bSub[e.ch] = e; break;
        case 'c_hint': { var h = prob(e.pid, e.ch); if (e.level > h.maxHint) h.maxHint = e.level; var hq = qrec(e.pid, e.ch); if (e.level > hq.hintMax) hq.hintMax = e.level; break; }
        case 'c_answer': {
          var p = prob(e.pid, e.ch); p.attempts++; p.answered = true; p.ms += e.ms || 0;
          if (!p.first) p.first = { answer: e.answer, correct: e.correct, conf: e.conf || '', t: e.t };
          if (e.correct === true) p.correct = true;
          qatt(e.pid, e.ch, { t: e.t, ctx: e.ctx || 'practice', correct: e.correct, answer: e.answer, ms: e.ms || 0, conf: e.conf || '', hint: p.maxHint });
          break;
        }
        case 'c_miss': prob(e.pid, e.ch).miss = e.miss; break;
        case 'c_note': prob(e.pid, e.ch).note = e.text; break;
        case 'redo': (D.redos[e.pid] = D.redos[e.pid] || []).push(e); qatt(e.pid, e.ch, { t: e.t, ctx: e.src === 'R' ? 'review' : e.src === 'warmup' ? 'warmup' : 'spaced', correct: e.correct, answer: e.answer, ms: 0, grade: e.grade }); break;
        // "Review this" flag. Older review_add / review_skip events mean flag on / flag off.
        case 'flag': D.flags[e.pid] = { on: e.on !== false, t: e.t, ch: e.ch || '' }; break;
        case 'review_add': D.flags[e.pid] = { on: true, t: e.t, ch: e.ch || '' }; break;
        case 'review_skip': D.flags[e.pid] = { on: false, t: e.t, ch: e.ch || '' }; break;
        case 'report': (D.reports[e.pid] = D.reports[e.pid] || []).push(e); break;
        case 'note': D.notes[e.pid] = e; if (!D.noteFirst[e.pid]) D.noteFirst[e.pid] = e.t; if (!D.completeT[e.pid] && entryComplete(e)) D.completeT[e.pid] = e.t; break;
        case 't_submit':
          D.subById[e.id] = e;
          if (e.kind === 'MOCK') D.mocks.push(e); else if (e.kind === 'TEST') D.customTests.push(e); else (D.tests[e.ch] = D.tests[e.ch] || []).push(e);
          (e.pids || []).forEach(function (pid) {
            var res = (e.result || {})[pid];
            if (res === 'correct' || res === 'incorrect' || res === 'unanswered') qatt(pid, (e.chOf || {})[pid] || e.ch, { t: e.t, ctx: e.kind === 'MOCK' ? 'mock' : e.kind === 'TEST' ? 'customtest' : 'test', correct: res === 'correct', answer: (e.answers || {})[pid] || '', ms: (e.ms || {})[pid] || 0 });
          });
          break;
        case 'frq_ans': {
          var ak = (e.aid || '') + '|' + e.pid, pv = D.frqAns[ak];
          D.frqAns[ak] = { aid: e.aid || '', pid: e.pid, ch: e.ch || (pv && pv.ch) || '', text: e.text || '', images: e.images || [], t: e.t, ask: !!(e.ask || (pv && pv.ask)), askedAt: e.ask ? e.t : (pv && pv.askedAt) || 0 };
          break;
        }
        case 'frq_score': {
          var sk = (e.aid || '') + '|' + e.pid;
          if (!e.by && D.frqScoreBy[sk]) break; // the mentor's score is final: a later self-score does not replace it
          if (e.by) D.frqScoreBy[sk] = { t: e.t, by: e.by, score: +e.score, max: e.max || 0 };
          if (!e.aid) { frqPracticeScore(e); break; }
          (D.frqScores[e.aid] = D.frqScores[e.aid] || {})[e.pid] = e.score; frqAttempt(e); break;
        }
        case 't_review': D.tReviews[e.aid] = e; break;
        case 'cnote': D.cnotes[e.ch] = e; break;
        case 'close': D.closed[e.ch] = e; break;
        // Concept / example cards can be put in the review queue (flag) and graded there (redo).
        case 'card_flag': D.cardFlags[cardId(e.kind, e.ch, e.key)] = { on: e.on !== false, t: e.t }; break;
        case 'card_redo': (D.cardRedos[cardId(e.kind, e.ch, e.key)] = D.cardRedos[cardId(e.kind, e.ch, e.key)] || []).push(e); break;
        case 'fb_sent': D.fb[e.ref] = e; break;
        case 'rec_del': D.recDel[e.ref] = 1; break; // a test / mock record deleted from the student's list; its attempts and entries stay
        case 'debrief_req': D.debrief[e.aid] = e; break;
      }
    });

    // Ticking a calendar item (by the student, even one the mentor made) is its own event, so the item keeps its author.
    Object.keys(D.calDone).forEach(function (k) {
      var c = D.cal[k], d = D.calDone[k]; if (c && d.t >= c.t) D.cal[k] = Object.assign({}, c, { done: d.done !== false });
    });

    // Older events kept the brief note and the miss tag on the problem. Treat them as a quick note.
    Object.keys(D.prob).forEach(function (pid) {
      var p = D.prob[pid];
      if (!D.notes[pid] && (p.miss || len(p.note))) {
        D.notes[pid] = { id: 'legacy:' + pid, t: p.first ? p.first.t : 0, type: 'note', pid: pid, ch: p.ch, miss: p.miss, idea: p.note, quick: true };
        D.noteFirst[pid] = D.notes[pid].t;
        if (entryComplete(D.notes[pid])) D.completeT[pid] = D.notes[pid].t;
      }
    });

    // Free-response answers the student sent to the mentor: waiting until the mentor scores it or writes about it after the ask.
    Object.keys(D.frqAns).forEach(function (k) {
      var a = D.frqAns[k]; if (!a.ask) return;
      var ref = 'frq:' + (a.aid || 'p') + ':' + a.pid, sc = D.frqScoreBy[k], answered = Math.max(sc ? sc.t : 0, D.fb[ref] ? D.fb[ref].t : 0, D.msgs.reduce(function (m, x) { return x.from === 'teacher' && x.ref === ref ? Math.max(m, x.t) : m; }, 0)) > a.askedAt;
      D.frqAsk[k] = { aid: a.aid, pid: a.pid, ch: a.ch, ref: ref, askedAt: a.askedAt, text: a.text, images: a.images, status: answered ? 'answered' : 'waiting', score: sc ? sc.score : null, max: sc ? sc.max : 0 };
    });
    D.mocks = D.mocks.filter(function (m) { return !D.recDel[m.id]; });
    D.customTests = D.customTests.filter(function (m) { return !D.recDel[m.id]; });

    /* entries: the problems the student has to write up and then review. Wrong answers are pre-flagged (the
     * student may unflag a practice / chapter miss; a miss on a chapter test, custom test or mock cannot be
     * unflagged), and the student can flag any problem, right or wrong. A problem needs an entry (Careless or
     * Actual) before it is finished; the entry starts its FSRS card. After that a later wrong attempt is just an
     * Again grade, not a second entry. */
    var FORCED = ['test', 'customtest', 'mock'], FREE = ['chapter', 'practice'], CTX_SRC = { test: 'T', customtest: 'U', mock: 'M' };
    var PRIORITY = ['T', 'C', 'S', 'U', 'M', 'P'];
    // C = a chapter's own C problem, S = a problem from a fixed set (C11A/B, FRQ bank), P = anything else practiced.
    function srcOf(pid, ch) { if (info.setOf && info.setOf[pid]) return 'S'; var m = info.chapters[ch]; return m && m.cIds.indexOf(pid) >= 0 ? 'C' : 'P'; }
    var HALF = (CFG.SAME_SESSION_HOURS || 12) * 36e5, RET_ACTUAL = CFG.REQUEST_RETENTION || 0.9, RET_CARELESS = CFG.CARELESS_RETENTION || 0.8;
    function addEntry(pid, ch, src, reason, forced) {
      var en = D.entries[pid];
      if (!en) en = D.entries[pid] = { pid: pid, ch: ch || '', src: src, srcs: [], reasons: [], forced: false, flagged: false, note: D.notes[pid] || null, redos: D.redos[pid] || [] };
      if (en.srcs.indexOf(src) < 0) en.srcs.push(src);
      if (en.reasons.indexOf(reason) < 0) en.reasons.push(reason);
      if (forced) en.forced = true;
      if (!en.ch && ch) en.ch = ch;
    }
    Object.keys(D.q).forEach(function (pid) {
      var qq = D.q[pid], fl = D.flags[pid], lastFreeWrong = 0;
      qq.attempts.forEach(function (a) { if (a.correct === false && FREE.indexOf(a.ctx) >= 0 && a.t > lastFreeWrong) lastFreeWrong = a.t; });
      var unflagged = !!(fl && !fl.on && fl.t >= lastFreeWrong);
      qq.attempts.forEach(function (a) {
        if (a.correct !== false) return;
        if (FORCED.indexOf(a.ctx) >= 0) addEntry(pid, qq.ch, CTX_SRC[a.ctx], 'wrong', true);
        else if (FREE.indexOf(a.ctx) >= 0 && !unflagged) addEntry(pid, qq.ch, srcOf(pid, qq.ch), 'wrong', false);
      });
    });
    Object.keys(D.flags).forEach(function (pid) {
      var fl = D.flags[pid]; if (!fl.on) return;
      var ch = fl.ch || (D.q[pid] && D.q[pid].ch) || '';
      addEntry(pid, ch, srcOf(pid, ch), 'flag', false); D.entries[pid].flagged = true;
    });
    // Notes that were written before flags existed (or on problems nobody flagged) still count, unless the student unflagged the problem.
    Object.keys(D.notes).forEach(function (pid) {
      var fl = D.flags[pid];
      if (!entryComplete(D.notes[pid]) || (fl && !fl.on) || D.entries[pid]) return;
      var ch = D.notes[pid].ch || (D.q[pid] && D.q[pid].ch) || '';
      addEntry(pid, ch, srcOf(pid, ch), 'note', false);
    });
    Object.keys(D.entries).forEach(function (pid) {
      var en = D.entries[pid], q0 = D.q[pid];
      en.src = PRIORITY.filter(function (k) { return en.srcs.indexOf(k) >= 0; })[0] || en.src;
      en.skipped = false;
      en.complete = entryComplete(en.note); en.noted = en.complete; en.handled = en.complete; en.pending = !en.complete;
      en.track = en.complete ? trackOf(en.note) : null;
      en.miss = (en.note && en.note.miss) || '';
      en.ret = en.track === 'careless' ? RET_CARELESS : RET_ACTUAL;
      en.card = null; en.due = null; en.reviews = 0; en.lapses = 0; en.stability = 0;
      var cold = en.redos.filter(function (r) { return r.src === 'R'; })[0];
      en.coldRedo = !!cold;
      en.warmupDone = en.redos.some(function (r) { return r.src === 'warmup'; });
      if (!en.complete) { en.status = 'to-write'; return; }
      var t0 = D.completeT[pid] || D.noteFirst[pid] || (q0 && q0.first ? q0.first.t : now);
      function gradeOf(r) { return r.grade || (r.correct ? 3 : 1); }
      // Reviews are explicit redos (spaced / warm-up) PLUS any later attempt from anywhere that is not just an
      // immediate retry: a fresh attempt at least ~12h after the last one counts (right = Good, wrong = Again).
      var explicit = en.redos.filter(function (r) { return r.src !== 'R'; }).map(function (r) { return { t: r.t, grade: gradeOf(r), explicit: true }; });
      var organic = (q0 ? q0.attempts : []).filter(function (a) { return ['chapter', 'practice', 'test', 'customtest', 'mock'].indexOf(a.ctx) >= 0 && a.t >= t0 + HALF; })
        .map(function (a) { return { t: a.t, grade: a.correct ? 3 : 1, organic: true }; });
      var merged = explicit.concat(organic).sort(function (x, y) { return x.t - y.t; }), graded = [], lastT = t0;
      merged.forEach(function (g) { if (g.t <= t0) return; if (g.explicit || g.t - lastT >= HALF) { graded.push(g); lastT = g.t; } });
      var card = FSRS.grade(FSRS.blank(), 3, t0, en.ret), lastGrade = 3;
      graded.forEach(function (g) { lastGrade = g.grade; card = FSRS.grade(card, lastGrade, g.t, en.ret); en.reviews++; });
      en.card = card; en.stability = card.stability; en.lapses = card.lapses;
      // Careless: resolved after one clean redo. Actual: resolved once the interval reaches RESOLVED_INTERVAL_DAYS.
      var resolved = en.track === 'careless' ? (en.reviews > 0 && lastGrade >= 3) : card.lastIntervalDays >= CFG.RESOLVED_INTERVAL_DAYS;
      if (resolved) { en.status = 'resolved'; return; }
      en.due = new Date(card.due).getTime();
      en.status = lastGrade === 1 && en.reviews > 0 ? 'shaky' : en.reviews > 0 ? 'redone' : 'written';
    });

    /* Concept and example cards in the review queue. A concept card joins when the student flags it (and has written
     * at least 10 characters). An example card is pre-flagged when the student needed a hint or did not get it, and
     * can be flagged or unflagged either way. Graded Again / Hard / Good / Easy by the student; same FSRS schedule. */
    (info.order || []).forEach(function (ch) {
      var m = info.chapters[ch];
      [['concept', D.concepts[ch] || {}, m.conceptKeys, m.concepts || []], ['example', D.ex[ch] || {}, m.exKeys, m.examples || []]].forEach(function (grp) {
        var kind = grp[0], evMap = grp[1], keys = grp[2].concat(Object.keys(evMap).filter(function (k) { return grp[2].indexOf(k) < 0; }));
        keys.forEach(function (key) {
          var e = evMap[key] || {}; if (e.deleted) return;
          var id = cardId(kind, ch, key), fl = D.cardFlags[id];
          var on = !!(fl && fl.on); D.cardOn[id] = on;
          var def = grp[3].filter(function (x) { return x.key === key; })[0] || {};
          var body = kind === 'concept' ? (e.text || '') : (e.line || '');
          if (!on) return;
          var t0 = Math.max(fl ? fl.t : 0, e.t || 0) || now;
          var reds = (D.cardRedos[id] || []).filter(function (r) { return r.t > t0; }).sort(function (a, b) { return a.t - b.t; });
          var card = FSRS.grade(FSRS.blank(), 3, t0, RET_ACTUAL), lastGrade = 3, n = 0;
          reds.forEach(function (r) { lastGrade = r.grade || 3; card = FSRS.grade(card, lastGrade, r.t, RET_ACTUAL); n++; });
          var it = { pid: id, id: id, isCard: true, kind: kind, ch: ch, key: key, title: e.name || e.label || def.name || def.label || key, body: body, images: kind === 'concept' ? (e.images || []) : [], tap: e.tap || '', prompt: def.prompt || '',
            track: kind, ret: RET_ACTUAL, card: card, reviews: n, lapses: card.lapses, stability: card.stability, complete: true, pending: false };
          if (card.lastIntervalDays >= CFG.RESOLVED_INTERVAL_DAYS) { it.status = 'resolved'; it.due = null; }
          else { it.due = new Date(card.due).getTime(); it.status = lastGrade === 1 && n > 0 ? 'shaky' : n > 0 ? 'redone' : 'written'; }
          D.cards[id] = it;
        });
      });
    });

    /* 발상노트 cards: any idea note can be added to the review queue by itself (card_flag kind 'idea'), separately from the problem redo.
     * Sources: stand-alone notes (`idea` events) and the note written for a problem (key 'n-<pid>'). Recall: the trigger / idea, then what you wrote. */
    var ideaSrc = [];
    Object.keys(D.ideas).forEach(function (k) { var e = D.ideas[k]; if (e.deleted || len(e.text) < 3) return; ideaSrc.push({ key: k, ch: e.ch || '', text: e.text, nkind: e.nkind || 'other', t: e.t, pid: '' }); });
    Object.keys(D.notes).forEach(function (pid) { var n = D.notes[pid]; if (!noteValid(n)) return; var body = noteBody(n); if (len(body) < 3) return; ideaSrc.push({ key: 'n-' + pid, ch: n.ch || '', text: body, nkind: n.nkind || (len(n.signal) > 4 ? 'rule' : 'idea'), t: n.t, pid: pid }); });
    ideaSrc.forEach(function (src) {
      var id = cardId('idea', src.ch, src.key), fl = D.cardFlags[id], on = !!(fl && fl.on); D.cardOn[id] = on;
      if (!on) return;
      var t0 = Math.max(fl.t, src.t || 0) || now;
      var reds = (D.cardRedos[id] || []).filter(function (r) { return r.t > t0; }).sort(function (a, b) { return a.t - b.t; });
      var card = FSRS.grade(FSRS.blank(), 3, t0, RET_ACTUAL), lastGrade = 3, n = 0;
      reds.forEach(function (r) { lastGrade = r.grade || 3; card = FSRS.grade(card, lastGrade, r.t, RET_ACTUAL); n++; });
      var tr = ideaTrigger(src.text);
      var it = { pid: id, id: id, isCard: true, kind: 'idea', ch: src.ch, key: src.key, from: src.pid, nkind: src.nkind, title: tr || src.text.replace(/\s+/g, ' ').slice(0, 80), trigger: tr, body: src.text, images: [], tap: '', prompt: '',
        track: 'idea', ret: RET_ACTUAL, card: card, reviews: n, lapses: card.lapses, stability: card.stability, complete: true, pending: false };
      if (card.lastIntervalDays >= CFG.RESOLVED_INTERVAL_DAYS) { it.status = 'resolved'; it.due = null; }
      else { it.due = new Date(card.due).getTime(); it.status = lastGrade === 1 && n > 0 ? 'shaky' : n > 0 ? 'redone' : 'written'; }
      D.cards[id] = it;
    });

    /* One status per problem, kyj-sat style: review | done | skipped (absent = new). The attempt log underneath
     * holds all the detail; this is just the label. A card that resolves (interval >= 30 days) is Done + mastered. */
    D.pstatus = {}; D.mastered = {};
    Object.keys(D.q).forEach(function (pid) { D.pstatus[pid] = 'done'; });
    Object.keys(D.entries).forEach(function (pid) {
      var en = D.entries[pid];
      D.pstatus[pid] = en.status === 'resolved' ? 'done' : 'review';
      if (en.status === 'resolved') D.mastered[pid] = true;
    });

    /* stages per chapter */
    var order = info.order || [];
    order.forEach(function (ch) {
      var m = info.chapters[ch], S = {};
      // Book has no gate: the student adds the examples and concepts they want, and submits when they are done reading.
      function exLive(k) { var e = (D.ex[ch] || {})[k]; return !(e && e.deleted); }
      function cpLive(k) { var e = (D.concepts[ch] || {})[k]; return !(e && e.deleted); }
      var exTot = m.exKeys.concat(Object.keys(D.ex[ch] || {}).filter(function (k) { return m.exKeys.indexOf(k) < 0; })).filter(exLive).length;
      var cpKeys = m.conceptKeys.concat(Object.keys(D.concepts[ch] || {}).filter(function (k) { return m.conceptKeys.indexOf(k) < 0; })).filter(cpLive);
      var cpTot = cpKeys.length, cpOk = cpKeys.filter(function (k) { return words((D.concepts[ch] || {})[k] && D.concepts[ch][k].text) >= REQ.conceptWords; }).length;
      S.B = { key: 'B', done: !!D.bSub[ch], ready: true, started: exTot + cpTot > 0 || !!D.bSub[ch], cur: exTot + cpTot, total: exTot + cpTot, exOk: exTot, exTot: exTot, cpOk: cpOk, cpTot: cpTot };

      // R and R (test) share one rule: every flagged / missed problem in scope needs a written entry.
      function scope(ids) {
        var es = ids.filter(function (id) { return D.entries[id]; }).map(function (id) { return D.entries[id]; });
        var done = es.filter(function (e) { return e.complete; }).length;
        return { entries: es.length, cur: done, total: es.length, pending: es.length - done };
      }
      if (m.hasC) {
        var ans = m.cIds.filter(function (id) { return !!D.q[id]; }).length;
        S.C = { key: 'C', done: m.cIds.length > 0 && ans === m.cIds.length, started: ans > 0, cur: ans, total: m.cIds.length };
        var rs = scope(m.cIds);
        // A chapter whose Problems were finished in the old roadmap has no attempt data, so C is not derived done: Review then needs at
        // least one written entry (the problems the student flags from their feedback) or an explicit "nothing to review" (legacy_done R).
        var legC = !!(D.legacyDone[ch] && D.legacyDone[ch].C);
        S.R = { key: 'R', done: (S.C.done || legC) && rs.pending === 0 && (S.C.done || rs.entries > 0), started: rs.cur > 0, cur: rs.cur, total: rs.total, entries: rs.entries, pending: rs.pending };
      }
      if (m.hasT) {
        var tl = D.tests[ch] || [], latest = tl[tl.length - 1] || null;
        S.T = { key: 'T', done: !!latest, started: !!latest, submitted: !!latest, latest: latest, score: latest ? latest.score : null };
        var vs = scope(m.tIds);
        S.V = { key: 'V', done: !!latest && vs.pending === 0, started: !!latest && vs.cur > 0, cur: vs.cur, total: vs.total, entries: vs.entries, pending: vs.pending, submitted: !!latest };
      }
      var cn = D.cnotes[ch];
      S.X = { key: 'X', done: !!D.closed[ch], ready: !!cn && words(cn.summary) >= REQ.summaryWords, started: !!cn };

      // Stages finished in the old roadmap count as done (V follows T: the old flow had no separate test review).
      var ld = D.legacyDone[ch];
      if (ld) Object.keys(ld).forEach(function (k) {
        if (S[k]) { S[k].done = true; S[k].started = true; S[k].legacy = true; }
        if (k === 'T' && S.V) { S.V.done = true; S.V.started = true; S.V.legacy = true; }
      });

      // availability, soft locks, and which stage is "next"
      var seq = ['B', 'C', 'R', 'T', 'V', 'X'].filter(function (k) { return S[k]; });
      // Students moving over from the old roadmap often had not done the test (T) or the Concepts Notebook (X). For them those stages are
      // optional review: they never block the chapter, and the chapter counts as complete. (A legacy_done event lists them in `optional`.)
      var lo = D.legacyOptional[ch] || {};
      var tOpt = !!(info.curriculum && info.curriculum.tOptional); // checkpoints replace the per-chapter test; review (V) is only owed once T is taken
      seq.forEach(function (k) { S[k].optional = !S[k].done && (!!lo[k] || (k === 'V' && !!lo.T) || (tOpt && (k === 'T' || (k === 'V' && S.T && !S.T.done)))); });
      var nextKey = null;
      seq.forEach(function (k) { if (!nextKey && !S[k].done && !S[k].optional) nextKey = k; });
      seq.forEach(function (k) {
        S[k].state = S[k].done ? 'done' : S[k].optional ? 'optional' : (k === nextKey ? 'active' : (S[k].started ? 'active' : 'todo'));
        S[k].locked = false;
      });
      // Soft locks: the UI explains them and lets the student continue anyway.
      if (S.T) S.T.locked = !S.T.done && !!(S.R && !S.R.done);
      if (S.V) S.V.locked = !S.V.done && !S.T.done;
      S.X.locked = !S.X.done && seq.some(function (k) { return k !== 'X' && !S[k].done && !S[k].optional; });
      seq.forEach(function (k) { if (S[k].optional) S[k].locked = false; }); // optional review is never locked
      S.seq = seq; S.next = nextKey;
      S.hasOptional = seq.some(function (k) { return S[k].optional; });
      S.complete = S.hasOptional ? seq.every(function (k) { return S[k].done || S[k].optional; }) : S.X.done;
      D.stages[ch] = S;
    });
    D.current = order.filter(function (ch) { return !D.stages[ch].complete; })[0] || null;
    D.curriculum = buildCurriculum(D, info);

    /* Tasks the mentor assigned. A custom practice set is done when every problem has an attempt since it was assigned; a
     * chapter / stage task is done when that stage is; a free task is done when someone marks it. Anyone can also mark one done. */
    D.tasks = Object.keys(D.taskDefs).map(function (k) { return D.taskDefs[k]; }).filter(function (d) { return !d.deleted; }).map(function (d) {
      var t = { key: d.key, title: d.title || 'Task', instr: d.instr || '', kind: d.kind || 'free', ch: d.ch || '', stage: d.stage || '', pids: d.pids || [], forced: !!d.forced, sprint: !!d.sprint, minutes: d.minutes || 0,
        due: d.due || '', dueTime: d.dueTime || '', dueAt: localTs(d.due, d.dueTime), t: d.t, by: d.by || '', legacy: !!d.legacy, cur: 0, total: 0, done: false, doneBy: '' };
      if (t.kind === 'practice') {
        t.total = t.pids.length;
        t.cur = t.pids.filter(function (pid) { var q = D.q[pid]; return q && q.attempts.some(function (a) { return a.t >= d.t && a.ctx !== 'legacy'; }); }).length;
        t.done = t.total > 0 && t.cur >= t.total;
      } else if (t.kind === 'stage') {
        var S = D.stages[t.ch], st = S && (t.stage === 'ALL' ? S.X : S[t.stage]);
        if (t.stage === 'ALL') { t.done = !!(S && S.complete); t.cur = S ? S.seq.filter(function (k) { return S[k].done; }).length : 0; t.total = S ? S.seq.length : 0; }
        else if (st) { t.done = !!st.done; t.cur = st.cur || (st.done ? 1 : 0); t.total = st.total || 1; }
      }
      var md = D.taskDone[d.key]; if (md && md.t >= d.t) { t.done = true; t.doneBy = md.by ? 'mentor' : 'you'; }
      t.status = t.done ? 'done' : (t.dueAt && t.dueAt < now ? 'overdue' : 'open');
      return t;
    }).sort(function (a, b) { return (a.dueAt || 9e15) - (b.dueAt || 9e15) || a.t - b.t; });

    /* Mentor messages: unread = after the read marker, not imported from the old system. */
    D.unread.teacher = D.msgs.filter(function (m) { return m.from !== 'teacher' && !m.legacy && m.t > D.read.teacher; });
    D.unread.student = D.msgs.filter(function (m) { return m.from === 'teacher' && !m.legacy && m.t > D.read.student; });
    D.props = D.msgs.filter(function (m) { return m.kind === 'proposal' && m.from !== 'teacher'; }).map(function (m) {
      var r = D.propReply[m.id]; return { msg: m, status: r ? r.status : 'pending', reply: r || null };
    });
    return D;
  }

  /* ---------- Right Now ---------- */
  // One ranked list of what the student should do, and why. The order is a rule, not a guess (the page prints it):
  //   1  Required by your mentor (forced tasks): overdue first, then soonest due, then undated
  //   2  Reviews due (the daily queue, within the time budget)
  //   3  Entries waiting to be written (the Inbox)
  //   4  Your own calendar: to-dos / mocks / events dated today or earlier
  //   5  Suggested by your mentor (tasks that are not forced)
  //   6  Your plan: warm-up, the current chapter's next stage, or a mock when every chapter is done
  // A required task always outranks reviews, because the mentor only forces something for a reason (a deadline, a sprint). Within
  // a tier the earlier deadline wins. `why` says in a sentence what put it there.
  function rightNow(D, o) {
    o = o || {}; var now = o.now || D.now, cid = encodeURIComponent(o.course || ''), todayISO = dayKey(now), items = [], plan = o.plan || null;
    function when(t) {
      if (!t.dueAt) return '';
      var days = Math.floor((new Date(t.due + 'T00:00:00').getTime() - new Date(todayISO + 'T00:00:00').getTime()) / DAY + 0.5);
      return days < 0 ? 'overdue by ' + (-days) + ' day' + (days < -1 ? 's' : '') : days === 0 ? (t.dueTime ? 'due today ' + t.dueTime : 'due today') : days === 1 ? 'due tomorrow' : 'due ' + t.due;
    }
    function taskHref(t) {
      if (t.kind === 'practice') return 'practice.html?course=' + cid + '&task=' + encodeURIComponent(t.key);
      if (t.kind === 'stage') return t.stage === 'ALL' ? 'chapter.html?course=' + cid + '&ch=' + encodeURIComponent(t.ch) + '#hub' : 'chapter.html?course=' + cid + '&ch=' + encodeURIComponent(t.ch) + '#' + ({ B: 'b', C: 'c', R: 'r', T: 't', V: 'rt', X: 'x' }[t.stage] || 'hub');
      return '';
    }
    D.tasks.filter(function (t) { return !t.done; }).forEach(function (t) {
      var w = when(t), prog = t.total ? t.cur + ' of ' + t.total + (t.kind === 'practice' ? ' problems' : '') : '';
      var it = { id: 'task:' + t.key, kind: 'task', task: t, forced: t.forced, title: t.title, detail: t.instr, href: taskHref(t), minutes: t.minutes, due: t.dueAt, dueText: w, progress: prog, sprint: t.sprint, manual: t.kind === 'free' };
      if (t.forced) { it.tier = 1; it.why = 'Required by your mentor' + (w ? ' · ' + w : ''); }
      else { it.tier = 5; it.why = 'Suggested by your mentor' + (w ? ' · ' + w : ''); }
      items.push(it);
    });
    var dq = dailyQueue(D, now, o.costOf);
    if (dq.items.length) items.push({ id: 'reviews', tier: 2, kind: 'reviews', title: dq.items.length + ' review' + (dq.items.length > 1 ? 's' : '') + ' due', detail: dq.all.length > dq.items.length ? dq.all.length + ' are due; today\'s share fits your ' + dq.budget + '-minute budget.' : 'Redo them cold, then say how it felt.', minutes: dq.minutes, href: 'notebook.html?course=' + cid + '&view=redo', why: 'Spaced reviews come due on a schedule; the longer they wait, the more you forget' });
    var pending = Object.keys(D.entries).filter(function (p) { return D.entries[p].pending; }).length;
    if (pending) items.push({ id: 'inbox', tier: 3, kind: 'inbox', title: pending + ' entr' + (pending > 1 ? 'ies' : 'y') + ' to write', detail: 'Wrong answers and flags wait for a Careless or Actual entry. Writing one starts its review.', minutes: pending * 3, href: 'notebook.html?course=' + cid + '&view=inbox', why: 'You flagged or missed these; the entry is what makes the review work' });
    Object.keys(D.cal).map(function (k) { return D.cal[k]; }).filter(function (c) { return !c.deleted && !c.done && c.date && c.date <= todayISO; }).forEach(function (c) {
      var over = c.date < todayISO, timeAt = c.time ? localTs(c.date, c.time) : 0;
      items.push({ id: 'cal:' + c.key, tier: 4, kind: 'cal', cal: c, title: c.title, detail: c.kind === 'event' ? 'Event' + (c.time ? ' at ' + c.time : '') : c.kind === 'mock' ? 'Mock exam on your calendar' : 'Your to-do', href: c.kind === 'mock' ? 'practice.html?course=' + cid + '#mock' : '', manual: c.kind === 'todo', due: timeAt || localTs(c.date), dueText: over ? 'was ' + c.date : c.time ? 'today ' + c.time : 'today', why: c.by ? 'On the calendar your mentor set' : 'On your own calendar for ' + (over ? 'an earlier day' : 'today') });
    });
    var step = chapterStep(D, plan, now), a = step.action, T = { onTrack: step.out.onTrack };
    {
      var hash = { B: 'b', C: 'c', R: 'r', T: 't', V: 'rt', X: 'x' };
      var href = a.kind === 'warmup' ? 'notebook.html?course=' + cid + '&view=redo&mode=warmup&ch=' + encodeURIComponent(a.ch) : a.kind === 'item' ? itemHref(a.item, o.course || '') : a.kind === 'stage' ? 'chapter.html?course=' + cid + '&ch=' + encodeURIComponent(a.ch) + '#' + (hash[a.stage] || 'hub') : 'practice.html?course=' + cid + '#mock';
      items.push({ id: 'plan', tier: 6, kind: 'plan', title: a.label, detail: a.detail, href: href, why: a.kind === 'item' ? 'Next step in your course: checkpoints and Chapter M come after the chapters they cover' : T.onTrack ? 'Next step in your chapter flow · ' + T.onTrack.text : 'Next step in your chapter flow', onTrack: T.onTrack });
    }
    items.sort(function (a, b) { return a.tier - b.tier || (a.due || 9e15) - (b.due || 9e15); });
    var up = Object.keys(D.cal).map(function (k) { return D.cal[k]; }).filter(function (c) { return !c.deleted && !c.done && c.date && c.kind === 'event'; }).map(function (c) { return { c: c, at: localTs(c.date, c.time || '00:00') }; })
      .filter(function (x) { return x.at >= now - 36e5 && x.at <= now + 2 * DAY; }).sort(function (a, b) { return a.at - b.at; });
    return { items: items, top: items[0] || null, rest: items.slice(1), upcoming: up, queue: dq, unread: D.unread.student.length, behind: T.onTrack && T.onTrack.state === 'behind' ? T.onTrack : null };
  }

  // The chapter's concept cards in the student's own order: [{key,name,text,images,prompt}], deleted ones left out. Cards the order
  // does not mention yet (new ones) follow in their natural order.
  function conceptList(D, info, ch) {
    var m = info.chapters[ch] || {}, evs = D.concepts[ch] || {}, defs = m.concepts || [], base = m.conceptKeys || [];
    var keys = base.concat(Object.keys(evs).filter(function (k) { return base.indexOf(k) < 0; })), ord = (D.conceptOrder && D.conceptOrder[ch]) || [];
    function rank(k) { var i = ord.indexOf(k); return i >= 0 ? i : 1e6 + keys.indexOf(k); }
    return keys.filter(function (k) { return !(evs[k] && evs[k].deleted); }).sort(function (a, b) { return rank(a) - rank(b); }).map(function (k) {
      var e = evs[k] || {}, def = defs.filter(function (x) { return x.key === k; })[0] || {};
      return { key: k, name: e.name || def.name || k, text: e.text || '', images: e.images || [], prompt: def.prompt || '' };
    });
  }
  function moveConcept(store, D, info, ch, key, dir) {
    var keys = conceptList(D, info, ch).map(function (x) { return x.key; }), i = keys.indexOf(key), j = i + dir;
    if (i < 0 || j < 0 || j >= keys.length) return false;
    var t = keys[i]; keys[i] = keys[j]; keys[j] = t; store.append('concept_order', { ch: ch, keys: keys }); return true;
  }

  /* ---------- Today ---------- */
  function dueEntries(D, now) {
    now = now || D.now;
    return Object.keys(D.entries).map(function (k) { return D.entries[k]; }).concat(Object.keys(D.cards || {}).map(function (k) { return D.cards[k]; }))
      .filter(function (e) { return e.due && e.due <= now && e.status !== 'resolved'; })
      .sort(function (a, b) { return a.due - b.due; });
  }
  // The review queue for today: Actual (idea) problems first, then Careless, each oldest-due first, filled up to the
  // daily budget in minutes (an FRQ costs more than an MCQ). The rest stays due and rolls over. Always shows at least one.
  function dailyQueue(D, now, costOf, budget, opts) {
    var all = dueEntries(D, now).slice().sort(function (a, b) {
      var pa = a.track === 'careless' ? 1 : 0, pb = b.track === 'careless' ? 1 : 0;
      return pa !== pb ? pa - pb : a.due - b.due;
    });
    budget = budget || REQ.dailyReviewMin || CFG.DAILY_REVIEW_MIN || 15;
    var used = 0, total = 0, items = [];
    all.forEach(function (e) {
      var c = e.isCard ? (CFG.MIN_PER_CARD || 1) : costOf ? costOf(e.pid) : CFG.MIN_PER_QUESTION; total += c;
      if (!items.length || used + c <= budget) { items.push(e); used += c; }
    });
    var ahead = 0;
    if (opts && opts.ahead) { // review ahead: when nothing else is due (or the budget has room), pull the soonest upcoming reviews forward
      Object.keys(D.entries).map(function (k) { return D.entries[k]; }).concat(Object.keys(D.cards || {}).map(function (k) { return D.cards[k]; }))
        .filter(function (e) { return e.due && e.due > now && e.status !== 'resolved' && !e.pending; }).sort(function (a, b) { return a.due - b.due; })
        .forEach(function (e) { var c = e.isCard ? (CFG.MIN_PER_CARD || 1) : costOf ? costOf(e.pid) : CFG.MIN_PER_QUESTION; if (used + c <= budget) { items.push(Object.assign({}, e, { early: true })); used += c; ahead++; } });
    }
    return { items: items, all: all, minutes: Math.round(used), totalMinutes: Math.round(total), budget: budget, ahead: ahead };
  }
  function warmupEntries(D, ch) {
    var order = D.info.order, i = order.indexOf(ch), prev = null;
    for (var j = i - 1; j >= 0; j--) if (D.info.chapters[order[j]].hasT) { prev = order[j]; break; }
    if (!prev) return { prev: null, entries: [] };
    var es = Object.keys(D.entries).map(function (k) { return D.entries[k]; })
      .filter(function (e) { return e.ch === prev && e.srcs.indexOf('T') >= 0 && e.reviews === 0 && !e.warmupDone && !e.pending && e.status !== 'resolved'; })
      .slice(0, CFG.WARMUP_COUNT);
    return { prev: prev, entries: es };
  }
  var STAGE_NAME = { B: 'Book', C: 'Problems', R: 'Review', T: 'Test', V: 'Review (test)', X: 'Close' };

  /* ---------- Curriculum: chapters, cumulative checkpoints, then Chapter M ----------
   * rows = every required step in order. A checkpoint sits right after its last chapter and is due once all its chapters are complete
   * (it is optional, never blocking, for a student whose chapters were all done in the old roadmap). Chapter M rows follow the chapters.
   * next = the first row still to do, which is what Today and Right Now point at. */
  function buildCurriculum(D, info) {
    var cfg = info.curriculum; if (!cfg) return null;
    function chDone(ch) { var S = D.stages[ch]; return !!(S && S.complete); }
    function taken(id) { return D.mocks.some(function (s) { return s.mockId === id; }); }
    var setById = {}; (info.sets || []).forEach(function (x) { setById[x.id] = x; });
    var rows = [], selfStudy = !!info.selfStudy; // self-study: nothing here is required
    info.order.forEach(function (ch) {
      rows.push({ kind: 'chapter', id: 'ch' + ch, ch: ch, label: 'Ch ' + ch, title: info.chapters[ch].title, done: chDone(ch) });
      (cfg.checkpoints || []).filter(function (cp) { return String(cp.after) === String(ch); }).forEach(function (cp) {
        var legacy = cp.chapters.every(function (c) { return !!D.legacyDone[c]; });
        rows.push({ kind: 'checkpoint', id: cp.id, label: '\u2605', title: cp.title, chapters: cp.chapters, done: taken(cp.id), optional: selfStudy || (legacy && !taken(cp.id)),
          due: cp.chapters.every(chDone), legacy: legacy });
      });
    });
    var ex = cfg.exam || { items: [] }, mi = 0;
    (ex.items || []).forEach(function (it) {
      mi++;
      var r = { kind: it.kind, id: it.id, group: 'M', label: 'M' + mi, title: it.title, optional: selfStudy };
      if (it.kind === 'set') { var st = setById[it.id]; if (!st) return; r.total = st.ids.length; r.cur = st.ids.filter(function (pid) { return D.q[pid] && D.q[pid].n; }).length; r.done = r.total > 0 && r.cur >= r.total; r.started = r.cur > 0; }
      else { r.done = taken(it.id); r.started = r.done; }
      rows.push(r);
    });
    var next = null;
    rows.forEach(function (r) { if (next || r.done || r.optional) return; if (r.kind === 'checkpoint' && !r.due) return; next = r; });
    var m = rows.filter(function (r) { return r.group === 'M'; });
    var req = rows.filter(function (r) { return !r.optional; });
    return { rows: rows, next: next, m: { id: ex.id || 'M', title: ex.title || 'Chapter M', rows: m, done: m.filter(function (r) { return r.done; }).length, total: m.length, complete: m.length > 0 && m.every(function (r) { return r.done; }),
      unlocked: D.current === null || selfStudy }, selfStudy: selfStudy, complete: req.every(function (r) { return r.done; }) };
  }
  // Links from the course view carry `ret` so Practice's Back / finish leads back to the course view, not to the Practice tabs.
  function itemHref(it, cid) {
    var c = encodeURIComponent(cid), ret = '&ret=' + encodeURIComponent('roadmap.html?course=' + cid);
    return it.kind === 'set' ? 'practice.html?course=' + c + ret + '#set:' + it.id : it.kind === 'chapter' ? 'chapter.html?course=' + c + '&ch=' + encodeURIComponent(it.ch) + '#hub' : 'practice.html?course=' + c + ret + '#mock:' + it.id;
  }
  function itemAction(it) {
    var a = { kind: 'item', item: it };
    if (it.kind === 'checkpoint') { a.label = 'Take ' + it.title; a.detail = '40 problems, 80 minutes straight, like a mock. It replaces the chapter tests for these chapters.'; }
    else if (it.kind === 'set') { a.label = 'Work through ' + it.title + (it.total ? ' \u00b7 ' + it.cur + '/' + it.total : ''); a.detail = 'Mixed problems from every chapter. Flag what you miss; it goes to your review queue.'; }
    else { a.label = 'Take ' + it.title; a.detail = 'Timed and without feedback until the end. One shot.'; }
    return a;
  }

  // The next step in the chapter flow, ignoring reviews: a warm-up if the chapter has not been touched, else the next stage.
  function chapterStep(D, plan, now) {
    var nx = D.curriculum && D.curriculum.next;
    if (nx && nx.kind !== 'chapter') return { out: { ch: D.current, warmup: [], onTrack: null }, action: itemAction(nx) };
    var ch = D.current; if (!ch) return { out: { ch: null, warmup: [], onTrack: null }, action: { kind: 'done', label: 'Every chapter is complete', detail: 'Keep your due reviews going and run a mock.' } };
    var S = D.stages[ch], w = warmupEntries(D, ch), out = { ch: ch, warmup: w.entries, warmupFrom: w.prev, onTrack: plan ? planStatus(plan, ch, S.complete, now) : null };
    if (w.entries.length && !S.B.started && !S.B.done) return { out: out, action: { kind: 'warmup', ch: ch, label: 'Warm-up: redo ' + w.entries.length + ' missed test problem' + (w.entries.length > 1 ? 's' : '') + ' from Ch ' + w.prev, detail: 'About 15 minutes, then start Chapter ' + ch + '.' } };
    var k = S.next, st = S[k], prog = st.total ? ' · ' + st.cur + '/' + st.total : '';
    return { out: out, action: { kind: 'stage', ch: ch, stage: k, label: (st.started ? 'Continue ' : 'Start ') + STAGE_NAME[k] + ' for Chapter ' + ch + prog, detail: stageGoal(k) } };
  }
  function today(D, plan, now) {
    now = now || D.now;
    var step = chapterStep(D, plan, now), out = step.out; out.due = dueEntries(D, now); out.action = step.action;
    if (out.action.kind === 'stage' || out.action.kind === 'done' || out.action.kind === 'item') {
      if (out.due.length) out.action = { kind: 'due', ch: out.ch, label: out.due.length + ' review' + (out.due.length > 1 ? 's' : '') + ' due', detail: 'Redo them cold, then write what changed.' };
    }
    return out; // a warm-up outranks reviews, as before
  }
  function stageGoal(k) {
    return { B: 'Read the chapter, then add the examples and concepts you want to keep.',
      C: 'Solve. Open the answer when you are stuck. Flag every problem you want to review.',
      R: 'For each problem you flagged, say Careless or Actual and write what happened.',
      T: 'A timed test, once. No feedback until you submit.',
      V: 'Write an entry for every test miss, the same way as in Review.',
      X: 'Pull the chapter together in your Concepts Notebook.' }[k];
  }

  /* ---------- long-term plan ---------- */
  function parseISO(s) { var p = String(s).split('-'); return Date.UTC(+p[0], +p[1] - 1, +p[2]); }
  function toISO(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0') + '-' + String(d.getUTCDate()).padStart(2, '0'); }
  function addDays(iso, n) { return toISO(parseISO(iso) + n * DAY); }
  function daysBetween(a, b) { return Math.round((parseISO(b) - parseISO(a)) / DAY); }

  // chapters: [{ch,title,hasT}]; opts: {start, exam, pace, overlap, mockEvery}
  function generatePlan(chapters, opts) {
    var pace = Math.max(3, +opts.pace || 9);
    var overlap = Math.min(opts.overlap === undefined || opts.overlap === '' || isNaN(+opts.overlap) ? 2 : +opts.overlap, pace - 1);
    var every = +opts.mockEvery || 5, cursor = opts.start, ms = [], warnings = [], n = 0;
    chapters.forEach(function (c, i) {
      var span = c.hasT === false ? Math.max(3, Math.ceil(pace * 0.6)) : pace;
      var end = addDays(cursor, span - 1);
      ms.push({ id: 'ch' + c.ch, type: 'chapter', ch: String(c.ch), label: 'Ch ' + c.ch + ' · ' + c.title, start: cursor, end: end });
      if ((i + 1) % every === 0 && i < chapters.length - 1) { n++; ms.push({ id: 'mock' + n, type: 'mock', label: 'Cumulative mock ' + n, start: addDays(end, 1), end: addDays(end, 1) }); }
      cursor = addDays(end, 1 - overlap);
    });
    var lastEnd = ms.length ? ms[ms.length - 1].end : opts.start;
    if (opts.exam) {
      [21, 14, 7].forEach(function (d, i) { ms.push({ id: 'full' + (i + 1), type: 'mock', label: 'Full mock ' + (i + 1), start: addDays(opts.exam, -d), end: addDays(opts.exam, -d) }); });
      ms.push({ id: 'exam', type: 'exam', label: 'AP exam', start: opts.exam, end: opts.exam });
      var over = daysBetween(addDays(opts.exam, -21), lastEnd);
      if (over > 0) warnings.push('Chapters run ' + over + ' day' + (over > 1 ? 's' : '') + ' past the first full mock. Shorten the pace or start earlier.');
    }
    ms.sort(function (a, b) { return a.start < b.start ? -1 : a.start > b.start ? 1 : 0; });
    return { plan: { start: opts.start, exam: opts.exam || '', pace: pace, overlap: overlap, milestones: ms }, warnings: warnings };
  }
  function planStatus(plan, ch, complete, now) {
    var m = (plan.milestones || []).filter(function (x) { return x.type === 'chapter' && String(x.ch) === String(ch); })[0];
    if (!m) return null;
    var today = toISO(now);
    if (complete) return { state: 'ahead', days: Math.max(0, daysBetween(today, m.end)), text: 'Done ahead of plan' };
    var late = daysBetween(m.end, today);
    if (late > 0) return { state: 'behind', days: late, text: late + ' day' + (late > 1 ? 's' : '') + ' behind plan' };
    var p = m.end.split('-'), mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+p[1] - 1];
    return { state: 'on', days: -late, text: 'On track · target ' + mon + ' ' + (+p[2]) };
  }

  /* ---------- stats ---------- */
  // Everything the Stats tab and "bias toward weak" need, derived from D (no extra storage).
  function stats(D, info, now) {
    now = now || D.now;
    var by = {};
    function row(ch) { return by[ch] || (by[ch] = { ch: ch, title: (info.chapters[ch] || {}).title || 'Chapter ' + ch, attempted: 0, firstRight: 0, hinted: 0, ms: 0, msN: 0, testN: 0, testRight: 0 }); }
    info.order.forEach(row);
    Object.keys(D.prob).forEach(function (pid) {
      var p = D.prob[pid]; if (!p.answered) return;
      var r = row(p.ch); r.attempted++;
      if (p.first && p.first.correct) r.firstRight++;
      if (p.maxHint >= 4) r.hinted++; // opened the answer (older hint levels 1-3 no longer exist)
      if (p.ms) { r.ms += p.ms; r.msN++; }
    });
    var subs = [].concat.apply([], Object.keys(D.tests).map(function (k) { return D.tests[k]; })).concat(D.customTests, D.mocks);
    subs.forEach(function (sb) {
      (sb.pids || []).forEach(function (pid) {
        var res = (sb.result || {})[pid];
        if (res !== 'correct' && res !== 'incorrect' && res !== 'unanswered') return;
        var r = row((sb.chOf || {})[pid] || sb.ch); r.testN++;
        if (res === 'correct') r.testRight++;
        if (sb.ms && sb.ms[pid]) { r.ms += sb.ms[pid]; r.msN++; }
      });
    });
    var overall = { attempted: 0, right: 0, hinted: 0, seen: 0 };
    Object.keys(by).forEach(function (ch) {
      var r = by[ch];
      r.seen = r.attempted + r.testN; r.right = r.firstRight + r.testRight;
      r.pct = r.seen ? r.right / r.seen : null;
      r.hintPct = r.attempted ? r.hinted / r.attempted : null;
      r.avgSec = r.msN ? Math.round(r.ms / r.msN / 1000) : null;
      overall.seen += r.seen; overall.right += r.right; overall.attempted += r.attempted; overall.hinted += r.hinted;
    });
    overall.pct = overall.seen ? overall.right / overall.seen : null;
    overall.hintPct = overall.attempted ? overall.hinted / overall.attempted : null;
    var weak = Object.keys(by).filter(function (c) { return info.chapters[c] && by[c].seen >= 5; }).sort(function (a, b) { return by[a].pct - by[b].pct; });
    var es = Object.keys(D.entries).map(function (k) { return D.entries[k]; });
    var missCount = { careless: 0, actual: 0 }; es.forEach(function (e) { if (e.track) missCount[e.track]++; });
    var live = es.filter(function (e) { return e.card && e.status !== 'resolved'; });
    var rs = live.map(function (e) { return FSRS.retrievability(e.card, now); }).filter(function (x) { return x != null; });
    var queue = { total: es.length, needsNote: es.filter(function (e) { return e.pending; }).length, skipped: 0,
      due: dueEntries(D, now).length, shaky: es.filter(function (e) { return e.status === 'shaky'; }).length,
      resolved: es.filter(function (e) { return e.status === 'resolved'; }).length,
      avgRetention: rs.length ? rs.reduce(function (a, b) { return a + b; }, 0) / rs.length : null };
    var sessions = subs.map(function (sb) { return { t: sb.t, kind: sb.kind, ch: sb.ch, correct: sb.score.correct, total: sb.score.total, sec: sb.usedSec || 0, id: sb.id }; })
      .sort(function (a, b) { return a.t - b.t; });
    var bySet = {};
    (info.sets || []).forEach(function (st) {
      var r = { id: st.id, title: st.title, frq: st.frq, total: st.ids.length, tried: 0, firstRight: 0, hinted: 0 };
      st.ids.forEach(function (pid) { var q = D.q[pid]; if (!q || !q.n) return; r.tried++; if (q.first.correct) r.firstRight++; if (q.hintMax >= 4) r.hinted++; });
      r.pct = r.tried ? r.firstRight / r.tried : null; bySet[st.id] = r;
    });

    /* ---- streak, forecast, trend, histories ---- */
    var act = D.activity || {}, today = dayKey(now);
    function shift(key, n) { var p = key.split('-'); var d = new Date(+p[0], +p[1] - 1, +p[2] + n); return dayKey(d.getTime()); }
    var cur = 0, k = act[today] ? today : shift(today, -1);
    while (act[k]) { cur++; k = shift(k, -1); }
    var days = Object.keys(act).sort(), longest = 0, run = 0, prev = null;
    days.forEach(function (d) { run = prev && shift(prev, 1) === d ? run + 1 : 1; if (run > longest) longest = run; prev = d; });
    var total = days.reduce(function (n, d) { return n + act[d]; }, 0);
    var streak = { current: cur, longest: longest, activeDays: days.length, total: total, today: act[today] || 0 };
    // reviews due per day for the next two weeks (anything overdue counts as today)
    var items = Object.keys(D.entries).map(function (q) { return D.entries[q]; }).concat(Object.keys(D.cards || {}).map(function (q) { return D.cards[q]; }));
    var forecast = []; for (var i = 0; i < 14; i++) forecast.push({ day: shift(today, i), n: 0 });
    items.forEach(function (e) {
      if (!e.due || e.status === 'resolved') return;
      var dk = dayKey(e.due), idx = e.due <= now ? 0 : forecast.map(function (f) { return f.day; }).indexOf(dk);
      if (idx >= 0) forecast[idx].n++;
    });
    // first-try accuracy by week for the last 10 weeks (practice, chapter, tests, mocks; not review redos)
    var weekMs = 7 * DAY, trend = [];
    for (var w = 9; w >= 0; w--) trend.push({ from: now - (w + 1) * weekMs, to: now - w * weekMs, n: 0, right: 0 });
    var tags = info.tags || {}, byCalc = { yes: { n: 0, right: 0 }, no: { n: 0, right: 0 } }, byType = { mcq: { n: 0, right: 0 }, frq: { n: 0, right: 0 } };
    // Habits and calibration: when they work, how sure they were vs how right, how hints and speed relate to results.
    var hours = [], dow = [], calib = {}, speed = { yes: { n: 0, ms: 0 }, no: { n: 0, ms: 0 } }, hintBy = [0, 1, 2, 3, 4].map(function () { return { n: 0, right: 0 }; });
    for (var hh = 0; hh < 24; hh++) hours.push({ n: 0, right: 0 });
    for (var dd = 0; dd < 7; dd++) dow.push({ n: 0, right: 0 });
    var recover = { missedFirst: 0, gotLater: 0 }, studyWeeks = [];
    for (var sw = 9; sw >= 0; sw--) studyWeeks.push({ from: now - (sw + 1) * 7 * DAY, to: now - sw * 7 * DAY, ms: 0 });
    Object.keys(D.q).forEach(function (pid) {
      var r = D.q[pid], tg = tags[pid] || [];
      if (r.first && r.first.correct === false) { recover.missedFirst++; if (r.attempts.slice(1).some(function (x) { return x.correct === true; })) recover.gotLater++; }
      r.attempts.forEach(function (a, ai) {
        if (a.ms) studyWeeks.forEach(function (b) { if (a.t > b.from && a.t <= b.to) b.ms += a.ms; });
        if (['chapter', 'practice', 'test', 'customtest', 'mock', 'legacy'].indexOf(a.ctx) < 0 || a.correct == null) return;
        if (a.ctx !== 'legacy') {
          var dt = new Date(a.t), hb = hours[dt.getHours()], db = dow[dt.getDay()];
          hb.n++; db.n++; if (a.correct) { hb.right++; db.right++; }
        }
        if (ai === 0 && a.ctx !== 'legacy') {
          if (a.conf) { var cb = calib[a.conf] || (calib[a.conf] = { n: 0, right: 0 }); cb.n++; if (a.correct) cb.right++; }
          var hl = Math.min(4, r.attempts[0] && a.hint ? a.hint : 0), hbk = hintBy[hl]; hbk.n++; if (a.correct) hbk.right++;
          if (a.ms && tg[0] && speed[tg[0]]) { speed[tg[0]].n++; speed[tg[0]].ms += a.ms; }
        }
        if (a.ctx === 'legacy') { trend.forEach(function (b) { if (a.t > b.from && a.t <= b.to) { b.n++; if (a.correct) b.right++; } }); return; }
        trend.forEach(function (b) { if (a.t > b.from && a.t <= b.to) { b.n++; if (a.correct) b.right++; } });
        if (ai === 0) {
          if (tg[0] && byCalc[tg[0]]) { byCalc[tg[0]].n++; if (a.correct) byCalc[tg[0]].right++; }
          var ty = tg[1] ? 'frq' : 'mcq'; byType[ty].n++; if (a.correct) byType[ty].right++;
        }
      });
    });
    trend.forEach(function (b) { b.pct = b.n ? b.right / b.n : null; });
    // practice history: one row per day and kind of work
    var CTXG = { legacy: 'Imported (old roadmap)', chapter: 'Chapter problems', practice: 'Practice', review: 'Review', spaced: 'Review queue', warmup: 'Warm-up', test: 'Chapter test', customtest: 'Test', mock: 'Mock' };
    var hist = {};
    Object.keys(D.q).forEach(function (pid) { D.q[pid].attempts.forEach(function (a) {
      var key = dayKey(a.t) + '|' + (CTXG[a.ctx] || a.ctx), h = hist[key] || (hist[key] = { day: dayKey(a.t), what: CTXG[a.ctx] || a.ctx, n: 0, right: 0, ms: 0, t: a.t });
      h.n++; if (a.correct) h.right++; h.ms += a.ms || 0; if (a.t > h.t) h.t = a.t;
    }); });
    var history = Object.keys(hist).map(function (x) { return hist[x]; }).sort(function (a, b) { return b.t - a.t; });
    var mocks = D.mocks.map(function (m) {
      var sc = D.frqScores[m.id] || {}, pts = 0, n = 0; Object.keys(sc).forEach(function (p) { pts += +sc[p] || 0; n++; });
      return { t: m.t, id: m.id, title: m.title || 'Mock', correct: m.score.correct, total: m.score.total, minutes: m.minutes, usedSec: m.usedSec || 0, frqN: (m.frqPids || []).length, frqScored: n, frqPts: pts, frqMax: (m.spec && m.spec.scoring && m.spec.scoring.frqMaxEach) || 9 };
    }).sort(function (a, b) { return b.t - a.t; });
    // Careless vs Actual entries by chapter: where slips happen versus where the idea is missing.
    var mixByCh = {};
    es.forEach(function (e) { if (!e.track || !e.ch) return; var m = mixByCh[e.ch] || (mixByCh[e.ch] = { careless: 0, actual: 0 }); m[e.track]++; });
    var avgMs = function (x) { return x.n ? Math.round(x.ms / x.n / 1000) : null; };
    return { byChapter: by, bySet: bySet, order: info.order, overall: overall, weak: weak, miss: missCount, queue: queue, sessions: sessions,
      streak: streak, forecast: forecast, trend: trend, byCalc: byCalc, byType: byType, history: history, mocks: mocks,
      hours: hours, dow: dow, calib: calib, hintBy: hintBy, recover: recover, mixByCh: mixByCh, speed: { yes: avgMs(speed.yes), no: avgMs(speed.no) },
      studyWeeks: studyWeeks.map(function (b) { return { from: b.from, to: b.to, min: Math.round(b.ms / 60000) }; }) };
  }

  var api = {
    CFG: CFG, DAY: DAY, code: code, normCode: normCode, uid: uid, len: len, missType: missType, frqRef: function (aid, pid) { return 'frq:' + (aid || 'p') + ':' + pid; }, noteValid: noteValid, noteBody: noteBody, ideaTrigger: ideaTrigger,
    dayKey: dayKey, FSRS: FSRS, open: open, loadAll: loadAll, derive: derive, stats: stats, today: today, syncNow: syncNow, fetchT: fetchT, itemHref: itemHref, rightNow: rightNow, dueEntries: dueEntries, dailyQueue: dailyQueue, warmupEntries: warmupEntries, entryComplete: entryComplete, trackOf: trackOf, cardId: cardId,
    localTs: localTs, conceptList: conceptList, moveConcept: moveConcept, req: req, words: words, reqDefaults: reqDefaults, REQ_LIMITS: REQ_LIMITS,
    STAGE_NAME: STAGE_NAME, stageGoal: stageGoal,
    generatePlan: generatePlan, planStatus: planStatus, addDays: addDays, daysBetween: daysBetween, toISO: toISO, parseISO: parseISO
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZP = api;
})(typeof window === 'undefined' ? globalThis : window);
