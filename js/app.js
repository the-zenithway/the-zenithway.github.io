/*
  APP LOGIC
  ---------
  Shared functions used across the site.

  You shouldn't need to edit this file much:
    - To add/edit/remove students or their links, edit js/data.js.
    - To change the footer's social icons, edit js/social-links.js.
    - portal.html, calendar.html, and submit.html all call
      renderEmbedPage() at the bottom of this file — it's shared,
      since each of those pages is just "logged-in student sees one
      iframe" with a different URL. To add another page like that,
      copy submit.html, give its iframe the id "embed-frame" (same
      id, new page), and call renderEmbedPage() with that page's own
      URL field from js/data.js.
    - right-now.html is different — it's real content, not an embed,
      rendered by renderRightNow() below from each student's
      "rightNow" field in js/data.js.
    - There are two roles now: students (STUDENTS in data.js) use all
      the pages above; teachers (TEACHERS in data.js) log into
      teacher.html instead, which is its own separate, much simpler
      page for now — see requireTeacherLogin()/getCurrentTeacher()
      below.
*/

const SESSION_KEY = "loggedInUsername";
const ROLE_KEY = "loggedInRole"; // "student" or "teacher"
const ACTIVE_COURSE_KEY = "activeCourseId";

// Pages login.html is allowed to send someone back to after they log
// in. Keeps a crafted "?redirect=" link from sending someone to an
// external site or a javascript: URL.
const REDIRECTABLE_PAGES = ["index.html", "portal.html", "roadmap.html", "calendar.html", "right-now.html", "submit.html", "feedback.html", "cheatsheet.html", "teacher.html", "resources.html", "philosophy.html", "faq.html", "blog.html"];

// Checks a username/password against STUDENTS first, then TEACHERS
// (from data.js). On success, remembers who's logged in and which
// role they are (in this browser) and returns true. Returns false on
// a bad username/password.
function login(username, password) {
  const student = STUDENTS.find(function (s) {
    return s.username === username && s.password === password;
  });
  if (student) {
    localStorage.setItem(SESSION_KEY, student.username);
    localStorage.setItem(ROLE_KEY, "student");
    localStorage.removeItem(ACTIVE_COURSE_KEY);
    return true;
  }

  const teacher = TEACHERS.find(function (t) {
    return t.username === username && t.password === password;
  });
  if (teacher) {
    localStorage.setItem(SESSION_KEY, teacher.username);
    localStorage.setItem(ROLE_KEY, "teacher");
    return true;
  }

  return false;
}

// Returns the currently logged-in student object, or null if
// nobody is logged in on this browser (or they're a teacher).
function getCurrentStudent() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return STUDENTS.find(function (s) { return s.username === username; }) || null;
}

// Returns the currently logged-in teacher object, or null if nobody
// is logged in on this browser (or they're a student).
function getCurrentTeacher() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return TEACHERS.find(function (t) { return t.username === username; }) || null;
}

// Sends the visitor to the login page if nobody is logged in,
// remembering the page they were trying to reach so login.html can
// send them back afterward. Call this at the very top of any
// student-facing "protected" page.
function requireLogin() {
  const student = getCurrentStudent();
  if (!student) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
    return;
  }
  setUpCourseNavigation(student);
}

// Same as requireLogin(), but for teacher.html — checks the TEACHERS
// list instead of STUDENTS.
function requireTeacherLogin() {
  if (!getCurrentTeacher()) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
}

// Reads "?redirect=" from the login page's URL and returns it if
// it's one of this site's own pages; otherwise falls back to a
// role-appropriate default (teachers -> their dashboard, students ->
// home). Call this after a successful login.
function getLoginRedirect() {
  const requested = new URLSearchParams(window.location.search).get("redirect");
  const requestedPage = requested ? requested.split("?")[0] : "";
  if (REDIRECTABLE_PAGES.includes(requestedPage)) return requested;
  return localStorage.getItem(ROLE_KEY) === "teacher" ? "teacher.html" : "index.html";
}

// Forgets who's logged in and returns to the home page.
function logout() {
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(ROLE_KEY);
  localStorage.removeItem(ACTIVE_COURSE_KEY);
  window.location.href = "index.html";
}

// Renders the footer's social icons from SOCIAL_LINKS (defined in
// js/social-links.js). Called near the bottom of every page.
function renderSocialLinks() {
  const container = document.getElementById("social-links");
  if (!container) return;

  container.innerHTML = SOCIAL_LINKS.map(function (s) {
    return '<a href="' + s.url + '" target="_blank" rel="noopener" ' +
           'aria-label="' + s.name + '" class="social-icon">' +
             '<img src="https://cdn.simpleicons.org/' + s.icon + '/8F8F8F?viewbox=auto" ' +
             'alt="" width="20" height="20" loading="lazy">' +
           '</a>';
  }).join("");
}

// Swaps the nav's "Log In" button for the logged-in student's name.
// Call this near the bottom of any public page that has the
// site-header nav (index.html, philosophy.html, resources.html,
// faq.html).
function renderNavAuth() {
  const loginBtn = document.getElementById("nav-login-btn");
  const userName = document.getElementById("nav-user-name");
  if (!loginBtn || !userName) return;

  const student = getCurrentStudent();
  if (student) {
    loginBtn.hidden = true;
    userName.hidden = false;
    userName.textContent = student.name;
  } else {
    loginBtn.hidden = false;
    userName.hidden = true;
  }
}

// Fills in the shared bar's "Open in ... ↗" direct link and points
// this page's iframe at the given URL. portal.html and calendar.html
// each call this with their own URL and a label — that's the only
// difference between the two pages.
//
// Pass available=false (portal.html does this for students whose
// notionAvailable is false in data.js) to skip the iframe and show
// the "temporarily unavailable" fallback button instead — the page
// needs an #embed-unavailable/#embed-unavailable-link pair in its
// markup for that; calendar.html doesn't have one and never needs
// to, since it always passes available=true.
function renderEmbedPage(student, embedUrl, label, available) {
  if (!student) return;
  if (available === undefined) available = true;

  const link = document.getElementById("open-direct-link");
  link.href = embedUrl;
  link.textContent = "Open in " + label + " ↗";

  if (!available) {
    document.getElementById("embed-frame").hidden = true;
    document.getElementById("embed-unavailable").hidden = false;
    document.getElementById("embed-unavailable-link").href = embedUrl;
    document.getElementById("embed-unavailable-link").textContent = "Open in " + label + " ↗";
    return;
  }

  const frame = document.getElementById("embed-frame");
  frame.src = embedUrl;
  frame.title = student.name + "'s " + label;
}

// Fills in right-now.html from the logged-in student's "rightNow"
// field in js/data.js. One thing shown at a time:
//   - no rightNow field at all -> empty state (nothing set yet)
//   - state: "waiting"   -> passive: what we're doing, no button
//   - state: "your-move" -> active: the instruction, due date, and
//     a "message us when done" button that opens a menu of every
//     real contact option (see setUpContactMenu below)
function renderRightNow(student) {
  if (!student) return;
  const course = getSelectedCourse(student);

  document.getElementById("rightnow-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const card = document.getElementById("rightnow-card");
  const tag = document.getElementById("rightnow-tag");
  const title = document.getElementById("rightnow-title");
  const instruction = document.getElementById("rightnow-instruction");
  const due = document.getElementById("rightnow-due");
  const ctaWrap = document.getElementById("rightnow-cta-wrap");
  const data = course ? course.rightNow : null;

  if (!data) {
    card.classList.add("rightnow-empty");
    title.textContent = "Nothing set yet";
    instruction.textContent = "Check back soon, or open your Portal for the full picture.";
    due.hidden = true;
    ctaWrap.hidden = true;
    return;
  }

  title.textContent = data.chapter + " · " + data.unit;

  if (data.state === "waiting") {
    card.classList.add("rightnow-waiting");
    tag.textContent = "With us";
    instruction.textContent = data.note;
    due.hidden = true;
    ctaWrap.hidden = true;
    return;
  }

  card.classList.add("rightnow-active");
  tag.textContent = "Your move";
  instruction.textContent = data.instruction;

  if (data.due) {
    due.hidden = false;
    due.textContent = "Due " + data.due;
  } else {
    due.hidden = true;
  }

  ctaWrap.hidden = false;
  setUpContactMenu();
}

// Builds the "Message us when done" popover from SOCIAL_LINKS (see
// js/social-links.js — same one place to edit updates both the
// footer icons and this menu), skipping any entry that's still an
// unfilled placeholder (its url contains "YOUR_"). Toggled open on
// clicking the button, closed on an outside click.
function setUpContactMenu() {
  const button = document.getElementById("rightnow-cta");
  const menu = document.getElementById("rightnow-contact-menu");

  menu.innerHTML = SOCIAL_LINKS.filter(function (s) {
    return s.url.indexOf("YOUR_") === -1;
  }).map(function (s) {
    return '<a href="' + s.url + '" target="_blank" rel="noopener" class="rightnow-contact-item">' +
             '<img src="https://cdn.simpleicons.org/' + s.icon + '/E6E6E4?viewbox=auto" alt="" width="18" height="18" loading="lazy">' +
             '<span>' + s.name + '</span>' +
           '</a>';
  }).join("");

  button.addEventListener("click", function (e) {
    e.stopPropagation();
    menu.hidden = !menu.hidden;
  });

  document.addEventListener("click", function () {
    menu.hidden = true;
  });
}

// Fills in the small "Your Cheat Sheet" banner on feedback.html from
// the logged-in student's "cheatSheet" array in js/data.js — just a
// count and a link to cheatsheet.html, since the full thing can get
// long. Hidden entirely if the field is missing or empty (most
// students won't have one yet — filled in by hand as patterns get
// noticed, same as feedback and rightNow).
function renderCheatSheetBanner(student) {
  if (!student) return;
  const course = getSelectedCourse(student);

  const banner = document.getElementById("cheatsheet-banner");
  const count = document.getElementById("cheatsheet-banner-count");
  const entries = course ? (course.cheatSheet || []) : [];

  if (entries.length === 0) {
    banner.hidden = true;
    return;
  }

  banner.hidden = false;
  count.textContent = entries.length + (entries.length === 1 ? " pattern" : " patterns");
}

// Fills in the full cheat sheet list on cheatsheet.html — each entry
// is { topic, source, pattern }, where "source" is the 발상노트
// problem reference (e.g. "5B-22") and "pattern" can contain LaTeX
// ($...$ or $$...$$); call renderMath() after this to typeset it.
// Shows an empty state if the field is missing or empty.
function renderCheatSheetPage(student) {
  if (!student) return;
  const course = getSelectedCourse(student);

  document.getElementById("cheatsheet-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const list = document.getElementById("cheatsheet-list");
  const entries = course ? (course.cheatSheet || []) : [];

  if (entries.length === 0) {
    list.innerHTML = '<div class="feedback-empty">' +
      '<h1>Nothing here yet</h1>' +
      '<p>Patterns show up here as they get noticed across your feedback.</p>' +
      '</div>';
    return;
  }

  list.innerHTML = entries.map(function (entry) {
    return '<div class="feedback-item">' +
      '<div class="feedback-meta">' +
        '<p class="cheatsheet-topic">' + entry.topic + '</p>' +
        '<span class="cheatsheet-source">' + entry.source + '</span>' +
      '</div>' +
      '<p class="cheatsheet-pattern">' + entry.pattern + '</p>' +
    '</div>';
  }).join("");
}

// Runs KaTeX's auto-render over a container, turning any $...$ /
// $$...$$ LaTeX in its text into typeset math in place. Call this
// once, after any innerHTML that might contain LaTeX has already
// been set. Only cheatsheet.html loads KaTeX; on any other page this
// quietly does nothing.
function renderMath(container) {
  if (typeof renderMathInElement === "undefined") return;
  renderMathInElement(container, {
    delimiters: [
      { left: "$$", right: "$$", display: true },
      { left: "$", right: "$", display: false }
    ]
  });
}

// Fills in feedback.html from the logged-in student's "feedback"
// array in js/data.js — newest first, exactly as the array is
// ordered (add new entries to the top by hand). Shows an empty
// state if the field is missing or empty.
function renderFeedback(student) {
  if (!student) return;
  const course = getSelectedCourse(student);

  document.getElementById("feedback-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const list = document.getElementById("feedback-list");
  const entries = course ? (course.feedback || []) : [];

  if (entries.length === 0) {
    list.innerHTML = '<div class="feedback-empty">' +
      '<h1>Nothing here yet</h1>' +
      '<p>Feedback shows up here once your submissions have been reviewed.</p>' +
      '</div>';
    return;
  }

  list.innerHTML = entries.map(function (entry) {
    return '<div class="feedback-item">' +
      '<div class="feedback-meta">' +
        '<span class="feedback-date">' + entry.date + '</span>' +
        '<span class="feedback-chapter">' + entry.chapter + ' · ' + entry.unit + '</span>' +
      '</div>' +
      '<p class="feedback-content">' + entry.content + '</p>' +
    '</div>';
  }).join("");
}

// Fills in the (currently placeholder) teacher.html dashboard from
// the logged-in teacher's name. The actual dashboard content/layout
// is intentionally undesigned for now — this just proves the role
// separation works end to end.
function renderTeacherDashboard(teacher) {
  if (!teacher) return;
  document.getElementById("teacher-greeting").textContent =
    "Hey " + teacher.name.split(" ")[0] + ",";
}

// Fills in blog.html's post list from BLOG_POSTS (js/blog-data.js),
// newest first, exactly as the array is ordered (add new posts to
// the top by hand). Each preview links to blog-post.html?slug=....
function renderBlogList() {
  const list = document.getElementById("blog-list");
  if (!list) return;

  if (BLOG_POSTS.length === 0) {
    list.innerHTML = '<p class="blog-empty">No posts yet — check back soon.</p>';
    return;
  }

  list.innerHTML = BLOG_POSTS.map(function (post) {
    return '<a href="blog-post.html?slug=' + encodeURIComponent(post.slug) + '" class="blog-preview">' +
      '<span class="blog-preview-date">' + post.date + '</span>' +
      '<h2>' + post.title + '</h2>' +
      '<p class="blog-preview-excerpt">' + post.excerpt + '</p>' +
      '<span class="blog-read-more">Read more →</span>' +
    '</a>';
  }).join("");
}

// Fills in blog-post.html from the "?slug=" in the URL, looking it
// up in BLOG_POSTS (js/blog-data.js). Shows a friendly "not found"
// message (with a link back to the index) for an unknown/missing
// slug instead of a blank page.
function renderBlogPost() {
  const article = document.getElementById("blog-article");
  if (!article) return;

  const slug = new URLSearchParams(window.location.search).get("slug");
  const post = BLOG_POSTS.find(function (p) { return p.slug === slug; });

  if (!post) {
    article.innerHTML = '<h1>Post not found</h1>' +
      '<p class="blog-preview-excerpt">That post doesn\'t exist, or may have moved.</p>';
    return;
  }

  document.title = post.title + " — Zenith";
  article.innerHTML = '<span class="blog-article-date">' + post.date + '</span>' +
    '<h1>' + post.title + '</h1>' +
    '<div class="blog-article-body">' +
      post.content.map(function (paragraph) { return '<p>' + paragraph + '</p>'; }).join("") +
    '</div>';
}

// Returns one enrolled course from a student record by its stable URL id.
// A course is an enrollment: if it is not in student.courses, it is not shown
// in the course folder and its roadmap cannot be selected for that student.
function getStudentCourse(student, courseId) {
  if (!student || !courseId) return null;
  return (student.courses || []).find(function (course) {
    return course.id === courseId;
  }) || null;
}

// Resolves the active enrolled course from ?course= and remembers it for the
// rest of that subject path. This keeps Now and Feedback scoped correctly even
// if a browser or stale page drops the query from a navigation link.
function getSelectedCourse(student) {
  const page = window.location.pathname.split("/").pop();
  if (page === "portal.html") {
    localStorage.removeItem(ACTIVE_COURSE_KEY);
    return null;
  }

  const params = new URLSearchParams(window.location.search);
  if (params.has("course")) {
    const queriedCourse = getStudentCourse(student, params.get("course"));
    if (queriedCourse) {
      localStorage.setItem(ACTIVE_COURSE_KEY, queriedCourse.id);
      return queriedCourse;
    }
    localStorage.removeItem(ACTIVE_COURSE_KEY);
    return null;
  }

  const rememberedCourse = getStudentCourse(
    student,
    localStorage.getItem(ACTIVE_COURSE_KEY)
  );
  if (!rememberedCourse) localStorage.removeItem(ACTIVE_COURSE_KEY);
  return rememberedCourse;
}

// Keeps the selected subject active across protected navigation. Courses
// intentionally returns to the chooser without retaining a subject.
// Requires an enrolled subject for course-owned pages. A direct visit without
// course context returns to the chooser instead of showing unrelated data.
function requireSelectedCourse(student) {
  const course = getSelectedCourse(student);
  if (!course) {
    window.location.href = "portal.html";
    return null;
  }
  return course;
}

function setUpCourseNavigation(student) {
  const course = getSelectedCourse(student);
  if (!course) return null;

  document.querySelectorAll(".portal-nav-link").forEach(function(link) {
    const url = new URL(link.getAttribute("href"), window.location.href);
    if (url.pathname.split("/").pop() === "portal.html") return;
    url.searchParams.set("course", course.id);
    link.setAttribute("href", url.pathname.split("/").pop() + url.search);
  });

  const cheatSheetLink = document.querySelector("#cheatsheet-banner a");
  if (cheatSheetLink) {
    cheatSheetLink.href = "cheatsheet.html?course=" + encodeURIComponent(course.id);
  }

  return course;
}

// Subject-specific app icons used by the course folder. They are inline SVG so
// the folder stays self-contained and does not depend on another icon service.
function courseIconHtml(icon) {
  if (icon === "biology") {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M32 7c15 6 21 17 21 27 0 15-10 23-21 23S11 49 11 34c0-10 6-21 21-27z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M32 57V9M32 7l-6 8M32 7l6 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>' +
      '<circle cx="32" cy="35" r="9" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".72"/>' +
      '<circle cx="32" cy="35" r="2.5" fill="currentColor" opacity=".85"/>' +
      '<path d="M18 24c3-3 6-3 8 0M38 47c3 3 6 3 8 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>' +
    '</svg>';
  }
  return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M8 32H56" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".72"/>' +
    '<path d="M32 58V8M32 8l-6 8M32 8l6 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".72"/>' +
    '<path d="M9 55C18 38 24 32 32 32C40 32 40 50 47 50C53 50 55 28 59 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M29 33V55M35 33V55" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".6"/>' +
  '</svg>';
}

// Builds the iPhone-folder-style course launcher on portal.html. Only courses
// present in this student's courses array are rendered.
function renderCoursePortal(student) {
  if (!student) return;
  localStorage.removeItem(ACTIVE_COURSE_KEY);

  const courses = student.courses || [];
  const grid = document.getElementById("course-app-grid");
  const empty = document.getElementById("course-folder-empty");
  document.getElementById("course-folder-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ", pick a subject to continue.";

  if (courses.length === 0) {
    grid.hidden = true;
    empty.hidden = false;
    return;
  }

  grid.hidden = false;
  empty.hidden = true;
  grid.innerHTML = courses.map(function (course) {
    return '<a class="course-app" href="roadmap.html?course=' + encodeURIComponent(course.id) + '">' +
      '<span class="course-app-icon course-app-icon--' + course.icon + '">' + courseIconHtml(course.icon) + '</span>' +
      '<span class="course-app-name">' + course.name + '</span>' +
    '</a>';
  }).join("");
}

// Resolves roadmap.html's course query only against the logged-in student's
// enrollments, then hands that course to the shared roadmap table renderer.
function renderCourseRoadmap(student) {
  if (!student) return;

  const course = getSelectedCourse(student);
  const heading = document.getElementById("roadmap-course-name");

  if (!course) {
    heading.textContent = "Course not found";
    renderRoadmap(null);
    return;
  }

  document.title = course.name + " Roadmap — Zenith";
  heading.textContent = course.name;
  renderRoadmap(course);
  return course;
}

// Colors for the roadmap table's Category/Status pills on
// portal.html — the single place to tweak the palette. Keys must
// match the exact strings used in a student's "roadmap" array in
// js/data.js. Anything not listed here falls back to a plain grey
// pill instead of breaking.
const ROADMAP_CATEGORY_COLORS = {
  "I-information": { text: "#94A3B8", bg: "rgba(148, 163, 184, 0.16)" },
  "L-Learning": { text: "#60A5FA", bg: "rgba(96, 165, 250, 0.16)" },
  "N-Notes Submission": { text: "#FBBF24", bg: "rgba(251, 191, 36, 0.16)" },
  "B-book chapter": { text: "#60A5FA", bg: "rgba(96, 165, 250, 0.16)" },
  "C-coursework": { text: "#FB923C", bg: "rgba(251, 146, 60, 0.16)" },
  "S-solution manual": { text: "#2DD4BF", bg: "rgba(45, 212, 191, 0.16)" },
  "F-Final Self Check": { text: "#A78BFA", bg: "rgba(167, 139, 250, 0.16)" },
  "R-Review": { text: "#C4B5FD", bg: "rgba(196, 181, 253, 0.16)" },
  "T-Test": { text: "#FB7185", bg: "rgba(251, 113, 133, 0.16)" },
  "M-Mock": { text: "#F472B6", bg: "rgba(244, 114, 182, 0.16)" }
};

const ROADMAP_STATUS_COLORS = {
  "Complete": { text: "#4ADE80", bg: "rgba(74, 222, 128, 0.16)" },
  "Review": { text: "#60A5FA", bg: "rgba(96, 165, 250, 0.16)" },
  "Unlocked": { text: "#D6A94A", bg: "rgba(214, 169, 74, 0.18)" },
  "Optional-Reading": { text: "#C4B5FD", bg: "rgba(196, 181, 253, 0.16)" },
  "Locked": { text: "#8F8F8F", bg: "rgba(143, 143, 143, 0.14)" }
};

// Light/dark variants of the exact status colors above, for the
// Curve view's faceted gem fills — same status, same base hue as the
// table's pills, just given a gradient for a jewel-like look.
const ROADMAP_STATUS_GEM_COLORS = {
  "Complete": { light: "#96ECB5", dark: "#2B814A" },
  "Review": { light: "#A3CBFC", dark: "#386091" },
  "Unlocked": { light: "#E7CD96", dark: "#7C622B" },
  "Optional-Reading": { light: "#DDD4FE", dark: "#726993" },
  "Locked": { light: "#BEBEBE", dark: "#535353" }
};

const ROADMAP_FALLBACK_COLOR = { text: "var(--text-muted)", bg: "var(--bg)" };

function roadmapPillHtml(rawKey, colorMap, label) {
  const c = colorMap[rawKey] || ROADMAP_FALLBACK_COLOR;
  return '<span class="roadmap-pill" style="color:' + c.text + '; background:' + c.bg + ';">' + label + '</span>';
}

// "B-book chapter" -> "Book Chapter", "R-Review" -> "Review", etc.
// Purely cosmetic — item.category itself (the raw value) is still
// what's used to look up the pill's color.
function roadmapCategoryLabel(category) {
  const dash = category.indexOf("-");
  const rest = dash === -1 ? category : category.slice(dash + 1);
  return rest.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
}

// A small rotating palette for the Chapter column — not meant to
// mean anything on its own, just enough so adjacent chapters look
// different from each other and a long table doesn't read as one
// undifferentiated wall of "Chapter 1, Chapter 1, Chapter 2...".
// Chapter 0 (intro material) and Chapter M (mocks) get their own
// fixed colors since they're not part of the regular 1-12 sequence.
const ROADMAP_CHAPTER_PALETTE = ["#7DD3FC", "#FCA5A5", "#FDE68A", "#A7F3D0", "#D8B4FE", "#FDBA74"];

function roadmapChapterColor(chapter) {
  if (chapter === "Chapter 0") return "var(--text-muted)";
  if (chapter === "Chapter M") return "var(--accent)";
  const num = parseInt(chapter.replace("Chapter", ""), 10);
  if (isNaN(num)) return "var(--text-muted)";
  return ROADMAP_CHAPTER_PALETTE[(num - 1) % ROADMAP_CHAPTER_PALETTE.length];
}

// Fills in roadmap.html's table from one selected enrolled course
// (the caller has already verified the course belongs to the
// logged-in student). Shows an empty state if it has no roadmap yet.
function renderRoadmap(course) {

  const table = document.getElementById("roadmap-table");
  const empty = document.getElementById("roadmap-empty");
  const tbody = document.getElementById("roadmap-tbody");
  const items = course ? (course.roadmap || []) : [];

  if (items.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }

  table.hidden = false;
  empty.hidden = true;

  tbody.innerHTML = items.map(function (item) {
    // Locked means not accessible yet — don't offer resource or submission
    // links, even if URLs are already filled in for the item.
    const links = [];
    if (item.status !== "Locked" && item.url) {
      links.push('<a href="' + item.url + '" target="_blank" rel="noopener" class="roadmap-link">Open ↗</a>');
    }
    if (item.status !== "Locked" && item.submissionUrl) {
      links.push('<a href="' + item.submissionUrl + '" target="_blank" rel="noopener" class="roadmap-link">Submit ↗</a>');
    }
    const link = links.length > 0 ? links.join(' <span aria-hidden="true">·</span> ') : "—";

    // Unlocked = the thing to actually work on right now; Locked =
    // not relevant yet. Everything else (Complete/Review/Optional)
    // stays visually neutral.
    let rowClass = "";
    let namePrefix = "";
    if (item.status === "Unlocked") {
      rowClass = "roadmap-row-unlocked";
      namePrefix = '<span class="roadmap-star" title="Work on this now">★</span> ';
    } else if (item.status === "Locked") {
      rowClass = "roadmap-row-locked";
    }

    return '<tr class="' + rowClass + '">' +
      '<td class="roadmap-chapter" style="color:' + roadmapChapterColor(item.chapter) + ';">' + item.chapter + '</td>' +
      '<td class="roadmap-name">' + namePrefix + item.name + '</td>' +
      '<td>' + roadmapPillHtml(item.category, ROADMAP_CATEGORY_COLORS, roadmapCategoryLabel(item.category)) + '</td>' +
      '<td>' + roadmapPillHtml(item.status, ROADMAP_STATUS_COLORS, item.status.replace(/-/g, " ")) + '</td>' +
      '<td>' + link + '</td>' +
    '</tr>';
  }).join("");
}

// ---- Roadmap "Curve" view ----
// An alternate way to look at the exact same student.roadmap data as
// the table: one gem per chapter (skipping Chapter 0 — it's just
// intro material, no B/C/S/R/T), plotted along a smooth curve.
// Clicking a gem draws the tangent line through that point and opens
// a popover with that chapter's breakdown.

// Groups the flat roadmap array into one entry per chapter, in the
// order chapters first appear (the array is already chapter-ordered).
function roadmapGroupByChapter(items) {
  const order = [];
  const map = {};
  items.forEach(function (item) {
    if (item.chapter === "Chapter 0") return;
    if (!map[item.chapter]) {
      map[item.chapter] = [];
      order.push(item.chapter);
    }
    map[item.chapter].push(item);
  });
  return order.map(function (chapter) {
    return { chapter: chapter, label: chapter.replace("Chapter ", ""), items: map[chapter] };
  });
}

// One status per chapter, rolled up from its B/C/S/R/T items:
// fully Complete wins outright; otherwise Unlocked (something to do
// now) beats Review, which beats Optional-Reading; Locked is the
// default when nothing else applies.
function roadmapChapterOverallStatus(items) {
  if (items.every(function (it) { return it.status === "Complete"; })) return "Complete";
  if (items.some(function (it) { return it.status === "Unlocked"; })) return "Unlocked";
  if (items.some(function (it) { return it.status === "Review"; })) return "Review";
  if (items.some(function (it) { return it.status === "Optional-Reading"; })) return "Optional-Reading";
  return "Locked";
}

// ---- Curve shape: a real degree-7 polynomial ----
// Six irregularly-spaced critical x-values (asymmetric on purpose —
// not evenly spaced or mirrored) define f'(x) as a product of linear
// factors; f itself is f' integrated term-by-term. That gives the
// curve genuine, varied peaks and troughs across its whole length,
// and means the tangent line drawn through a clicked gem is an exact
// derivative of a real function, not an approximation from
// neighboring points.
const ROADMAP_CURVE_ROOTS = [-4.3, -2.6, -1.0, 0.7, 2.3, 4.0];
const ROADMAP_CURVE_K = 0.028;
const ROADMAP_CURVE_DOMAIN = [-4.6, 4.3];
const ROADMAP_CURVE_MARGIN_X = 50;
const ROADMAP_CURVE_MARGIN_Y = 60;

function roadmapBuildPolynomial(roots, k) {
  let coeffs = [1]; // (x - r0)(x - r1)...(x - rn), highest power first
  roots.forEach(function (r) {
    const next = new Array(coeffs.length + 1).fill(0);
    for (let i = 0; i < coeffs.length; i++) {
      next[i] += coeffs[i];
      next[i + 1] += coeffs[i] * -r;
    }
    coeffs = next;
  });
  const fpCoeffs = coeffs.map(function (c) { return c * k; }); // f', degree = roots.length
  const deg = fpCoeffs.length - 1;
  const fTerms = fpCoeffs.map(function (a, idx) { // f, integrated term-by-term
    const power = deg - idx + 1;
    return { power: power, coeff: a / power };
  });
  return {
    f: function (x) {
      let s = 0;
      for (let i = 0; i < fTerms.length; i++) s += fTerms[i].coeff * Math.pow(x, fTerms[i].power);
      return s;
    },
    fp: function (x) {
      let s = 0;
      for (let i = 0; i < fpCoeffs.length; i++) s += fpCoeffs[i] * Math.pow(x, deg - i);
      return s;
    }
  };
}

const ROADMAP_CURVE_POLY = roadmapBuildPolynomial(ROADMAP_CURVE_ROOTS, ROADMAP_CURVE_K);

// Sampled once up front so every course's curve normalizes against
// the same true min/max, regardless of how many chapters it has.
const ROADMAP_CURVE_RANGE = (function () {
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i <= 300; i++) {
    const x = ROADMAP_CURVE_DOMAIN[0] + (i / 300) * (ROADMAP_CURVE_DOMAIN[1] - ROADMAP_CURVE_DOMAIN[0]);
    const v = ROADMAP_CURVE_POLY.f(x);
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  return [lo, hi];
})();

// Maps a chapter's position (i of n) onto the fixed math domain above
// — the same domain regardless of chapter count, so every course
// samples the same curve shape, just at different points along it.
function roadmapMathXAt(i, n) {
  const t = n === 1 ? 0.5 : i / (n - 1);
  return ROADMAP_CURVE_DOMAIN[0] + t * (ROADMAP_CURVE_DOMAIN[1] - ROADMAP_CURVE_DOMAIN[0]);
}

function roadmapMathXToPixel(mathX, width) {
  const usableW = width - ROADMAP_CURVE_MARGIN_X * 2;
  const t = (mathX - ROADMAP_CURVE_DOMAIN[0]) / (ROADMAP_CURVE_DOMAIN[1] - ROADMAP_CURVE_DOMAIN[0]);
  return ROADMAP_CURVE_MARGIN_X + t * usableW;
}

function roadmapPixelXToMathX(px, width) {
  const usableW = width - ROADMAP_CURVE_MARGIN_X * 2;
  const t = (px - ROADMAP_CURVE_MARGIN_X) / usableW;
  return ROADMAP_CURVE_DOMAIN[0] + t * (ROADMAP_CURVE_DOMAIN[1] - ROADMAP_CURVE_DOMAIN[0]);
}

// Converts an arbitrary math-y value (not necessarily on the curve —
// a tangent line's y at some x is not f(x) except at the tangent
// point itself) to a pixel-y within the plotting area.
function roadmapMathYToPixel(mathY, height) {
  const usableH = height - ROADMAP_CURVE_MARGIN_Y * 2;
  const span = ROADMAP_CURVE_RANGE[1] - ROADMAP_CURVE_RANGE[0] || 1;
  return ROADMAP_CURVE_MARGIN_Y + usableH * (1 - (mathY - ROADMAP_CURVE_RANGE[0]) / span);
}

function roadmapMathToPixel(mathX, width, height) {
  return { x: roadmapMathXToPixel(mathX, width), y: roadmapMathYToPixel(ROADMAP_CURVE_POLY.f(mathX), height) };
}

// Evenly spaces one point per chapter along the curve's math domain,
// so every chapter sits exactly on the polynomial above.
function roadmapCurveLayout(groups, width, height) {
  const n = groups.length;
  return groups.map(function (group, i) {
    const mathX = roadmapMathXAt(i, n);
    const p = roadmapMathToPixel(mathX, width, height);
    return { x: p.x, y: p.y, mathX: mathX, group: group };
  });
}

// Draws the actual polynomial densely across its full domain — not
// just Catmull-Rom through the (possibly few) chapter gems — so
// every peak and trough is always fully visible no matter how many
// chapters a course has.
function roadmapCurveSamplePath(width, height) {
  const steps = 160;
  let d = "";
  for (let i = 0; i <= steps; i++) {
    const mathX = ROADMAP_CURVE_DOMAIN[0] + (i / steps) * (ROADMAP_CURVE_DOMAIN[1] - ROADMAP_CURVE_DOMAIN[0]);
    const p = roadmapMathToPixel(mathX, width, height);
    d += (i === 0 ? "M " : "L ") + p.x.toFixed(1) + " " + p.y.toFixed(1) + " ";
  }
  return d;
}

// An 8-point alternating star (a diamond-cut sparkle) around (cx, cy)
// — computed from angles rather than hand-authored per gem.
function roadmapStarPoints(cx, cy, rOuter, rInner) {
  const pts = [];
  for (let i = 0; i < 8; i++) {
    const angle = (Math.PI / 4) * i - Math.PI / 2;
    const r = i % 2 === 0 ? rOuter : rInner;
    pts.push((cx + r * Math.cos(angle)).toFixed(1) + "," + (cy + r * Math.sin(angle)).toFixed(1));
  }
  return pts.join(" ");
}

function roadmapGemGradId(status) {
  return "roadmap-gem-grad-" + status.toLowerCase().replace(/[^a-z]/g, "");
}

// Builds the curve, gems, and legend for one selected course and
// wires up gem clicks. Called once up front (from
// setUpRoadmapViewSwitch) so switching views is instant either way.
function renderRoadmapCurve(course) {
  const svg = document.getElementById("roadmap-curve-svg");
  const legend = document.getElementById("roadmap-curve-legend");
  if (!svg || !legend || !course) return;

  const groups = roadmapGroupByChapter(course.roadmap || []);
  if (groups.length === 0) {
    svg.innerHTML = "";
    legend.innerHTML = '<p class="roadmap-empty">Nothing here yet.</p>';
    return;
  }

  legend.innerHTML = ["Complete", "Unlocked", "Review", "Optional-Reading", "Locked"].map(function (status) {
    const c = ROADMAP_STATUS_COLORS[status] || ROADMAP_FALLBACK_COLOR;
    return '<span class="curve-legend-item"><span class="curve-legend-dot" style="background:' + c.text + ';"></span>' + status.replace(/-/g, " ") + '</span>';
  }).join("");

  const width = 1000, height = 340;
  const points = roadmapCurveLayout(groups, width, height);
  const curvePathD = roadmapCurveSamplePath(width, height);

  const defsHtml = '<defs>' +
      '<filter id="roadmap-glow-filter" x="-60%" y="-60%" width="220%" height="220%">' +
        '<feGaussianBlur stdDeviation="2.6" result="b"></feGaussianBlur>' +
        '<feMerge><feMergeNode in="b"></feMergeNode><feMergeNode in="SourceGraphic"></feMergeNode></feMerge>' +
      '</filter>' +
      '<linearGradient id="roadmap-curve-grad" x1="0" y1="0" x2="1" y2="0">' +
        '<stop offset="0%" stop-color="#8FB4EC"></stop>' +
        '<stop offset="30%" stop-color="var(--accent)"></stop>' +
        '<stop offset="65%" stop-color="#F3D98B"></stop>' +
        '<stop offset="100%" stop-color="var(--accent)"></stop>' +
      '</linearGradient>' +
      Object.keys(ROADMAP_STATUS_GEM_COLORS).map(function (status) {
        const c = ROADMAP_STATUS_GEM_COLORS[status];
        return '<radialGradient id="' + roadmapGemGradId(status) + '" cx="35%" cy="30%" r="75%">' +
          '<stop offset="0%" stop-color="' + c.light + '"></stop>' +
          '<stop offset="100%" stop-color="' + c.dark + '"></stop>' +
        '</radialGradient>';
      }).join("") +
    '</defs>';

  const gemsHtml = points.map(function (p, i) {
    const status = roadmapChapterOverallStatus(p.group.items);
    const glowColor = (ROADMAP_STATUS_COLORS[status] || ROADMAP_FALLBACK_COLOR).text;
    const starPts = roadmapStarPoints(p.x, p.y, 14, 6);
    return '<g class="roadmap-gem" data-gem-index="' + i + '">' +
      '<circle class="roadmap-gem-glow" cx="' + p.x + '" cy="' + p.y + '" r="21" fill="' + glowColor + '"></circle>' +
      '<circle class="roadmap-gem-hit" cx="' + p.x + '" cy="' + p.y + '" r="22" fill="transparent"></circle>' +
      '<g class="roadmap-gem-body" filter="url(#roadmap-glow-filter)">' +
        '<polygon class="roadmap-gem-star" points="' + starPts + '" fill="url(#' + roadmapGemGradId(status) + ')"></polygon>' +
        '<polygon points="' + starPts + '" fill="none" stroke="rgba(255,255,255,0.55)" stroke-width="1"></polygon>' +
      '</g>' +
      '<text class="roadmap-gem-label" x="' + p.x + '" y="' + (p.y + 34) + '">' + p.group.label + '</text>' +
    '</g>';
  }).join("");

  svg.innerHTML =
    defsHtml +
    '<path class="roadmap-curve-glow" d="' + curvePathD + '"></path>' +
    '<path class="roadmap-curve-path" d="' + curvePathD + '"></path>' +
    '<line id="roadmap-tangent-line" class="roadmap-tangent-line" x1="0" y1="0" x2="0" y2="0" opacity="0"></line>' +
    '<g id="roadmap-sparkle-layer"></g>' +
    gemsHtml;

  svg.querySelectorAll(".roadmap-gem").forEach(function (gemEl) {
    gemEl.addEventListener("click", function (e) {
      e.stopPropagation();
      const i = parseInt(gemEl.getAttribute("data-gem-index"), 10);
      roadmapActivateGem(svg, points, i, gemEl, width, height);
    });
  });

  document.getElementById("curve-popover").addEventListener("click", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", hideCurvePopover);
}

// Roadmap-scoped tangent animation state, so clicking a second gem
// cancels whatever the previous animation was still doing instead of
// the two clashing.
let roadmapTangentRaf = null;

function roadmapLerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
function roadmapEaseOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

// Draws the tangent line through the clicked gem — computed from the
// curve polynomial's actual derivative, not an approximation — as a
// brief flash that extends to both edges of the graph and fades,
// marks the gem active, and opens its popover.
function roadmapActivateGem(svg, points, i, gemEl, width, height) {
  const point = points[i];
  const slope = ROADMAP_CURVE_POLY.fp(point.mathX);
  const y0 = ROADMAP_CURVE_POLY.f(point.mathX);

  const leftMathX = roadmapPixelXToMathX(0, width);
  const rightMathX = roadmapPixelXToMathX(width, width);
  const leftY = slope * (leftMathX - point.mathX) + y0;
  const rightY = slope * (rightMathX - point.mathX) + y0;
  const pLeft = { x: 0, y: roadmapMathYToPixel(leftY, height) };
  const pRight = { x: width, y: roadmapMathYToPixel(rightY, height) };

  svg.querySelectorAll(".roadmap-gem.is-active").forEach(function (g) { g.classList.remove("is-active"); });
  gemEl.classList.add("is-active");

  roadmapFireTangent({ x: point.x, y: point.y }, pLeft, pRight);
  showCurvePopover(point.group, gemEl, svg);
}

function roadmapFireTangent(p0, pLeft, pRight) {
  const line = document.getElementById("roadmap-tangent-line");
  const sparkleLayer = document.getElementById("roadmap-sparkle-layer");
  if (!line || !sparkleLayer) return;
  if (roadmapTangentRaf) cancelAnimationFrame(roadmapTangentRaf);
  sparkleLayer.innerHTML = "";

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  roadmapSpawnSparkles(sparkleLayer, p0, reduceMotion);

  if (reduceMotion) {
    line.style.transition = "none";
    line.setAttribute("x1", pLeft.x); line.setAttribute("y1", pLeft.y);
    line.setAttribute("x2", pRight.x); line.setAttribute("y2", pRight.y);
    line.style.opacity = "1";
    setTimeout(function () {
      line.style.transition = "opacity 1s ease";
      line.style.opacity = "0";
    }, 400);
    return;
  }

  const shortLeft = roadmapLerp(p0, pLeft, 0.12);
  const shortRight = roadmapLerp(p0, pRight, 0.12);
  line.style.transition = "none";
  line.setAttribute("x1", shortLeft.x); line.setAttribute("y1", shortLeft.y);
  line.setAttribute("x2", shortRight.x); line.setAttribute("y2", shortRight.y);
  line.style.opacity = "1";

  const EXTEND = 220, HOLD = 90, FADE = 1000;
  const start = performance.now();

  function frame(now) {
    const t = now - start;
    if (t < EXTEND) {
      const p = roadmapEaseOutCubic(t / EXTEND);
      const cl = roadmapLerp(shortLeft, pLeft, p), cr = roadmapLerp(shortRight, pRight, p);
      line.setAttribute("x1", cl.x); line.setAttribute("y1", cl.y);
      line.setAttribute("x2", cr.x); line.setAttribute("y2", cr.y);
      roadmapTangentRaf = requestAnimationFrame(frame);
    } else if (t < EXTEND + HOLD) {
      line.setAttribute("x1", pLeft.x); line.setAttribute("y1", pLeft.y);
      line.setAttribute("x2", pRight.x); line.setAttribute("y2", pRight.y);
      roadmapTangentRaf = requestAnimationFrame(frame);
    } else if (t < EXTEND + HOLD + FADE) {
      line.style.opacity = String(1 - (t - EXTEND - HOLD) / FADE);
      roadmapTangentRaf = requestAnimationFrame(frame);
    } else {
      line.style.opacity = "0";
      roadmapTangentRaf = null;
    }
  }
  roadmapTangentRaf = requestAnimationFrame(frame);
}

function roadmapSpawnSparkles(layer, p0, reduceMotion) {
  const NS = "http://www.w3.org/2000/svg";
  function el(tag, attrs) {
    const node = document.createElementNS(NS, tag);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    return node;
  }
  const ripple = el("circle", { class: "roadmap-ripple", cx: p0.x, cy: p0.y, r: "4", opacity: "0.9" });
  layer.appendChild(ripple);

  const count = reduceMotion ? 0 : 7;
  const dots = [];
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.4;
    const dot = el("circle", { class: "roadmap-sparkle-dot", cx: p0.x, cy: p0.y, r: "2.2" });
    layer.appendChild(dot);
    dots.push({ node: dot, angle: angle, dist: 24 + Math.random() * 18 });
  }

  const start = performance.now();
  const DUR = reduceMotion ? 500 : 900;
  (function step(now) {
    const t = Math.min((now - start) / DUR, 1);
    ripple.setAttribute("r", String(4 + t * 40));
    ripple.setAttribute("opacity", String(0.9 * (1 - t)));
    dots.forEach(function (s) {
      s.node.setAttribute("cx", String(p0.x + Math.cos(s.angle) * s.dist * t));
      s.node.setAttribute("cy", String(p0.y + Math.sin(s.angle) * s.dist * t));
      s.node.setAttribute("opacity", String(1 - t));
    });
    if (t < 1) requestAnimationFrame(step);
    else layer.innerHTML = "";
  })(start);
}

// Positions the popover right next to the clicked gem using the
// SVG's screen transform, so it lines up correctly no matter how the
// SVG has been scaled to fit its container.
function showCurvePopover(group, gemEl, svg) {
  const popover = document.getElementById("curve-popover");
  const title = document.getElementById("curve-popover-title");
  const list = document.getElementById("curve-popover-list");
  const canvas = document.getElementById("roadmap-curve-canvas");

  title.textContent = "Chapter " + group.label;
  list.innerHTML = group.items.map(function (item) {
    const link = (item.url && item.status !== "Locked")
      ? '<div class="curve-popover-item-link"><a href="' + item.url + '" target="_blank" rel="noopener" class="roadmap-link">Open ↗</a></div>'
      : "";
    return '<div class="curve-popover-item">' +
      '<span class="curve-popover-item-name">' + item.name + '</span>' +
      roadmapPillHtml(item.status, ROADMAP_STATUS_COLORS, item.status.replace(/-/g, " ")) +
    '</div>' + link;
  }).join("");

  const circle = gemEl.querySelector(".roadmap-gem-hit");
  const pt = svg.createSVGPoint();
  pt.x = parseFloat(circle.getAttribute("cx"));
  pt.y = parseFloat(circle.getAttribute("cy"));
  const screenPt = pt.matrixTransform(svg.getScreenCTM());
  const canvasRect = canvas.getBoundingClientRect();

  popover.hidden = false;
  const popoverWidth = popover.offsetWidth || 260;
  let left = screenPt.x - canvasRect.left + 18;
  if (left + popoverWidth > canvasRect.width - 8) {
    left = screenPt.x - canvasRect.left - popoverWidth - 18;
  }
  let top = screenPt.y - canvasRect.top - 20;
  top = Math.max(4, Math.min(top, canvasRect.height - popover.offsetHeight - 4));

  popover.style.left = left + "px";
  popover.style.top = top + "px";
}

function hideCurvePopover() {
  const popover = document.getElementById("curve-popover");
  const line = document.getElementById("roadmap-tangent-line");
  const sparkleLayer = document.getElementById("roadmap-sparkle-layer");
  if (popover) popover.hidden = true;
  if (roadmapTangentRaf) { cancelAnimationFrame(roadmapTangentRaf); roadmapTangentRaf = null; }
  if (line) { line.style.transition = "none"; line.style.opacity = "0"; }
  if (sparkleLayer) sparkleLayer.innerHTML = "";
  document.querySelectorAll(".roadmap-gem.is-active").forEach(function (g) { g.classList.remove("is-active"); });
}

// ---- Roadmap "Cards" and "Orbit" views ----
// Both show the same one-card-per-chapter content as Curve (reusing
// roadmapGroupByChapter/roadmapChapterOverallStatus) — they differ
// only in presentation: a plain horizontal scroller for Cards, a
// coverflow-style 3D treatment for Orbit. Scrolling is native
// (touch/trackpad/wheel all just work); the JS only adds prev/next
// buttons, tracks which card is centered, and — for Orbit — a
// per-frame transform based on each card's distance from center.

// "B6-Definite Integrals" -> "Definite Integrals"; falls back to
// "Chapter <label>" for chapters with no book-chapter item (e.g. M).
function roadmapCardTopicName(group) {
  const book = group.items.find(function (it) { return it.category === "B-book chapter"; });
  if (book) {
    const dash = book.name.indexOf("-");
    if (dash !== -1) return book.name.slice(dash + 1);
  }
  return "Chapter " + group.label;
}

function roadmapCardHtml(group) {
  const status = roadmapChapterOverallStatus(group.items);
  const color = (ROADMAP_STATUS_COLORS[status] || ROADMAP_FALLBACK_COLOR).text;
  const itemsHtml = group.items.map(function (item) {
    return '<div class="roadmap-card-item">' +
      '<span class="roadmap-card-item-name">' + item.name + '</span>' +
      roadmapPillHtml(item.status, ROADMAP_STATUS_COLORS, item.status.replace(/-/g, " ")) +
    '</div>';
  }).join("");
  return '<div class="roadmap-card">' +
    '<p class="roadmap-card-tag" style="color:' + color + ';">' + status.replace(/-/g, " ") + '</p>' +
    '<h3 class="roadmap-card-title">' + roadmapCardTopicName(group) + '</h3>' +
    '<div class="roadmap-card-items">' + itemsHtml + '</div>' +
  '</div>';
}

function renderRoadmapCards(course) {
  const track = document.getElementById("roadmap-cards-track");
  if (!track || !course) return;
  const groups = roadmapGroupByChapter(course.roadmap || []);
  track.innerHTML = groups.map(roadmapCardHtml).join("");
}

function renderRoadmapOrbit(course) {
  const track = document.getElementById("roadmap-orbit-track");
  if (!track || !course) return;
  const groups = roadmapGroupByChapter(course.roadmap || []);
  track.innerHTML = groups.map(roadmapCardHtml).join("");
}

// Marks whichever card is nearest the track's own center as focused
// and, for Orbit, applies a coverflow transform to every card based
// on its distance from that center (in card-widths).
function roadmapUpdateTrackFocus(track, is3D) {
  const trackRect = track.getBoundingClientRect();
  const centerX = trackRect.left + trackRect.width / 2;
  track.querySelectorAll(".roadmap-card").forEach(function (card) {
    const cardRect = card.getBoundingClientRect();
    const cardCenterX = cardRect.left + cardRect.width / 2;
    const t = (cardCenterX - centerX) / (cardRect.width + 20);
    card.classList.toggle("is-focused", Math.abs(t) < 0.5);
    if (!is3D) return;
    const clamped = Math.max(-2.4, Math.min(2.4, t));
    const rotate = clamped * -32;
    const z = -Math.abs(clamped) * 90;
    const scale = 1 - Math.min(Math.abs(clamped) * 0.16, 0.4);
    const opacity = 1 - Math.min(Math.abs(clamped) * 0.32, 0.75);
    card.style.transform = "translateZ(" + z.toFixed(1) + "px) rotateY(" + rotate.toFixed(1) + "deg) scale(" + scale.toFixed(3) + ")";
    card.style.opacity = opacity.toFixed(3);
    card.style.zIndex = String(1000 - Math.round(Math.abs(clamped) * 10));
  });
}

// Scrolling is native (touch/trackpad/wheel); this just adds prev/next
// buttons and keeps focus/transform in sync with scroll position. No
// custom mouse-drag here on purpose — an earlier pointer-capture-based
// drag handler could get stuck mid-gesture and swallow every click on
// the page afterward, not just inside the track.
function roadmapSetUpScrollTrack(trackId, prevBtnId, nextBtnId, is3D) {
  const track = document.getElementById(trackId);
  if (!track) return;
  const prevBtn = document.getElementById(prevBtnId);
  const nextBtn = document.getElementById(nextBtnId);

  let ticking = false;
  track.addEventListener("scroll", function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { roadmapUpdateTrackFocus(track, is3D); ticking = false; });
  });
  roadmapUpdateTrackFocus(track, is3D);

  function step(dir) {
    const card = track.querySelector(".roadmap-card");
    const cardWidth = card ? card.getBoundingClientRect().width + 20 : 320;
    track.scrollBy({ left: dir * cardWidth, behavior: "smooth" });
  }
  if (prevBtn) prevBtn.addEventListener("click", function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener("click", function () { step(1); });
}

// Wires the Table/Curve/Cards/Orbit toggle buttons above the roadmap
// and renders every view once up front so switching is instant.
function setUpRoadmapViewSwitch(course) {
  const switchEl = document.getElementById("roadmap-view-switch");
  if (!switchEl || !course) return;

  renderRoadmapCurve(course);
  renderRoadmapCards(course);
  renderRoadmapOrbit(course);
  roadmapSetUpScrollTrack("roadmap-cards-track", "roadmap-cards-prev", "roadmap-cards-next", false);
  roadmapSetUpScrollTrack("roadmap-orbit-track", "roadmap-orbit-prev", "roadmap-orbit-next", true);

  const views = {
    table: document.getElementById("roadmap-view-table"),
    curve: document.getElementById("roadmap-view-curve"),
    cards: document.getElementById("roadmap-view-cards"),
    orbit: document.getElementById("roadmap-view-orbit")
  };

  switchEl.querySelectorAll(".roadmap-view-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchEl.querySelectorAll(".roadmap-view-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");

      const view = btn.getAttribute("data-view");
      Object.keys(views).forEach(function (key) { views[key].hidden = key !== view; });
      if (view !== "curve") hideCurvePopover();

      // Cards/Orbit were rendered up front while still hidden, so any
      // focus/transform computed then used zeroed-out (display:none)
      // measurements. Recompute now that the view is actually visible
      // and has real layout.
      if (view === "cards") roadmapUpdateTrackFocus(document.getElementById("roadmap-cards-track"), false);
      if (view === "orbit") roadmapUpdateTrackFocus(document.getElementById("roadmap-orbit-track"), true);
    });
  });
}
