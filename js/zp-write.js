/* The "write your entries" screen. One component, three scopes:
 *   R          a chapter's flagged C problems            (chapter.html#r)
 *   R (test)   a chapter test's misses + anything flagged (chapter.html#rt)
 *   Inbox      everything still waiting                   (notebook.html?view=inbox)
 * Every flagged problem needs an entry: pick Careless or Actual, write it. Careless goes to the review
 * queue only; Actual goes to the Idea Notebook and the review queue. There is no skip: unflagging is the way out. */
(function (root) {
  'use strict';
  var ZP = root.ZP, UI = root.ZPUI, esc = UI.esc;

  // opts: {host, store, data, derive(), scope(pid)->bool, order(pid)->number, src ('C'|'T'|...), chOf(pid), noun, addable(D)->pid[], addTitle,
  //        emptyTitle, emptyBody, doneHTML, pid (open this one), onChange(), pendingOnly}
  function mount(opts) {
    var host = opts.host, store = opts.store, data = opts.data, D, open = opts.pid || '';
    function chOf(pid) { return opts.chOf ? opts.chOf(pid) : (data.byId[pid] ? data.byId[pid].chapter : ''); }
    function entries() {
      D = opts.derive();
      var list = Object.keys(D.entries).map(function (k) { return D.entries[k]; }).filter(function (e) { return data.byId[e.pid] && opts.scope(e.pid); });
      list.sort(function (a, b) { return (opts.order ? opts.order(a.pid) - opts.order(b.pid) : 0) || a.pid.localeCompare(b.pid, undefined, { numeric: true }); });
      return list;
    }
    function badge(e) {
      if (e.pending) return '<span class="zp-badge warn">Needs entry</span>';
      return '<span class="zp-badge ' + (e.track === 'actual' ? 'ok' : '') + '">' + esc(UI.ETYPE[e.track] || 'Written') + '</span>';
    }
    var REASON = { wrong: 'Missed', flag: 'You flagged it', note: 'Your note' };
    function wrongAttempt(pid) {
      var r = D.q[pid]; if (!r) return null;
      for (var i = r.attempts.length - 1; i >= 0; i--) if (r.attempts[i].correct === false && ['chapter', 'practice', 'test', 'customtest', 'mock'].indexOf(r.attempts[i].ctx) >= 0) return r.attempts[i];
      return r.attempts.filter(function (a) { return ['chapter', 'practice', 'test', 'customtest', 'mock'].indexOf(a.ctx) >= 0; }).pop() || null;
    }
    function detail(e) {
      var Q = data.byId[e.pid], a = wrongAttempt(e.pid);
      var mine = '';
      if (a) mine = '<p class="zp-muted">Your answer: <b>' + esc(a.answer || (a.correct === false ? '(none)' : '')) + '</b>' + (a.ms ? ' · ' + Math.round(a.ms / 1000) + 's' : '') + ' · ' + esc(UI.CTX[a.ctx] || a.ctx) + '</p>';
      var choices = Q.frq ? '' : UI.choicesHTML(Q, { selected: a ? a.answer : '', correct: Q.correct, reveal: true, locked: true });
      return '<div class="zp-panel"><p class="zp-label">' + UI.codeBadge(Q) + ' ' + badge(e) + ' <span class="zp-muted">' + e.reasons.map(function (r) { return REASON[r] || r; }).join(', ') + '</span></p>' +
        UI.stemHTML(Q) + choices + mine + UI.solutionHTML(Q) + '</div>' + UI.mentorFeedbackHTML(D, 'entry:' + e.pid) +
        '<div class="zp-panel"><h3>Your entry</h3>' + UI.entryFormHTML(e.pid, e.note, UI.ownOf(D, e.pid, chOf(e.pid))) +
        '<div class="zp-row">' + UI.btn(e.pending ? 'Save entry' : 'Update entry', 'wsave', 'primary', 'data-pid="' + esc(e.pid) + '"') + '</div></div>' +
        '<div class="zp-panel">' + UI.toolsHTML(D, e.pid) + '</div>';
    }
    function nextPending(list, after) {
      var pend = list.filter(function (e) { return e.pending; });
      var later = pend.filter(function (e) { return list.indexOf(e) > list.findIndex(function (x) { return x.pid === after; }); })[0];
      return (later || pend[0] || {}).pid || '';
    }
    function render() {
      var list = entries(), pend = list.filter(function (e) { return e.pending; }).length, done = list.length - pend;
      if (!open || !list.some(function (e) { return e.pid === open; })) open = (list.filter(function (e) { return e.pending; })[0] || list[0] || {}).pid || '';
      var rows = list.map(function (e) {
        var Q = data.byId[e.pid];
        return '<button type="button" class="zp-row-item' + (e.pid === open ? ' cur' : '') + '" data-act="wopen" data-pid="' + esc(e.pid) + '">' + badge(e) + '<span>' + UI.codeBadge(Q) + ' ' + esc(UI.shortStem(Q, 64)) + '</span></button>';
      }).join('');
      var add = opts.addable ? opts.addable(D) : [];
      var addHTML = add.length ? '<details class="zp-panel"><summary><b>' + esc(opts.addTitle || 'Also flag one you got right') + ' (' + add.length + ')</b> <span class="zp-muted">for a guess, or an idea worth keeping</span></summary>' +
        add.map(function (id) { return '<div class="zp-rightrow"><span>' + UI.codeBadge(data.byId[id]) + ' ' + esc(UI.shortStem(data.byId[id], 80)) + '</span><button type="button" class="zp-btn" data-qt="flag" data-pid="' + esc(id) + '">Flag</button></div>'; }).join('') + '</details>' : '';
      var head = '<div class="zp-runbar"><h1>' + esc(opts.title || 'Write your entries') + '</h1><span class="zp-prog">' + (opts.pendingOnly ? pend + ' to write' : done + ' / ' + list.length + ' written') + '</span></div>' +
        (opts.intro ? '<p class="zp-muted">' + opts.intro + '</p>' : '');
      if (!list.length) {
        host.innerHTML = head + UI.emptyState(opts.emptyTitle || 'Nothing to write', opts.emptyBody || 'Wrong answers and anything you flag show up here.') + addHTML + (opts.doneHTML || '');
        UI.renderMath(host); return;
      }
      host.innerHTML = head + '<div class="zp-runbody wide"><aside class="zp-panel zp-list zp-sticky">' + rows + '</aside><section id="zp-wdetail">' + detail(D.entries[open]) + '</section></div>' + addHTML +
        (pend === 0 && opts.doneHTML ? opts.doneHTML : '');
      UI.initEntryForms(host); UI.renderMath(host);
    }
    host.onclick = function (ev) {
      var b = ev.target.closest('[data-act]'); if (!b || b.disabled) return;
      if (b.dataset.act === 'wopen') { open = b.dataset.pid; render(); var d = document.getElementById('zp-wdetail'); if (d && d.getBoundingClientRect().top < 0) d.scrollIntoView({ block: 'start' }); }
      else if (b.dataset.act === 'wsave') {
        var form = host.querySelector('.zp-entryform'), pid = b.dataset.pid, r = UI.readEntryForm(form, D.entries[pid] ? D.entries[pid].src : opts.src || 'C');
        if (!r.ok) return;
        r.data.ch = chOf(pid); store.append('note', r.data); UI.applyOwn(store, D, pid, r.data.ch, r.own);
        var list = entries(); open = nextPending(list, pid) || pid; render();
        if (opts.onChange) opts.onChange();
      }
    };
    UI.bindEntryForms(host);
    UI.bindTools(host, { store: store, derive: opts.derive, chOf: chOf, rerender: function () { render(); if (opts.onChange) opts.onChange(); } });
    render();
    return { render: render };
  }

  root.ZPWrite = { mount: mount };
})(window);
