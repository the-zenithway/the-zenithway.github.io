/* Chapter practice, local attempts, and a transparent bank audit. */
(async function () {
  'use strict';
  requireLogin();
  const student = getCurrentStudent();
  if (!student) return;
  document.getElementById('logout-btn').addEventListener('click', logout);
  const host = document.getElementById('lab');
  const core = window.ZenithPractice;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const params = new URLSearchParams(location.search);
  const enrolled = (student.courses || []).filter(c => ['ap-calculus-bc','ap-chemistry'].includes(c.id));
  if (!enrolled.length) { host.innerHTML = '<h1>Practice Lab</h1><p>Your enrolled courses do not have C or T banks yet.</p><a href="portal.html">Back to courses</a>'; return; }
  let subject = enrolled.some(c => c.id === params.get('course')) ? params.get('course') : (enrolled.find(c => c.id === localStorage.getItem('activeCourseId')) || enrolled[0]).id;
  let tab = 'sets', kindFilter = 'all', auditFilter = 'all', search = '', problems = [], attempt = null, cursor = 0, results = false, includeIncomplete = false;
  let timerHandle;
  const storageKey = 'zenith:practice:v1:' + student.username;
  let saved = { attempts: [], active: null }, storageError = false;
  try { const raw = JSON.parse(localStorage.getItem(storageKey)); if (raw && Array.isArray(raw.attempts)) saved = raw; } catch (_) { storageError = true; }
  function persist() {
    try { localStorage.setItem(storageKey, JSON.stringify(saved)); storageError = false; }
    catch (_) { storageError = true; }
    const el = document.getElementById('save-state');
    if (el) el.textContent = storageError ? 'Storage unavailable — export before leaving.' : 'Saved in this browser · ' + student.name.split(' ')[0];
  }
  function button(label, action, cls = '', extra = '') { return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${label}</button>`; }
  function badges(q) { return q.issues.map(x => `<span class="badge warn">${esc(x)}</span>`).join(' '); }
  function renderMath() {
    if (window.renderMathInElement) window.renderMathInElement(host, {delimiters:[{left:'$$',right:'$$',display:true},{left:'\\[',right:'\\]',display:true},{left:'$',right:'$',display:false},{left:'\\(',right:'\\)',display:false}],throwOnError:false,trust:false});
  }
  async function load() {
    host.innerHTML = '<p role="status">Loading chapter banks…</p>';
    try {
      const prefix = subject === 'ap-calculus-bc' ? 'calculus' : 'chemistry';
      const banks = await Promise.all(['C','T'].map(async kind => {
        const response = await fetch(`data/${prefix}-${kind.toLowerCase()}-bank.json`, { cache: 'no-cache' });
        if (!response.ok) throw new Error('Bank request failed (' + response.status + ')');
        return core.normalize(await response.json(), subject, kind);
      }));
      problems = banks.flat();
      render();
    } catch (e) { host.innerHTML = `<h1>Could not load the banks</h1><p>${esc(e.message)}</p>${button('Try again','reload')}`; }
  }
  function heading() {
    return `<p class="eyebrow">Zenith / Practice Lab</p><h1>One chapter. Real progress.</h1><p class="intro muted">Work through a C grind at your own pace, or put yourself to the test in a timed T mock. Keep your working on paper; capture your answer and the idea here.</p>
    <div class="toolbar"><label>Course <select id="lab-course">${enrolled.map(c => `<option value="${esc(c.id)}" ${c.id === subject ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>${['sets','review','audit'].map(t => button({sets:'Chapter sets',review:'My attempts',audit:'Bank audit'}[t],'tab-' + t,tab === t ? 'active' : '')).join('')}<span class="save-status" id="save-state">${storageError ? 'Storage unavailable — export before leaving.' : 'Progress stays in this browser · ' + esc(student.name.split(' ')[0])}</span></div>`;
  }
  function groups() {
    const sets = new Map();
    problems.filter(q => kindFilter === 'all' || q.kind === kindFilter).forEach(q => { const key = q.chapter + q.kind; if (!sets.has(key)) sets.set(key, []); sets.get(key).push(q); });
    return [...sets.values()].sort((a,b) => Number(a[0].chapter)-Number(b[0].chapter) || a[0].kind.localeCompare(b[0].kind));
  }
  function setsView() {
    const usable = problems.filter(q => !q.blocked).length;
    const active = saved.active && saved.active.subject === subject ? saved.active : null;
    return `<div class="stats"><div class="stat"><strong>${problems.length}</strong><span>indexed problems</span></div><div class="stat"><strong>${usable}</strong><span>no blocking flags detected</span></div><div class="stat"><strong>${problems.filter(q => q.issues.length).length}</strong><span>with content notices</span></div></div>
    ${active ? `<div class="panel"><h3>Your unfinished ${active.kind === 'C' ? 'grind' : 'mock'}</h3><p>Chapter ${esc(active.chapter)} · ${Object.keys(active.answers).length}/${active.ids.length} answered${active.deadline ? ' · timer continues while away' : ''}</p>${button('Resume set','resume','primary')}</div>` : ''}
    <div class="toolbar"><label>Show <select id="lab-kind"><option value="all" ${kindFilter==='all'?'selected':''}>All sets</option><option value="C" ${kindFilter==='C'?'selected':''}>C · chapter grind</option><option value="T" ${kindFilter==='T'?'selected':''}>T · chapter mock</option></select></label><label class="switch"><input id="include-incomplete" type="checkbox" ${includeIncomplete?'checked':''}> Include flagged problems (ungraded)</label><label>T mock minutes <input id="mock-minutes" type="number" min="1" max="240" value="45" style="width:85px"></label></div>
    <p class="mode-note">Mock duration is your choice, not an official exam timing. Blank problems, blank choices, unusable keys, and suspected missing figures/formulas are excluded by default. Missing solutions remain visible. Nonempty text may still contain extraction errors.</p>
    ${subject === 'ap-chemistry' ? '<p class="warning">Chemistry C is not indexed yet. Its bank is empty; only T mocks are available.</p>' : `<p class="mode-note">${problems.filter(q => q.reviewed).length} of ${problems.length} Calculus problems have reviewed LaTeX and worked explanations. Ambiguous or defective source questions are flagged and ungraded.</p>`}
    <div class="sets">${groups().map(set => {
      const q = set[0], available = set.filter(p => !p.blocked).length, count = includeIncomplete ? set.length : available;
      return `<article class="set"><div class="set-top"><span class="set-number">CHAPTER ${esc(q.chapter)}${q.kind}</span><span class="badge">${q.kind === 'C' ? 'GRIND / UNTIMED' : 'MOCK / TIMED'}</span></div><h3>${esc(q.title)}</h3><p class="muted">${set.length} problems · ${available} without blocking flags<br>${set.filter(p => !p.solution).length} blank solutions · ${set.filter(p => p.blocked).length} need content checks</p><p class="question-id">${esc(set[0].id)} — ${esc(set.at(-1).id)}</p><div class="actions">${button(count ? `Start ${q.kind === 'C' ? 'grind' : 'mock'} →` : 'No usable problems','start','primary',`data-set="${q.chapter}${q.kind}" ${count ? '' : 'disabled'}`)}${button('Inspect bank','inspect','',`data-set="${q.chapter}${q.kind}"`)}</div></article>`;
    }).join('')}</div>`;
  }
  function auditView() {
    const rows = problems.filter(q => (auditFilter==='all' || q.chapter+q.kind===auditFilter) && (!search || [q.id,q.sourceId,q.title,...q.issues].join(' ').toLowerCase().includes(search.toLowerCase())));
    return `<h2>Know what’s in the bank.</h2><p class="muted">IDs read as chapter + C/T + problem label: <code>1CA1</code> = chapter 1, C, A1. T source IDs like T1 map to A1 (<code>1TA1</code>); originals are retained below. IDs are unique within a subject; exports include the subject too.</p><div class="toolbar"><input id="audit-search" class="audit-search" aria-label="Search bank audit" placeholder="Search ID, chapter, or issue…" value="${esc(search)}"><label>Set <select id="audit-set"><option value="all">All sets</option>${groups().map(g => `<option value="${g[0].chapter}${g[0].kind}" ${auditFilter===g[0].chapter+g[0].kind?'selected':''}>Chapter ${g[0].chapter}${g[0].kind}</option>`).join('')}</select></label>${button('Export audit JSON','export-audit')}</div><p class="muted">${rows.length} matching problems. “Present” means nonempty, not verified. Suspected gaps are heuristic warnings. Free responses are self-reviewed.</p><div class="table-wrap"><table><thead><tr><th>ID / source</th><th>Problem</th><th>Choices</th><th>Solution / key</th><th>Content notices</th></tr></thead><tbody>${rows.map(q => `<tr><td><strong>${esc(q.id)}</strong><br><span class="muted">Source ${esc(q.sourceId)}</span></td><td>${q.reviewed ? 'Source reviewed' : q.stem ? 'Present' : 'BLANK'}<br>${esc(q.title)}</td><td>${q.frq ? 'N/A · free response' : !q.choices.length ? 'MISSING' : q.choices.map((c,i)=>String.fromCharCode(65+i)+': '+(c?'present':'BLANK')).join('<br>')}</td><td>${q.solution ? 'Present' : 'BLANK solution'}<br>${q.correct ? 'Key present' : q.frq ? 'Self-review' : 'Key missing'}</td><td>${badges(q) || '<span class="muted">No automatic flags</span>'}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function attemptsView() {
    const list = saved.attempts.filter(a => a.subject === subject).slice().reverse();
    return `<h2>Your work, chapter by chapter.</h2><p class="muted">Attempts and notes are saved for this account in this browser. Export a copy to keep or share with your teacher. These attempts do not change roadmap status or submit work to a teacher.</p>${button('Export my progress','export-progress')}<div class="result-list">${list.length ? list.map(a=>`<div class="result-row"><div><strong>Chapter ${esc(a.chapter)}${a.kind} · ${a.kind==='C'?'Grind':'Mock'}</strong><br><span class="muted">${new Date(a.finished).toLocaleString()} · ${a.ids.length} problems</span></div>${button('Review attempt','review-attempt','',`data-id="${esc(a.uid)}"`)}</div>`).join('') : '<p class="empty">Finish your first chapter set to see it here.</p>'}</div>`;
  }
  function currentQuestions() { return attempt.ids.map(id => problems.find(q => q.id === id)).filter(Boolean); }
  function start(setKey) {
    if (saved.active && !confirm('Replace your unfinished set? Its current answers will be replaced.')) return;
    const all = problems.filter(q => q.chapter+q.kind === setKey);
    const qs = all.filter(q => includeIncomplete || !q.blocked);
    if (!qs.length) return;
    const minutesEl = document.getElementById('mock-minutes');
    const minutes = Number(minutesEl.value);
    if (all[0].kind === 'T' && (!Number.isFinite(minutes) || minutes<1 || minutes>240)) { minutesEl.reportValidity(); return; }
    attempt = {uid: Date.now().toString(36),subject,kind:all[0].kind,chapter:all[0].chapter,ids:qs.map(q=>q.id),answers:{},checked:{},flags:{},notes:{},started:Date.now(),deadline:all[0].kind==='T'?Date.now()+minutes*60000:null,cursor:0};
    saved.active = attempt; cursor=0; results=false; persist(); renderRunner();
  }
  function finish(auto = false) {
    if (!attempt || attempt.finished) return;
    if (!auto && !confirm(`Finish this set? ${attempt.ids.filter(id=>!attempt.answers[id]).length} problems unanswered. ${attempt.kind==='T'?'Answers and solutions will now unlock.':''}`)) return;
    attempt.finished=Date.now(); saved.attempts.push(attempt); saved.active=null; persist(); clearInterval(timerHandle); results=true; renderRunner();
  }
  function tick() {
    const el=document.getElementById('lab-timer');
    if (!attempt || attempt.finished || !attempt.deadline) return;
    const seconds=Math.max(0,Math.ceil((attempt.deadline-Date.now())/1000));
    if(el) el.textContent = Math.floor(seconds/60).toString().padStart(2,'0')+':'+(seconds%60).toString().padStart(2,'0');
    if (!seconds) finish(true);
  }
  function renderRunner() {
    clearInterval(timerHandle);
    const qs = currentQuestions();
    if (!qs.length) {attempt=null;render();return;}
    cursor=Math.max(0,Math.min(cursor,qs.length-1));
    const q=qs[cursor], answer=attempt.answers[q.id] || '', revealed=!!attempt.finished || (attempt.kind==='C' && attempt.checked[q.id]);
    const counts={correct:0,incorrect:0,unanswered:0,ungraded:0};
    qs.forEach(p=>counts[core.grade(p,attempt.answers[p.id])]++);
    host.innerHTML = `<div class="runner-top"><div>${button('← Chapter sets','leave')} <span class="badge">Chapter ${esc(attempt.chapter)}${attempt.kind} / ${attempt.kind==='C'?'Grind':'Mock'}</span></div><div class="actions">${attempt.deadline && !attempt.finished?'<span class="timer" id="lab-timer" role="timer"></span>':''}${attempt.finished?button(results?'Open questions':'Results',results?'show-questions':'show-results'):button('Finish set','finish','primary')}</div></div>
    ${results?`<div class="panel"><p class="eyebrow">Set complete</p><h1>${counts.correct} / ${counts.correct+counts.incorrect+counts.unanswered} correct</h1><p>${counts.incorrect} incorrect · ${counts.unanswered} unanswered · ${counts.ungraded} ungraded / content flagged / free response</p><p class="muted">Score uses bank keys, which have not been independently verified. Flagged content and free responses are excluded.</p>${button('Export this attempt','export-attempt')}<div class="result-list">${qs.map((p,i)=>`<div class="result-row"><div><strong>${esc(p.id)}</strong> <span class="badge">${core.grade(p,attempt.answers[p.id])}</span> ${attempt.flags[p.id]?'★':''}<br><span class="muted">${esc(attempt.notes[p.id] || '')}</span></div>${button('Review','jump','',`data-index="${i}"`)}</div>`).join('')}</div></div>`:
    `<div class="workspace"><aside class="panel"><p class="eyebrow">Question map</p><p class="muted">${Object.keys(attempt.answers).filter(id=>attempt.answers[id]).length} / ${qs.length} answered<br>Green = answered · dot = flagged</p><nav class="qnav" aria-label="Questions">${qs.map((p,i)=>button(String(i+1),'jump',`${i===cursor?'active':''} ${attempt.answers[p.id]?'answered':''} ${attempt.flags[p.id]?'flagged':''}`,`data-index="${i}" aria-label="Question ${i+1}, ${esc(p.id)}" ${i===cursor?'aria-current="true"':''}`)).join('')}</nav></aside><section class="panel"><div class="runner-top"><span class="question-id">${esc(q.id)} · ${cursor+1} of ${qs.length} · source ${esc(q.sourceId)}</span>${button(attempt.flags[q.id]?'★ Flagged':'☆ Mark for review','flag',attempt.flags[q.id]?'active':'',`aria-pressed="${!!attempt.flags[q.id]}"`)}</div>
    ${q.issues.length?`<div class="warning">${badges(q)}${q.blocked?'<br>This item is ungraded because its content needs checking.':''}</div>`:''}
    <div class="stem">${esc(q.stem || '[Blank problem — source content missing]')}</div>
    ${q.figure?`<figure><img src="${esc(q.figure.src)}" alt="${esc(q.figure.alt)}" style="max-width:100%;height:auto;background:white"></figure>`:''}
    ${q.frq?`<label for="frq-answer">Your answer (work on paper; summarize here)</label><textarea class="note" id="frq-answer" ${attempt.finished?'readonly':''}>${esc(answer)}</textarea>`:`<div class="choices">${q.choices.map((c,i)=>{const letter=String.fromCharCode(65+i);return button(`<span class="letter">${letter}</span><span>${esc(c || '[Blank choice — source content missing]')}</span>`,'answer','choice '+(answer===letter?'selected':''),`data-answer="${letter}" aria-pressed="${answer===letter}" ${attempt.finished || revealed || !c?'disabled':''}`);}).join('') || '<p class="warning">Choices missing from this bank.</p>'}</div>`}
    ${!attempt.finished && attempt.kind==='C' ? button(q.frq?'Reveal solution for self-review':'Check answer','check','primary',(!answer || revealed)?'disabled':'') : ''}
    ${q.sourceCorrection ? `<p class="mode-note">Source correction: ${esc(q.sourceCorrection)}</p>` : ''}
    ${revealed && q.sourceIssue ? `<p class="warning">${esc(q.sourceIssue)}</p>` : ''}
    ${revealed?`<div class="feedback" role="status"><strong>${q.frq?'Self-review':q.blocked?'Ungraded · source content needs checking':core.grade(q,answer)}</strong>${q.correct?'\nBank answer: '+esc(q.correct):''}\n\n${esc(q.solution || 'Blank solution — no worked explanation is included in this bank.')}</div>`:attempt.kind==='T'?'<p class="mode-note">Answers and solutions unlock when you finish the mock.</p>':''}
    <label for="idea-note">Idea note · What did you try? What will you notice next time?</label><textarea class="note" id="idea-note" maxlength="1600" placeholder="When I see ___, I try ___…">${esc(attempt.notes[q.id] || '')}</textarea><span class="save-status" id="save-state">${storageError?'Storage unavailable — export before leaving.':'Saved in this browser'}</span>
    <div class="question-foot">${button('← Previous','previous','',cursor===0?'disabled':'')}${button(cursor===qs.length-1?(attempt.finished?'See results':'Finish set'):'Next →',cursor===qs.length-1?(attempt.finished?'show-results':'finish'):'next','primary')}</div></section></div>`}`;
    renderMath();
    if (attempt.deadline && !attempt.finished) {tick();timerHandle=setInterval(tick,1000);}
  }
  function render() {
    clearInterval(timerHandle); attempt=null;
    host.innerHTML=heading()+(tab==='audit'?auditView():tab==='review'?attemptsView():setsView());
  }
  function download(name,data) {
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));
    const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  host.addEventListener('click',e=>{
    const b=e.target.closest('[data-action]');if(!b || b.disabled)return;
    const action=b.dataset.action;
    if (attempt && !attempt.finished && attempt.deadline && Date.now()>=attempt.deadline) {finish(true);return;}
    const q=attempt?currentQuestions()[cursor]:null;
    if(action.startsWith('tab-')){tab=action.slice(4);render();}
    else if(action==='reload')load();
    else if(action==='start')start(b.dataset.set);
    else if(action==='inspect'){kindFilter='all';auditFilter=b.dataset.set;search='';tab='audit';render();}
    else if(action==='resume'){attempt=saved.active;cursor=attempt.cursor || 0;results=false;renderRunner();}
    else if(action==='leave'){attempt=null;render();}
    else if(action==='answer'){attempt.answers[q.id]=b.dataset.answer;persist();renderRunner();}
    else if(action==='check'){attempt.checked[q.id]=true;persist();renderRunner();}
    else if(action==='flag'){attempt.flags[q.id]=!attempt.flags[q.id];persist();renderRunner();}
    else if(action==='finish')finish();
    else if(action==='next' || action==='previous' || action==='jump'){cursor=action==='jump'?Number(b.dataset.index):cursor+(action==='next'?1:-1);attempt.cursor=cursor;results=false;persist();renderRunner();}
    else if(action==='show-results'){results=true;renderRunner();}
    else if(action==='show-questions'){results=false;renderRunner();}
    else if(action==='review-attempt'){attempt=saved.attempts.find(a=>a.uid===b.dataset.id);cursor=0;results=true;renderRunner();}
    else if(action==='export-audit')download('zenith-'+subject+'-bank-audit.json',problems.map(({stem,choices,solution,correct,...p})=>({...p,problemBlank:!stem,blankChoices:choices.map((c,i)=>c?null:String.fromCharCode(65+i)).filter(Boolean),solutionBlank:!solution,keyPresent:!!correct})));
    else if(action==='export-progress')download('zenith-practice-progress.json',saved);
    else if(action==='export-attempt')download('zenith-'+attempt.subject+'-'+attempt.chapter+attempt.kind+'.json',attempt);
  });
  host.addEventListener('change',async e=>{
    if(e.target.id==='lab-course'){subject=e.target.value;kindFilter='all';auditFilter='all';search='';await load();}
    else if(e.target.id==='lab-kind'){kindFilter=e.target.value;render();}
    else if(e.target.id==='include-incomplete'){includeIncomplete=e.target.checked;}
    else if(e.target.id==='audit-set'){auditFilter=e.target.value;render();}
  });
  host.addEventListener('input',e=>{
    if(e.target.id==='audit-search'){search=e.target.value;const position=e.target.selectionStart;render();const input=document.getElementById('audit-search');input.focus();input.setSelectionRange(position,position);}
    if(attempt && ['idea-note','frq-answer'].includes(e.target.id)){
      if(!attempt.finished && attempt.deadline && Date.now()>=attempt.deadline){finish(true);return;}
      const q=currentQuestions()[cursor];
      if(e.target.id==='idea-note')attempt.notes[q.id]=e.target.value;
      else if(!attempt.finished)attempt.answers[q.id]=e.target.value;
      persist();
    }
  });
  window.addEventListener('load',renderMath);
  await load();
})();
