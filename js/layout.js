/*
  SHARED HEADER & FOOTER
  -----------------------
  Every page's header/footer used to be copy-pasted HTML, so one nav
  change meant editing 15+ files. Now each page just has a mount point
  (<div id="header-mount"></div> / <div id="footer-mount"></div>) and a
  single call to renderSiteHeader / renderPortalHeader / renderFooter.
  Edit the markup or link lists below and every page picks it up.

  The mount div is replaced in place (outerHTML), not wrapped, so the
  resulting <header>/<footer> stays a direct child of <body> — this
  matters for the flex layout on portal pages (see .portal-body in
  css/style.css).
*/

const SITE_NAV_LINKS = [
  { key: "home", href: "index.html", label: "Home" },
  { key: "philosophy", href: "philosophy.html", label: "Philosophy" },
  { key: "resources", href: "resources.html", label: "Resources" },
  { key: "faq", href: "faq.html", label: "FAQ" },
  { key: "blog", href: "blog.html", label: "Blog" },
  { key: "portal", href: "portal.html", label: "Portal" }
];

const PORTAL_NAV_LINKS = [
  { key: "courses", href: "portal.html", label: "Courses" },
  { key: "catalog", href: "catalog.html", label: "Catalog" },
  { key: "now", href: "right-now.html", label: "Now" },
  { key: "feedback", href: "feedback.html", label: "Feedback" },
  { key: "calendar", href: "calendar.html", label: "Calendar" },
  { key: "submit", href: "submit.html", label: "Submit" }
];

const TEACHER_NAV_LINKS = [
  { key: "dashboard", href: "teacher.html", label: "Teacher Dashboard" },
  { key: "overview", href: "teacher-overview.html", label: "All Students" },
  { key: "calendar", href: "calendar.html", label: "Calendar" }
];

const PORTAL_ACTION_HTML = {
  open: '<a id="open-direct-link" href="#" target="_blank" rel="noopener" class="portal-link">Open ↗</a>',
  allCourses: '<a href="portal.html" class="portal-link">All courses</a>',
  back: '<a href="resources.html" class="portal-link">← Back to Resources</a>',
  requests: '<a href="requests.html" class="portal-link">Requests</a>',
  calendar: '<a href="calendar.html" class="portal-link">Calendar</a>',
  lang: '<span id="lang-toggle-mount" class="lang-toggle-mount"></span>',
  logout: '<button id="logout-btn" class="portal-logout">Log out</button>'
};

function renderLogo() {
  return (
    '<a href="index.html" class="logo">' +
    '<svg class="logo-mark" viewBox="0 0 100 70" aria-hidden="true" focusable="false">' +
    '<path d="M50,2 L61,22 L50,17 L39,22 Z" fill="currentColor"/>' +
    '<rect x="47.6" y="19" width="2" height="36" fill="currentColor"/>' +
    '<rect x="52.4" y="19" width="1.6" height="36" fill="currentColor"/>' +
    '<path d="M7,58 C24,58 33,58 34,56 C42,42 45,23 49,23" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>' +
    '<path d="M93,58 C76,58 67,58 66,56 C58,42 55,23 51,23" fill="none" stroke="currentColor" stroke-width="4.5" stroke-linecap="round"/>' +
    '</svg>' +
    '<span class="logo-wordmark" aria-hidden="true">Z<span class="logo-e"><span></span><span></span><span></span></span>NITH</span>' +
    '<span class="sr-only">Zenith</span>' +
    '</a>'
  );
}

function mount(id, html) {
  const el = document.getElementById(id);
  if (!el) return;
  el.outerHTML = html;
}

// opts: { active: 'resources', showAuth: true, langToggle: true }
// langToggle adds an empty #lang-toggle-mount span to the nav — opt-in
// since only resources.html currently calls renderLangToggle() on it.
function renderSiteHeader(opts) {
  opts = opts || {};
  const showAuth = opts.showAuth !== false;

  const navLinks = SITE_NAV_LINKS.map(function (link) {
    const activeClass = link.key === opts.active ? ' class="active"' : "";
    return '<a href="' + link.href + '"' + activeClass + ">" + link.label + "</a>";
  }).join("\n      ");

  const auth = showAuth
    ? '<a href="login.html" id="nav-login-btn" class="btn-nav">Log In</a>\n      <span id="nav-user-name" class="nav-user" hidden></span>'
    : "";

  const lang = opts.langToggle ? '<span id="lang-toggle-mount" class="lang-toggle-mount"></span>' : "";

  const html =
    '<header class="site-header">\n' +
    '  <div class="container header-inner">\n' +
    "    " + renderLogo() + "\n" +
    '    <button type="button" class="nav-toggle" id="nav-toggle" aria-label="Toggle menu" aria-expanded="false" aria-controls="site-nav">\n' +
    "      <span></span><span></span><span></span>\n" +
    "    </button>\n" +
    '    <nav id="site-nav">\n' +
    "      " + navLinks + "\n" +
    "      " + lang + "\n" +
    "      " + auth + "\n" +
    "    </nav>\n" +
    "  </div>\n" +
    "</header>";

  mount("header-mount", html);

  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("site-nav");
  if (toggle && nav) {
    toggle.addEventListener("click", function () {
      const isOpen = nav.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", isOpen ? "true" : "false");
    });
    nav.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", function () {
        nav.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }
}

// opts:
//   nav: 'full' (default) — Courses/Now/Feedback/Calendar/Submit, needs `active`
//   nav: 'resources' — Home/Resources/Student Portal self-study subnav
//   nav: 'teacher' — Teacher Dashboard/All Students/Calendar tabs, needs `active` ('dashboard'/'overview'/'calendar')
//   nav: 'label' — single non-link label, needs `label`
//   actions: array of 'open' | 'allCourses' | 'requests' | 'calendar' | 'lang' | 'logout' (default ['logout'])
function renderPortalHeader(opts) {
  opts = opts || {};
  const navType = opts.nav || "full";
  const actions = opts.actions || ["logout"];

  let nav;
  if (navType === "label") {
    nav = '<span class="portal-nav-link active">' + opts.label + "</span>";
  } else if (navType === "resources") {
    nav =
      '<a href="index.html" class="portal-nav-link">Home</a>\n' +
      '      <a href="resources.html" class="portal-nav-link active">Resources</a>\n' +
      '      <a href="portal.html" class="portal-nav-link">Student Portal</a>';
  } else if (navType === "teacher") {
    nav = TEACHER_NAV_LINKS.map(function (link) {
      const activeClass = link.key === opts.active ? " active" : "";
      return '<a href="' + link.href + '" class="portal-nav-link' + activeClass + '">' + link.label + "</a>";
    }).join("\n      ");
  } else {
    nav = PORTAL_NAV_LINKS.map(function (link) {
      const activeClass = link.key === opts.active ? " active" : "";
      return '<a href="' + link.href + '" class="portal-nav-link' + activeClass + '">' + link.label + "</a>";
    }).join("\n      ");
  }

  const actionsHtml = actions.map(function (key) { return PORTAL_ACTION_HTML[key]; }).join("\n    ");

  const html =
    '<header class="portal-bar">\n' +
    '  <div class="portal-bar-left">\n' +
    "    " + renderLogo() + "\n" +
    '    <nav class="portal-nav">\n' +
    "      " + nav + "\n" +
    "    </nav>\n" +
    "  </div>\n" +
    '  <div class="portal-actions">\n' +
    "    " + actionsHtml + "\n" +
    "  </div>\n" +
    "</header>";

  mount("header-mount", html);
}

function renderFooter() {
  const html =
    "<footer>\n" +
    '  <div class="container">\n' +
    '    <div id="social-links" class="social-icons"></div>\n' +
    "    <p>The process is clear. Your potential is limitless. Let’s get to work.</p>\n" +
    "  </div>\n" +
    "</footer>";

  mount("footer-mount", html);
}
