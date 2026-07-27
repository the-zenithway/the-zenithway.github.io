# Zenith Web — Project Progress and Codex Handoff

Last updated: 2026-07-27

This file is the persistent handoff document for this repository. A new Codex
session should read this file, `README.md`, and `todo.md` before making changes.
It explains the current architecture and records work that may not be obvious
from an isolated prompt.

## Instructions for future Codex sessions

1. Read this entire file before editing the project.
2. Run `git status --short --branch` and preserve all pre-existing changes.
3. Compare the working tree with `HEAD` if expected files appear to be missing.
4. Read the files involved in the requested feature before changing them.
5. Keep the static HTML/CSS/JavaScript architecture unless the user explicitly
   requests a larger migration.
6. Test the affected public, student, or teacher flow after making a change.
7. Update the Current State and Work Log sections below before handing off.
8. Never place new real passwords, private tokens, or secrets in this document.

When updating this file, keep stable architectural information in the sections
above the Work Log. Add a new dated entry to the top of the Work Log for each
meaningful task. Do not erase older entries unless they are factually wrong;
mark superseded information clearly instead.

## Project purpose

Zenith Web is a static education and student-portal site hosted through GitHub
Pages. It provides public information and study resources, personalized student
roadmaps and feedback, embedded external tools, and an early teacher dashboard.

There is no server, database, framework, dependency manifest, compilation step,
or automated test suite in this repository. Pages load plain HTML, one shared
CSS file, and global JavaScript files directly in the browser.

## Git structure

- Remote: `origin`, pointing to the `the-zenithway/the-zenithway.github.io`
  GitHub repository.
- Primary and only observed branch: `main`.
- `origin/HEAD` points to `origin/main`.
- At the time of this handoff, local `main` and `origin/main` both point to
  commit `0a8485e` (`todo upate`).
- History is linear and contains 61 commits as of 2026-07-27.
- Most commits are small direct changes to content, student data, or a single
  feature. Commit messages are informal; CLI-managed student changes sometimes
  use `zenith: add student ...` or `zenith: remove student ...`.
- The main contributors visible in history are `kyj9981` and `Hamin Park`.
- GitHub Pages is enabled by the repository layout; `.nojekyll` asks GitHub to
  serve files without Jekyll processing.
- There is currently no `.gitignore`. `.DS_Store` files are tracked in the root,
  `css/`, and `js/`; avoid adding more generated OS files.

### Existing uncommitted work

At the time this file was created, `README.md` already had an uncommitted
10-line section named `Using Codex in development`. This change predates
`PROGRESS.md` and belongs to the user. Preserve it unless the user explicitly
asks to change or discard it.

Always re-check `git status` because this section can become outdated.

## Repository layout

### Public pages

- `index.html` — home page and public introduction.
- `philosophy.html` — teaching philosophy.
- `resources.html` — public SAT/AP resources and external links.
- `faq.html` — public FAQ, including several unfinished answers.
- `blog.html` — blog index rendered from `js/blog-data.js`.
- `blog-post.html` — individual post selected using a URL slug.
- `login.html` — shared student/teacher login form.

### Authenticated student pages

- `portal.html` — the student's full roadmap; the portal navigation labels it
  `Roadmap`.
- `right-now.html` — renders one current priority/action for the student.
- `feedback.html` — personalized feedback and a cheat-sheet link when available.
- `cheatsheet.html` — personalized formulas/notes with KaTeX math rendering.
- `calendar.html` — shared embedded Google Calendar.
- `submit.html` — embedded Google submission form.

### Teacher page

- `teacher.html` — protected teacher dashboard placeholder. Authentication and
  rendering hooks exist, but the dashboard structure is still minimal.

### Shared code and data

- `css/style.css` — all shared styles, theme variables, public layouts, portal
  layouts, roadmap, feedback, blog, responsive behavior, and component styles.
- `js/app.js` — all shared browser logic and render functions.
- `js/data.js` — shared calendar/submission URLs plus student and teacher data.
- `js/blog-data.js` — ordered blog-post records.
- `js/social-links.js` — footer/contact link records.
- `README.md` — basic project editing and architecture documentation.
- `todo.md` — product ideas and unfinished roadmap items.
- `.claude/launch.json` — local static server configuration using
  `python3 -m http.server 8934`.
- Favicons and PNG assets — browser icons plus a header design reference.

## Runtime and dependency flow

All data and functions are globals loaded with normal `<script>` tags. Script
order matters: data files must load before `js/app.js`, and page-specific inline
scripts run last.

Typical public page:

```text
HTML -> js/data.js -> js/social-links.js -> js/app.js
     -> renderSocialLinks() + renderNavAuth()
```

Blog pages additionally load `js/blog-data.js` before `js/app.js` and call
`renderBlogList()` or `renderBlogPost()`.

Typical protected student page:

```text
HTML -> js/data.js -> js/app.js
     -> requireLogin() -> getCurrentStudent() -> page render function
```

`right-now.html` also loads `js/social-links.js` because its contact menu uses
the configured social/contact records.

`cheatsheet.html` loads KaTeX and its auto-render extension from jsDelivr, then
calls `renderMath()` after rendering the personalized sheet.

## JavaScript architecture

`js/app.js` is organized as global functions rather than modules or classes.
Its main responsibilities are:

- Authentication: `login`, `getCurrentStudent`, `getCurrentTeacher`,
  `requireLogin`, `requireTeacherLogin`, `getLoginRedirect`, and `logout`.
- Public UI: `renderSocialLinks` and `renderNavAuth`.
- External embeds: `renderEmbedPage`.
- Student features: `renderRightNow`, `setUpContactMenu`,
  `renderCheatSheetBanner`, `renderCheatSheetPage`, `renderMath`,
  `renderFeedback`, and `renderRoadmap`.
- Teacher feature: `renderTeacherDashboard`.
- Blog features: `renderBlogList` and `renderBlogPost`.
- Roadmap presentation: category/status color maps and pill-label helpers.

Authentication uses these local-storage keys:

- `loggedInUsername`
- `loggedInRole` (`student` or `teacher`)

Redirect destinations are restricted by a hard-coded allowlist in `app.js`.
When adding a protected page that can be used as a login redirect, update that
allowlist as well as the navigation on every related page.

## Data model

`js/data.js` is executable browser JavaScript, not a private database. It
currently defines:

- `CALENDAR_URL` — one shared Google Calendar embed.
- `SUBMISSION_FORM_URL` — one shared Google Form embed.
- `STUDENTS` — login records and personalized portal information.
- `TEACHERS` — teacher login records.

Student records have evolved beyond the older README example. The current code
uses personalized roadmap, current-action, feedback, and cheat-sheet data in
addition to identity/login information. Read the live schema in `js/data.js`
and its consumers in `js/app.js` before adding or modifying records.

`js/data.js` may be regenerated by `zenith-cli`. Prefer preserving its existing
format and comments. Changes made manually can be overwritten by a later CLI
operation.

## Course enrollment model

In Zenith, enrolling a student in a course means adding a course object to that
student's `courses` array in `js/data.js`. Each course object contains:

```js
{
  id: "stable-url-id",
  name: "Visible Course Name",
  icon: "subject-icon-key",
  roadmap: [/* that course's roadmap rows */]
}
```

`portal.html` is the student's course chooser. It renders only the objects in
the logged-in student's `courses` array as app-style subject icons.
`roadmap.html?course=<id>` resolves the requested ID only against that same
array, so a student cannot select a course that is not in their enrollments.

To enroll a student in an existing course, copy the complete course object (or
its roadmap with the same course metadata) into that student's `courses` array.
To unenroll them, remove that course object. Do not add course icons manually to
HTML; the chooser is data-driven.

Current enrollments:

- Bogue Kwon: AP Calculus BC.
- Hamin Park: AP Biology and AP Calculus BC. Hamin's Calculus roadmap is an exact
  copy of Bogue's 88-row roadmap at the time of enrollment.
- Other student records currently have no native course enrollment and see the
  empty-course state.

## Page and UI conventions

- Theme values are CSS custom properties near the top of `css/style.css`.
- Public pages repeat the same header/navigation/footer markup rather than using
  templates. A public navigation change normally requires editing every public
  HTML page.
- Protected pages repeat a separate portal bar. A portal navigation change
  normally requires editing every student HTML page and setting the appropriate
  `active` class on each page.
- The logo is repeated as inline SVG plus a CSS-built wordmark.
- Public content is generally wrapped in `.container`.
- Protected pages use `body.portal-body` and portal-specific layout classes.
- DOM nodes are usually empty in HTML and populated by a named render function.
- Code style uses two-space indentation in JavaScript data, semicolons, `const`
  for shared bindings, and traditional function declarations/callbacks.
- HTML uses minimal indentation at the document level and two spaces within
  components.
- The site intentionally uses a dark palette matching embedded Notion pages.

## External services

The site currently depends on:

- GitHub Pages for hosting.
- Google Fonts for Manrope, IBM Plex Mono, and Space Grotesk.
- Simple Icons CDN for social icons.
- Google Calendar for the shared calendar.
- Google Forms for submissions.
- KaTeX from jsDelivr for cheat-sheet math.
- Notion/EmbedNotion or direct Notion links for some existing resources and
  legacy student content.
- Google Drive and other public websites linked from the Resources page.

External embed availability and permissions can fail independently of this
repository. Verify both the generated URL and the provider's sharing settings
when diagnosing an empty iframe.

## Security and privacy limitations

This is a static client-side site. Usernames, passwords, teacher credentials,
student records, and private-looking external URLs in `js/data.js` are delivered
to visitors and can be viewed in browser developer tools or source files.
`localStorage` authentication only controls navigation and rendering; it does
not create real authorization or make external Notion/Google pages private.

Do not describe the current login as secure. Any request involving sensitive
student information or real access control likely requires a backend or managed
authentication service, which would be a significant architectural change and
should be discussed explicitly with the user.

Avoid reproducing credentials in logs, summaries, screenshots, commit messages,
or this handoff document.

## Known issues and maintenance risks

- `README.md` contains older portal examples that do not fully match the current
  expanded data schema and navigation.
- Public and portal headers are duplicated across many HTML files, making it
  easy for navigation to become inconsistent.
- There is no automated validation or test suite.
- There is no `.gitignore`, and macOS `.DS_Store` files are tracked.
- Several Resources links are placeholders (`href="#"`).
- The College Board Bluebook URL in `resources.html` appears accidentally
  repeated several times in one `href` and should be repaired when authorized.
- Several FAQ answers and AP resource subsections are placeholders.
- Some social URLs are placeholders such as Discord/WhatsApp/KakaoTalk values.
- External CDNs and embeds are runtime dependencies and need network access.
- Client-side credentials and student data are the largest structural risk.
- The teacher dashboard is only a placeholder.

## Efficient change checklist

For every implementation task:

- Identify whether it affects public pages, student pages, teacher pages, or
  shared data.
- Search for every repeated navigation/header instance before editing.
- Follow data fields from `js/data.js` into their renderer in `js/app.js`, then
  into the target IDs/classes in HTML and CSS.
- Preserve the load order of scripts.
- Add new redirectable protected pages to `REDIRECTABLE_PAGES`.
- Check desktop and narrow/mobile layouts for navigation-heavy changes.
- Run a local static server when interaction or routing needs verification.
- Review `git diff --check`, `git diff --stat`, and the focused diff.
- Do not commit or push unless the user explicitly requests it.
- Update this document's Current State and Work Log.

## Completed Request — Hamin's native AP Biology roadmap

The user provided the `d2d2` Notion CSV export for Hamin Park. It was converted
into a
native Zenith roadmap like Bogue Kwon's AP Calculus BC roadmap. The user should
not need to explain this goal again.

The intended result is:

- Store the selected student's roadmap directly in that student's `roadmap`
  array in `js/data.js`.
- Display it through `portal.html` and the existing
  `renderRoadmap(student)` function in `js/app.js`.
- Remove the active dependency on a Notion embed for that roadmap.
- Show the roadmap only for the corresponding logged-in student under the
  site's existing client-side account selection.
- Leave linked external learning materials external unless the user separately
  asks to migrate those files into this repository.

When the user supplies the Notion link, identify which existing student account
should receive the roadmap if their message does not make that clear. Do not ask
them to repeat the architecture or desired behavior documented here.

### Bogue's roadmap as the reference implementation

Bogue's native roadmap is not rendered from Notion. His student record contains
a `roadmap` array whose items use this shape:

```js
{
  name: "Visible resource or activity name",
  category: "B-book chapter",
  chapter: "Chapter 1",
  status: "Unlocked",
  url: "https://..." // optional
}
```

Existing category keys are `I-information`, `B-book chapter`, `C-coursework`,
`S-solution manual`, `R-Review`, `T-Test`, and `M-Mock`. Existing statuses are
`Complete`, `Review`, `Unlocked`, `Optional-Reading`, and `Locked`.
`renderRoadmap()` converts these into colored pills. Locked items never display
an `Open` link, even if their records include URLs. Unknown values receive
neutral fallback styling rather than breaking the table.

Bogue's Calculus structure covers introductory information, Chapters 1–12, and
a mock-exam section. Typical chapters contain book, coursework, solution,
review, and test entries. Use this as the structural reference, but derive the
new student's actual chapters and rows from their Notion content rather than
copying Calculus-specific names.

### Migration procedure for the future Codex session

1. Confirm the target student's existing `STUDENTS` record without exposing or
   repeating their password.
2. Inspect the supplied Notion page/database. It must be published and readable
   through the link. If it cannot be read, ask for a Notion CSV export rather
   than asking the user to explain the project again.
3. Inventory every row and relevant property: ordering, chapter/group, title,
   category/type, status, and destination URL.
4. Normalize the records into Zenith's `{ name, category, chapter, status,
   url? }` schema while preserving meaningful Notion ordering.
5. Map clear equivalent categories/statuses. If a mapping is ambiguous, ask or
   extend the renderer deliberately; do not silently discard information.
6. Add the `roadmap` array only to the target student's `js/data.js` record.
7. Disable the legacy Notion dependency as appropriate, but preserve its old
   URL until the native roadmap is verified or the user requests removal.
8. Verify account isolation, row ordering, rendering, colored labels,
   locked-link behavior, destination links, and narrow-screen usability.
9. Compare the migrated row count and important links against the Notion source
   to ensure the transfer is complete.
10. Update Current State and the Work Log with the student, source, migrated row
    count, mapping decisions, verification, and unresolved items. Never record
    credentials here.

### Meaning of "independent from Notion"

The roadmap's structure, labels, statuses, and resource-link list will live in
Zenith's own source data and render without loading Notion. This does not copy
linked PDFs, videos, Google Drive files, or other resources into the repository.
Migrating those assets is a separate task requiring the files and confirmation

## Current State

- Repository architecture and Git history have been inventoried.
- Public pages, student flows, teacher placeholder, shared render functions, and
  data ownership are documented above.
- No application code was changed during the inventory.
- `PROGRESS.md` was added as the persistent Codex handoff document.
- Existing user modification in `README.md` remains untouched.
- Hamin Park's AP Biology roadmap is now native Zenith data: 63 ordered entries
  across Chapters 0–8 and Chapter M, with 63 resource links and 8 separate
  submission links imported from `d2d2`.
- Hamin's Now page assigns Chapter 1, L1 Chemistry of Life as his current move.
- Hamin's Feedback page contains one congratulatory Chapter 0 Foundations entry
  that gives study advice and directs him to move on to L1.

- The Portal link now opens an iPhone-folder-style course chooser; roadmap
  tables live on `roadmap.html` and are selected by enrolled course ID.
- Hamin is enrolled in AP Biology and AP Calculus BC; Bogue is enrolled in AP
  Calculus BC. Other students currently have no course objects.

## Work Log

Add new entries immediately below this instruction, newest first. Each entry
should include the date, request, files changed, verification, and any remaining
work or important decisions.

### 2026-07-27 — Added multi-course enrollment and course chooser

- Request: place a course-selection page between Portal/login and roadmaps,
  styled like an iPhone app folder with subject-specific app icons.
- Definition: enrollment now means a course object exists in the student's
  `courses` array; only enrolled courses are rendered or resolvable.
- Files changed: `js/data.js`, `js/app.js`, `css/style.css`, `portal.html`, new
  `roadmap.html`, all protected student navigation pages, and `PROGRESS.md`.
- Data migration: Bogue's 88-row Calculus roadmap became his AP Calculus BC
  course. Hamin's 63-row Biology roadmap became AP Biology, and Hamin was also
  enrolled in an exact copy of Bogue's 88-row AP Calculus BC course roadmap.
- UI: Portal renders a translucent rounded folder with Biology DNA and Calculus
  integral/graph SVG app icons; each icon links to its course roadmap.
- Isolation: course IDs are resolved only inside the logged-in student's course
  list. Students without courses receive an empty enrollment state.
- Routing: `roadmap.html` was added to safe redirects, and login now preserves
  the selected local `?course=` query.
- Verification: both JavaScript files pass syntax checks; enrollment counts are
  Bogue 1 and Hamin 2; Hamin's Calculus copy matches all 88 Bogue rows; no legacy
  top-level roadmap arrays remain; navigation and `git diff --check` pass.

### 2026-07-27 — Added Hamin's L1 Now task and feedback

- Request: place L1 in Hamin's Now section and add sensible congratulatory
  feedback that tells him to move forward.
- Files changed: `js/data.js` and `PROGRESS.md`.
- Now state: `your-move`, Chapter 1, unit L1, Chemistry of Life on Khan Academy,
  due next session.
- Feedback: one Chapter 0 Foundations entry congratulating Hamin on completing
  the orientation materials, advising active use of references, and directing
  him to L1 Chemistry of Life.
- Design: no new markup or CSS was needed. Hamin uses the same `renderRightNow`
  and `renderFeedback` functions and styles as Bogue.
- Verification: `js/data.js` passes `node --check`; Hamin's resolved record
  contains the intended task and one feedback entry; `git diff --check` passes.

### 2026-07-27 — Migrated Hamin's AP Biology roadmap

- Converted the local `d2d2` Notion CSV into a native roadmap for Hamin.
- Files changed: `js/data.js`, `js/app.js`, and `PROGRESS.md`.
- Imported 63 rows across Chapters 0–8 and Chapter M, preserving 63 resource
  links and 8 separate submission links.
- Added Biology category colors and separate Submit-link rendering.
- Only Hamin received this roadmap; Bogue's Calculus roadmap is unchanged.
- Both JavaScript files and `git diff --check` pass.

### 2026-07-27 — Recorded pending Notion roadmap migration

- Request: convert another student's existing Notion roadmap into an independent
  Zenith roadmap matching Bogue's native Calculus implementation.
- Files changed: `PROGRESS.md` only.
- Decision: reuse the per-student `roadmap` schema and `renderRoadmap()` instead
  of creating another Notion iframe.
- Input still needed: the published Notion link and target student account. A
  CSV export is the fallback if the Notion page cannot be read.
- Scope: the roadmap becomes independent from Notion; linked external materials
  remain external unless separately migrated.
- Application/data changes: none yet.

### 2026-07-27 — Repository handoff documentation

- Request: understand the full repository and create an editable progress file
  for future memoryless Codex sessions.
- Files changed: `PROGRESS.md` added.
- Investigation: mapped branches, remote, commit history, tracked files, public
  and authenticated pages, shared JavaScript functions, data ownership, external
  services, and known maintenance/security risks.
- Existing work preserved: uncommitted `README.md` Codex-development section.
- Verification: documentation was derived from the working tree and current
  Git `HEAD`; no application behavior was modified.
- Remaining work: continue updating this log after future tasks.

