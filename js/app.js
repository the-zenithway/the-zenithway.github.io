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
const ROLE_KEY = "loggedInRole"; // "student", "teacher", or "parent"
const ACTIVE_COURSE_KEY = "activeCourseId";

// Pages login.html is allowed to send someone back to after they log
// in. Keeps a crafted "?redirect=" link from sending someone to an
// external site or a javascript: URL.
const REDIRECTABLE_PAGES = ["index.html", "portal.html", "roadmap.html", "calendar.html", "right-now.html", "submit.html", "feedback.html", "cheatsheet.html", "teacher.html", "teacher-student.html", "teacher-overview.html", "parent.html", "resources.html", "philosophy.html", "faq.html", "blog.html", "week.html"];

// Checks a username/password against STUDENTS first, then TEACHERS,
// then PARENTS (from data.js). On success, remembers who's logged in
// and which role they are (in this browser) and returns true. Returns
// false on a bad username/password.
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

  const parent = PARENTS.find(function (p) {
    return p.username === username && p.password === password;
  });
  if (parent) {
    localStorage.setItem(SESSION_KEY, parent.username);
    localStorage.setItem(ROLE_KEY, "parent");
    return true;
  }

  return false;
}

// Returns the currently logged-in student object, or null if
// nobody is logged in on this browser (or they're a teacher/parent).
function getCurrentStudent() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return STUDENTS.find(function (s) { return s.username === username; }) || null;
}

// Returns the currently logged-in teacher object, or null if nobody
// is logged in on this browser (or they're a student/parent).
function getCurrentTeacher() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return TEACHERS.find(function (t) { return t.username === username; }) || null;
}

// Returns the currently logged-in parent object, or null if nobody
// is logged in on this browser (or they're a student/teacher).
function getCurrentParent() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return PARENTS.find(function (p) { return p.username === username; }) || null;
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
  setUpWhatsNew(student);
}

// Same as requireLogin(), but for teacher.html — checks the TEACHERS
// list instead of STUDENTS.
function requireTeacherLogin() {
  if (!getCurrentTeacher()) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
}

// Same as requireLogin(), but for parent.html — checks the PARENTS
// list instead of STUDENTS.
function requireParentLogin() {
  if (!getCurrentParent()) {
    const here = window.location.pathname.split("/").pop() + window.location.search;
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
}

// Reads "?redirect=" from the login page's URL and returns it if
// it's one of this site's own pages; otherwise falls back to a
// role-appropriate default (teachers/parents -> their dashboard,
// students -> home). Call this after a successful login.
function getLoginRedirect() {
  const requested = new URLSearchParams(window.location.search).get("redirect");
  const requestedPage = requested ? requested.split("?")[0] : "";
  if (REDIRECTABLE_PAGES.includes(requestedPage)) return requested;
  const role = localStorage.getItem(ROLE_KEY);
  if (role === "teacher") return "teacher.html";
  if (role === "parent") return "parent.html";
  return "index.html";
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
  const revealBtn = document.getElementById("rightnow-reveal-btn");
  const bufferCard = document.getElementById("rightnow-buffer-card");
  const data = course ? course.rightNow : null;

  revealBtn.hidden = true;
  bufferCard.hidden = true;

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

  if (course) setUpRightNowBuffer(course, data);
}

// Lets a student peek at exactly one queued-up task if they finish
// the current one before we've had a chance to update things (e.g.
// we're offline) — capped at one task ahead, never a preview of
// everything left in the roadmap. Foldable both ways (in case it
// gets opened by accident) via a "See what's next" / "Hide" toggle;
// whichever state it's left in is remembered per exact task (keyed on
// chapter+unit, not just the course), so it resets on its own the
// moment we move them on to something new — no separate "clear the
// buffer" action needed anywhere.
function setUpRightNowBuffer(course, currentData) {
  const next = course.rightNowNext;
  const revealBtn = document.getElementById("rightnow-reveal-btn");
  const foldBtn = document.getElementById("rightnow-fold-btn");
  const bufferCard = document.getElementById("rightnow-buffer-card");
  if (!next) return;

  const key = "rightNowBufferSeen:" + course.id + ":" + currentData.chapter + ":" + currentData.unit;

  document.getElementById("rightnow-buffer-title").textContent = next.chapter + " · " + next.unit;
  document.getElementById("rightnow-buffer-instruction").textContent = next.instruction;

  function setExpanded(expanded) {
    bufferCard.hidden = !expanded;
    revealBtn.hidden = expanded;
    if (expanded) localStorage.setItem(key, "1");
    else localStorage.removeItem(key);
  }

  setExpanded(localStorage.getItem(key) === "1");
  revealBtn.onclick = function () { setExpanded(true); };
  foldBtn.onclick = function () { setExpanded(false); };
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

// ---- Submission log (submit.html) ----
// Reads data/submissions-log.json — the file the Apps Script
// submission compiler (automation/submissions-compiler.gs) appends to
// on every Form submission — and shows this student's own history for
// the current course, newest first. Compile-only, same as the log
// itself: this just displays what's there, it doesn't write anything.
const SUBMISSION_STATUS_COLORS = {
  "pending": { text: "#D6A94A", bg: "rgba(214, 169, 74, 0.18)" },
  "reviewed": { text: "#4ADE80", bg: "rgba(74, 222, 128, 0.16)" }
};

// Every non-file answer is a string; a file-upload question's answer
// is the only array (a list of Drive file IDs) — so scanning for the
// first array value finds it without depending on the exact question
// title, which can change on the Form.
function submissionFileIds(entry) {
  const answers = entry.answers || {};
  const key = Object.keys(answers).find(function (k) { return Array.isArray(answers[k]); });
  return key ? answers[key] : [];
}

// Resolves a submission's course from the raw "course" Form answer
// (e.g. "AP Chemistry") matched against real course names in
// STUDENTS, rather than trusting the log entry's own `courseId`
// field. `courseId` is only as good as
// automation/submissions-compiler.gs's COURSE_IDS map staying
// manually in sync — it already went stale once (missing "AP
// Chemistry" entirely, producing courseId: null on four real
// submissions in early August). Matching live against STUDENTS here
// means a course COURSE_IDS forgot still resolves correctly on every
// page without a second manual fix — the raw answer text is the
// source of truth, everywhere on the site.
function submissionCourseId(entry) {
  const raw = entry.answers && (entry.answers.course || entry.answers.Course);
  if (!raw) return entry.courseId || null;
  const lower = String(raw).trim().toLowerCase();
  let found = null;
  STUDENTS.forEach(function (s) {
    (s.courses || []).forEach(function (c) {
      if (!found && c.name.toLowerCase() === lower) found = c.id;
    });
  });
  return found || entry.courseId || null;
}

function submissionDateLabel(receivedAt) {
  const d = new Date(receivedAt);
  if (isNaN(d.getTime())) return receivedAt;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) +
    " · " + d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function submissionLogItemHtml(entry) {
  const thumbsHtml = submissionFileIds(entry).map(function (id) {
    return '<a class="submit-log-thumb" href="https://drive.google.com/file/d/' + id + '/view" target="_blank" rel="noopener">' +
      '<img src="https://drive.google.com/thumbnail?id=' + id + '&sz=w400" alt="Submitted photo" loading="lazy">' +
    '</a>';
  }).join("");

  const chapterUnit = [entry.chapter, entry.unit].filter(Boolean).join(" · ") || "Chapter/unit not recorded";
  const status = entry.status || "pending";

  return '<div class="submit-log-item">' +
    '<div class="submit-log-meta">' +
      '<span class="submit-log-date">' + submissionDateLabel(entry.receivedAt) + '</span>' +
      roadmapPillHtml(status, SUBMISSION_STATUS_COLORS, status) +
    '</div>' +
    '<p class="submit-log-chapter">' + chapterUnit + '</p>' +
    (thumbsHtml ? '<div class="submit-log-thumbs">' + thumbsHtml + '</div>' : '') +
    (entry.ocrText ? '<div class="submit-log-ocr">' + entry.ocrText.replace(/\n/g, '<br>') + '</div>' : '') +
  '</div>';
}

// Same submission data as submissionLogItemHtml above, but collapsed —
// used only on teacher-student.html, where a teacher is scanning
// *all* of one student's submission history at once and the full OCR
// text/thumbnails for every entry at once is just noise. Mirrors the
// "summary box, click through for the rest" pattern the student roster
// cards on teacher.html already use, except this expands in place
// (a plain <details>/<summary> — no JS needed) rather than linking to
// another page, since there's no dedicated single-submission page to
// link to.
function teacherSubmissionCardHtml(entry) {
  const thumbIds = submissionFileIds(entry);
  const thumbsHtml = thumbIds.map(function (id) {
    return '<a class="submit-log-thumb" href="https://drive.google.com/file/d/' + id + '/view" target="_blank" rel="noopener">' +
      '<img src="https://drive.google.com/thumbnail?id=' + id + '&sz=w400" alt="Submitted photo" loading="lazy">' +
    '</a>';
  }).join("");

  const chapterUnit = [entry.chapter, entry.unit].filter(Boolean).join(" · ") || "Chapter/unit not recorded";
  const status = entry.status || "pending";
  const hints = [];
  if (thumbIds.length > 0) hints.push(thumbIds.length + (thumbIds.length === 1 ? " photo" : " photos"));
  if (entry.ocrText) hints.push("OCR text");

  return '<details class="teacher-submission-item">' +
    '<summary class="teacher-submission-summary">' +
      '<span class="submit-log-date">' + submissionDateLabel(entry.receivedAt) + '</span>' +
      '<span class="teacher-submission-chapter">' + chapterUnit + '</span>' +
      roadmapPillHtml(status, SUBMISSION_STATUS_COLORS, status) +
      (hints.length > 0 ? '<span class="teacher-submission-hint">' + hints.join(" · ") + '</span>' : '') +
    '</summary>' +
    '<div class="teacher-submission-detail">' +
      (thumbsHtml ? '<div class="submit-log-thumbs">' + thumbsHtml + '</div>' : '') +
      (entry.ocrText ? '<div class="submit-log-ocr">' + entry.ocrText.replace(/\n/g, '<br>') + '</div>' : '') +
      (thumbsHtml === '' && !entry.ocrText ? '<p class="submit-log-empty">No photos or OCR text on this submission.</p>' : '') +
    '</div>' +
  '</details>';
}

// Fails quietly into the empty state if the fetch doesn't work (e.g.
// opened from file:// instead of a real server) — this is a
// nice-to-have log, not something that should block the page.
function renderSubmissionLog(student, course) {
  const list = document.getElementById("submit-log-list");
  if (!list || !student) return;

  list.innerHTML = '<p class="submit-log-empty">Loading your submissions...</p>';

  fetch("data/submissions-log.json")
    .then(function (res) { return res.json(); })
    .then(function (all) {
      const mine = all.filter(function (entry) {
        return entry.username === student.username && (!course || submissionCourseId(entry) === course.id);
      }).sort(function (a, b) { return new Date(b.receivedAt) - new Date(a.receivedAt); });

      if (mine.length === 0) {
        list.innerHTML = '<p class="submit-log-empty">Nothing submitted yet -- it will show up here once you submit through the form above.</p>';
        return;
      }

      list.innerHTML = mine.map(submissionLogItemHtml).join("");
    })
    .catch(function () {
      list.innerHTML = '<p class="submit-log-empty">Could not load your submission history right now.</p>';
    });
}

// ---- Teacher dashboard (teacher.html) ----
// A triage view over the same data the student/parent pages already
// read — data/submissions-log.json and each student's course records
// in js/data.js. Almost entirely read-only by design (see CLAUDE.md /
// todo.md): there is no general backend write path, so feedback,
// cheat sheets, and roadmap unlocks still happen by hand-editing
// js/data.js. The one exception is marking a submission Complete
// (see "Mark complete" below) — everything else here just makes
// "what needs my attention" scannable instead of requiring a teacher
// to reconstruct it from memory.
//
// Two sections, both filterable by subject via #teacher-course-filter:
//   1. Queue — every submission whose log entry isn't marked
//      "Complete" yet, oldest first. `status` is the one field in the
//      log a teacher already hand-edits after grading (see
//      automation/README.md), so it's the only reliable "needs
//      grading" signal — deliberately not trying to infer this from
//      feedback dates, since course.feedback[].date is a free-text
//      string like "Jul 30" with no year, not a comparable timestamp.
//   2. Roster — one card per enrolled student/course, surfacing the
//      raw signals a teacher needs to decide what's next (current
//      Now-page task, unlocked roadmap items, latest feedback) without
//      guessing at "stale" or "ready to unlock" on their behalf. Each
//      course name links to teacher-student.html for that student's
//      full detail view (roadmap, feedback, cheat sheet, submissions).

// Cache of the fetched log so switching the subject filter doesn't
// refetch — populated once by renderTeacherQueue(), read by anything
// that needs the raw list (currently just markSubmissionComplete_).
let teacherSubmissionsCache = null;

function teacherDaysAgoLabel(receivedAt) {
  const d = new Date(receivedAt);
  if (isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return days + " days ago";
}

// One entry per distinct enrolled course across all students, in
// first-seen order — feeds the subject filter dropdown without
// needing a separate hardcoded course list to keep in sync.
function teacherAllCourses() {
  const seen = {};
  const list = [];
  STUDENTS.forEach(function (s) {
    (s.courses || []).forEach(function (c) {
      if (!seen[c.id]) {
        seen[c.id] = true;
        list.push({ id: c.id, name: c.name });
      }
    });
  });
  return list;
}

function renderTeacherCourseFilter() {
  const select = document.getElementById("teacher-course-filter");
  if (!select) return;

  select.innerHTML = '<option value="">All subjects</option>' +
    teacherAllCourses().map(function (c) {
      return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join("");

  select.addEventListener("change", function () {
    renderTeacherQueue(select.value);
    renderTeacherRoster(select.value);
  });
}

// Posts a status change to SUBMISSION_STATUS_UPDATE_URL (js/data.js —
// left blank until that endpoint is deployed; see
// automation/submission-status-updater.gs). Sent as text/plain rather
// than application/json purely to dodge a CORS preflight, which Apps
// Script web apps don't handle — the endpoint still parses the body
// as JSON on its side. On success, updates the cached entry in place
// and re-renders both sections so the item disappears from the queue
// immediately instead of waiting for a full reload.
function markSubmissionComplete_(id, buttonEl) {
  if (!SUBMISSION_STATUS_UPDATE_URL) {
    alert("No status-update endpoint configured yet — see automation/submission-status-updater.gs for setup, then fill in SUBMISSION_STATUS_UPDATE_URL in js/data.js.");
    return;
  }

  buttonEl.disabled = true;
  buttonEl.textContent = "Marking complete...";

  fetch(SUBMISSION_STATUS_UPDATE_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ id: id })
  })
    .then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      const entry = (teacherSubmissionsCache || []).find(function (e) { return e.id === id; });
      if (entry) entry.status = "Complete";
      const select = document.getElementById("teacher-course-filter");
      renderTeacherQueue(select ? select.value : "", teacherSubmissionsCache);
    })
    .catch(function () {
      buttonEl.disabled = false;
      buttonEl.textContent = "Mark complete";
      alert("Could not mark this submission complete — the status-update endpoint may be down. Try again, or mark it by hand in data/submissions-log.json.");
    });
}

function teacherQueueItemHtml(entry) {
  const student = STUDENTS.find(function (s) { return s.username === entry.username; });
  const resolvedCourseId = submissionCourseId(entry);
  const course = student ? getStudentCourse(student, resolvedCourseId) : null;
  const chapterUnit = [entry.chapter, entry.unit].filter(Boolean).join(" · ") || "Chapter/unit not recorded";
  const remark = (entry.answers && entry.answers["feedback-and-remarks"]) || "";
  const thumbsHtml = submissionFileIds(entry).map(function (id) {
    return '<a class="submit-log-thumb" href="https://drive.google.com/file/d/' + id + '/view" target="_blank" rel="noopener">' +
      '<img src="https://drive.google.com/thumbnail?id=' + id + '&sz=w400" alt="Submitted photo" loading="lazy">' +
    '</a>';
  }).join("");
  // Only link through to teacher-student.html when the course
  // actually resolved (see submissionCourseId above) — an
  // unresolved course would otherwise send the teacher to a dead
  // "couldn't find that student/course" page, which reads as "this
  // student has no submissions" even though the entry is sitting
  // right here in the queue.
  const studentLink = (student && course)
    ? '<a class="teacher-queue-student" href="teacher-student.html?username=' + encodeURIComponent(student.username) + '&course=' + encodeURIComponent(resolvedCourseId) + '">' + student.name + '</a>'
    : '<span class="teacher-queue-student">' + (student ? student.name : entry.username) + '</span>';
  const courseLabel = course ? course.name : '<span class="teacher-queue-course-unresolved">Course not recorded</span>';

  return '<div class="teacher-queue-item" data-submission-id="' + entry.id + '">' +
    '<div class="teacher-queue-head">' +
      studentLink +
      '<span class="teacher-queue-course">' + courseLabel + '</span>' +
      '<span class="teacher-queue-waiting">' + teacherDaysAgoLabel(entry.receivedAt) + '</span>' +
    '</div>' +
    '<p class="teacher-queue-chapter">' + chapterUnit + '</p>' +
    (remark ? '<p class="teacher-queue-remark">"' + remark + '"</p>' : "") +
    (entry.ocrText ? '<div class="teacher-queue-ocr">' + entry.ocrText.replace(/\n/g, '<br>') + '</div>' : "") +
    (thumbsHtml ? '<div class="submit-log-thumbs">' + thumbsHtml + '</div>' : "") +
    '<button type="button" class="teacher-mark-complete-btn" data-mark-complete="' + entry.id + '">Mark complete</button>' +
  '</div>';
}

// `cached`, if given, skips the fetch (used by markSubmissionComplete_
// to re-render instantly off the already-fetched list after a status
// change instead of hitting the network again).
function renderTeacherQueue(courseFilter, cached) {
  const list = document.getElementById("teacher-queue-list");
  if (!list) return;

  const render = function (all) {
    teacherSubmissionsCache = all;
    const pending = all
      .filter(function (entry) { return entry.status !== "Complete"; })
      .filter(function (entry) { return !courseFilter || submissionCourseId(entry) === courseFilter; })
      .sort(function (a, b) { return new Date(a.receivedAt) - new Date(b.receivedAt); });

    const countEl = document.getElementById("teacher-queue-count");
    if (countEl) countEl.textContent = pending.length > 0 ? String(pending.length) : "";

    if (pending.length === 0) {
      list.innerHTML = '<p class="teacher-empty">Nothing waiting on you here — every matching submission is marked Complete.</p>';
      return;
    }

    list.innerHTML = pending.map(teacherQueueItemHtml).join("");
    list.querySelectorAll("[data-mark-complete]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        markSubmissionComplete_(btn.getAttribute("data-mark-complete"), btn);
      });
    });
  };

  if (cached) { render(cached); return; }

  list.innerHTML = '<p class="teacher-empty">Loading submissions...</p>';
  fetch("data/submissions-log.json")
    .then(function (res) { return res.json(); })
    .then(render)
    .catch(function () {
      list.innerHTML = '<p class="teacher-empty">Could not load the submission log right now.</p>';
    });
}

function teacherStudentCardHtml(student, course) {
  const items = course.roadmap || [];
  const pct = roadmapPercentComplete(items);
  const data = course.rightNow;
  const unlocked = items.filter(function (it) { return it.status === "Unlocked"; });
  const latestFeedback = (course.feedback || [])[0];
  const detailHref = "teacher-student.html?username=" + encodeURIComponent(student.username) + "&course=" + encodeURIComponent(course.id);

  let nowClass = "parent-now";
  let nowHtml = '<p class="parent-now-empty">Nothing set right now.</p>';
  if (data) {
    const isWaiting = data.state === "waiting";
    if (isWaiting) nowClass += " is-waiting";
    nowHtml =
      '<p class="parent-now-tag">' + (isWaiting ? "With us" : "Their move") + '</p>' +
      '<p class="parent-now-text">' + data.chapter + ' · ' + data.unit + ' — ' + (isWaiting ? data.note : data.instruction) + '</p>';
  }

  const unlockedHtml = unlocked.length > 0
    ? '<div class="teacher-unlocked">' + unlocked.map(function (it) {
        return roadmapPillHtml("Unlocked", ROADMAP_STATUS_COLORS, it.chapter + " · " + it.name);
      }).join("") + '</div>'
    : '<p class="teacher-unlocked-empty">Nothing currently unlocked.</p>';

  const feedbackHtml = latestFeedback
    ? '<p class="teacher-latest-feedback">Latest feedback — ' + latestFeedback.date + ', ' + latestFeedback.chapter + ' · ' + latestFeedback.unit + '</p>'
    : '<p class="teacher-latest-feedback teacher-latest-feedback-empty">No feedback written yet.</p>';

  return '<div class="parent-course-card">' +
    '<div class="parent-course-head">' +
      '<h3 class="parent-course-name"><a class="teacher-student-link" href="' + detailHref + '">' + course.name + ' →</a></h3>' +
      '<span class="parent-course-pct">' + pct + '% complete</span>' +
    '</div>' +
    '<div class="parent-course-progress"><span class="parent-course-progress-bar" style="width:' + pct + '%;"></span></div>' +
    '<div class="' + nowClass + '">' + nowHtml + '</div>' +
    unlockedHtml +
    feedbackHtml +
  '</div>';
}

function renderTeacherRoster(courseFilter) {
  const wrap = document.getElementById("teacher-roster");
  if (!wrap) return;

  const withCourses = STUDENTS
    .map(function (s) {
      const courses = (s.courses || []).filter(function (c) { return !courseFilter || c.id === courseFilter; });
      return { student: s, courses: courses };
    })
    .filter(function (entry) { return entry.courses.length > 0; });

  if (withCourses.length === 0) {
    wrap.innerHTML = '<p class="teacher-empty">No students match this filter.</p>';
    return;
  }

  wrap.innerHTML = withCourses.map(function (entry) {
    const body = entry.courses.map(function (course) { return teacherStudentCardHtml(entry.student, course); }).join("");
    return '<section class="parent-student">' +
      '<h2 class="parent-student-name">' + entry.student.name + '</h2>' +
      body +
    '</section>';
  }).join("");
}

function renderTeacherDashboard(teacher) {
  if (!teacher) return;
  document.getElementById("teacher-greeting").textContent =
    "Hey " + teacher.name.split(" ")[0] + ",";
  renderTeacherCourseFilter();
  renderTeacherQueue("");
  renderTeacherRoster("");
}

// ---- Teacher overview (teacher-overview.html) ----
// One row per enrolled course across every student, compiling the same
// course.metrics fields renderTeacherMetrics() shows on
// teacher-student.html into a single scannable table. Averages are
// rounded to the nearest whole number; any missing/empty field renders
// as "—" rather than 0, so an ungraded chapter doesn't look identical
// to an actual zero score.
function teacherAvg_(arr, key) {
  if (!arr || arr.length === 0) return null;
  const values = arr.map(function (item) { return item[key]; }).filter(function (v) { return v !== null && v !== undefined; });
  if (values.length === 0) return null;
  const sum = values.reduce(function (a, b) { return a + b; }, 0);
  return Math.round(sum / values.length);
}

function teacherOverviewRowHtml(student, course) {
  const metrics = course.metrics || {};
  const progress = roadmapPercentComplete(course.roadmap || []);
  const mastery = teacherAvg_(metrics.topicMastery, "score");
  const cScore = teacherAvg_(metrics.chapterScores, "cScore");
  const tScore = teacherAvg_(metrics.chapterScores, "tScore");
  const motivationList = metrics.motivation || [];
  const latestMotivation = motivationList.length > 0 ? motivationList[motivationList.length - 1].score : null;
  const mockList = metrics.mockScores || [];
  const mockPct = mockList.length === 0 ? null : Math.round(
    mockList.reduce(function (sum, m) {
      const score = m.mcq.score + m.frq.score;
      const maxScore = m.mcq.maxScore + m.frq.maxScore;
      return sum + (score / maxScore) * 100;
    }, 0) / mockList.length
  );
  const avgDays = teacherAvg_(metrics.timeToCompletion, "days");
  const ap = metrics.apFinalScore;
  const detailHref = "teacher-student.html?username=" + encodeURIComponent(student.username) + "&course=" + encodeURIComponent(course.id);
  const dash = '<span class="teacher-overview-empty">—</span>';

  return '<tr class="teacher-overview-row" data-href="' + detailHref + '">' +
    '<td data-label="Student"><a class="teacher-student-link" href="' + detailHref + '">' + student.name + '</a></td>' +
    '<td data-label="Course">' + course.name + '</td>' +
    '<td data-label="Progress">' + progress + '%</td>' +
    '<td data-label="Mastery">' + (mastery === null ? dash : mastery) + '</td>' +
    '<td data-label="C-score">' + (cScore === null ? dash : cScore) + '</td>' +
    '<td data-label="T-score">' + (tScore === null ? dash : tScore) + '</td>' +
    '<td data-label="Motivation">' + (latestMotivation === null ? dash : latestMotivation) + '</td>' +
    '<td data-label="Mock avg">' + (mockPct === null ? dash : mockPct + '%') + '</td>' +
    '<td data-label="Avg pace">' + (avgDays === null ? dash : avgDays + 'd/chapter') + '</td>' +
    '<td data-label="AP final">' + (ap ? ap.score + '/' + ap.maxScore : dash) + '</td>' +
  '</tr>';
}

function renderTeacherOverviewTable_(courseFilter) {
  const tbody = document.getElementById("teacher-overview-tbody");
  const table = document.getElementById("teacher-overview-table");
  const empty = document.getElementById("teacher-overview-empty");
  if (!tbody) return;

  const rows = [];
  STUDENTS.forEach(function (student) {
    (student.courses || []).forEach(function (course) {
      if (courseFilter && course.id !== courseFilter) return;
      rows.push(teacherOverviewRowHtml(student, course));
    });
  });

  if (rows.length === 0) {
    table.hidden = true;
    empty.hidden = false;
    return;
  }

  table.hidden = false;
  empty.hidden = true;
  tbody.innerHTML = rows.join("");

  tbody.querySelectorAll(".teacher-overview-row").forEach(function (row) {
    row.addEventListener("click", function (e) {
      if (e.target.tagName === "A") return;
      window.location.href = row.getAttribute("data-href");
    });
  });
}

function renderTeacherOverviewPage() {
  const select = document.getElementById("teacher-overview-filter");
  select.innerHTML = '<option value="">All subjects</option>' +
    teacherAllCourses().map(function (c) {
      return '<option value="' + c.id + '">' + c.name + '</option>';
    }).join("");

  select.addEventListener("change", function () { renderTeacherOverviewTable_(select.value); });

  renderTeacherOverviewTable_("");
}

// ---- Teacher student detail (teacher-student.html) ----
// The "click a student, see their full picture" page — one course's
// full roadmap/rightNow/feedback/cheat sheet/submissions for one
// student, read straight from js/data.js by ?username=&course= in the
// URL. Deliberately its own page rather than reusing renderRightNow /
// renderFeedback / renderCheatSheetPage directly: those all read the
// *logged-in* student via getSelectedCourse()/localStorage, and
// repurposing them for "a teacher looking at someone else" would mean
// temporarily overwriting the session's active student/course, which
// risks corrupting the teacher's own logged-in state if anything
// throws mid-render. renderRoadmap(course) is the one exception reused
// as-is — it already takes an explicit course argument and touches no
// session state.
// Renders course.metrics (see the shape comment in js/data.js) into the
// "Metrics" section of teacher-student.html. Every sub-section is
// independently optional — course.metrics itself, and each array/field
// inside it, may be missing, so each block below guards for that rather
// than assuming a fully-populated shape.
function renderTeacherMetrics(metrics) {
  const wrap = document.getElementById("teacher-student-metrics");
  if (!metrics) {
    wrap.innerHTML = '<p class="feedback-empty">No metrics recorded yet.</p>';
    return;
  }

  const mastery = metrics.topicMastery || [];
  const masteryHtml = mastery.length === 0 ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">Topic mastery</p>' +
      mastery.map(function (m) {
        return '<div class="teacher-metric-row">' +
          '<span class="teacher-metric-name">' + m.chapter + ' — ' + m.topic + '</span>' +
          '<span class="teacher-metric-bar"><span class="teacher-metric-bar-fill" style="width:' + m.score + '%"></span></span>' +
          '<span class="teacher-metric-pct">' + m.score + '</span>' +
        '</div>';
      }).join("") +
    '</div>';

  const chapterScores = metrics.chapterScores || [];
  const chapterScoresHtml = chapterScores.length === 0 ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">C / T scores by chapter</p>' +
      '<table class="teacher-metric-table">' +
        '<thead><tr><th>Chapter</th><th>C-score</th><th>T-score</th></tr></thead>' +
        '<tbody>' +
          chapterScores.map(function (c) {
            return '<tr><td>' + c.chapter + '</td>' +
              '<td>' + (c.cScore === null || c.cScore === undefined ? '—' : c.cScore) + '</td>' +
              '<td>' + (c.tScore === null || c.tScore === undefined ? '—' : c.tScore) + '</td></tr>';
          }).join("") +
        '</tbody>' +
      '</table>' +
    '</div>';

  const motivation = metrics.motivation || [];
  const motivationHtml = motivation.length === 0 ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">Motivation over time</p>' +
      motivation.map(function (m) {
        return '<div class="teacher-metric-row">' +
          '<span class="teacher-metric-name">' + m.date + '</span>' +
          '<span class="teacher-metric-bar"><span class="teacher-metric-bar-fill" style="width:' + m.score + '%"></span></span>' +
          '<span class="teacher-metric-pct">' + m.score + '</span>' +
        '</div>';
      }).join("") +
    '</div>';

  const mockScores = metrics.mockScores || [];
  const mockScoresHtml = mockScores.length === 0 ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">Mock scores</p>' +
      mockScores.map(function (m) {
        return '<div class="teacher-mock-item">' +
          '<p class="teacher-mock-name">' + m.name + ' (' + m.date + ')</p>' +
          '<div class="teacher-metric-row">' +
            '<span class="teacher-metric-name">MCQ</span>' +
            '<span class="teacher-metric-pct">' + m.mcq.score + ' / ' + m.mcq.maxScore + '</span>' +
          '</div>' +
          '<div class="teacher-metric-row">' +
            '<span class="teacher-metric-name">FRQ</span>' +
            '<span class="teacher-metric-pct">' + m.frq.score + ' / ' + m.frq.maxScore + '</span>' +
          '</div>' +
        '</div>';
      }).join("") +
    '</div>';

  const timeToCompletion = metrics.timeToCompletion || [];
  const timeToCompletionHtml = timeToCompletion.length === 0 ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">Time to completion</p>' +
      '<table class="teacher-metric-table">' +
        '<thead><tr><th>Chapter</th><th>Days unlock → complete</th></tr></thead>' +
        '<tbody>' +
          timeToCompletion.map(function (t) {
            return '<tr><td>' + t.chapter + '</td><td>' + t.days + '</td></tr>';
          }).join("") +
        '</tbody>' +
      '</table>' +
    '</div>';

  const ap = metrics.apFinalScore;
  const apHtml = !ap ? "" :
    '<div class="teacher-metric-block">' +
      '<p class="teacher-metric-label">AP final score</p>' +
      '<div class="teacher-metric-row">' +
        '<span class="teacher-metric-name">' + ap.examDate + '</span>' +
        '<span class="teacher-metric-pct">' + ap.score + ' / ' + ap.maxScore + '</span>' +
      '</div>' +
    '</div>';

  const blocks = [masteryHtml, chapterScoresHtml, motivationHtml, mockScoresHtml, timeToCompletionHtml, apHtml].filter(function (h) { return h !== ""; });
  wrap.innerHTML = blocks.length === 0
    ? '<p class="feedback-empty">No metrics recorded yet.</p>'
    : blocks.join("");
}

function renderTeacherStudentPage() {
  const params = new URLSearchParams(window.location.search);
  const username = params.get("username");
  const courseId = params.get("course");
  const student = STUDENTS.find(function (s) { return s.username === username; });
  const course = student ? getStudentCourse(student, courseId) : null;

  const notFound = document.getElementById("teacher-student-not-found");
  const content = document.getElementById("teacher-student-content");

  if (!student || !course) {
    notFound.hidden = false;
    content.hidden = true;
    return;
  }

  notFound.hidden = true;
  content.hidden = false;

  document.getElementById("teacher-student-name").textContent = student.name;
  document.getElementById("teacher-student-course").textContent = course.name;
  document.title = student.name + " · " + course.name + " — Zenith";

  const data = course.rightNow;
  const nowWrap = document.getElementById("teacher-student-now");
  if (!data) {
    nowWrap.innerHTML = '<p class="parent-now-empty">Nothing set right now.</p>';
  } else {
    const isWaiting = data.state === "waiting";
    nowWrap.className = "parent-now" + (isWaiting ? " is-waiting" : "");
    nowWrap.innerHTML =
      '<p class="parent-now-tag">' + (isWaiting ? "With us" : "Their move") + '</p>' +
      '<p class="parent-now-text">' + data.chapter + ' · ' + data.unit + ' — ' + (isWaiting ? data.note : data.instruction) + '</p>';
  }

  renderTeacherMetrics(course.metrics);

  renderRoadmap(course);

  const feedbackList = document.getElementById("teacher-student-feedback");
  const feedback = course.feedback || [];
  feedbackList.innerHTML = feedback.length === 0
    ? '<p class="feedback-empty">No feedback written yet.</p>'
    : feedback.map(function (entry) {
        return '<div class="feedback-item">' +
          '<div class="feedback-meta">' +
            '<span class="feedback-date">' + entry.date + '</span>' +
            '<span class="feedback-chapter">' + entry.chapter + ' · ' + entry.unit + '</span>' +
          '</div>' +
          '<p class="feedback-content">' + entry.content + '</p>' +
        '</div>';
      }).join("");

  const cheatList = document.getElementById("teacher-student-cheatsheet");
  const cheatSheet = course.cheatSheet || [];
  cheatList.innerHTML = cheatSheet.length === 0
    ? '<p class="feedback-empty">No cheat sheet entries yet.</p>'
    : cheatSheet.map(function (entry) {
        return '<div class="feedback-item">' +
          '<div class="feedback-meta">' +
            '<p class="cheatsheet-topic">' + entry.topic + '</p>' +
            '<span class="cheatsheet-source">' + entry.source + '</span>' +
          '</div>' +
          '<p class="cheatsheet-pattern">' + entry.pattern + '</p>' +
        '</div>';
      }).join("");

  renderMath(document.getElementById("teacher-student-content"));

  const subList = document.getElementById("teacher-student-submissions");
  subList.innerHTML = '<p class="submit-log-empty">Loading submissions...</p>';
  fetch("data/submissions-log.json")
    .then(function (res) { return res.json(); })
    .then(function (all) {
      const mine = all
        .filter(function (entry) { return entry.username === student.username && submissionCourseId(entry) === course.id; })
        .sort(function (a, b) { return new Date(b.receivedAt) - new Date(a.receivedAt); });
      subList.innerHTML = mine.length === 0
        ? '<p class="submit-log-empty">Nothing submitted yet for this course.</p>'
        : mine.map(teacherSubmissionCardHtml).join("");
    })
    .catch(function () {
      subList.innerHTML = '<p class="submit-log-empty">Could not load submissions right now.</p>';
    });
}

// ---- Parent dashboard (parent.html) ----
// A read-only, course-scoped progress summary — one section per
// linked student, one card per that student's enrolled course. There
// is deliberately nothing to click that changes any data anywhere on
// this page: no submit form, no "message us" contact menu, no edit
// controls. Just what's already true, reused from the same helpers
// the student-facing pages already use (roadmapPercentComplete,
// roadmapGroupByChapter, roadmapChapterOverallStatus, roadmapPillHtml)
// so a parent's numbers can never drift from what the student sees.
//
// `lang` ("en"/"ko", from js/i18n.js's getLang()) only affects this
// page's own static labels (greeting, "Chapter", pill text, etc) —
// not student/course names or actual feedback/instruction content,
// which is tutor-authored English and outside this toggle's scope.
// Word order differs enough between the two languages (e.g. the
// greeting) that these are built as whole strings per language
// rather than word-for-word substitution.
const PARENT_I18N = {
  subtitle: {
    en: "A read-only summary — nothing here can be edited or submitted from this account.",
    ko: "읽기 전용 요약입니다 — 이 계정에서는 아무것도 수정하거나 제출할 수 없습니다."
  },
  noStudent: {
    en: "No student is linked to this account yet.",
    ko: "아직 이 계정에 연결된 학생이 없습니다."
  },
  noCourses: {
    en: "No courses set up yet.",
    ko: "아직 등록된 과목이 없습니다."
  },
  chapter: { en: "Chapter ", ko: "챕터 " },
  complete: { en: "complete", ko: "완료" },
  yourMove: { en: "Your move", ko: "지금 할 일" },
  withUs: { en: "With us", ko: "검토 중" },
  nothingNow: { en: "Nothing set right now.", ko: "현재 설정된 항목이 없습니다." },
  latestFeedback: { en: "Latest feedback — ", ko: "최근 피드백 — " }
};

function pt(key, lang) {
  const entry = PARENT_I18N[key];
  return (entry && entry[lang]) || (entry && entry.en) || key;
}

// Korean labels for the same ROADMAP_STATUS_COLORS keys used by the
// pills elsewhere — kept separate from that shared map since it's
// English-only and used on student-facing pages too.
const PARENT_STATUS_LABELS_KO = {
  "Complete": "완료",
  "Review": "검토",
  "Unlocked": "잠금 해제",
  "Optional-Reading": "선택 읽기자료",
  "Locked": "잠김"
};

function renderParentDashboard(parent, lang) {
  lang = lang || "en";
  if (!parent) return;
  document.getElementById("parent-greeting").textContent =
    lang === "ko" ? parent.name + "님, 안녕하세요," : "Hey " + parent.name + ",";

  const subtitle = document.querySelector(".parent-subtitle");
  if (subtitle) subtitle.textContent = pt("subtitle", lang);

  const wrap = document.getElementById("parent-summary");
  const students = (parent.linkedStudents || [])
    .map(function (username) { return STUDENTS.find(function (s) { return s.username === username; }); })
    .filter(Boolean);

  if (students.length === 0) {
    wrap.innerHTML = '<p class="parent-empty">' + pt("noStudent", lang) + '</p>';
    return;
  }

  wrap.innerHTML = students.map(function (student) {
    const courses = student.courses || [];
    const body = courses.length === 0
      ? '<p class="parent-empty">' + pt("noCourses", lang) + '</p>'
      : courses.map(function (course) { return parentCourseCardHtml(course, lang); }).join("");
    return '<section class="parent-student">' +
      '<h2 class="parent-student-name">' + student.name + '</h2>' +
      body +
    '</section>';
  }).join("");
}

function parentCourseCardHtml(course, lang) {
  lang = lang || "en";
  const items = course.roadmap || [];
  const pct = roadmapPercentComplete(items);
  const groups = roadmapGroupByChapter(items);
  const data = course.rightNow;

  const chaptersHtml = groups.map(function (group) {
    const status = roadmapChapterOverallStatus(group.items);
    const chapterPct = roadmapPercentComplete(group.items);
    const statusLabel = lang === "ko" ? (PARENT_STATUS_LABELS_KO[status] || status) : status.replace(/-/g, " ");
    return '<div class="parent-chapter-row">' +
      '<span class="parent-chapter-label">' + pt("chapter", lang) + group.label + '</span>' +
      roadmapPillHtml(status, ROADMAP_STATUS_COLORS, statusLabel) +
      '<span class="parent-chapter-pct">' + chapterPct + '%</span>' +
    '</div>';
  }).join("");

  let nowClass = "parent-now";
  let nowHtml = '<p class="parent-now-empty">' + pt("nothingNow", lang) + '</p>';
  if (data) {
    const isWaiting = data.state === "waiting";
    if (isWaiting) nowClass += " is-waiting";
    nowHtml =
      '<p class="parent-now-tag">' + (isWaiting ? pt("withUs", lang) : pt("yourMove", lang)) + '</p>' +
      '<p class="parent-now-text">' + data.chapter + ' · ' + data.unit + ' — ' + (isWaiting ? data.note : data.instruction) + '</p>';
  }

  const feedback = course.feedback || [];
  const latestFeedback = feedback[0];
  const feedbackHtml = latestFeedback
    ? '<div class="parent-feedback">' +
        '<p class="parent-feedback-label">' + pt("latestFeedback", lang) + latestFeedback.date + '</p>' +
        '<p class="parent-feedback-content">' + latestFeedback.content + '</p>' +
      '</div>'
    : "";

  return '<div class="parent-course-card">' +
    '<div class="parent-course-head">' +
      '<h3 class="parent-course-name">' + course.name + '</h3>' +
      '<span class="parent-course-pct">' + pct + '% ' + pt("complete", lang) + '</span>' +
    '</div>' +
    '<div class="parent-course-progress"><span class="parent-course-progress-bar" style="width:' + pct + '%;"></span></div>' +
    '<div class="' + nowClass + '">' + nowHtml + '</div>' +
    '<div class="parent-chapters">' + chaptersHtml + '</div>' +
    feedbackHtml +
  '</div>';
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
    const page = url.pathname.split("/").pop();
    if (page === "portal.html") return;
    url.searchParams.set("course", course.id);
    link.setAttribute("href", page + url.search);
  });

  const cheatSheetLink = document.querySelector("#cheatsheet-banner a");
  if (cheatSheetLink) {
    cheatSheetLink.href = "cheatsheet.html?course=" + encodeURIComponent(course.id);
  }

  renderRightNowBreadcrumb(course);

  return course;
}

// A persistent "Next up" strip under the header, visible on every
// course-scoped page (not just right-now.html itself), so a student
// never has to go back to Now just to remember what it said. Built
// and inserted from here rather than hand-added to every page, since
// this already runs on all of them via requireLogin -> here. Skipped
// on right-now.html (the full task is already right there) and on
// portal.html (no single course is selected yet — getSelectedCourse
// already returns null there, so this function is never reached).
function renderRightNowBreadcrumb(course) {
  const existing = document.getElementById("rightnow-breadcrumb");
  if (existing) existing.remove();

  const page = window.location.pathname.split("/").pop();
  if (page === "right-now.html" || page === "week.html") return;

  const data = course.rightNow;
  if (!data) return;

  const header = document.querySelector(".portal-bar");
  if (!header) return;

  const isWaiting = data.state === "waiting";
  const bar = document.createElement("div");
  bar.id = "rightnow-breadcrumb";
  bar.className = "rightnow-breadcrumb" + (isWaiting ? " rightnow-breadcrumb-waiting" : "");
  bar.innerHTML =
    '<a class="rightnow-breadcrumb-link" href="right-now.html?course=' + encodeURIComponent(course.id) + '">' +
      '<span class="rightnow-breadcrumb-eyebrow">Next up</span>' +
      '<span class="rightnow-breadcrumb-tag">' + (isWaiting ? "With us" : "Your move") + '</span>' +
      '<span class="rightnow-breadcrumb-text">' + data.chapter + ' · ' + data.unit + ' — ' + (isWaiting ? data.note : data.instruction) + '</span>' +
      '<span class="rightnow-breadcrumb-arrow" aria-hidden="true">→</span>' +
    '</a>';

  header.insertAdjacentElement("afterend", bar);
}

// ---- "What's new" changelog feed ----
// A GitHub Action (.github/workflows/notify.yml, notify-on-push job) runs
// the same change-detection logic used for the email digests
// (automation/notifications/compute-changes.js) on every push to main and
// commits the result to data/changelog-events.json — a real, shared,
// server-computed event log, not a guess. This is the single source of
// truth for "what changed"; the browser's only job is to remember, per
// student per device, the last time they opened the dropdown (in
// localStorage) and show events newer than that.

const ZENITH_CHANGELOG_LAST_SEEN_PREFIX = "zenithChangelogLastSeen:";
const CHANGELOG_EVENTS_URL = "data/changelog-events.json";

// A missing last-seen timestamp means this is the very first time we've
// looked on this device (or localStorage was cleared) — in that case there
// is nothing to report; we just seed "now" as the baseline silently so
// nothing gets flagged as "new" on a first visit.
function computeWhatsNew(student, eventsByUsername) {
  const key = ZENITH_CHANGELOG_LAST_SEEN_PREFIX + student.username;
  const lastSeen = localStorage.getItem(key);
  const events = (eventsByUsername && eventsByUsername[student.username]) || [];

  const changes = lastSeen ? events.filter(function (e) { return e.timestamp > lastSeen; }) : [];

  return { changes: changes, key: key, isFirstVisit: !lastSeen };
}

// Builds (once) and refreshes the "Updates" button + dropdown in the
// header's action row. Injected via JS rather than hand-added to
// every page, same as the Next Up breadcrumb.
function setUpWhatsNew(student) {
  if (!student) return;
  const actions = document.querySelector(".portal-actions");
  if (!actions) return;

  let wrap = document.getElementById("whatsnew-wrap");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.className = "whatsnew-wrap";
    wrap.id = "whatsnew-wrap";
    wrap.innerHTML =
      '<button type="button" class="whatsnew-btn" id="whatsnew-btn">Updates<span class="whatsnew-badge" id="whatsnew-badge" hidden></span></button>' +
      '<div class="whatsnew-menu" id="whatsnew-menu" hidden></div>';
    actions.insertBefore(wrap, actions.firstChild);
  }

  const btn = document.getElementById("whatsnew-btn");
  const badge = document.getElementById("whatsnew-badge");
  const menu = document.getElementById("whatsnew-menu");

  fetch(CHANGELOG_EVENTS_URL)
    .then(function (res) { return res.ok ? res.json() : {}; })
    .catch(function () { return {}; })
    .then(function (eventsByUsername) {
      const result = computeWhatsNew(student, eventsByUsername);

      badge.hidden = result.changes.length === 0;
      badge.textContent = String(result.changes.length);

      menu.innerHTML = result.changes.length > 0
        ? result.changes.map(function (c) {
            return '<a class="whatsnew-item" href="' + c.url + '">' + c.text + '</a>';
          }).join("")
        : '<p class="whatsnew-empty">You’re all caught up.</p>';

      btn.onclick = function (e) {
        e.stopPropagation();
        menu.hidden = !menu.hidden;
        if (!menu.hidden) {
          localStorage.setItem(result.key, new Date().toISOString());
          badge.hidden = true;
        }
      };
      menu.onclick = function (e) { e.stopPropagation(); };
      document.addEventListener("click", function () { menu.hidden = true; });

      if (result.isFirstVisit) {
        localStorage.setItem(result.key, new Date().toISOString());
      }
    });
}

// Subject-specific app icons used by the course folder. They are inline SVG so
// the folder stays self-contained and does not depend on another icon service.
function courseIconHtml(icon) {
  if (icon === "chemistry") {
    return "<svg viewBox=\"0 0 64 64\" aria-hidden=\"true\"><path d=\"M24 8h16M28 8v17L15 48c-2 4 1 8 6 8h22c5 0 8-4 6-8L36 25V8\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"4\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M20 43h24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"3\" stroke-linecap=\"round\" opacity=\".75\"/><circle cx=\"28\" cy=\"48\" r=\"2\" fill=\"currentColor\"/><circle cx=\"37\" cy=\"51\" r=\"2.5\" fill=\"currentColor\" opacity=\".75\"/></svg>";
  }
  if (icon === "biology") {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M32 7c15 6 21 17 21 27 0 15-10 23-21 23S11 49 11 34c0-10 6-21 21-27z" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M32 57V9M32 7l-6 8M32 7l6 8" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85"/>' +
      '<circle cx="32" cy="35" r="9" fill="none" stroke="currentColor" stroke-width="2.5" opacity=".72"/>' +
      '<circle cx="32" cy="35" r="2.5" fill="currentColor" opacity=".85"/>' +
      '<path d="M18 24c3-3 6-3 8 0M38 47c3 3 6 3 8 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" opacity=".55"/>' +
    '</svg>';
  }
  if (icon === "computer-science") {
    return '<svg viewBox="0 0 64 64" aria-hidden="true">' +
      '<path d="M22 20L9 32l13 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M42 20l13 12-13 12" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<path d="M37 14L27 50" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" opacity=".85"/>' +
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
    const pct = roadmapPercentComplete(course.roadmap || []);
    return '<a class="course-app" href="roadmap.html?course=' + encodeURIComponent(course.id) + '">' +
      '<span class="course-app-icon course-app-icon--' + course.icon + '">' + courseIconHtml(course.icon) + '</span>' +
      '<span class="course-app-name">' + course.name + '</span>' +
      '<span class="course-app-progress"><span class="course-app-progress-bar" style="width:' + pct + '%;"></span></span>' +
      '<span class="course-app-progress-label">' + pct + '% complete</span>' +
    '</a>';
  }).join("");

  const weekLink = document.getElementById("course-folder-week-link");
  if (weekLink) weekLink.hidden = courses.length < 2;
}

// ---- This Week (week.html) ----
// A combined, cross-course view for students enrolled in more than one
// subject — one compact card per enrolled course, each showing exactly
// that course's single "rightNow" item (same field renderRightNow()
// reads), so the total list is always capped at one task per course
// rather than a preview of every course's full roadmap. Linked from
// portal.html only when a student has 2+ courses (see renderCoursePortal
// above); a single-course student has no real use for it, but the page
// itself works fine for any student count, including zero.
function renderWeekView(student) {
  if (!student) return;
  localStorage.removeItem(ACTIVE_COURSE_KEY);

  document.getElementById("week-greeting").textContent =
    "Hey " + student.name.split(" ")[0] + ", here's what's next across every course.";

  const courses = student.courses || [];
  const list = document.getElementById("week-list");

  if (courses.length === 0) {
    list.innerHTML = '<p class="course-folder-empty">You are not enrolled in a course yet.</p>';
    return;
  }

  list.innerHTML = courses.map(weekCourseCardHtml).join("");
}

function weekCourseCardHtml(course) {
  const data = course.rightNow;
  const isWaiting = !!data && data.state === "waiting";

  let cardClass = "rightnow-card";
  cardClass += !data ? " rightnow-empty" : isWaiting ? " rightnow-waiting" : " rightnow-active";

  const tag = !data ? "" : isWaiting ? "With us" : "Your move";
  const title = data ? data.chapter + " · " + data.unit : "Nothing set yet";
  const body = !data
    ? "Check back soon, or open this course for the full picture."
    : (isWaiting ? data.note : data.instruction);
  const due = (data && !isWaiting && data.due)
    ? '<span class="rightnow-due">Due ' + data.due + '</span>'
    : "";

  return '<div class="' + cardClass + '">' +
    '<div class="week-card-head">' +
      '<span class="course-app-icon course-app-icon--' + course.icon + ' week-card-icon">' + courseIconHtml(course.icon) + '</span>' +
      '<p class="week-card-course">' + course.name + '</p>' +
    '</div>' +
    (tag ? '<p class="rightnow-tag">' + tag + '</p>' : "") +
    '<h2 class="rightnow-title">' + title + '</h2>' +
    '<p class="rightnow-instruction">' + body + '</p>' +
    '<div class="rightnow-footer">' +
      due +
      '<a class="week-card-open" href="right-now.html?course=' + encodeURIComponent(course.id) + '">Open ' + course.name + ' →</a>' +
    '</div>' +
  '</div>';
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

// How much each category counts toward "percent complete." Book
// chapter and coursework (and their Biology equivalents, Learning and
// Notes Submission) are the actual learning and practice, so they
// carry the most weight. A Test — and a full Mock — is the proof
// that the learning stuck, so it counts a little more than a Review.
// A Review counts meaningfully but less than doing the work itself.
// Solution manuals and pure information items are reference material,
// not something a student "completes" in a way that reflects
// progress, so they're weighted just above zero rather than excluded
// outright.
const ROADMAP_CATEGORY_WEIGHT = {
  "B-book chapter": 3,
  "C-coursework": 3,
  "L-Learning": 3,
  "N-Notes Submission": 3,
  "T-Test": 2.5,
  "M-Mock": 2.5,
  "R-Review": 2,
  "F-Final Self Check": 2,
  "S-solution manual": 0.5,
  "I-information": 0.5
};

function roadmapItemWeight(item) {
  return ROADMAP_CATEGORY_WEIGHT[item.category] || 1;
}

// Weighted percent complete across a list of roadmap items — an
// empty/unset roadmap reads as 0%, not NaN.
function roadmapPercentComplete(items) {
  if (!items || items.length === 0) return 0;
  let total = 0, done = 0;
  items.forEach(function (item) {
    const w = roadmapItemWeight(item);
    total += w;
    if (item.status === "Complete") done += w;
  });
  return total === 0 ? 0 : Math.round((done / total) * 100);
}

// Fills in roadmap.html's table from one selected enrolled course
// (the caller has already verified the course belongs to the
// logged-in student). Shows an empty state if it has no roadmap yet.
function renderRoadmap(course) {

  const table = document.getElementById("roadmap-table");
  const empty = document.getElementById("roadmap-empty");
  const tbody = document.getElementById("roadmap-tbody");
  const items = course ? (course.roadmap || []) : [];

  const progressEl = document.getElementById("roadmap-course-progress");
  if (progressEl) progressEl.textContent = items.length > 0 ? roadmapPercentComplete(items) + "% complete" : "";

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
      '<td class="roadmap-chapter" data-label="Chapter" style="color:' + roadmapChapterColor(item.chapter) + ';">' + item.chapter + '</td>' +
      '<td class="roadmap-name" data-label="Name">' + namePrefix + item.name + '</td>' +
      '<td data-label="Category">' + roadmapPillHtml(item.category, ROADMAP_CATEGORY_COLORS, roadmapCategoryLabel(item.category)) + '</td>' +
      '<td data-label="Status">' + roadmapPillHtml(item.status, ROADMAP_STATUS_COLORS, item.status.replace(/-/g, " ")) + '</td>' +
      '<td data-label="Links">' + link + '</td>' +
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

  title.textContent = "Chapter " + group.label + " · " + roadmapPercentComplete(group.items) + "%";
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
  const pct = roadmapPercentComplete(group.items);
  const itemsHtml = group.items.map(function (item) {
    const nameHtml = (item.url && item.status !== "Locked")
      ? '<a class="roadmap-card-item-name roadmap-card-item-link" href="' + item.url + '" target="_blank" rel="noopener">' + item.name + '</a>'
      : '<span class="roadmap-card-item-name">' + item.name + '</span>';
    return '<div class="roadmap-card-item">' +
      nameHtml +
      roadmapPillHtml(item.status, ROADMAP_STATUS_COLORS, item.status.replace(/-/g, " ")) +
    '</div>';
  }).join("");
  return '<div class="roadmap-card">' +
    '<div class="roadmap-card-head">' +
      '<p class="roadmap-card-tag" style="color:' + color + ';">' + status.replace(/-/g, " ") + '</p>' +
      '<span class="roadmap-card-pct">' + pct + '%</span>' +
    '</div>' +
    '<h3 class="roadmap-card-title">' + roadmapCardTopicName(group) + '</h3>' +
    '<div class="roadmap-card-progress"><span class="roadmap-card-progress-bar" style="width:' + pct + '%;"></span></div>' +
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
