/* Mentor: the student <-> teacher line, shared by the student's Mentor page (mentor.html) and the teacher's student page.
 * Everything is an event in the student's own log (type msg, plus msg_read / prop_reply), so it syncs, shows in "view as student",
 * and drives the teacher's progress queue and the student's Right Now. Nothing here is required of a student: it is the place to drop
 * a photo of work, a question, a progress note, or a proposed session. */
(function (root) {
  'use strict';
  var MN = 'Mentor' + (root.ZENITH_MENTOR ? ' : ' + root.ZENITH_MENTOR : '');
  var ZP = root.ZP, UI = root.ZPUI, esc = UI.esc;
  var STUDENT_KINDS = [['message', 'Message'], ['photo', 'Photo of work'], ['progress', 'Progress update'], ['question', 'Question'], ['proposal', 'Propose a session']];
  var TEACHER_KINDS = [['message', 'Message'], ['nudge', 'Nudge'], ['motivation', 'Motivation'], ['advice', 'Advice'], ['resource', 'Resource'], ['feedback', 'Feedback']];
  var LABEL = { message: '', submission: 'Submission', photo: 'Photo', progress: 'Progress', question: 'Question', proposal: 'Session proposal', nudge: 'Nudge', motivation: 'Motivation', advice: 'Advice', resource: 'Resource', feedback: 'Feedback', frqask: 'Feedback request', debrief: 'Debrief request' };
  var MAX_PHOTOS = 6;

  function stamp(t) {
    var d = new Date(t), h = d.getHours(), m = d.getMinutes();
    return UI.fmtDate(t) + ', ' + ((h + 11) % 12 + 1) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'am' : 'pm');
  }
  function richText(s) {
    return esc(s || '').replace(/https?:\/\/[^\s<]+/g, function (u) { var clean = u.replace(/[.,;:!?)]+$/, ''), tail = u.slice(clean.length); return '<a href="' + clean + '" target="_blank" rel="noopener">' + clean + '</a>' + tail; }).replace(/\n/g, '<br>');
  }
  function filesHTML(files) {
    if (!files || !files.length) return '';
    return '<div class="zp-bubfiles">' + files.map(function (f) {
      var src = f.url || f.data || ''; if (!src) return '';
      return '<a href="' + esc(src) + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + esc(f.name || 'Photo') + '" loading="lazy"></a>';
    }).join('') + '</div>';
  }
  // An old-roadmap submission record: which chapter and unit, when, its status, then the answers and uploads behind a fold.
  function submissionHTML(m) {
    var sb = m.sub || {}, links = (sb.drive || []).map(function (u, i) { return '<a href="' + esc(u) + '" target="_blank" rel="noopener">Upload ' + (i + 1) + ' on Drive ↗</a>'; }).join(' · ');
    return '<div class="zp-subhead"><b>' + esc(sb.chapter || '') + (sb.unit ? ' · ' + esc(sb.unit) : '') + '</b>' + (sb.status ? ' <span class="zp-badge ' + (sb.status === 'Complete' ? 'ok' : 'warn') + '">' + esc(sb.status) + '</span>' : '') + '</div>' +
      (sb.answers ? '<details class="zp-more"><summary>Answers submitted</summary><pre class="zp-subpre">' + esc(sb.answers) + '</pre></details>' : '') +
      (sb.ocr ? '<details class="zp-more"><summary>Text read from the uploaded photos</summary><pre class="zp-subpre">' + esc(sb.ocr) + '</pre></details>' : '') + (links ? '<p>' + links + '</p>' : '');
  }
  function propStatus(D, m) {
    var p = D.props.filter(function (x) { return x.msg.id === m.id; })[0]; if (!p) return '';
    return '<div class="zp-propbox ' + p.status + '"><b>' + esc(m.prop && m.prop.title || 'Session') + '</b> · ' + esc(m.prop && m.prop.date || '') + (m.prop && m.prop.time ? ' ' + esc(m.prop.time) : '') + (m.prop && m.prop.len ? ' · ' + esc(m.prop.len) + ' min' : '') +
      '<span class="zp-badge ' + (p.status === 'accepted' ? 'ok' : p.status === 'declined' ? '' : 'warn') + '">' + (p.status === 'pending' ? 'Waiting for reply' : p.status === 'accepted' ? 'Accepted, on the calendar' : 'Declined') + '</span>' + (p.reply && p.reply.note ? '<br><span class="zp-muted">' + esc(p.reply.note) + '</span>' : '') + '</div>';
  }
  // me = who is looking: 'student' or 'teacher'. A bubble is "mine" when I wrote it.
  function bubble(m, D, me, extra) {
    var mine = (m.from === 'teacher') === (me === 'teacher'), lab = LABEL[m.kind] || '';
    var who = m.from === 'teacher' ? MN : 'Student';
    var refTxt = m.ref ? '<span class="zp-badge">About ' + esc(m.refLabel || String(m.ref).replace(/^entry:/, '')) + '</span> ' : '';
    // Feedback about a free-response answer: the student gets a link that opens the problem (or the mock it was in).
    var fr = m.ref && me === 'student' ? /^frq:([^:]+):(.+)$/.exec(String(m.ref)) : null;
    if (fr) {
      var cid = new URLSearchParams(location.search).get('course') || '';
      refTxt = '<a class="zp-badge zp-reflink" href="practice.html?course=' + encodeURIComponent(cid) + '&ret=' + encodeURIComponent('mentor.html?course=' + cid) + (fr[1] === 'p' ? '&q=' + encodeURIComponent(fr[2]) : '&r=' + encodeURIComponent(fr[1])) + '">About ' + esc(m.refLabel || fr[2]) + ' ↗ open the problem</a> ';
    }
    return '<div class="zp-bubrow ' + (mine ? 'me' : 'them') + '"><div class="zp-bub ' + (m.from === 'teacher' ? 'mentor' : 'student') + (m.kind === 'nudge' || m.kind === 'motivation' ? ' soft' : '') + '">' +
      '<div class="zp-bubmeta"><b>' + (mine ? 'You' : who) + '</b>' + (lab ? '<span class="zp-badge ' + (m.kind === 'feedback' ? 'ok' : 'warn') + '">' + lab + '</span>' : '') + (m.legacy ? '<span class="zp-badge">From the old roadmap</span>' : '') + '<span class="zp-muted">' + stamp(m.t) + '</span></div>' +
      refTxt + (m.kind === 'submission' ? submissionHTML(m) : '') + (m.text ? '<div class="zp-bubtext">' + richText(m.text) + '</div>' : '') + (m.url ? '<p><a class="zp-link" href="' + esc(m.url) + '" target="_blank" rel="noopener">' + esc(m.url.replace(/^https?:\/\//, '').slice(0, 60)) + ' ↗</a></p>' : '') +
      filesHTML(m.files) + (m.kind === 'proposal' ? propStatus(D, m) : '') + (extra || '') + '</div></div>';
  }
  // Newest on top. Messages are grouped under a heading per day; "older" at the bottom reveals the rest.
  function threadHTML(D, me, opts) {
    opts = opts || {};
    var list = D.msgs.slice(); if (opts.only) list = list.filter(opts.only);
    if (!list.length) return '<p class="zp-muted zp-threadempty">' + (me === 'student' ? 'Nothing here yet. Say hello, send a photo of your work, or ask something.' : 'No messages yet.') + '</p>';
    var shown = (opts.all ? list : list.slice(-40)).slice().reverse(), hidden = list.length - shown.length, html = '', day = '';
    shown.forEach(function (m) {
      var d = ZP.dayKey(m.t); if (d !== day) { day = d; html += '<h3 class="zp-agday">' + UI.fmtISO(d) + '</h3>'; }
      html += bubble(m, D, me, opts.extra ? opts.extra(m) : '');
    });
    if (hidden > 0) html += '<div class="zp-row"><button type="button" class="zp-btn" data-act="older">Show ' + hidden + ' older message' + (hidden > 1 ? 's' : '') + '</button></div>';
    return '<div class="zp-thread">' + html + '</div>';
  }

  /* ---------- photos ---------- */
  function readPhoto(file) {
    return typeof readImageAsCompressedBase64_ === 'function' ? readImageAsCompressedBase64_(file, 1400, 0.82) : Promise.reject(new Error('Photos are not available on this page.'));
  }
  // Uploaded to the repository by the writer script (action uploadPhotos in automation/zenith-data-writer.gs). With no endpoint
  // (testing locally) the compressed photo is kept inside the message instead, so it still shows up in this browser.
  function sendPhotos(photos) {
    if (!photos.length) return Promise.resolve([]);
    var local = function () { return photos.map(function (p) { return { data: 'data:' + p.mimeType + ';base64,' + p.dataBase64, name: p.filename }; }); };
    if (typeof TEACHER_DATA_WRITE_URL === 'undefined' || !TEACHER_DATA_WRITE_URL) return Promise.resolve(local());
    return fetch(TEACHER_DATA_WRITE_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify({ action: 'uploadPhotos', payload: { photos: photos } }) })
      .then(function (r) { return r.json(); }).then(function (res) {
        if (!res.ok || !res.urls) throw new Error(res.error || 'upload failed');
        return res.urls.map(function (u, i) { return { url: u, name: photos[i].filename }; });
      }).catch(function (e) {
        if (ZP.CFG.DATA_URL) throw e; // a synced log must not hold multi-hundred-KB photos: fail loudly instead
        return local();
      });
  }

  /* ---------- the student's page ---------- */
  function mount(host, ctx) {
    var student = ctx.student, course = ctx.course, store = ZP.open(student.username, course.id), D, kind = 'message', picked = [], sending = false, showAll = false;
    var mentors = typeof teachersForStudentCourse_ === 'function' ? teachersForStudentCourse_(student, course.id).map(function (t) { return t.name.replace(/\(.*\)/, '').trim(); }) : [];
    function derive() { D = ZP.derive(store.events(), { order: [], chapters: {} }); }
    function composer() {
      host.innerHTML =
        '<div class="zp-crumb"><span>' + esc(MN) + '</span>' + UI.saveStatus(store) + '</div><h1>' + esc(MN) + '</h1>' +
        '<p class="zp-muted">' + (mentors.length ? 'Your mentor: <b>' + esc(mentors.join(', ')) + '</b>. ' : '') + 'Everything here is optional. Send a photo of your work, ask a question, tell them how it is going, or propose a session. Replies appear below, and your mentor sees the same record.</p>' +
        '<div class="zp-twocol zp-mentorcols"><section class="zp-panel" id="zp-mcomp"><h2>Send something</h2>' +
        '<div class="zp-chips" role="group" aria-label="What are you sending">' + STUDENT_KINDS.map(function (k) { return '<button type="button" class="zp-chip' + (k[0] === kind ? ' on' : '') + '" data-kind="' + k[0] + '">' + k[1] + '</button>'; }).join('') + '</div>' +
        '<div id="zp-mprop" hidden class="zp-propform"><label class="zp-field"><span>What for?</span><input type="text" id="zp-pptitle" maxlength="100" placeholder="e.g. Go over my Chapter 5 test"></label>' +
        '<div class="zp-propgrid"><label class="zp-field"><span>Date</span><input type="date" id="zp-ppdate"></label><label class="zp-field"><span>Time</span><input type="time" id="zp-pptime"></label><label class="zp-field"><span>Minutes</span><input type="number" id="zp-pplen" min="15" max="240" step="15" value="60"></label></div></div>' +
        '<label class="zp-field"><span id="zp-mlabel"></span><textarea id="zp-mtext" class="zp-tex" rows="4" maxlength="3000"></textarea></label>' +
        '<div class="zp-photobox"><input type="file" id="zp-mfile" accept="image/*" multiple hidden><button type="button" class="zp-btn" data-act="pick">Add photos</button><span class="zp-muted" id="zp-mpicked"></span></div><div id="zp-mthumbs" class="zp-bubfiles"></div>' +
        '<div class="zp-row"><button type="button" class="zp-btn primary" data-act="send">Send</button><span class="zp-muted" id="zp-mmsg" role="status"></span></div></section>' +
        '<section class="zp-panel zp-howtext"><h2>What to use it for</h2><ul class="zp-signals"><li><b>Photo of work</b>: handwritten solutions, an Idea Notebook page, a test you took on paper.</li><li><b>Progress update</b>: where you are, what felt hard, what you finished.</li><li><b>Question</b>: anything you are stuck on. Add the problem code if you have one, like C5A12.</li><li><b>Propose a session</b>: pick a time. If your mentor accepts it, it lands on your calendar.</li></ul><p class="zp-muted">To write math, click the box: symbol buttons appear above it and a preview below. Your mentor replies here, not by email.</p></section></div>' +
        '<section class="zp-panel"><h2>Conversation</h2><div id="zp-mthread"></div></section>';
      setKind(kind); thread();
    }
    function setKind(k) {
      kind = k;
      Array.prototype.forEach.call(host.querySelectorAll('[data-kind]'), function (c) { c.classList.toggle('on', c.dataset.kind === k); });
      host.querySelector('#zp-mprop').hidden = k !== 'proposal';
      host.querySelector('#zp-mlabel').textContent = { message: 'Your message', photo: 'Say what the photo is (optional)', progress: 'How is it going?', question: 'Your question', proposal: 'Anything your mentor should know? (optional)' }[k];
    }
    function thread() {
      derive();
      host.querySelector('#zp-mthread').innerHTML = threadHTML(D, 'student', { all: showAll });
      UI.renderMath(host.querySelector('#zp-mthread'));
      if (D.unread.student.length) store.append('msg_read', { by: 'student', upTo: Date.now() });
    }
    function thumbs() {
      host.querySelector('#zp-mpicked').textContent = picked.length ? picked.length + ' photo' + (picked.length > 1 ? 's' : '') + ' ready' : '';
      host.querySelector('#zp-mthumbs').innerHTML = picked.map(function (p, i) { return '<span class="zp-thumb"><img src="data:' + p.mimeType + ';base64,' + p.dataBase64 + '" alt=""><button type="button" data-rm="' + i + '" aria-label="Remove photo">×</button></span>'; }).join('');
    }
    function say(t, bad) { var el = host.querySelector('#zp-mmsg'); el.textContent = t; el.style.color = bad ? 'var(--error)' : ''; }
    function send() {
      if (sending) return;
      var text = host.querySelector('#zp-mtext').value.trim(), data = { from: 'student', kind: kind, text: text };
      if (kind === 'proposal') {
        var title = host.querySelector('#zp-pptitle').value.trim(), date = host.querySelector('#zp-ppdate').value;
        if (!title || !date) return say('Add what it is for and a date.', true);
        data.prop = { title: title, date: date, time: host.querySelector('#zp-pptime').value, len: +host.querySelector('#zp-pplen').value || 60 };
      } else if (!text && !picked.length) return say('Write something or add a photo first.', true);
      if (kind === 'photo' && !picked.length) return say('Add at least one photo.', true);
      sending = true; say(picked.length ? 'Uploading photos…' : 'Sending…');
      sendPhotos(picked).then(function (files) {
        if (files.length) data.files = files;
        store.append('msg', data);
        host.querySelector('#zp-mtext').value = ''; host.querySelector('#zp-mtext').dispatchEvent(new Event('input'));
        picked = []; thumbs(); showAll = true; thread(); say(kind === 'proposal' ? 'Sent. You will see the reply here.' : 'Sent.');
      }).catch(function (e) { say('Could not send: ' + e.message + '. Nothing was lost; try again.', true); }).then(function () { sending = false; });
    }
    host.onclick = function (e) {
      var k = e.target.closest('[data-kind]'); if (k) return setKind(k.dataset.kind);
      var rm = e.target.closest('[data-rm]'); if (rm) { picked.splice(+rm.dataset.rm, 1); return thumbs(); }
      var b = e.target.closest('[data-act]'); if (!b) return;
      if (b.dataset.act === 'pick') host.querySelector('#zp-mfile').click();
      else if (b.dataset.act === 'send') send();
      else if (b.dataset.act === 'older') { showAll = true; thread(); }
    };
    host.onchange = function (e) {
      if (e.target.id !== 'zp-mfile') return;
      var files = Array.prototype.slice.call(e.target.files).slice(0, MAX_PHOTOS - picked.length); e.target.value = '';
      if (!files.length) return say('At most ' + MAX_PHOTOS + ' photos at a time.', true);
      say('Reading photos…');
      Promise.all(files.map(readPhoto)).then(function (ps) { picked = picked.concat(ps); thumbs(); say(''); }).catch(function (err) { say(err.message, true); });
    };
    composer();
    store.load().then(function () { thread(); });
    store.onChange(function () { var el = host.querySelector('.zp-sync'); if (el) el.outerHTML = UI.saveStatus(store); });
  }

  root.ZPMentor = { mount: mount, threadHTML: threadHTML, bubble: bubble, readPhoto: readPhoto, sendPhotos: sendPhotos, STUDENT_KINDS: STUDENT_KINDS, TEACHER_KINDS: TEACHER_KINDS, richText: richText, stamp: stamp, MAX_PHOTOS: MAX_PHOTOS, filesHTML: filesHTML };
})(window);
