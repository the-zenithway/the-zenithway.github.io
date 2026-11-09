/**
 * Zenith — student data store (course platform), COMMIT-BASED
 * -----------------------------------------------------------
 * Same idea as kyj-sat's "kyj-cloud": the browser keeps everything locally and a small Apps Script, holding a GitHub token the browser never
 * sees, writes it into the repo as commits on a dedicated branch (default `student-data`, created on first write from `main`), so nothing
 * clutters main's history. There is no Google Sheet any more.
 *
 * FILES (on the data branch)
 *   data/cloud/<username>__<course>.json    {"v":1,"username","course","events":[...]}   one append-only event log per student and course
 *   data/cloud/docs/<key>.json              {"key","value","updatedAt","by"}              plans (plan:<user>:<course>) and reports:fixed
 *
 * HOW THE SITE USES IT (js/zp-store.js)
 *   writes   the browser queues events and pushes them here in batches: about 3 s after the first unsent event when nothing was sent for
 *            5 minutes, otherwise at most once every SYNC_PUSH_MINUTES (5), plus one last push when the tab is closed. One commit per push.
 *   reads    straight from GitHub, no Apps Script involved: https://raw.githubusercontent.com/<owner>/<repo>/<branch>/data/cloud/<file>
 *            (CLOUD_RAW_URL in js/zp-config.js), every SYNC_PULL_MINUTES (5) and when a page opens if the last pull was longer ago.
 *   merging  events are only ever added and have unique ids, so merging two devices is a union by id; nothing is ever overwritten.
 *
 * SETUP (script.google.com > a project; this can be the same project as zenith-data-writer.gs only if you also merge the doGet/doPost)
 *   1. Paste this file.
 *   2. Project Settings > Script properties:
 *        GITHUB_TOKEN   fine-grained token for ONLY this repo, with Contents: read and write  (the same one zenith-data-writer.gs uses)
 *        GITHUB_OWNER   the-zenithway
 *        GITHUB_REPO    the-zenithway.github.io
 *        GITHUB_BRANCH  main                  (optional; the branch the data branch is created from)
 *        DATA_BRANCH    student-data          (optional)
 *        DATA_DIR       data/cloud            (optional)
 *   3. Deploy > New deployment > Web app > Execute as: Me, Who has access: Anyone. Copy the /exec URL into DATA_URL in js/zp-config.js.
 *      Later changes: Manage deployments > edit > New version (the URL stays the same).
 *   4. CLOUD_RAW_URL in js/zp-config.js = https://raw.githubusercontent.com/<owner>/<repo>/<DATA_BRANCH>/<DATA_DIR>
 *
 * API (text/plain bodies, same CORS trick as zenith-data-writer.gs)
 *   POST {action:"append", username, course, events:[...]}   -> {ok, added}     (also sends the mentor-layer emails, see the bottom)
 *   POST {action:"putDoc", key, value, by}                    -> {ok}
 *   GET  ?action=events&username=&course=                     -> {ok, events}    (the site reads the raw GitHub file instead; kept as a fallback)
 *   GET  ?action=all                                          -> {ok, events}    (fallback for the teacher view)
 *   GET  ?action=doc&key=                                     -> {ok, value}
 *
 * TRUST MODEL: identical to the rest of the site (see js/data.js "NOT SECURE"). The URL is visible in page source and there is no per-user
 * auth, so anyone with the URL can append events, and the data branch of a public repo is readable by anyone. What bounds the damage:
 * appends are validated (known event types, size caps, id-deduped) and nothing is ever edited or deleted. Do not store anything in here you
 * would not put on a public page.
 */

var MAX_EVENTS_PER_CALL = 200;
var MAX_JSON_CHARS = 40000; // one event; photos go through zenith-data-writer.gs uploadPhotos and are stored as URLs
var MAX_FILE_EVENTS = 60000;

var EVENT_TYPES = ['ex', 'concept', 'b_submit', 'c_hint', 'c_answer', 'c_miss', 'c_note', 'redo', 'note',
  't_submit', 't_review', 'cnote', 'close', 'fb_sent', 'debrief_req', 'review_add', 'review_skip', 'flag', 'card_flag', 'card_redo', 'cal_item', 'cal_done', 'report', 'frq_score',
  // mentor layer (student <-> teacher)
  'msg', 'msg_read', 'prop_reply', 'task', 'task_done', 'criteria', 'tnote', 'legacy_done', 'concept_order', 'rec_del', 'idea', 'frq_ans'];

function doGet(e) {
  try {
    var p = e.parameter || {}, action = p.action;
    if (action === 'events') {
      requireName_(p.username, 'username'); requireName_(p.course, 'course');
      return json_({ ok: true, events: readEvents_(p.username, p.course) });
    }
    if (action === 'all') return json_({ ok: true, events: readAllEvents_() });
    if (action === 'doc') return json_({ ok: true, value: readDoc_(String(p.key || '')) });
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
    var body = JSON.parse(e.postData.contents || '{}');
    if (body.action === 'append') return json_(append_(body));
    if (body.action === 'putDoc') return json_(putDoc_(body));
    return json_({ ok: false, error: 'unknown action' });
  } catch (err) { return json_({ ok: false, error: String(err.message || err) }); }
  finally { try { lock.releaseLock(); } catch (x) { /* not held */ } }
}

/* ---------- GitHub storage ---------- */
function cfg_() {
  var p = PropertiesService.getScriptProperties();
  var token = p.getProperty('GITHUB_TOKEN'), owner = p.getProperty('GITHUB_OWNER'), repo = p.getProperty('GITHUB_REPO');
  if (!token || !owner || !repo) throw new Error('Missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO script property');
  return { base: p.getProperty('GITHUB_BRANCH') || 'main', branch: p.getProperty('DATA_BRANCH') || 'student-data', dir: (p.getProperty('DATA_DIR') || 'data/cloud').replace(/\/+$/, ''),
    api: 'https://api.github.com/repos/' + owner + '/' + repo, headers: { Authorization: 'token ' + token, Accept: 'application/vnd.github+json' } };
}
function eventsPath_(cfg, username, course) { return cfg.dir + '/' + username + '__' + course + '.json'; }
function docPath_(cfg, key) { return cfg.dir + '/docs/' + String(key).replace(/[^A-Za-z0-9_.-]/g, '__') + '.json'; }

// {exists, sha, text}. Files over 1 MB come back from the JSON endpoint without content, so they are fetched again as raw.
function ghRead_(cfg, path) {
  var url = cfg.api + '/contents/' + path + '?ref=' + encodeURIComponent(cfg.branch);
  var r = UrlFetchApp.fetch(url, { method: 'get', headers: cfg.headers, muteHttpExceptions: true }), code = r.getResponseCode();
  if (code === 404) return { exists: false, sha: null, text: null };
  if (code !== 200) throw new Error('GitHub GET ' + path + ' failed: ' + code);
  var j = JSON.parse(r.getContentText()), text;
  if (j.content) text = Utilities.newBlob(Utilities.base64Decode(String(j.content).replace(/\n/g, ''))).getDataAsString();
  else text = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: cfg.headers.Authorization, Accept: 'application/vnd.github.raw' }, muteHttpExceptions: true }).getContentText();
  return { exists: true, sha: j.sha, text: text };
}
function ghWrite_(cfg, path, text, sha, message) {
  var payload = { message: message, content: Utilities.base64Encode(Utilities.newBlob(text).getBytes()), branch: cfg.branch };
  if (sha) payload.sha = sha;
  var r = UrlFetchApp.fetch(cfg.api + '/contents/' + path, { method: 'put', headers: cfg.headers, contentType: 'application/json', payload: JSON.stringify(payload), muteHttpExceptions: true }), code = r.getResponseCode();
  if (code === 200 || code === 201) return;
  var err = new Error('GitHub PUT ' + path + ' failed: ' + code); err.conflict = code === 409 || code === 422; // the file changed since it was read
  throw err;
}
// Creates the data branch from the base branch's current head the first time (cached for the day once it exists).
function ensureBranch_(cfg) {
  var cache = CacheService.getScriptCache(), key = 'branch:' + cfg.branch;
  if (cache.get(key)) return;
  var ref = UrlFetchApp.fetch(cfg.api + '/git/ref/heads/' + encodeURIComponent(cfg.branch), { method: 'get', headers: cfg.headers, muteHttpExceptions: true });
  if (ref.getResponseCode() === 200) { cache.put(key, '1', 21600); return; }
  var base = UrlFetchApp.fetch(cfg.api + '/git/ref/heads/' + encodeURIComponent(cfg.base), { method: 'get', headers: cfg.headers, muteHttpExceptions: true });
  if (base.getResponseCode() !== 200) throw new Error('Could not read branch ' + cfg.base + ' to create ' + cfg.branch);
  var created = UrlFetchApp.fetch(cfg.api + '/git/refs', { method: 'post', headers: cfg.headers, contentType: 'application/json', muteHttpExceptions: true,
    payload: JSON.stringify({ ref: 'refs/heads/' + cfg.branch, sha: JSON.parse(base.getContentText()).object.sha }) });
  if (created.getResponseCode() !== 201 && created.getResponseCode() !== 422) throw new Error('Could not create branch ' + cfg.branch + ': ' + created.getResponseCode());
  cache.put(key, '1', 21600);
}
// One event per line keeps the commit diffs readable; the file is still plain JSON.
function serializeLog_(doc) {
  return '{"v":1,"username":' + JSON.stringify(doc.username) + ',"course":' + JSON.stringify(doc.course) + ',"events":[\n' + doc.events.map(function (e) { return JSON.stringify(e); }).join(',\n') + '\n]}\n';
}

function append_(body) {
  requireName_(body.username, 'username'); requireName_(body.course, 'course');
  var evs = body.events;
  if (!Array.isArray(evs) || !evs.length) throw new Error('no events');
  if (evs.length > MAX_EVENTS_PER_CALL) throw new Error('too many events in one call');
  evs.forEach(function (ev) {
    if (!ev || typeof ev.id !== 'string' || ev.id.length > 40 || EVENT_TYPES.indexOf(ev.type) < 0 || typeof ev.t !== 'number') throw new Error('bad event');
    if (JSON.stringify(ev).length > MAX_JSON_CHARS) throw new Error('event too large');
  });
  var cfg = cfg_(); ensureBranch_(cfg);
  var path = eventsPath_(cfg, body.username, body.course), fresh = [];
  for (var attempt = 0; attempt < 3; attempt++) {
    var f = ghRead_(cfg, path), doc = f.exists ? JSON.parse(f.text) : { v: 1, username: body.username, course: body.course, events: [] }, seen = {};
    doc.events.forEach(function (e) { seen[e.id] = 1; });
    fresh = evs.filter(function (ev) { if (seen[ev.id]) return false; seen[ev.id] = 1; return true; }); // retries of events already stored are skipped
    if (!fresh.length) return { ok: true, added: 0 };
    if (doc.events.length + fresh.length > MAX_FILE_EVENTS) throw new Error('log too large');
    doc.events = doc.events.concat(fresh).sort(function (a, b) { return a.t - b.t; });
    try { ghWrite_(cfg, path, serializeLog_(doc), f.sha, 'Sync ' + body.username + ' ' + body.course + ': +' + fresh.length + ' event' + (fresh.length > 1 ? 's' : '')); break; }
    catch (err) { if (!err.conflict || attempt === 2) throw err; fresh = []; } // someone else committed in between: read again and merge
  }
  try { notifyEvents_(body.username, body.course, fresh); } catch (err) { /* an email problem must never lose or block the student's data */ }
  return { ok: true, added: fresh.length };
}

function readEvents_(username, course) {
  var cfg = cfg_(), f = ghRead_(cfg, eventsPath_(cfg, username, course));
  return f.exists ? (JSON.parse(f.text).events || []) : [];
}
function readAllEvents_() {
  var cfg = cfg_(), r = UrlFetchApp.fetch(cfg.api + '/contents/' + cfg.dir + '?ref=' + encodeURIComponent(cfg.branch), { method: 'get', headers: cfg.headers, muteHttpExceptions: true });
  if (r.getResponseCode() === 404) return [];
  if (r.getResponseCode() !== 200) throw new Error('GitHub list failed: ' + r.getResponseCode());
  var out = [];
  JSON.parse(r.getContentText()).filter(function (x) { return x.type === 'file' && /__.+\.json$/.test(x.name); }).slice(0, 80).forEach(function (x) {
    var f = ghRead_(cfg, cfg.dir + '/' + x.name); if (!f.exists) return;
    var d = JSON.parse(f.text); (d.events || []).forEach(function (ev) { ev.username = d.username; ev.course = d.course; out.push(ev); });
  });
  return out;
}

function putDoc_(body) {
  var key = String(body.key || '');
  if (!/^(plan:[A-Za-z0-9_.-]{1,40}:[a-z0-9-]{1,40}|reports:fixed)$/.test(key)) throw new Error('bad key');
  var value = body.value || {};
  if (JSON.stringify(value).length > MAX_JSON_CHARS) throw new Error('document too large');
  var cfg = cfg_(); ensureBranch_(cfg);
  var path = docPath_(cfg, key);
  for (var attempt = 0; attempt < 3; attempt++) {
    var f = ghRead_(cfg, path);
    try { ghWrite_(cfg, path, JSON.stringify({ key: key, value: value, updatedAt: new Date().toISOString(), by: String(body.by || '').slice(0, 40) }) + '\n', f.sha, 'Update ' + key); return { ok: true }; }
    catch (err) { if (!err.conflict || attempt === 2) throw err; }
  }
}
function readDoc_(key) {
  var cfg = cfg_(), f = ghRead_(cfg, docPath_(cfg, key));
  return f.exists ? (JSON.parse(f.text).value || null) : null;
}

function requireName_(v, what) {
  if (typeof v !== 'string' || !/^[A-Za-z0-9_.-]{1,40}$/.test(v)) throw new Error('bad ' + what);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- EMAIL NOTIFICATIONS ----------
 * Who gets an email, and when. Sent from this script as events are saved (see append_), using the emails in js/data.js
 * (STUDENTS[].email, TEACHERS[].email; an empty email means "no emails", same rule as automation/notifications/). The mentor of a
 * student is whoever teaches a CLASSES entry that lists the student for that course. Self-study students have no mentor, so
 * nothing is sent about them, and they get no mentor emails.
 *
 *   to the mentor    a message from the student (any kind: message, photo, question, progress report, session proposal)
 *                    a request for FRQ feedback, a mock debrief request, a task marked done without a report
 *   to the student   a message / feedback / nudge from the mentor, a new task (required or not), a session or event added to their
 *                    calendar, the answer to a proposed session
 *
 * Throttle: the same kind of email about the same thing is sent at most once per NOTIFY_WINDOW_SEC (a burst of messages is one
 * email; everything is in the app anyway). The daily mail quota is respected (consumer Gmail ~100/day).
 * Turn it all off: Project Settings > Script properties > NOTIFY_OFF = 1.
 * Reads js/data.js from the public repo (raw.githubusercontent.com), no token needed. */
var SITE_URL = 'https://the-zenithway.github.io';
var DATA_JS_URL = 'https://raw.githubusercontent.com/the-zenithway/the-zenithway.github.io/main/js/data.js';
var NOTIFY_WINDOW_SEC = 600;

// Pure: which emails an append produces. dir = {students:{username:{name,email}}, teachers:{username:{name,email}}, classes:[{courseId,teachers,students}]}.
// Returns [{to, subject, body, key}]. (Kept free of Apps Script services so it can be tested in Node.)
function notifyPlan_(username, course, evs, dir) {
  var out = [], stu = (dir.students || {})[username] || {}, name = stu.name || username;
  var mentors = [];
  (dir.classes || []).forEach(function (c) {
    if (c.courseId !== course || (c.students || []).indexOf(username) < 0) return;
    (c.teachers || []).forEach(function (t) { var tt = (dir.teachers || {})[t]; if (tt && tt.email && mentors.every(function (m) { return m.email !== tt.email; })) mentors.push(tt); });
  });
  var tail = function (t, n) { t = String(t || '').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
  var cq = encodeURIComponent(course), uq = encodeURIComponent(username);
  var toMentors = function (subject, body, key, page) {
    mentors.forEach(function (m) { out.push({ to: m.email, subject: '[Zenith] ' + subject, body: body + '\n\nOpen it: ' + SITE_URL + '/teacher-student.html?student=' + uq + '&course=' + cq + (page ? '#' + page : ''), key: 'm:' + m.email + ':' + key }); });
  };
  var toStudent = function (subject, body, key, page) {
    if (!stu.email || (dir.selfStudy || {})[username]) return;
    out.push({ to: stu.email, subject: '[Zenith] ' + subject, body: body + '\n\nOpen it: ' + SITE_URL + '/' + page + (page.indexOf('?') < 0 ? '?' : '&') + 'course=' + cq, key: 's:' + stu.email + ':' + key });
  };
  var reported = {};
  evs.forEach(function (ev) { if (ev.type === 'msg' && /^task:/.test(ev.ref || '') && !ev.by) reported[ev.ref] = 1; });
  evs.forEach(function (ev) {
    if (!ev || ev.legacy) return;
    var mine = !ev.by; // student-authored; mentor events carry `by`
    if (ev.type === 'msg' && ev.from === 'student' && mine) {
      var files = (ev.files || []).length ? '\n(' + ev.files.length + ' photo' + (ev.files.length > 1 ? 's' : '') + ' attached)' : '', what = ev.refLabel ? ' (' + ev.refLabel + ')' : '';
      if (ev.kind === 'frqask') toMentors(name + ' asked for feedback on ' + (ev.refLabel || 'a free-response answer'), tail(ev.text, 500) + files, 'frq:' + username + ':' + (ev.ref || ''), 'work');
      else if (ev.kind === 'debrief') toMentors(name + ' asked for a debrief: ' + (ev.refLabel || 'a mock'), tail(ev.text, 500), 'deb:' + username + ':' + (ev.ref || ''), 'work');
      else if (ev.kind === 'proposal') toMentors(name + ' proposed a session', tail(ev.text, 500), 'prop:' + username, 'plan');
      else toMentors(name + ' wrote to you' + what, tail(ev.text, 500) + files, 'msg:' + username, 'talk');
    } else if (ev.type === 'task_done' && mine && !reported['task:' + ev.key]) {
      toMentors(name + ' marked a task done', 'Task id: ' + ev.key + '. No report was sent with it.', 'done:' + username + ':' + ev.key, 'talk');
    } else if (ev.type === 'msg' && ev.from === 'teacher' && ev.by) {
      var fb = ev.kind === 'feedback';
      toStudent(fb ? 'Mentor feedback' + (ev.refLabel ? ' on ' + ev.refLabel : '') : ev.kind === 'nudge' ? 'A nudge from your mentor' : 'A message from your mentor', tail(ev.text, 800), fb ? 'fb:' + (ev.ref || '') : 'msg:' + ev.kind, 'mentor.html');
    } else if (ev.type === 'task' && ev.by && !ev.deleted && ev.title) {
      toStudent((ev.forced ? 'Required task: ' : 'New task: ') + ev.title, (ev.instr ? tail(ev.instr, 500) + '\n\n' : '') + (ev.due ? 'Due ' + ev.due + (ev.dueTime ? ' ' + ev.dueTime : '') + '.\n' : '') + (ev.forced ? 'Your mentor marked this one required.' : 'Suggested by your mentor.'), 'task:' + ev.key, 'right-now.html');
    } else if (ev.type === 'cal_item' && ev.by && !ev.deleted && ev.title && String(ev.key || '').charAt(0) !== 'p') {
      toStudent('On your calendar: ' + ev.title, (ev.kind === 'mock' ? 'Mock exam' : ev.kind === 'todo' ? 'To-do' : 'Session') + ' on ' + (ev.date || '') + (ev.time ? ' at ' + ev.time : '') + '.', 'cal:' + ev.key, 'calendar.html');
    } else if (ev.type === 'prop_reply' && ev.by) {
      toStudent('Your proposed session was ' + (ev.status === 'accepted' ? 'accepted' : 'declined'), (ev.note ? tail(ev.note, 400) : (ev.status === 'accepted' ? 'It is on your calendar.' : 'Write to your mentor if you want to find another time.')), 'prop:' + ev.ref, 'calendar.html');
    }
  });
  return out;
}

// The people in js/data.js, reduced to what notifications need; cached for 10 minutes.
function directory_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('zp_dir');
  if (hit) return JSON.parse(hit);
  var src = UrlFetchApp.fetch(DATA_JS_URL, { muteHttpExceptions: true }).getContentText();
  var students = {}, teachers = {}, classes = [], selfStudy = {};
  readConstArray_(src, 'STUDENTS').forEach(function (s) { students[s.username] = { name: s.name || s.username, email: s.email || '' }; });
  readConstArray_(src, 'TEACHERS').forEach(function (t) { teachers[t.username] = { name: t.name || t.username, email: t.email || '' }; });
  readConstArray_(src, 'CLASSES').forEach(function (c) { classes.push({ courseId: c.courseId, teachers: c.teacherUsernames || [], students: c.studentUsernames || [] }); });
  try { // students listed as self-study in data/student-tracks.json have no mentor: no mentor emails to them
    var tr = JSON.parse(UrlFetchApp.fetch(DATA_JS_URL.replace('js/data.js', 'data/student-tracks.json'), { muteHttpExceptions: true }).getContentText());
    (tr.selfStudy || []).forEach(function (u) { selfStudy[u] = 1; });
  } catch (err) { /* no track file: rely on the class rosters */ }
  var dir = { students: students, teachers: teachers, classes: classes, selfStudy: selfStudy };
  cache.put('zp_dir', JSON.stringify(dir), 600);
  return dir;
}

// "const NAME = [ ... ];" out of a plain script file: finds the matching bracket (skipping strings and comments) and evaluates the literal.
function readConstArray_(source, name) {
  var m = new RegExp('(?:const|let|var)\\s+' + name + '\\s*=\\s*\\[').exec(source);
  if (!m) return [];
  var i = m.index + m[0].length - 1, depth = 0, q = '';
  for (var j = i; j < source.length; j++) {
    var ch = source.charAt(j), nx = source.charAt(j + 1);
    if (q) { if (ch === '\\') j++; else if (ch === q) q = ''; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { q = ch; continue; }
    if (ch === '/' && nx === '/') { while (j < source.length && source.charAt(j) !== '\n') j++; continue; }
    if (ch === '/' && nx === '*') { j = source.indexOf('*/', j + 2); if (j < 0) break; j++; continue; }
    if (ch === '[') depth++;
    else if (ch === ']' && --depth === 0) return eval('(' + source.slice(i, j + 1) + ')');
  }
  return [];
}

function notifyEvents_(username, course, evs) {
  if (!evs || !evs.length || PropertiesService.getScriptProperties().getProperty('NOTIFY_OFF')) return;
  var plan = notifyPlan_(username, course, evs, directory_());
  if (!plan.length) return;
  var cache = CacheService.getScriptCache();
  plan.forEach(function (m) {
    if (MailApp.getRemainingDailyQuota() < 5) return;
    var k = 'mail:' + Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, m.key)).slice(0, 22);
    if (cache.get(k)) return; // the same notification was just sent
    cache.put(k, '1', NOTIFY_WINDOW_SEC);
    try { MailApp.sendEmail({ to: m.to, subject: m.subject, body: m.body, name: 'Zenith' }); } catch (err) { /* one bad address must not stop the rest */ }
  });
}
