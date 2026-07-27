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
*/

const SESSION_KEY = "loggedInUsername";

// Pages login.html is allowed to send someone back to after they log
// in. Keeps a crafted "?redirect=" link from sending someone to an
// external site or a javascript: URL.
const REDIRECTABLE_PAGES = ["index.html", "portal.html", "calendar.html", "right-now.html", "submit.html", "resources.html", "philosophy.html", "faq.html"];

// Checks a username/password against STUDENTS (from data.js).
// On success, remembers who's logged in (in this browser) and
// returns true. Returns false on a bad username/password.
function login(username, password) {
  const match = STUDENTS.find(function (s) {
    return s.username === username && s.password === password;
  });

  if (match) {
    localStorage.setItem(SESSION_KEY, match.username);
    return true;
  }
  return false;
}

// Returns the currently logged-in student object, or null if
// nobody is logged in on this browser.
function getCurrentStudent() {
  const username = localStorage.getItem(SESSION_KEY);
  if (!username) return null;
  return STUDENTS.find(function (s) { return s.username === username; }) || null;
}

// Sends the visitor to the login page if nobody is logged in,
// remembering the page they were trying to reach so login.html can
// send them back afterward. Call this at the very top of any
// "protected" page.
function requireLogin() {
  if (!getCurrentStudent()) {
    const here = window.location.pathname.split("/").pop();
    window.location.href = "login.html?redirect=" + encodeURIComponent(here);
  }
}

// Reads "?redirect=" from the login page's URL and returns it only
// if it's one of this site's own pages — otherwise sends the visitor
// home. Call this after a successful login.
function getLoginRedirect() {
  const requested = new URLSearchParams(window.location.search).get("redirect");
  return REDIRECTABLE_PAGES.includes(requested) ? requested : "index.html";
}

// Forgets who's logged in and returns to the home page.
function logout() {
  localStorage.removeItem(SESSION_KEY);
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
