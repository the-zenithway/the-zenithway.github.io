/*
  LANGUAGE TOGGLE (EN / KO)
  --------------------------
  Scoped to two pages only, not a site-wide i18n system:
    - resources.html — static markup, translated by swapping the text
      of every [data-i18n="key"] element using RESOURCES_KO below.
      English is never duplicated here: the first time
      applyResourcesLanguage() runs, it reads each element's current
      (English) text into data-i18n-en, then swaps between that and
      RESOURCES_KO[key] on every toggle.
    - parent.html — content is built dynamically from student data
      (see renderParentDashboard()/parentCourseCardHtml() in
      js/app.js), so it takes a lang argument and re-renders instead.

  To add a new translated string on resources.html: wrap the text in
  a <span data-i18n="some-key">, then add "some-key": "..." to
  RESOURCES_KO. Nothing else changes automatically — this does not
  translate new pages on its own.

  Preference is remembered per-browser (localStorage), not per-page.
*/

const LANG_KEY = "zenithLang";

function getLang() {
  return localStorage.getItem(LANG_KEY) === "ko" ? "ko" : "en";
}

// Injects a small EN/한국어 toggle button into the given (already
// mounted) container and wires it up. Calls onChange once immediately
// with the current stored language, so the page reflects a returning
// visitor's choice on load, and again on every click.
function renderLangToggle(containerId, onChange) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "lang-toggle-btn";
  container.appendChild(btn);

  function paint(lang) {
    btn.textContent = lang === "ko" ? "EN" : "한국어";
    btn.setAttribute("aria-label", lang === "ko" ? "Switch to English" : "한국어로 보기");
  }

  btn.addEventListener("click", function () {
    const next = getLang() === "ko" ? "en" : "ko";
    localStorage.setItem(LANG_KEY, next);
    paint(next);
    onChange(next);
  });

  const initial = getLang();
  paint(initial);
  onChange(initial);
}

// ---- resources.html ----
// Keyed by each translatable element's data-i18n value. Titles/brand
// names (e.g. "Erica Meltzer SAT Reading", "Khan Academy") are left
// in English on purpose — they're proper nouns/product names, not
// prose, and a parent searching for the book wants the English title.
const RESOURCES_KO = {
  "page-title": "자료",
  "intro": "아래는 누구나 이용할 수 있어야 한다고 생각하는 자료들입니다. 새로운 자료에 대한 아이디어가 있으시면 (예: Barron's AP World History 자료가 있는지 등) 하단의 링크를 통해 언제든 문의해 주세요. 원하시는 자료를 항상 구해드릴 수는 없지만, 최소한 찾아보도록 노력하겠습니다.",

  "sat-bluebook-desc": "College Board는 2026년 7월 기준 11개의 모의고사를 제공합니다. 이 모의고사들은 실제 시험을 준비하는 데 가장 좋은 자료이며, 실제 시험 당일의 모습과 거의 100% 동일합니다.",
  "sat-khan-desc": "SAT를 준비하는 가장 좋은 방법 중 하나입니다. College Board와 공식 제휴를 맺고 있어 실제 SAT에서 사용된 문제들을 연습할 수 있습니다.",
  "sat-barrons-desc": "SAT의 모든 영역을 다루는 종합 준비서입니다. 여러 개의 모의고사가 포함되어 있습니다.",
  "sat-meltzer-reading-desc": "SAT 독해 영역을 위한 최고의 책입니다. 내용이 포괄적이고 좋은 연습 문제가 많으며 잘 쓰여져 있습니다. SAT 리딩 분야에서 그럴 만한 이유로 부동의 베스트셀러입니다.",
  "sat-meltzer-grammar-desc": "사실 직접 다 풀어보지는 못했습니다. SAT Writing & Language를 위한 집중 연습과 전략을 제공합니다.",
  "sat-bluebook-grammar-desc": "SAT 문법에서 만점을 받는 데 필요한 수준을 넘어서는 내용도 있지만, 헷갈리는 문법 문제들을 이보다 더 잘 다룬 책은 읽어본 적이 없습니다.",
  "sat-wordsmart1-desc": "SAT를 위한 최고의 어휘책입니다. SAT 수준을 넘어설 수도 있습니다.",
  "sat-wordsmart2-desc": "베스트셀러 어휘책 Word Smart의 후속작입니다.",
  "sat-qbank-desc": "College Board의 공식 SAT 문제 데이터베이스입니다. 영어(리딩/문법) 영역에 약 1,700개의 문제가 있으며, 세부 카테고리와 정답 해설이 함께 제공됩니다.",

  "ap-frqs-desc": "모든 AP 과목의 기출 서술형(FRQ) 문제를 모아 주제별로 정리한 자료입니다.",
  "ap-five-desc": "38개 이상의 AP 과목을 다루는 인터랙티브 연습 플랫폼으로, 난이도별 문제, 글로벌 순위표, 시즌별 시험 대비 프로그램을 제공합니다.",
  "ap-calc-self-study-desc": "AP Calculus BC를 위한 Zenith의 자기주도 학습 과정입니다. 로그인 없이 누구나 이용할 수 있습니다.",
  "ap-calc-cheatsheet-desc": "AP Calculus BC 전체 커리큘럼을 다루는 종합 치트시트입니다.",
  "ap-calc-barrons-desc": "AP Calculus BC를 독학하기에 가장 좋은 책으로 보입니다. Zenith의 핵심 커리큘럼에서도 Barron's의 연습문제를 많이 활용합니다.",
  "ap-bio-self-study-desc": "AP Biology를 위한 Zenith의 자기주도 학습 과정입니다. 로그인 없이 누구나 이용할 수 있습니다.",
  "ap-bio-barrons-desc": "AP Biology 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-chem-barrons-desc": "AP Chemistry 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-physics-barrons-desc": "AP Physics C 커리큘럼(Mechanics, Electricity & Magnetism) 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-csa-barrons-desc": "AP Computer Science A 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-econ-barrons-desc": "AP Macroeconomics와 AP Microeconomics 커리큘럼을 모두 다루는 통합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-englang-barrons-desc": "AP English Language and Composition 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-englit-barrons-desc": "AP English Literature and Composition 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-stats-barrons-desc": "AP Statistics 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다.",
  "ap-enviro-barrons-desc": "AP Environmental Science 커리큘럼 전체를 다루는 종합 자기주도 학습서로, 복습 콘텐츠와 모의고사가 포함되어 있습니다."
};

function applyResourcesLanguage(lang) {
  document.querySelectorAll("[data-i18n]").forEach(function (el) {
    if (el.dataset.i18nEn === undefined) el.dataset.i18nEn = el.textContent;
    const key = el.dataset.i18n;
    const ko = RESOURCES_KO[key];
    el.textContent = (lang === "ko" && ko) ? ko : el.dataset.i18nEn;
  });
}
