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
  if (!getCurrentStudent()) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
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

  document.getElementById("rightnow-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const card = document.getElementById("rightnow-card");
  const tag = document.getElementById("rightnow-tag");
  const title = document.getElementById("rightnow-title");
  const instruction = document.getElementById("rightnow-instruction");
  const due = document.getElementById("rightnow-due");
  const ctaWrap = document.getElementById("rightnow-cta-wrap");
  const data = student.rightNow;

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

  const banner = document.getElementById("cheatsheet-banner");
  const count = document.getElementById("cheatsheet-banner-count");
  const entries = student.cheatSheet || [];

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

  document.getElementById("cheatsheet-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const list = document.getElementById("cheatsheet-list");
  const entries = student.cheatSheet || [];

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

  document.getElementById("feedback-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ",";

  const list = document.getElementById("feedback-list");
  const entries = student.feedback || [];

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

// Subject-specific app icons used by the course folder. They are inline SVG so
// the folder stays self-contained and does not depend on another icon service.
function courseIconHtml(icon) {
  if (icon === "biology") {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M20 10c22 10 22 34 0 44M44 10c-22 10-22 34 0 44" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
      '<path d="M22 18h20M18 27h28M18 37h28M22 46h20" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" opacity=".72"/>' +
    '</svg>';
  }
  return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
    '<path d="M39 9c-9 0-12 5-13 14l-3 24c-1 7-4 9-10 9" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>' +
    '<path d="M18 28h20M39 20l12 25M50 20L37 45" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round"/>' +
  '</svg>';
}

// Builds the iPhone-folder-style course launcher on portal.html. Only courses
// present in this student's courses array are rendered.
function renderCoursePortal(student) {
  if (!student) return;

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

  const courseId = new URLSearchParams(window.location.search).get("course");
  const course = getStudentCourse(student, courseId);
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

// Evenly spaces one point per chapter across the width. The y uses a
// hand-tuned two-frequency wave purely for visual variety — real
// peaks and troughs instead of one repeating wiggle.
function roadmapCurveLayout(groups, width, height) {
  const marginX = 50, marginY = 60;
  const usableW = width - marginX * 2;
  const usableH = height - marginY * 2;
  const n = groups.length;
  return groups.map(function (group, i) {
    const x = marginX + (n === 1 ? usableW / 2 : (usableW * i) / (n - 1));
    const wave = Math.sin(i * 0.85 + 0.4) * 0.55 + Math.sin(i * 1.6 + 1.3) * 0.3;
    const y = marginY + usableH * (0.5 - wave * 0.42);
    return { x: x, y: y, group: group };
  });
}

// Smooth curve through every point via Catmull-Rom -> cubic Bezier
// conversion, so the line passes exactly through each gem instead of
// just floating near it.
function roadmapCurvePath(points) {
  if (points.length < 2) return "";
  let d = "M " + points[0].x.toFixed(1) + " " + points[0].y.toFixed(1);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += " C " + cp1x.toFixed(1) + " " + cp1y.toFixed(1) + " " + cp2x.toFixed(1) + " " + cp2y.toFixed(1) + " " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
  }
  return d;
}

// The Catmull-Rom tangent direction at point i (unit vector) — this
// is the same slope the curve itself uses at that knot, so the
// tangent line drawn through a clicked gem actually matches the
// curve's local direction there.
function roadmapTangentAt(points, i) {
  const prev = points[i - 1] || points[i];
  const next = points[i + 1] || points[i];
  const dx = next.x - prev.x;
  const dy = next.y - prev.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return { x: dx / len, y: dy / len };
}

function roadmapDiamondPoints(cx, cy, r) {
  return cx + "," + (cy - r) + " " + (cx + r) + "," + cy + " " + cx + "," + (cy + r) + " " + (cx - r) + "," + cy;
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

  const gemsHtml = points.map(function (p, i) {
    const status = roadmapChapterOverallStatus(p.group.items);
    const color = (ROADMAP_STATUS_COLORS[status] || ROADMAP_FALLBACK_COLOR).text;
    return '<g class="roadmap-gem" data-gem-index="' + i + '">' +
      '<circle class="roadmap-gem-hit" cx="' + p.x + '" cy="' + p.y + '" r="22" fill="transparent"></circle>' +
      '<polygon points="' + roadmapDiamondPoints(p.x, p.y, 13) + '" fill="' + color + '" stroke="var(--bg)" stroke-width="1.5"></polygon>' +
      '<polygon points="' + roadmapDiamondPoints(p.x, p.y - 4, 5) + '" fill="rgba(255,255,255,0.4)"></polygon>' +
      '<text class="roadmap-gem-label" x="' + p.x + '" y="' + (p.y + 34) + '">' + p.group.label + '</text>' +
    '</g>';
  }).join("");

  svg.innerHTML =
    '<path class="roadmap-curve-path" d="' + roadmapCurvePath(points) + '"></path>' +
    '<line id="roadmap-tangent-line" class="roadmap-tangent-line" x1="0" y1="0" x2="0" y2="0" hidden></line>' +
    gemsHtml;

  svg.querySelectorAll(".roadmap-gem").forEach(function (gemEl) {
    gemEl.addEventListener("click", function (e) {
      e.stopPropagation();
      const i = parseInt(gemEl.getAttribute("data-gem-index"), 10);
      roadmapActivateGem(svg, points, i, gemEl);
    });
  });

  document.getElementById("curve-popover").addEventListener("click", function (e) {
    e.stopPropagation();
  });

  document.addEventListener("click", hideCurvePopover);
}

// Draws the tangent line through the clicked gem, marks it active,
// and opens its popover.
function roadmapActivateGem(svg, points, i, gemEl) {
  const point = points[i];
  const tangent = roadmapTangentAt(points, i);
  const L = 42;

  const line = document.getElementById("roadmap-tangent-line");
  line.setAttribute("x1", point.x - tangent.x * L);
  line.setAttribute("y1", point.y - tangent.y * L);
  line.setAttribute("x2", point.x + tangent.x * L);
  line.setAttribute("y2", point.y + tangent.y * L);
  line.hidden = false;

  svg.querySelectorAll(".roadmap-gem polygon:first-of-type").forEach(function (poly) {
    poly.setAttribute("stroke-width", "1.5");
  });
  gemEl.querySelector("polygon").setAttribute("stroke-width", "3");

  showCurvePopover(point.group, gemEl, svg);
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
  if (popover) popover.hidden = true;
  if (line) line.hidden = true;
}

// Wires the Table/Curve toggle buttons above the roadmap and renders
// the curve once up front so switching between views is instant.
function setUpRoadmapViewSwitch(course) {
  const switchEl = document.getElementById("roadmap-view-switch");
  if (!switchEl || !course) return;

  renderRoadmapCurve(course);

  const tableView = document.getElementById("roadmap-view-table");
  const curveView = document.getElementById("roadmap-view-curve");

  switchEl.querySelectorAll(".roadmap-view-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      switchEl.querySelectorAll(".roadmap-view-btn").forEach(function (b) { b.classList.remove("active"); });
      btn.classList.add("active");

      const view = btn.getAttribute("data-view");
      tableView.hidden = view !== "table";
      curveView.hidden = view !== "curve";
      if (view !== "curve") hideCurvePopover();
    });
  });
}
