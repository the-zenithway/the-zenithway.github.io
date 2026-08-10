## What this is

Zenith is a static site: plain HTML pages, one shared stylesheet, and a
handful of global JavaScript files loaded with `<script>` tags. No
framework, no build step, no server, no database. It's hosted on GitHub
Pages directly from `main`.

For the full architectural handoff (data model, auth, course-enrollment
rules, known risks) see [PROGRESS.md](PROGRESS.md) — that's the
authoritative doc, kept up to date after every meaningful change. This
README is a lighter orientation. [documentation.md](documentation.md) and
[features-dev.md](features-dev.md) cover project history; [todo.md](todo.md)
is the open work list.

## File structure

```
zenith-website/
├── Public pages
│   ├── index.html              Home
│   ├── philosophy.html         Teaching philosophy (the 3 pillars)
│   ├── resources.html          Public SAT/AP resources and links
│   ├── faq.html                Public FAQ
│   ├── blog.html / blog-post.html   Blog list / single post (?slug=)
│   ├── bio-self-study.html     Public, no-login AP Biology roadmap
│   ├── calc-bc-self-study.html Public, no-login AP Calc BC roadmap
│   ├── cheatsheet.html         (also reused as a public preview in places)
│   └── login.html              Shared student/parent/teacher login form
│
├── Student pages (require login)
│   ├── portal.html             Course chooser — iPhone-folder-style app icons
│   ├── roadmap.html?course=<id>  Selected course's roadmap (Table/Curve/Cards/Orbit views)
│   ├── right-now.html          One current priority/action ("Now")
│   ├── feedback.html           Personalized feedback log
│   ├── cheatsheet.html         Personalized formulas/patterns (KaTeX)
│   ├── calendar.html           Embedded Google Calendar
│   └── submit.html             Embedded Google submission form
│
├── Parent page (read-only)
│   └── parent.html             Summary dashboard, nothing editable
│
├── Teacher page
│   └── teacher.html            Placeholder dashboard (role-aware login)
│
├── css/
│   └── style.css               All styling — theme colors/fonts are CSS variables at the top
│
├── js/
│   ├── layout.js       Shared header/footer — every page mounts <div id="header-mount">
│   │                   / <div id="footer-mount"> and calls renderSiteHeader() /
│   │                   renderPortalHeader() / renderFooter() from here
│   ├── data.js         Student/teacher/parent accounts, course enrollments, roadmaps,
│   │                   Now state, feedback, cheat sheets — the "database"
│   ├── blog-data.js    Ordered blog-post list
│   ├── social-links.js Footer + contact-menu icon list
│   └── app.js          Auth, course/enrollment logic, and every page renderer
│
├── data/
│   ├── submissions-log.json    Compiled log of Google Form submissions (see automation/)
│   ├── calculus-t-bank.json     Calc BC T1-T10 problems + answer keys, for grading — see CLAUDE.md
│   ├── chemistry-t-bank.json    Chem T1-T10 problems + answer keys + explanations, for grading
│   └── calculus-c-bank.json / chemistry-c-bank.json   C-chapter banks — placeholders, not yet built
│
├── automation/
│   ├── README.md               How the submission compiler works
│   └── submissions-compiler.gs Reference copy of the Apps Script that writes data/submissions-log.json
│
├── PROGRESS.md          Authoritative architecture/handoff doc — read this first for real work
├── documentation.md      Full commit-by-commit project history
├── features-dev.md       Same history, condensed to feature-level changes
├── todo.md               Open work, organized by the 3 pillars + Maintenance + Admin
├── .nojekyll             Tells GitHub Pages to serve files as-is (no Jekyll processing)
└── README.md             This file
```

## Shared header and footer

Every page used to hand-copy its header/footer markup, so one nav change
meant editing 15+ files. That's now centralized in `js/layout.js`:

- Public pages have `<div id="header-mount">` / `<div id="footer-mount">`
  and call `renderSiteHeader({ active: 'resources' })` + `renderFooter()`.
- Protected (student/parent/teacher) pages call `renderPortalHeader({...})`
  instead, which renders the portal action bar (Courses/Now/Feedback/
  Calendar/Submit nav, logout button, etc.) rather than the public nav.

`js/layout.js` must load before the inline script that calls these
functions — see the `<script src="js/layout.js">` in each page's `<head>`.
To change the nav links, logo markup, or portal action buttons site-wide,
edit `SITE_NAV_LINKS`, `PORTAL_NAV_LINKS`, `PORTAL_ACTION_HTML`, or
`renderLogo()` in that one file.

## Roles and login

`login.html` is one shared form for three roles — student, parent, and
teacher. `js/app.js` checks students first, then teachers, then parents.
Each role has its own `requireXLogin()` guard and its own dashboard:
students land on `portal.html` (course chooser), parents on
`parent.html` (read-only summary), teachers on `teacher.html`
(placeholder — structure still being figured out).

This is convenience routing via `localStorage`, not real
authentication — see the Security section in [PROGRESS.md](PROGRESS.md)
before treating any of this as access control.

## Course-based data model

A student's real content — roadmap, Now, feedback, cheat sheet — lives
inside their `courses[]` array in `js/data.js`, not at the top level of
their record. "Enrolling" a student in a course means adding a full
course object to that array; it then appears as an app icon on
`portal.html` and becomes reachable at `roadmap.html?course=<id>`.
Students can be enrolled in more than one course at once (e.g. both AP
Biology and AP Calculus BC), and each course's Now/Feedback/Cheat Sheet
is scoped independently — see **Course enrollment model** in
[PROGRESS.md](PROGRESS.md) for the exact rules and current enrollments.

## Editing the footer's social icons

Open `js/social-links.js` — it's a short list, one line per icon:

```js
{ name: "Instagram", icon: "instagram", url: "https://instagram.com/YOUR_HANDLE" }
```

Change `url` to your real link and you're done — it updates on every
page at once via `renderSocialLinks()`. To remove an icon, delete its
line; to add one, copy a line and change all three values (`icon` must
be a valid slug from simpleicons.org); for an email contact, use
`"mailto:you@example.com"` as the url.

## The favicon

`favicon.ico`, `favicon-16x16.png`, `favicon-32x32.png`, and
`apple-touch-icon.png` are the site mark, rendered as fallbacks for
browsers/devices that need different formats. Replace all of them
(same filenames) to use a different logo.

## The theme

Every page shares one dark theme (background `#191919`, matched to
Notion's own dark mode) so there's no visible seam where embeds start.
Colors and fonts live as CSS variables near the top of `css/style.css`
— `--bg`, `--text`, `--accent`, and so on — change them there and the
whole site updates together.

## Submission pipeline

`submit.html` embeds a Google Form. A Google Apps Script bound to that
form (`automation/submissions-compiler.gs`) compiles every response
into `data/submissions-log.json`, OCR'ing any file upload along the
way. It only compiles a status-tracked log — it does not write
feedback, cheat sheet entries, or roadmap status. See
[automation/README.md](automation/README.md) for the full setup and
log entry shape.

## Regarding embedded Notion/Google content

Several legacy student pages and public resources still link out to
Notion; the native roadmap system (Table/Curve/Cards/Orbit views driven
by `js/data.js`) is gradually replacing that dependency course by
course — see the migration procedure in [PROGRESS.md](PROGRESS.md). The
Submit page is an intentional, permanent embed (Google Forms), not
something being migrated away from. The Calendar page (`calendar.html`)
was previously a Google Calendar embed; it's now a native, role-aware
in-site calendar backed by `data/calendar-events.json` — see
`automation/zenith-data-writer.gs`'s `createEvent`/`cancelEvent` actions.

## Using AI coding assistants in development

Codex and Claude Code are both used throughout development on this
project — to understand the existing site, plan and implement changes,
review edits, trace bugs, and verify updates stay consistent with the
static architecture and shared styles. Before making a change, provide
the relevant files and desired outcome; read [PROGRESS.md](PROGRESS.md)
first for the full handoff context. Review changes before publishing,
especially anything touching student data, external links, or portal
access.
