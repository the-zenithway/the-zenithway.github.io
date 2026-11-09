/* LaTeX helper for every note box: a row of insert buttons above the text, and a live preview below.
 * It attaches itself to the note textareas (entries, concept and summary boxes, rules, free-response answers, messages) and to any
 * textarea given class "zp-tex", including ones that appear later when a page re-draws.
 *
 * The buttons put the right LaTeX in at the cursor. If the cursor is outside a $...$ pair they wrap the snippet in $ ... $ for you,
 * so nobody has to remember the dollar signs. The preview shows the typeset result as you type. */
(function (root) {
  'use strict';
  var SEL = 'textarea[data-nf], textarea[data-text], textarea[data-line], textarea.zp-tex, #zp-summary, #zp-rule, #zp-crecall, #zp-frq, #zp-rd';
  // [label shown, snippet, title]. "|" marks where the cursor goes (or where a selected piece of text is put).
  var KEYS = [
    ['a⁄b', '\\frac{|}{}', 'Fraction'], ['√', '\\sqrt{|}', 'Square root'], ['x²', '^{|}', 'Power / exponent'], ['xₙ', '_{|}', 'Subscript'],
    ['∫', '\\int_{a}^{b} | \\, dx', 'Integral'], ['lim', '\\lim_{x \\to |}', 'Limit'], ['Σ', '\\sum_{n=1}^{\\infty} |', 'Sum'], ['d/dx', '\\frac{d}{dx}|', 'Derivative'],
    ['f′', "f'(x)", 'f prime'], ['|x|', '\\left| | \\right|', 'Absolute value'], ['( )', '\\left( | \\right)', 'Brackets'],
    ['π', '\\pi', 'pi'], ['θ', '\\theta', 'theta'], ['∞', '\\infty', 'infinity'], ['≤', '\\le', 'less or equal'], ['≥', '\\ge', 'greater or equal'], ['≠', '\\ne', 'not equal'],
    ['±', '\\pm', 'plus or minus'], ['→', '\\to', 'arrow'], ['·', '\\cdot', 'dot'],
    ['sin', '\\sin(|)', 'sine'], ['cos', '\\cos(|)', 'cosine'], ['ln', '\\ln(|)', 'natural log'], ['eˣ', 'e^{|}', 'e to a power']
  ];

  function esc(v) { return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function insideMath(text, pos) {
    // Count unescaped $ before the cursor: odd means we are inside a math pair.
    var n = 0, s = text.slice(0, pos);
    for (var i = 0; i < s.length; i++) { if (s[i] === '\\') { i++; continue; } if (s[i] === '$') n++; }
    return n % 2 === 1;
  }
  function put(ta, text, caretBack) {
    ta.focus();
    var done = false;
    try { done = document.execCommand('insertText', false, text); } catch (e) { done = false; }
    if (!done) { var s = ta.selectionStart; ta.setRangeText(text, s, ta.selectionEnd, 'end'); }
    if (caretBack) { var p = ta.selectionStart - caretBack; ta.setSelectionRange(p, p); }
    ta.dispatchEvent(new Event('input', { bubbles: true })); ta.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function insertSnippet(ta, snippet, forceWrap) {
    var a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b), at = snippet.indexOf('|'), out, back;
    if (at >= 0) { out = snippet.slice(0, at) + sel + snippet.slice(at + 1); back = sel ? 0 : out.length - at; } else { out = snippet; back = 0; }
    var needWrap = forceWrap !== false && !insideMath(ta.value, a);
    if (needWrap) { out = '$' + out + '$'; back = back ? back + 1 : 1; }
    put(ta, out, sel ? 0 : back);
  }
  function wrapDollar(ta, display) {
    var a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b), d = display ? '$$' : '$';
    put(ta, d + sel + d, sel ? 0 : d.length);
  }

  function bar(ta) {
    var el = document.createElement('div'); el.className = 'zp-texbar'; el.setAttribute('role', 'toolbar'); el.setAttribute('aria-label', 'Math symbols');
    el.innerHTML = '<button type="button" class="zp-texkey wide" data-tex="inline" title="Math on this line: $ ... $">$ math $</button><button type="button" class="zp-texkey wide" data-tex="display" title="Math on its own line: $$ ... $$">$$ block $$</button>' +
      KEYS.map(function (k, i) { return '<button type="button" class="zp-texkey" data-tex="' + i + '" title="' + esc(k[2]) + '" aria-label="' + esc(k[2]) + '">' + esc(k[0]) + '</button>'; }).join('') +
      '<details class="zp-texhelp"><summary>?</summary><div><p><b>Math goes between dollar signs.</b> The buttons add them for you.</p><p><code>$x^2 + 1$</code> → x² + 1 · <code>$\\frac{a}{b}$</code> → a⁄b · <code>$\\int_0^1 x\\,dx$</code> → ∫</p><p>Press a button while the cursor is in your text and the symbol appears there. Select some text first and the button wraps it. The preview under the box shows how it will look.</p></div></details>';
    el.addEventListener('mousedown', function (e) { if (e.target.closest('.zp-texkey')) e.preventDefault(); });
    el.addEventListener('click', function (e) {
      var b = e.target.closest('.zp-texkey'); if (!b) return;
      var k = b.dataset.tex;
      if (k === 'inline') wrapDollar(ta, false); else if (k === 'display') wrapDollar(ta, true); else insertSnippet(ta, KEYS[+k][1]);
    });
    return el;
  }
  function preview(ta) {
    var el = document.createElement('div'); el.className = 'zp-texprev'; el.hidden = true; el.setAttribute('aria-live', 'polite');
    var timer = 0;
    function draw() {
      var v = ta.value;
      if (!/\$|\\\(|\\\[/.test(v)) { el.hidden = true; el.innerHTML = ''; return; }
      el.hidden = false; el.innerHTML = '<span class="zp-texlabel">Preview</span><div class="zp-texbody">' + esc(v).replace(/\n/g, '<br>') + '</div>';
      if (root.ZPUI) root.ZPUI.renderMath(el.querySelector('.zp-texbody'));
    }
    var cnt = null;
    function count() {
      var need = +ta.dataset.minwords; if (!need || !root.ZP) return;
      if (!cnt) { cnt = document.createElement('div'); cnt.className = 'zp-texcount'; ta.parentNode.insertBefore(cnt, ta.nextSibling); }
      var n = root.ZP.words(ta.value); cnt.textContent = n + ' / ' + need + ' words'; cnt.classList.toggle('ok', n >= need);
    }
    ta.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(draw, 120); count(); });
    count();
    ta.addEventListener('zp-redraw', draw);
    draw(); setTimeout(draw, 400); // once more after KaTeX has had time to load
    return el;
  }
  function enhance(ta) {
    if (!ta || ta.dataset.texd || ta.readOnly || ta.disabled || ta.classList.contains('zp-digest')) return;
    ta.dataset.texd = '1';
    ta.parentNode.insertBefore(bar(ta), ta);
    ta.parentNode.insertBefore(preview(ta), ta.nextSibling);
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches && node.matches(SEL)) enhance(node);
    if (node.querySelectorAll) Array.prototype.forEach.call(node.querySelectorAll(SEL), enhance);
  }
  function init() {
    scan(document.body);
    new MutationObserver(function (list) { list.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, scan); }); }).observe(document.body, { childList: true, subtree: true });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();

  root.ZPTex = { enhance: enhance, scan: scan, insertSnippet: insertSnippet, KEYS: KEYS, insideMath: insideMath };
})(window);
