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

- Remote: `origin`, pointing to `the-zenithway/the-zenithway.github.io`.
- Primary branch: `main`; `origin/HEAD` points to `origin/main`.
- Current pulled state verified on 2026-07-27: local `main` and `origin/main`
  point to merge commit `398aa79` (`Merge roadmap-views into app-launcher-view:
  courses + Table/Curve views`).
- Relevant remote branches include `app-launcher-view`, `roadmap-views`, and
  `integrate-courses-and-views`; their work is merged into `main`.
- The working tree was clean immediately after the pull. This documentation edit
  makes `PROGRESS.md` modified until committed; always run `git status` again.
- GitHub Pages serves the committed/pushed `main`. Local edits do not appear on
  the public website until explicitly committed and pushed. If the published
  site shows old markup after deployment, hard-refresh and allow Pages/cache
  propagation time.
- GitHub Pages is served without Jekyll because `.nojekyll` is tracked.
- There is no `.gitignore`; `.DS_Store` files are tracked in several directories.
- Commit messages are informal and generally feature-focused. Do not commit or
  push unless the user explicitly requests it.

## Repository layout

### Public pages

- `index.html` — home page and public introduction.
- `philosophy.html` — teaching philosophy.
- `resources.html` — public SAT/AP resources and external links.
- `faq.html` — public FAQ, including unfinished answers.
- `blog.html` and `blog-post.html` — data-driven blog list/post pages.
- `login.html` — shared student/teacher login form.

### Authenticated student pages

- `portal.html` — course chooser, not a roadmap. It renders only the logged-in
  student's enrolled courses as iPhone-folder-style subject apps.
- `roadmap.html?course=<id>` — selected enrolled course roadmap with Table and
  Curve views and an All Courses return link.
- `right-now.html` — one current priority/action for the student.
- `feedback.html` — personalized feedback and cheat-sheet banner.
- `cheatsheet.html` — personalized patterns/formulas with KaTeX rendering.
- `calendar.html` — shared embedded Google Calendar.
- `submit.html` — shared embedded Google submission form.

### Teacher page

- `teacher.html` — protected placeholder dashboard with role-aware login.

### Shared code and data

- `css/style.css` — complete shared theme and all public, portal, course-folder,
  Table/Curve roadmap, feedback, blog, and responsive styles.
- `js/app.js` — authentication and every shared browser renderer.
- `js/data.js` — shared embed URLs, student/teacher accounts, course enrollments,
  roadmaps, Now state, feedback, and cheat sheets.
- `js/blog-data.js` — ordered blog-post data.
- `js/social-links.js` — footer and Right Now contact destinations.
- `PROGRESS.md` — authoritative Codex handoff; update after meaningful work.
- `README.md` — general documentation, some examples may lag the live schema.
- `todo.md` — product ideas and roadmap.
- `d2d2/` — source Notion CSV export used for Hamin's AP Biology migration.
- `.claude/launch.json` — static server on port 8934.

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
     -> requireLogin() -> getCurrentStudent() -> requireSelectedCourse()
     -> render only the selected course data
```

`right-now.html` also loads `js/social-links.js` because its contact menu uses
the configured social/contact records.

`cheatsheet.html` loads KaTeX and its auto-render extension from jsDelivr, then
calls `renderMath()` after rendering the personalized sheet.

## JavaScript architecture

`js/app.js` uses browser globals, traditional function declarations, and no
module/bundler system. Main responsibilities:

- Authentication: `login`, `getCurrentStudent`, `getCurrentTeacher`,
  `requireLogin`, `requireTeacherLogin`, `getLoginRedirect`, `logout`.
- Public UI/blog: `renderSocialLinks`, `renderNavAuth`, `renderBlogList`, and
  `renderBlogPost`.
- Student pages: `renderRightNow`, contact menu, cheat-sheet functions,
  `renderFeedback`, and `renderEmbedPage`.
- Courses/enrollment: `getStudentCourse`, `getSelectedCourse`,
  `setUpCourseNavigation`, `courseIconHtml`, `renderCoursePortal`, and
  `renderCourseRoadmap`.
- Roadmap table: `renderRoadmap`, category/status color maps, and pill helpers.
- Roadmap curve: chapter grouping/status precedence, layout/path generation,
  gems/popovers, `renderRoadmapCurve`, and `setUpRoadmapViewSwitch`.
- Teacher placeholder: `renderTeacherDashboard`.

Authentication stores `loggedInUsername`, `loggedInRole`, and the validated
`activeCourseId` subject context in `localStorage`. It is convenience routing,
not secure authorization. `REDIRECTABLE_PAGES` is a
local allowlist. Protected login redirects preserve the local `?course=` query.
When adding a protected route, update this allowlist and repeated portal nav.
An enrolled `?course=<id>` query is the active subject context; protected nav
propagates it to Now, Feedback, Calendar, Submit, and Cheat Sheet while Courses
returns to the chooser.

`renderCourseRoadmap(student)` resolves the query only through
`getStudentCourse(student, id)`. It returns the selected course so
`roadmap.html` can call `setUpRoadmapViewSwitch(course)`. Do not bypass this
account-scoped lookup by searching all students or all roadmaps globally.

## Data model

`js/data.js` is executable public browser JavaScript, not a private database.
It defines `CALENDAR_URL`, `SUBMISSION_FORM_URL`, `STUDENTS`, and `TEACHERS`.

Student records contain identity/login data, legacy `portal` metadata, and
`courses`. Personalized learning state belongs to course objects, never to the
student root. Legacy root activity fields on unenrolled records are dormant and
are not rendered. The live schema—not older README examples—is authoritative:

```js
{
  id: "ap-biology",
  name: "AP Biology",
  icon: "biology",
  rightNow: { state, chapter, unit, instruction, due? }, // optional
  feedback: [], // optional, course-scoped
  cheatSheet: [], // course-scoped
  calendarUrl: "https://...", // optional; shared calendar is the fallback
  submissionFormUrl: "https://...", // optional; shared form is the fallback
  roadmap: [
    { name, category, chapter, status, url?, submissionUrl? }
  ]
}
```

`url` opens the learning/resource item. `submissionUrl` is a second Submit link.
Locked roadmap rows hide both links even when URLs exist. Biology introduced
Learning, Notes Submission, and Final Self Check categories; Calculus also uses
Information, Book Chapter, Coursework, Solution Manual, Review, Test, and Mock.

`js/data.js` may be regenerated by `zenith-cli`; preserve formatting and verify
that CLI operations do not erase manually migrated course/feedback data.

## Course enrollment model

### Definition of “enroll”

To **enroll** a student means adding a complete course object to that student's
`courses` array in `js/data.js`. The course then appears automatically as an app
inside their `portal.html` folder and becomes resolvable at
`roadmap.html?course=<id>`. To **unenroll**, remove that course object.

Do not manually add per-student icons or links to HTML. Enrollment is data-driven.
When enrolling someone in an existing course, copy the complete course metadata,
roadmap, and independent activity containers. Initialize `feedback` and
`cheatSheet` as empty arrays and omit `rightNow` until assigned; never inherit
these fields from another subject. Course IDs must be stable and unique within a
student's `courses` array.

When creating a new account, add a complete standalone object directly inside
`STUDENTS`. Every student must own their portal, Now, feedback, cheat-sheet, and
course data rather than resolving or cloning another student's record at runtime.
If initial content should match an existing student, duplicate it literally.

Current enrollments:

- Bogue Kwon: AP Calculus BC, 88 rows.
- Hamin Park: AP Biology, 63 rows; AP Calculus BC, 88 rows copied exactly from
  Bogue at enrollment time.
- David Heo: AP Biology, 63 rows; AP Calculus BC, 88 rows, with initial data
  matching Hamin's complete student record.
- Seohu Lee: AP Calculus BC, 88 rows.
- Alice Inthe Wonderland and Yong Joon Kim: no courses; they see the empty folder.

Bogue is the reference Calculus enrollment. All 88 roadmap rows remain exactly
unchanged. His existing Now and Feedback values were later moved intact from the
student root into the Calculus course for strict subject isolation.

## Shared terminology and user intent

- **Portal**: `portal.html`, the intermediate course/app chooser. It must not
  directly show a roadmap.
- **Course app / icon**: one subject tile in the iPhone-folder-style Portal.
  Biology uses a DNA SVG; Calculus uses an integral/graph SVG. The course name
  appears under its icon.
- **Course folder**: the translucent rounded container holding only the logged-in
  student's enrolled course apps.
- **Enrollment**: a course object in that student's `courses` array, as defined
  above—not merely a link, icon, or old Notion URL.
- **Roadmap**: the native Zenith row data belonging to one course. It can render
  as Table or Curve on `roadmap.html`.
- **Independent from Notion**: roadmap structure/status/link data lives in
  Zenith and renders without Notion. Linked Drive, Classroom, Khan Academy, or
  other files may remain external unless separately migrated.
- **Now**: one immediate `rightNow` action. Hamin's current action is Chapter 1,
  L1 Chemistry of Life, due next session.
- **Feedback**: dated personalized entries rendered with the same shared design
  for every student. Hamin has a Chapter 0 Foundations “well done” entry that
  directs him to L1.

The user expects future Codex sessions to act from this handoff without asking
them to repeat established context. Preserve existing student data, especially
Bogue's reference Calculus roadmap. When asked to migrate a Notion roadmap,
inspect the published page or CSV, preserve ordering/statuses/resource and
submission links, map it into a course enrollment, verify counts/parity, and
record the result here. Explain material ambiguities, but do not re-ask what
“enroll,” “Portal,” or “independent from Notion” means.

The user generally wants implementation plus verification, not merely advice.
However, committing/pushing/deploying remains a distinct external action and
must be explicitly requested. A local change is not automatically public.

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

## Notion-to-native roadmap migration procedure

Hamin's `d2d2` Notion export is the completed reference migration. The directory
contained two CSV files and no Markdown file. The ordered CSV produced 63 AP
Biology rows across Chapters 0–8 and Chapter M, preserving 63 resource URLs and
8 separate submission URLs.

For another migration:

1. Identify the target student without exposing their password.
2. Read the published Notion database or request a CSV export if inaccessible.
3. Inventory order, chapter, title, category, status, resource URL, and separate
   submission URL.
4. Normalize rows to `{ name, category, chapter, status, url?, submissionUrl? }`.
5. Map clear category/status equivalents; preserve ambiguous data rather than
   silently discarding it.
6. Create or update the target course object inside the student's `courses`
   array—never restore a top-level `student.roadmap`.
7. Verify enrollment isolation, source/migrated row counts, order, locked-link
   behavior, both Table and Curve views, and mobile layout.
8. Preserve legacy Notion URLs until verification unless removal is requested.
9. Update Current State and the newest-first Work Log without credentials.

Native roadmap data removes the Notion runtime dependency, but linked external
assets remain external until separately provided and migrated.

## Current State

- Verified pulled state: `main == origin/main == 398aa79` before this document
  update; no merge conflicts or application diffs were present.
- Multi-course Portal, account-scoped enrollments, `roadmap.html`, and Table/Curve
  views are merged and tracked on `main`.
- Enrollments: Bogue—Calculus; Hamin—Biology and Calculus; Seohu—Calculus;
  David Heo—Biology and Calculus; Alice/Yong Joon—none.
- Bogue's 88-row roadmap and activity values are preserved inside his Calculus
  course; no enrolled student uses root-level activity fields.
- Hamin Biology: 63 rows, 63 resource links, 8 separate submission links from
  `d2d2`; Now is L1 Chemistry of Life; Feedback contains the Foundations entry.
- All enrolled students use strict course-scoped paths for Now, Feedback, Cheat
  Sheet, Calendar, and Submit. Direct visits without a selected enrollment return
  to Courses, preventing activity from another subject from appearing.
- David: Biology Now is L1, Calculus Now is B1, and both Feedback arrays are empty.
  Hamin: Biology owns L1 and his Foundations feedback; Calculus activity is empty.
- Alice and Yong Joon have no enrollments. Yong Joon's legacy root activity data
  remains preserved but dormant; strict course pages cannot render it until it is
  deliberately placed into a future enrolled course.
- Validation passes: both JavaScript files parse; all five edited protected-page
  inline scripts parse; enrolled roadmaps match their prior data exactly; activity
  values/counts survived migration; and `git diff --check` passes.
- Current uncommitted files: `js/data.js`, `js/app.js`, `right-now.html`,
  `feedback.html`, `cheatsheet.html`, `calendar.html`, `submit.html`, and
  `PROGRESS.md`. Nothing has been committed or pushed.

## Work Log

Add new entries immediately below this instruction, newest first. Each entry
should include the date, request, files changed, verification, and any remaining
work or important decisions.

### 2026-07-27 — Saved final course-path handoff state

- Request: save all completed progress for the next memoryless session.
- Reconciled architecture, strict course ownership, active-course persistence,
  current enrollments, migrated activity placement, dormant unenrolled data,
  verification evidence, modified files, and commit/deployment status.
- Files changed for this handoff step: `PROGRESS.md` only; application changes
  from the recorded tasks remain uncommitted in the working tree.

### 2026-07-27 — Enforced course-specific paths for all students

- Request: make the selected enrollment determine all Roadmap, Now, Feedback,
  Cheat Sheet, Calendar, and Submit content for every student.
- Files changed: `js/data.js`, `js/app.js`, `right-now.html`,
  `feedback.html`, `cheatsheet.html`, `calendar.html`, `submit.html`, and
  `PROGRESS.md`.
- Migrated Bogue and Seohu activity into Calculus and Hamin activity into Biology;
  Hamin Calculus has independent empty Feedback/Cheat Sheet state. David remains
  independently scoped to Biology L1 and Calculus B1 with empty feedback.
- Course pages require a validated selected enrollment. Calendar and Submit accept
  optional per-course URLs and otherwise use the shared service, never another
  course's URL.
- Root-level activity fields are no longer render fallbacks. Dormant data on an
  unenrolled student remains preserved but cannot display until deliberately
  placed in a future course.
- Verification: syntax/data/diff checks pass; every enrolled course has isolated
  activity containers and migrated values/counts match their prior data.

### 2026-07-27 — Added course-scoped Now and Feedback paths

- Request: keep David’s Biology and Calculus activity data isolated according to
  the course app selected after login.
- Files changed: `js/data.js`, `js/app.js`, and `PROGRESS.md`.
- Navigation propagates only validated enrolled `?course=` IDs across protected
  pages and remembers the selected enrollment as `activeCourseId` if a local
  link drops its query; Courses and login/logout clear that subject context.
- David Biology Now shows L1; Calculus Now shows B1; both Feedback arrays are
  empty because he has no reviewed submissions.
- Superseded: course-owned fields are now mandatory for all enrolled students;
  root-level activity fallbacks were removed to prevent cross-subject leakage.
- Verification: JavaScript syntax and diff checks pass; simulated local flows
  render `Chapter 1 · L1` for Biology and `Chapter 1 · B1` for Calculus, keep
  Feedback empty, clear context at Courses, and reject invalid course IDs.

### 2026-07-27 — Added David Heo account and course enrollments

- Request: create David Heo's student account and enroll him in AP Biology and
  AP Calculus BC.
- Files changed: `js/data.js` and `PROGRESS.md`.
- Implementation: David is a complete literal object inside `STUDENTS`, with
  standalone copies of Hamin's portal, Now, feedback, and both course datasets.
  No runtime lookup, cloning helper, or shared student data object remains.
- Verification: syntax and diff checks pass; all non-identity data matches Hamin
  exactly, including the 63-row Biology and 88-row Calculus roadmaps.
- No credentials are reproduced in this handoff document.

### 2026-07-27 — Comprehensive memoryless-session handoff audit

- Reconciled this document with merged commit `398aa79`.
- Removed stale descriptions of Portal as a roadmap, top-level student roadmaps,
  the old commit/dirty README state, and the completed migration as pending.
- Added live Table/Curve architecture, enrollment semantics, shared terminology,
  user intent, deployment boundaries, migration workflow, and exact current
  enrollments/status.
- Files changed: `PROGRESS.md` only.

### 2026-07-27 — Verified pulled multi-course integration

- Repository state: clean `main` at `398aa79`, matching `origin/main`.
- Confirmed the course chooser, `roadmap.html`, enrollment-aware rendering, and
  the merged Table/Curve roadmap view are tracked on `main`.
- Current enrollments: Bogue has AP Calculus BC; Hamin has AP Biology and AP
  Calculus BC; Seohu has AP Calculus BC; Alice and Yong Joon have no courses.
- Bogue verification: all 88 Calculus roadmap rows and every non-course Bogue
  field exactly match the original pre-course data.
- Validation: `js/data.js` and `js/app.js` pass `node --check`; Git status and
  diff checks were clean immediately after the pull.

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

### 2026-07-27 — Initial Notion migration request (superseded/completed)

- Request: convert another student's existing Notion roadmap into an independent
  Zenith roadmap matching Bogue's native Calculus implementation.
- Files changed: `PROGRESS.md` only.
- Decision: reuse the per-student `roadmap` schema and `renderRoadmap()` instead
  of creating another Notion iframe.
- Superseded: the user later supplied the `d2d2` CSV and Hamin's migration
  was completed; no input remains pending for that request.
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

