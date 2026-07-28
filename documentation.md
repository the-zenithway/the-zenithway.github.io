# Zenith Web — Development History

A chronological account of every commit on `main`, from the first scaffold to the
latest working changes, based on the actual code/content in each diff (not just
the commit message). This is a history/changelog document — for current
architecture see [PROGRESS.md](PROGRESS.md), and for open work see [todo.md](todo.md).

---

## Phase 1 — Static login-portal scaffold (2026-07-15)

- **`ce67f53` initial commit** — First version of the site: `index.html`,
  `login.html`, `portal.html`, `style.css`, `app.js`, `data.js`. A deliberately
  insecure, client-side-only "login" (credentials shipped in `js/data.js`) that
  shows each logged-in student a personal Notion-embedded page. README explains
  this is a low-stakes local class tool, not real auth.
- **`5033e4c` Reorganize project structure** — Moved `style.css` → `css/style.css`
  and `app.js`/`data.js` → `js/`.
- **`c6b9b42` Recreate css, remake index, and update notion embedding** —
  Rewrote `css/style.css`, simplified `index.html`, cleaned up `app.js`/`data.js`,
  trimmed `portal.html`. README rewritten to match.
- **`4a43ba4` updated link for notion embedding** — Fixed a student's Notion
  embed URL.
- **`5f2e180` change website design and small updates** — Large CSS pass
  (~200 lines touched) restyling the login/portal look.
- **`65b119f` slight design fix and link testing** / **`62d9882` further design
  polish** — Incremental CSS refinements.
- **`dab93fa` update on database** — Student data edits in `js/data.js`.
- **`d502d66` hi** — Renamed demo students to real names/usernames, added an
  "Open in Notion ↗" direct link next to the embedded iframe, restyled the
  portal action bar.
- **`67dbc6c` updated database** — Data edit.
- **`1a67d70` updated readme** — Trimmed README significantly.

## Phase 2 — New pages, branding, security hardening (2026-07-16 – 2026-07-20)

- **`78a8dee` hi** — Small `index.html` tweak.
- **`4865204` updated login + portal + added new pages + favicon and all the
  login** (large commit) — Added `calendar.html`, `faq.html`, `philosophy.html`,
  `resources.html`, plus `js/social-links.js` (a `SOCIAL_LINKS` array driving a
  shared footer icon row via `renderSocialLinks()`). Refactored `app.js`:
  `renderPortal()` → generic `renderEmbedPage(student, embedUrl, label)` so
  multiple pages can share one iframe-embedding function; added
  `renderNavAuth()` to swap "Log In" for the student's name when signed in.
  Added open-redirect protection — `requireLogin()`/`getLoginRedirect()` only
  allow redirecting to a whitelisted `REDIRECTABLE_PAGES` list. `index.html`
  rewritten from a login splash into an "About Us" style home page with card
  links to Philosophy/Resources/Portal. Favicon and apple-touch-icon added.
- **`3a2ef64` added calendar feature** — Added a single shared `CALENDAR_URL`
  (one class-wide Google Calendar embed, unlike each student's individual
  Notion URL) and wired it into `calendar.html`.
- **`b60d717` removed unnecessary text** — Copy/CSS cleanup.
- **`6b2d6ac` logo and favicon update** / **`4625077` updated favicons** /
  **`75d7e17` favicon fix for github pages** — New favicon/apple-touch-icon
  assets, then relocated to site root and `<link rel="icon">` tags fixed across
  all pages so GitHub Pages resolves them correctly.
- **`9a50930` website header change, footer update** — Replaced the plain-text
  "Student Portal" logo with a custom inline-SVG Zenith mountain-peak mark plus
  a styled "ZENITH" wordmark, added the Space Grotesk font, and rebranded copy
  across `index.html`/`login.html` to Zenith's actual voice/mission.
- **`c508f6f` minimal update on readme; expect more soon; also need to clean up
  files with gitignore soon** — README trim (the `.gitignore` TODO mentioned
  here stayed open until this session).
- **`04428eb` database update** — Data edit.
- **`0caea83` database update, temporary fix for notion embedding issues** —
  Added a `notionAvailable` boolean per student; when `false`,
  `renderEmbedPage()` hides the iframe and shows a "temporarily unavailable"
  message with a direct link instead of embedding a broken page.
- **`0b4285a` database update** — Data edit.
- **`1b0b0a7` added new social links** / **`65b6aa3` updated social links** —
  Filled in real social URLs in `js/social-links.js`.
- **`8c3b641` hi** — No-op (`.DS_Store` only).
- **`52ff195` test for new repo** — README edit.
- **`a2efa8e` made appropriate titles for each page** — Set proper `<title>`
  tags across all pages.

## Phase 3 — FAQ and resource content (2026-07-21)

- **`757fa85` updated readme** — Large README trim.
- **`6943bfa` updated faq page** — Added a "Finding Your Way" FAQ section
  (placeholder Q&As marked "Answer coming soon"), swapped one question, linked
  "contact us" phrases to `#social-links`.
- **`1de2c5f` added sat resources and updated resource page** / **`975eabc`
  updated sat resources for resource page** / **`e6884f7` khan academy added to
  resource page** — Built out the public SAT resources list.
- **`1067b7f` updated database** — Data edit.

## Phase 4 — Planning and data experiments (2026-07-22 – 2026-07-25)

- **`d9bcfc9`, `a3f60ed`, `30d0aeb`, `24b36e0`** — README edits (including
  onboarding a second contributor, Hamin, to the repo).
- **`67f5060` added file for brainstorming** — Created `brainstorm.md`.
- **`b77f08e` / `19dfdd4` zenith: add/remove student smoketest** and
  **`a35c2ab` / `f02c602` zenith: add/remove student jsmith** — Temporary test
  student records added then removed from `js/data.js` to verify the data
  pipeline.
- **`ebcefe2` brainstorming ideas and todo** / **`c696316` updated todo in
  brainstorm** — Early feature brainstorming captured in `brainstorm.md`.

## Phase 5 — AP resources and todo system overhaul (2026-07-27, early)

- **`d9285b3` added AP calc bc self study track page** — (Despite the name)
  replaced two generic "Study Tools" links with one real link to a
  Notion-hosted "AP Calculus BC Self Study Track" — the standalone HTML version
  of this page comes later, in Phase 8.
- **`5fc6d54` added official college board student bank to resource page** —
  Resource link addition.
- **`58be677` updated todo list and changed brainstorm.md to todo.md** —
  Renamed `brainstorm.md` → `todo.md`, establishing the file that's maintained
  ever since.
- **`08ee37a` updated resource page, added various AP resources...** —
  Restructured Resources' "AP" section into per-subject subgroups (Calc BC,
  Biology, Chemistry, Physics, CS A), added an APFRQs.com link and an "AP Calc
  BC Cheat Sheet" PDF link.
- **`804592c` / `cce3725` updated todo** — Todo list restructuring.

## Phase 6 — Portal feature buildout: Now, Feedback, Cheat Sheet, Teacher, Blog,
## and the real roadmap (2026-07-27)

- **`b6c226c` now and submission form feature added to portal; new database
  structure** — Added `right-now.html` ("Now" page), driven by a new
  `student.rightNow` field with two states: `"waiting"` (passive note) and
  `"your-move"` (active instructions + due date + "Message us when done"
  button). Added `setUpContactMenu()` (contact popover built from
  `SOCIAL_LINKS`). Added `submit.html`, an embed page for a Google Form.
- **`c6e8548` updated database** — Data edit.
- **`6a34b73` added feedback section, personalized cheat sheet...** — Added
  `feedback.html` (renders `student.feedback[]`: date/chapter/unit/content) and
  `cheatsheet.html` (renders `student.cheatSheet[]`: topic/source/pattern,
  LaTeX-rendered via KaTeX through a new `renderMath()` helper). Feedback page
  shows a banner linking to the cheat sheet count.
- **`93d472b` updated todo** — (Despite the message) added the full teacher
  role: `teacher.html`, a `TEACHERS` array in `data.js`, and role-aware auth
  (`ROLE_KEY`, `getCurrentTeacher()`, `requireTeacherLogin()`) — `login()` now
  checks students first, then teachers.
- **`aa9afdf` added barrons ap calc in the resources page** — Resource link.
- **`44e1ab8` updated notion database for seohu** — Added a blog:
  `blog.html` (list), `blog-post.html` (`?slug=` detail view), and
  `js/blog-data.js` (a `BLOG_POSTS[]` array), plus `renderBlogList()` /
  `renderBlogPost()`.
- **`00a3c5a` updated bogues database and roadmap** — Data edit.
- **`1764f0e` updated roadmap for bogue, and resolved notion dependency** —
  Structural turning point: replaced the Notion iframe on `portal.html` with a
  real HTML roadmap table rendered from a new `student.roadmap[]` array
  (~88 rows for Bogue's AP Calc BC course: name/category/chapter/status/url).
  Added `renderRoadmap()` plus color-coded pill helpers
  (`roadmapPillHtml()`, `ROADMAP_CATEGORY_COLORS`, `ROADMAP_STATUS_COLORS`).
  Locked items suppress their link even when a URL is present.
- **`2daee7b` / `0a8485e` todo update** — Todo edits.
- **`5ff09fd` Add Roadmap Table/Curve view switcher, per-student roadmap data**
  (co-authored with Claude) — Added a Table/Curve toggle above the roadmap.
  New Curve view: groups roadmap rows by chapter, rolls each chapter up to one
  overall status, lays out one diamond "gem" per chapter along a hand-tuned
  sine-wave curve, draws a smooth Catmull-Rom→Bezier path through them, and on
  click draws the tangent line at that point and opens a popover with the
  chapter's full breakdown.
- **`1766bd0` Add app launcher / subject picker view** (Hamin Park, developed
  on a parallel branch) — Restructured `portal.html` from a single roadmap
  into an "iPhone-folder"-style course launcher: each student now has a
  `courses[]` array (`{id, name, icon, roadmap}`) instead of one flat roadmap,
  with inline-SVG subject icons. Added `roadmap.html?course=<id>` to host the
  per-course roadmap. Added `PROGRESS.md` as a persistent handoff/architecture
  doc.
- **`398aa79` Merge roadmap-views into app-launcher-view: courses + Table/Curve
  views** — Merged the Curve-view branch (`5ff09fd`) with the course-launcher
  branch (`1766bd0`), combining per-course roadmaps with the Table/Curve
  switcher.
- **`4dad16c` updated todo** — Todo edit.
- **`c6cc1ab` implemented course-specific structure** (Hamin Park) — Made Right
  Now, Feedback, and Cheat Sheet all course-scoped instead of student-scoped:
  added `getSelectedCourse()` (resolves `?course=`, remembers it in
  `localStorage`), `requireSelectedCourse()`, and `setUpCourseNavigation()`
  (auto-appends `?course=` across nav links). Students can now be enrolled in
  multiple courses at once (e.g. Hamin and David in both AP Biology and AP
  Calculus BC).

## Phase 7 — Content updates for live students (2026-07-28)

- **`fd1d6b0` added one in todo, and database update for bogue** — Pure content
  update: new real feedback write-up for Bogue (motion problems, IVT/MVT/
  Rolle's theorem, symmetry) and matching cheat-sheet entries; several
  Chapter 1 roadmap rows flipped from Review/Unlocked to Complete.
- **`dcd3bc2` additional cheat sheet entries for bogue** — Two more cheat-sheet
  entries (axis reflections, odd/even symmetry); Now task due date updated.

## Phase 8 — Public self-study page, philosophy rewrite, Orbit/Card views
## (2026-07-29)

- **`7ebb6f2` Updated philosophy page to reflect what we wrote in md...** —
  Added `calc-bc-self-study.html`, a public no-login version of the Calc BC
  roadmap (Table + Curve views, every item forced to "Complete"/unlocked) for
  visitors coming from Resources. Rewrote `philosophy.html` around three named
  pillars (Absolute Clarity, Active Engagement & Motivation, Advice &
  Direction — the same three pillars `todo.md` is organized around). Replaced
  "Answer coming soon" FAQ placeholders with real answers and added a "Your
  Course & Roadmap" explainer section. Reorganized `resources.html` into
  subgroups with a ★ marker for recommended items. Roadmap layout made more
  compact and centered; Curve view refined further (noted as still needing
  work).
- **`10239c5` two new views orbit and card, and extensive updates of ideas...**
  — Added two more roadmap views: **Cards** (`renderRoadmapCards()`, a
  horizontal scroller with one card per chapter, each showing a per-chapter
  progress bar) and **Orbit** (`renderRoadmapOrbit()`, the same cards with a
  coverflow-style 3D transform based on distance from the centered card, using
  native scroll + prev/next buttons rather than custom drag handling). Both
  reuse the Curve view's chapter-grouping logic. Added `curriculum-template.md`
  (canonical spec for building a course's `roadmap` array) and
  `teacher-onboarding.md` (new-teacher ramp-up checklist). Substantially
  expanded `todo.md` with new feature ideas and a policy note that **Zenith
  stays free — no paywalls, ever**.

## Phase 9 — Cleanup, in progress (current working changes)

Not yet committed at the time of writing:

- Added a `.gitignore` (`.DS_Store`) and untracked the three `.DS_Store` files
  that had been committed since Phase 1.
- `js/app.js` / `css/style.css` / `roadmap.html` / `calc-bc-self-study.html`
  — further Curve/Cards/Orbit view refinements, including a per-course
  **progress bar** (`course-app-progress-bar` on the portal course tiles and
  `roadmap-card-progress-bar` on roadmap cards) showing percent-complete.
- `curriculum-template.md`, `teacher-onboarding.md`, and the two `d2d2/AP
  Biology *.csv` scratch exports were removed from the working tree, along with
  the `todo.md` "Done" entries that referenced the two markdown docs.
- `todo.md` trimmed (several shipped/duplicate ideas removed) and a new item
  added: automatically gather the commit history into a documentation file —
  i.e., this document.

---

*Generated from `git log` and `git show` on 2026-07-29. Update this file's
Phase 9 section (or add a Phase 10) as new commits land — see the "Automatic
documentation" item in [todo.md](todo.md).*
