/* A free-response answer the student can hand in: typed text (LaTeX works) and/or photos of their work, saved as a `frq_ans` event, and an
 * "Ask for feedback" button that tells the mentor (Mentor Desk queue, student page > Work). The mentor scores it and writes back in the
 * Mentor thread; that score is final and becomes the problem's score (see js/zp-store.js). Not shown to self-study students, who have no
 * mentor: they keep scoring themselves.
 *
 *   ZPFrqAns.panelHTML(D, {aid, pid, ch, textId, text})   '' for self-study; aid '' = a practice problem, else the mock's submission id
 *   ZPFrqAns.bind(host, {store, derive, onChange})        wire every panel inside host (once per host, callbacks replaceable)
 */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, esc = UI.esc;

  function key(aid, pid) { return (aid || '') + '|' + pid; }
  function allowed(D) { return !!D && !(D.info && D.info.selfStudy); }

  function statusHTML(D, o) {
    var k = key(o.aid, o.pid), ask = D.frqAsk[k], ref = ZP.frqRef(o.aid, o.pid);
    if (!ask) return '';
    if (ask.status === 'waiting') return '<p class="zp-result"><b>Sent to ' + esc(UI.mentorName()) + '.</b> <span class="zp-muted">You will see the score and feedback here and in the Mentor page.</span></p>';
    return '<p class="zp-result good"><b>' + esc(UI.mentorName()) + ' answered' + (ask.score != null ? ': ' + ask.score + ' / ' + (ask.max || 9) : '') + '.</b></p>' + UI.mentorFeedbackHTML(D, ref);
  }
  function panelHTML(D, o) {
    if (!allowed(D)) return '';
    var k = key(o.aid, o.pid), a = D.frqAns[k] || null, images = a ? a.images : [], text = o.text ? o.text : (a ? a.text : ''), ask = D.frqAsk[k];
    var waiting = ask && ask.status === 'waiting';
    return '<div class="zp-frqans" data-cp="' + esc(k) + '" data-aid="' + esc(o.aid || '') + '" data-pid="' + esc(o.pid) + '" data-ch="' + esc(o.ch || '') + '" data-where="' + esc(o.where || '') + '">' +
      '<label class="zp-field"><span>Your answer: type it (LaTeX works) and/or attach a photo of your work</span><textarea' + (o.textId ? ' id="' + esc(o.textId) + '"' : '') + ' class="zp-tex" data-frqtext rows="4" maxlength="4000" placeholder="e.g. $\\int_0^2 f(x)\\,dx = \\dots$">' + esc(text) + '</textarea></label>' +
      root.ZPPhotos.controlsHTML(images) +
      '<div class="zp-row"><button type="button" class="zp-btn' + (waiting ? '' : ' primary') + '" data-act="frqask"' + (waiting ? ' disabled' : '') + '>' + (waiting ? 'Waiting for feedback' : ask ? 'Ask again with this answer' : 'Ask ' + esc(UI.mentorName()) + ' for feedback') + '</button>' +
      '<span class="zp-muted" data-frqmsg role="status">Attach a photo or type your work first, so there is something to give feedback on.</span></div>' + statusHTML(D, o) + '</div>';
  }

  function bind(host, cb) {
    host.__zpFrqCb = cb;
    if (host.__zpFrqBound) return;
    host.__zpFrqBound = true;
    function panelOf(el) { return el.closest && el.closest('.zp-frqans'); }
    function cur(panel) {
      var c = host.__zpFrqCb, D = c.derive(), k = panel.dataset.cp, a = D.frqAns[k];
      return { D: D, k: k, images: a ? a.images : [], text: (panel.querySelector('[data-frqtext]') || {}).value || '' };
    }
    function save(panel, images, text, ask) {
      var c = host.__zpFrqCb;
      c.store.append('frq_ans', { aid: panel.dataset.aid, pid: panel.dataset.pid, ch: panel.dataset.ch, text: text, images: images, ask: !!ask });
      // Every ask is also a message in the Mentor thread, with the answer and photos, so the whole conversation lives in one place.
      if (ask) {
        var Q = (root.ZPBank || {})[panel.dataset.pid], code = Q ? Q.code : panel.dataset.pid, where = panel.dataset.aid ? (panel.dataset.where || 'a mock') : 'practice';
        c.store.append('msg', { from: 'student', kind: 'frqask', text: 'Asked for feedback on ' + code + ' (' + where + ').' + (text.trim() ? '\n\n' + text.trim() : ''), files: images, ref: ZP.frqRef(panel.dataset.aid, panel.dataset.pid), refLabel: code, pid: panel.dataset.pid });
      }
      if (c.onChange) c.onChange();
    }
    // Photos: the shared photo helper does the picking and upload; this stores the result with the answer.
    root.ZPPhotos.bind(host, { images: function (card) { return card.classList.contains('zp-frqans') ? cur(card).images : []; },
      save: function (card, images) { if (card.classList.contains('zp-frqans')) save(card, images, cur(card).text, false); } });
    host.addEventListener('change', function (e) {
      var ta = e.target.closest && e.target.closest('[data-frqtext]'); if (!ta) return;
      var p = panelOf(ta); if (!p) return; var s = cur(p); if (s.text !== ((s.D.frqAns[s.k] || {}).text || '')) save(p, s.images, s.text, false);
    });
    host.addEventListener('click', function (e) {
      var b = e.target.closest && e.target.closest('[data-act="frqask"]'); if (!b || b.disabled) return;
      var p = panelOf(b); if (!p) return; var s = cur(p), msg = p.querySelector('[data-frqmsg]');
      if (!s.text.trim() && !s.images.length) { if (msg) msg.textContent = 'Type your answer or attach a photo first.'; return; }
      save(p, s.images, s.text, true);
    });
  }

  root.ZPFrqAns = { panelHTML: panelHTML, bind: bind, statusHTML: statusHTML };
})(window);
