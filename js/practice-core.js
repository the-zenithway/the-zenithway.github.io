/* Shared bank normalization; source banks stay unchanged. */
(function (root) {
  'use strict';
  const text = value => typeof value === 'string' ? value.trim() : '';
  function normalize(bank, subject, kind) {
    return Object.entries(bank).flatMap(([chapter, set]) => (set.problems || []).map((p, index) => {
      const sourceId = String(p.id || index + 1);
      const suffix = kind === 'T' && /^T\d+$/.test(sourceId) ? 'A' + sourceId.slice(1) : kind === 'T' && /^TB\d+$/.test(sourceId) ? sourceId.slice(1) : sourceId;
      const id = chapter + kind + suffix;
      const stem = text(p.stem_tex ?? p.stem);
      const choices = (p.choices_tex ?? p.choices ?? []).map(text);
      const solution = text(p.explanation_tex ?? p.explanation);
      const correct = text(p.correct !== undefined ? p.correct : (set.answer_key || {})[sourceId]).toUpperCase();
      const frq = set.type === 'frq';
      const reviewed = p.review_status === 'source-reviewed';
      const figure = p.figure && /^data\/calculus-figures\/[a-z0-9-]+\.(png|svg)$/.test(p.figure.src)
        ? { src: p.figure.src, alt: text(p.figure.alt) } : null;
      const issues = [];
      if (p.source_issue) issues.push('Source problem has no unique valid answer');
      if (!stem) issues.push('Blank problem');
      if (!frq && !choices.length) issues.push('Missing choices');
      choices.forEach((c, i) => { if (!c) issues.push('Blank choice ' + String.fromCharCode(65 + i)); });
      if (!solution) issues.push('Blank solution');
      if (!frq && (!/^[A-Z]$/.test(correct) || !choices[correct.charCodeAt(0) - 65])) issues.push('Missing or unusable answer key');
      // Heuristics are warnings, never assertions that a nonempty source is complete.
      if (!reviewed && !figure && /\b(?:domain|range|derivative|integral|graph) of\s+(?:is|equals)\b|\b(?:shown|pictured|figure|diagram|graph below)\b/i.test(stem)) issues.push('Possible missing formula or figure');
      const blocked = !!p.source_issue || !stem || (!frq && (!choices.length || choices.some(c => !c) || !/^[A-Z]$/.test(correct) || !choices[correct.charCodeAt(0) - 65])) || issues.includes('Possible missing formula or figure');
      return { id, key: subject + ':' + id, sourceId, subject, kind, chapter, title: set.title || 'Chapter ' + chapter, stem, choices, solution, correct, frq, figure, reviewed, sourceCorrection: text(p.source_correction), sourceIssue: text(p.source_issue), issues, blocked, tex: p.stem_tex !== undefined };
    }));
  }
  function grade(q, answer) {
    if (q.blocked || q.frq || !q.correct) return 'ungraded';
    if (!answer) return 'unanswered';
    return answer === q.correct ? 'correct' : 'incorrect';
  }
  const api = { normalize, grade };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ZenithPractice = api;
})(typeof window === 'undefined' ? globalThis : window);
