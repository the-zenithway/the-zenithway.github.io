# Zenith Web — Feature Development Log

Condensed from [documentation.md](documentation.md), organized by date. Includes
every feature addition and meaningful feature improvement/redesign. Excludes
pure database/content edits (student records, feedback text, resource-link
drops, small todo-item tweaks) — those are logged as ordinary upkeep, not
feature work, unless they changed the structure of a file/page.

## 2026-07-15 — Initial scaffold

- `ce67f53` Initial static student portal: login page, portal page with
  per-student Notion embed, intentionally insecure client-side auth.
- `5033e4c` Reorganized files into `css/` and `js/` folders.
- `c6b9b42` Rebuilt `css/style.css` and `index.html` from scratch; cleaned up
  `app.js`/`data.js`.
- `5f2e180` Full design pass — large rewrite of the login/portal look and feel.
- `65b119f`, `62d9882` Follow-up design fixes and polish on that new look.
- `d502d66` Added an "Open in Notion ↗" direct link next to the embedded
  iframe; restyled the portal action bar.

## 2026-07-20 — New pages, branding, resilience

- `4865204` Added Calendar, FAQ, Philosophy, and Resources pages; added a
  shared social-links footer (`js/social-links.js`); refactored the embed
  renderer into a reusable `renderEmbedPage()` so every embed page shares one
  function; added nav auth state (shows student name once logged in); added
  open-redirect protection on login (whitelisted redirect targets only);
  rebuilt `index.html` as an "About Us" home page; added favicon/apple-touch
  icon.
- `3a2ef64` Added a shared class-wide Calendar embed (separate from each
  student's individual Notion URL).
- `6b2d6ac`, `4625077`, `75d7e17` Favicon/icon set added, then relocated and
  fixed so it actually resolves correctly on GitHub Pages.
- `9a50930` Rebranded header/footer: custom inline-SVG Zenith mountain-peak
  logo mark, styled "ZENITH" wordmark, new Space Grotesk font, rewritten
  hero/footer copy in Zenith's own voice.
- `0caea83` Added a "Notion temporarily unavailable" fallback — shows a direct
  link instead of a broken embed when a student's Notion page isn't ready.

## 2026-07-21 — Content pages and polish

- `a2efa8e` Set proper, page-specific `<title>` tags site-wide.
- `6943bfa` Added a new "Finding Your Way" FAQ section.
- `1de2c5f`, `975eabc`, `e6884f7` Built out the Resources page with a real
  SAT resources list and Khan Academy links.

## 2026-07-25 — Planning infrastructure

- `67f5060` Created `brainstorm.md` — the precursor to the current todo
  system.

## 2026-07-27 — Major feature day: roadmap, portal features, teacher role, blog

- `58be677` Renamed `brainstorm.md` → `todo.md`, establishing the todo file
  and structure that's been maintained ever since (framework change, not a
  content edit).
- `08ee37a` Reorganized the Resources "AP" section into per-subject subgroups
  (Calc BC/Bio/Chem/Physics/CS A) with new `.resource-subgroup` CSS — a
  structural page redesign, not just link drops.
- `b6c226c` Added the **Right Now** page (single current-task view, with
  "waiting" vs "your-move" states) and the **Submit** page (Google Form
  embed); added a contact popover built from the social links list.
- `6a34b73` Added the **Feedback** page (per-student feedback log) and the
  **Cheat Sheet** page (KaTeX-rendered formulas/patterns), with a banner
  linking feedback → cheat sheet.
- `93d472b` Added the **Teacher role**: `teacher.html` dashboard, role-aware
  login that checks students then teachers.
- `44e1ab8` Added the **Blog**: list page, individual post page, and a
  blog-data module.
- `1764f0e` Replaced the Notion iframe roadmap with a real HTML **roadmap
  table** rendered from structured per-student data, with color-coded
  category/status pills and locked-row link suppression.
- `5ff09fd` Added the **Table/Curve view switcher** on the roadmap — a new
  Curve view that groups items by chapter, plots one gem per chapter along a
  sine-wave path with a smooth bezier curve, and opens a per-chapter breakdown
  popover on click.
- `1766bd0` Added the **app launcher / course picker**: portal became a
  multi-course, iPhone-folder-style launcher instead of one flat roadmap, with
  a new per-course roadmap page (`roadmap.html?course=`).
- `398aa79` Merged the Curve-view work and the course-launcher work into one
  combined roadmap system.
- `c6cc1ab` Made Right Now/Feedback/Cheat Sheet **course-scoped** (remembers
  the selected course via `localStorage`) and supported students enrolled in
  multiple courses at once.

## 2026-07-29 — Public page, rebrand, new roadmap views

- `7ebb6f2` Added a **public, no-login self-study roadmap page** for AP Calc
  BC; rewrote the Philosophy page around three named pillars (System,
  Engagement, Advice — the same structure `todo.md` now follows); replaced
  placeholder FAQ answers with real ones and added a roadmap explainer
  section; added starred "recommended" markers on the Resources page; made
  the roadmap layout more compact/centered.
- `10239c5` Added two more roadmap views — **Cards** (horizontal scroller,
  one card per chapter) and **Orbit** (same cards with a 3D coverflow
  transform) — both reusing the Curve view's chapter-grouping logic.

## 2026-07-29 — Working changes (uncommitted at time of writing)

- Added `.gitignore` and stopped tracking `.DS_Store` files.
- Added a per-course/per-chapter **progress bar** — shows percent-complete on
  portal course tiles and on roadmap Cards.
- Removed `curriculum-template.md` and `teacher-onboarding.md` (superseded
  docs) from the working tree.
- Added `documentation.md`, the full commit-by-commit project history.
