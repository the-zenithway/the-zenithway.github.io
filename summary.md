# Zenith: Comprehensive Project Summary

> This document summarizes the complete project-owned contents of the Zenith repository as audited on 2026-08-15. It covers the product, philosophy, website, roles, workflows, architecture, data model, content banks, automation, operations, limitations, current footprint, history, and backlog. Binary favicon/image assets, Git internals, generated video output, and installed third-party dependency source are identified but not reproduced. Credentials and personal email addresses are intentionally not duplicated here; their storage and security implications are documented instead.

## 1. What Zenith is

Zenith is a free, personalized learning and mentorship system centered on AP and SAT preparation. It is not merely a resource directory or a conventional learning-management system. Its operating idea is to give each student a concrete path, a single current priority, direct human feedback, a growing personal mistake/pattern record, and access to mentors who know the student's situation.

The public website explains Zenith's values and offers curated resources. The logged-in application coordinates students, teachers, parents, and administrators. The repository also contains the content and operational machinery behind the experience: course roadmaps, student progress, submissions, grading banks, requests, class rosters, sign-ups, calendar events, announcements, scheduled emails, blogs, and GitHub/Google automation.

Zenith currently focuses on these course identities:

- AP Calculus BC (`ap-calculus-bc`)
- AP Chemistry (`ap-chemistry`)
- AP Biology (`ap-biology`)
- AP Computer Science A (`ap-computer-science-a`)

The public Resources page also covers SAT preparation and links to material for AP Physics, Economics, English Language, English Literature, Statistics, and Environmental Science. The formerly public self-study roadmap pages for Calculus BC, Biology, Chemistry, and CS A are currently intentionally unavailable because they had exposed copyrighted Barron's material through public Drive links.

## 2. The Zenith philosophy

Zenith rejects quick judgments that treat a student's current position as a verdict on their potential. Its present philosophy has three pillars.

### 2.1 Absolute Clarity

The system should let a student begin at any time and immediately know what to do. Course roadmap, current task, feedback, cheat sheet, submissions, and calendar are unified instead of scattered across chats, screenshots, documents, and memory.

Each course is broken into explicit steps. An unlocked item is visible as the current opportunity; locked work recedes; completed, review, and optional material remain legible. The `Right Now` feature narrows the entire roadmap into one immediate action, optionally followed by exactly one preview task. Mistakes are not allowed to disappear: they are turned into feedback and durable cheat-sheet patterns.

### 2.2 Inner Excellence

Zenith values the person produced by the preparation process, not only a score or acceptance. It emphasizes:

- process and honest effort over outcome alone;
- active work and testing over passive rereading or rewatching;
- failure as information about the next correction, not identity or shame;
- humility and gratitude as stabilizers through both success and disappointment;
- long-term mastery, discipline, responsiveness, motivation, and self-knowledge.

The backlog makes “how to study” a major future concern: active recall, spaced repetition, effective cheat-sheet use, encouraging feedback, motivational writing, check-ins, and structured in-person sessions are intended to make the philosophy operational rather than decorative.

### 2.3 Genuine Mentorship

The current third pillar replaced the older “Community” framing with a more specific relationship: genuine mentorship. The site invokes the Buddhist idea of *kalyāṇamitra*, a noble friend who walks beside someone rather than supervising from above.

Teachers are meant to be guides and companions, not task dispensers. They remember their own climb, see versions of themselves in students, and push from recognition and care. The goal is broader than producing a 5: students should eventually become people who offer the same devotion and guidance to others.

Community still appears in future ideas—clubs, events, trips, squads, alumni mentorship, teach-backs, and Zenith Local—but the philosophical core is now person-to-person mentorship rather than competition or a leaderboard.

## 3. Technical character and deployment

Zenith is intentionally a static GitHub Pages site served directly from `main`:

- plain HTML pages;
- one large shared CSS file;
- global browser JavaScript loaded through `<script>` tags;
- no framework, bundler, build step, application server, or conventional database;
- `.nojekyll` instructs GitHub Pages to serve files as-is.

The repository itself acts as the database. `js/data.js` contains account records, classes, enrollments, roadmaps, personalization, and metrics. JSON files under `data/` contain mutable logs and feeds. Google Apps Script web apps mutate those repository files through the GitHub Contents API. GitHub Actions performs scheduled and push-triggered email work.

This architecture keeps hosting and development simple, but it also means:

- writes become commits to `main`;
- the browser downloads much of the data;
- there is no genuine server-side session or authorization boundary;
- changes to the reference Apps Script files do not affect live deployments until manually pasted/redeployed;
- GitHub Pages can only read data committed to `main`, which is why live logs cannot safely live only on a separate branch.

## 4. Visual identity and shared layout

The site uses one dark visual system designed around a `#191919` background. Main tokens in `css/style.css` include elevated `#212121`, border `#2C2C2C`, light text `#E6E6E4`, muted text `#8F8F8F`, gold accent `#D6A94A`, red error, and green success colors. Fonts are Manrope for the interface, IBM Plex Mono for code/technical elements, and Space Grotesk for the wordmark.

The brand uses a custom inline SVG mountain/peak mark and a stylized ZENITH wordmark. Root favicon assets provide `.ico`, 16px, 32px, Apple touch variants. `video-output/` is an untracked/generated media directory and is not part of the application source.

`js/layout.js` centrally renders:

- the public site header;
- the student/teacher/role-aware portal header;
- the logo;
- mobile navigation behavior;
- reusable action links such as Open, All Courses, Back, Calendar, Requests, language toggle, and Logout;
- the shared footer and social mount.

Public navigation includes Home, Philosophy, Resources, FAQ, Blog, and Portal. Student navigation includes Courses, Catalog, Now, Feedback, Calendar, and Submit. Teacher navigation includes Teacher Dashboard, All Students, and Calendar.

The CSS file styles every public and portal component, including roadmap visualizations, forms, queues, dashboards, calendars, admin editors, cards, popovers, tables, and mobile states. Responsive breakpoints cover narrow phones/tablets, and motion-heavy roadmap effects include `prefers-reduced-motion` handling. Screen-reader-only text is supported with `.sr-only`.

## 5. Authentication, roles, and sessions

There are four account roles:

1. student;
2. teacher;
3. parent;
4. admin.

`login.html` is shared. Login checks `STUDENTS`, then `TEACHERS`, then `PARENTS`, then `ADMINS`. It stores the username and role in browser `localStorage`. Student login clears the previously active course. Each protected page calls a role-specific guard; `requireAnyLogin()` is used for the native calendar.

Redirects after login are restricted to an explicit list of local HTML pages, preventing crafted external or `javascript:` redirects.

Two credential formats coexist:

- old hand-authored accounts contain plaintext `password` fields;
- accounts created through sign-up approval contain a SHA-256 `passwordHash`.

The browser hashes a sign-up password with Web Crypto before submission, and hashes login attempts before comparing to hashed accounts. This prevents new plaintext passwords from appearing in sign-up requests, but it is not secure authentication: the unsalted hash and all account data are publicly downloadable, older plaintext credentials remain in source, role guards trust localStorage, and the write endpoint is publicly discoverable. Zenith documentation explicitly calls this a low-stakes convenience model, not real access control. “Secure login” remains an open task.

## 6. Public website

### Home (`index.html`)

The home page welcomes visitors and presents three primary paths: the Zenith philosophy, public resources, and the personal portal. When someone is logged in, public navigation reflects that session.

### Philosophy (`philosophy.html`)

This is the canonical public statement of Absolute Clarity, Inner Excellence, and Genuine Mentorship, including the kalyāṇamitra framing.

### Resources (`resources.html`)

The Resources page is open without login and supports English/Korean interface copy. A star marks items Zenith recommends especially strongly. It currently points to:

- SAT: official Bluebook tests, Khan Academy, Barron's SAT, Erica Meltzer Reading and Grammar, *The Blue Book of Grammar and Punctuation*, Word Smart I/II, and the College Board Student Question Bank;
- AP-wide: APFRQs and APFive;
- subject books/resources for Calculus BC, Biology, Chemistry, Physics C, CS A, Economics, English Language, English Literature, Statistics, and Environmental Science.

Book links were changed from publicly shared copies to legitimate Amazon search links to address copyright concerns. Visitors can also open the Requests page specifically as a Resource Request.

### FAQ (`faq.html`)

The FAQ explains:

- who Zenith serves and the informal contact-based application path;
- that public pages do not require an account;
- how students should start and why it is not “too late”;
- individualized planning rather than fixed grade-level scripts;
- progress relative to one's own trajectory rather than classmates;
- the danger of passive consumption and the importance of testing and correction;
- account creation/recovery;
- portal, resource star, course switching, roadmap category/status, view, Now, feedback, cheat sheet, submit, and calendar concepts.

Some FAQ copy predates newer features and should be updated; this is explicitly in the backlog.

### Blog (`blog.html`, `blog-post.html`)

The blog merges two sources:

- legacy hand-authored `BLOG_POSTS` from `js/blog-data.js`;
- live posts fetched from `data/blog-posts.json`.

JSON posts are ordered newest first and support title, immutable slug, author, date, tags, excerpt, and Markdown content. `blog-post.html?slug=...` renders Markdown using marked.js. Both current stores are empty, so the public blog has infrastructure but no published posts at audit time.

### Requests (`requests.html`)

Requests is deliberately accessible without login. Guests may submit only Resource Requests and must give a name/email; logged-in users can use Feature Request, Resource Request, Bug Report, Ask My Teacher, and Concern / Other. Ask My Teacher is student-only and requires a course so it can route through class assignment. Logged-in users can see their own request history and statuses.

### Sign up (`signup.html`)

Anyone can request a student or teacher account. The form collects role, full name, username, email, password, and confirmation. Usernames must be 3–30 characters using letters, numbers, underscore, period, or hyphen; passwords must be at least eight characters. Passwords are hashed before transmission. Requests enter a Pending state and are reviewed manually, with the UI promising a typical 15-minute-to-one-day window.

### Self-study pages

`calc-bc-self-study.html`, `bio-self-study.html`, `chem-self-study.html`, and `csa-self-study.html` retain branded shells and titles but currently show temporary-unavailability notices. Their older public roadmaps were removed to avoid distributing copyrighted book content.

## 7. Student experience and workflow

### 7.1 Courses portal (`portal.html`)

The portal is an iPhone-folder-style launcher containing one app tile per enrollment. A tile displays a subject-specific SVG icon, course name, and weighted progress. Selecting it stores the active course and opens `roadmap.html?course=<id>`.

The portal also consumes `data/changelog-events.json` to show “What's new” events per student, with per-user last-seen state in localStorage. GitHub Actions generates this feed from changes to right-now, feedback, roadmap statuses, and cheat sheets, retaining at most 30 events per student.

### 7.2 Catalog (`catalog.html`)

The catalog lists every `CLASSES` entry with subject and assigned teachers. For the current student, each class displays Enrolled, Pending approval, or Registration locked. There is intentionally no student self-service Register button yet: admins choose candidate rosters and approve registrations.

### 7.3 Course selection and navigation

The active course comes from the `?course=` query parameter or `activeCourseId` localStorage. Course-aware navigation appends the selected id to Now, Feedback, Calendar, Submit, and related links. Missing/invalid selection returns the student to the course chooser.

### 7.4 Roadmap (`roadmap.html`)

A roadmap item has:

```text
{ name, category, chapter, status, url? }
```

Categories currently include Information, Book Chapter, Learning, Notes Submission, Coursework, Solution Manual, Review, Test, Final Self Check, and Mock, represented internally by keys such as `I-information`, `B-book chapter`, `L-Learning`, `N-Notes Submission`, `C-coursework`, `S-solution manual`, `R-Review`, `T-Test`, `F-Final Self Check`, and `M-Mock`.

Statuses are Locked, Unlocked, Review, Optional-Reading, and Complete. Locked items suppress their links. Unlocked is the principal “work now” state and is visually emphasized with a star. Review and optional reading remain available without being treated as core completion.

Progress is weighted rather than a simple row count. Category weights are applied by `roadmapItemWeight()`, and only Complete contributes fully to completion. The same percentage feeds portal tiles and chapter cards.

The roadmap supports several representations of the same underlying data:

- **Table:** direct row-by-row name/category/chapter/status view.
- **Curve:** Calculus signature view; chapter gems lie along a polynomial curve, animate tangent/sparkle effects, and open chapter breakdown popovers.
- **Periodic:** Chemistry signature view; chapters occupy a stylized periodic-table grid with category colors, ripple interaction, and popovers.
- **Cell:** Biology signature view; chapters are organelles in a cell illustration with activation waves and popovers.
- **Code:** CS A signature view; chapters appear as syntax-highlighted Java-like code tokens/methods with popovers.
- **Cards:** horizontal chapter cards with breakdown and progress.
- **Orbit:** a 3D/coverflow transformation of the chapter cards.

Default views are course-specific: Curve for Calculus, Periodic for Chemistry, Cell for Biology, Code for CS A, and Table otherwise. A student's chosen view is remembered separately per course in localStorage.

### 7.5 Now (`right-now.html`)

Every course can have one `rightNow` object:

- `your-move`: chapter, unit, instruction, optional due date, and a contact action;
- `waiting`: chapter, unit, and a note indicating the next move is with Zenith;
- absent: an empty state.

`rightNowNext` is a deliberately constrained buffer of exactly one additional task. Students can reveal/hide it if they finish while the teacher is unavailable. The reveal state is keyed to the current chapter+unit, so advancing the task resets it automatically.

The completion contact popover is built from the same social-link source as the footer, excluding unfinished placeholder URLs.

### 7.6 This Week (`week.html`)

The weekly view compiles course-scoped current work across all enrollments into one multi-course overview rather than requiring the student to open each course separately.

### 7.7 Feedback (`feedback.html`)

Feedback is a newest-first course array of `{date, chapter, unit, content}`. It records personalized explanations and corrections. The page renders math and links to the student's cheat sheet through a count banner.

### 7.8 Cheat Sheet (`cheatsheet.html`)

Each course's cheat sheet is an oldest-first array of `{topic, source, pattern}`. It stores durable mistake patterns, formulas, and reminders arising from actual work. Content can contain inline/block LaTeX and is rendered with KaTeX.

### 7.9 Submissions (`submit.html`)

Students can submit text directly inside Zenith for fixed chapters Chapter 1–12 and M1–M16 and unit types B, C, S, R, T, N, or L. The form sends the answer and optional remarks through the `submitWork` action. It creates the same submission shape used by the legacy Google Form pipeline, so all existing student/teacher readers and grading tools work identically.

Photo attachments are not supported by the in-site form. Written/photo work still goes through the external Google Form, which performs OCR. The student submission history is course-scoped and newest-first. Each card independently folds its photos, OCR text, typed answer, and remarks. Status colors distinguish pending and complete.

### 7.10 Calendar (`calendar.html`)

The old Google Calendar embed has been replaced by a native month grid backed by `data/calendar-events.json`. Students see only events where they are explicit participants. Event details show times, description, classes, and participants.

### 7.11 Class announcements

Students receive in-app announcements targeted to their classes. Unread counts are based on per-user last-seen timestamps stored locally. Announcements are currently in-app only, not email broadcasts.

## 8. Teacher experience and workflow

Teacher scope is determined by `CLASSES`, not merely by subject. A teacher sees only the student/course pairs granted by a class roster. This permits multiple sections of one subject and co-teaching without exposing a student's other courses.

### 8.1 Dashboard (`teacher.html`)

The dashboard contains:

- subject filter based on the teacher's assigned classes;
- class/roster cards;
- a grading queue of non-complete submissions;
- bulk staging/completion controls;
- Ask My Teacher requests requiring review;
- scheduled-notification composer and existing notification list/cancel action;
- class announcement composer;
- announcements from admins.

The queue uses `status !== Complete` as the reliable needs-grading signal. It does not infer readiness from feedback dates. Submission cards expose photos, OCR, typed answers, remarks, course/student links, received time, and fun submission-pattern statistics.

### 8.2 All Students (`teacher-overview.html`)

The overview compiles one row per visible student/course with aggregate teacher-only metrics. Missing values are displayed as em dashes, not zeros, so absence of evidence is not mistaken for a zero score.

### 8.3 Student detail (`teacher-student.html`)

This is the full operational workspace for one student and one course. It displays and can stage changes to:

- current Right Now state;
- teacher-only metrics;
- roadmap and per-row status control;
- feedback;
- cheat sheet;
- Ask My Teacher request history;
- submission-pattern analysis;
- all submissions.

Changes are queued in a sticky pending panel. Teachers can remove individual staged changes, discard all, or apply a batch. Local UI updates happen after success. Multiple mutations to `js/data.js` are committed together, minimizing noisy commits; a batch spanning multiple backing files still requires one commit per file.

### 8.4 Teacher metrics

Optional course metrics include:

- topic mastery: chapter/topic/0–100 score;
- chapter coursework/test scores;
- motivation check-ins;
- mock scores split into raw MCQ and FRQ score/max pairs;
- time to completion in days;
- AP predicted score and as-of date;
- AP final score and exam date;
- responsiveness score/note/as-of;
- free-text personality tags.

The system computes “vibe type” labels from metrics and time/day submission patterns from actual timestamps; neither is stored. Much existing metrics data is explicitly draft or placeholder, and metric formalization/editing remains open work.

### 8.5 Scheduling email

Teachers can select any students across their classes, choose a send time, subject, and message. Scheduling writes a Pending row immediately; a separate GitHub Actions cron sends it later. A teacher can cancel only their own Pending notification.

### 8.6 Teacher announcements and requests

Teachers can post to one of their classes and soft-delete their own announcements. “Ask My Teacher” requests route to teachers assigned to the student's selected course, can be marked In Progress/Completed, and remain visible in the student's history.

### 8.7 Teacher calendar

Teachers see events they created or events scoped to their classes. They can create events using whole-class shortcuts plus individual participant checkboxes, and can cancel events they created. Creation can optionally batch a linked scheduled notification with the event.

## 9. Parent experience

`parent.html` is a read-only dashboard. `PARENTS[].linkedStudents` determines whose progress a parent can see. For every linked student's course, the dashboard presents progress, current task, chapters/statuses, and related summary information using the same roadmap helpers as student pages so calculations cannot drift.

The parent interface supports English and Korean labels. Tutor-authored names, instructions, and feedback remain in their original language. Parents see calendar events in which a linked child is a participant. They cannot submit, edit, unlock, grade, announce, or change data. A parent with an email can receive a copy of a linked student's push digest.

## 10. Admin experience

`admin.html` has five tabs.

### Requests

Admins see all requests, filter by category, inspect counts, and update statuses. Non-Ask-My-Teacher requests notify admins; Ask My Teacher is routed to assigned teachers instead.

### Sign-ups

Admins filter Pending/Approved/Declined requests by role, select rows individually or in bulk, and approve or decline. Approval batches account creation with status change. Student accounts are appended to `STUDENTS`; teacher accounts to `TEACHERS`. Decline creates no account. Applicant and admins receive best-effort email notifications.

### Blog

Admins can create, preview, publish, edit, and delete Markdown blog posts. Title generates a slug unless manually changed; slug uniqueness is enforced and the slug becomes immutable after publishing. The editor captures author, date, tags, excerpt, and Markdown body and uses marked.js for live preview.

### Announcements

Admins post announcements to all teachers and can soft-delete them. Teachers see these in their dashboard with unread-state behavior.

### Classes

Admins create a class by choosing name, subject, one or more teachers, and candidate students. Candidate registrations are Pending. Approving performs two operations: enroll the student in the course and confirm them on the class roster. Declining removes/rejects the candidate state without enrollment.

Because there is no `COURSE_TEMPLATES` registry yet, enrollment clones the roadmap from an existing student already enrolled in that course. Chapter 0/1 is unlocked and later work locked. This works for existing subjects but cannot scaffold a genuinely new subject with no existing enrollment.

Admins see all native calendar events and can create/cancel events broadly.

## 11. Core data model (`js/data.js`)

### Students

```text
student = {
  username,
  password | passwordHash,
  name,
  email,
  courses?: [course]
}

course = {
  id, name, icon,
  roadmap: [roadmapItem],
  rightNow?, rightNowNext?,
  feedback: [], cheatSheet: [],
  metrics?, calendarUrl?, submissionFormUrl?
}
```

Enrollment data is duplicated per student: every enrolled course carries its own roadmap and progress state. This makes personalization straightforward but makes `js/data.js` long and universal curriculum changes difficult.

### Teachers

Teacher records contain credentials, name, and optional email. Old subject-level assignment fields are considered inert; `CLASSES` is authoritative.

### Classes

```text
{ id, name, courseId, teacherUsernames[], studentUsernames[], pendingStudentUsernames?[] }
```

Class ids are stable slugs. Several classes may share a course id, a class may have several teachers, and access is resolved per student+course.

### Parents

Parent records contain credentials, name, optional email, and `linkedStudents[]`.

### Admins

Admin records are independent accounts even if the same human also has teacher/student identities.

### Current footprint

At audit time, `js/data.js` contains:

- 8 student records, of which 6 have at least one course and 2 have none;
- 15 total student-course enrollments;
- 2 teacher accounts;
- 3 classes: one Calculus, one Biology, one Chemistry;
- 1 parent account;
- 2 admin accounts.

The four active roadmap shapes contain 88 Calculus items, 87 Chemistry items, 67 Biology items, and 37 CS A items per enrollment. Live records include personalized right-now tasks, optional next tasks, feedback, cheat sheets, and a small amount of teacher-metrics data. This summary deliberately does not reproduce personal credentials or email addresses.

## 12. JSON data stores

### `data/submissions-log.json`

An array of submission records. At audit time it contains 18 entries. Common fields are id, receivedAt, status, courseId, username, chapter, unit, answers, ocrText, and formResponseId. Both native submissions and Google Form/OCR submissions share this schema.

### `data/requests-log.json`

Contains 3 entries. Records carry identity/role/contact, category, optional course, title/details/photo URL, timestamp, and New/In Progress/Completed status.

### `data/signup-requests.json`

Contains 3 entries. Records carry requested role, username, name, email, client-generated password hash, Pending/Approved/Declined state, and decision metadata.

### `data/scheduled-notifications.json`

Contains 3 entries. Records include creator, send time, recipient username/name snapshots, subject/message, Pending/Sent/Cancelled state, sent metadata, and optional event id.

### `data/calendar-events.json`

Contains 1 event. Event fields include id, title, description, start/end, creator identity/role, class ids, explicit student/teacher participants, linked notification id, Active/Cancelled state, and timestamps.

### `data/announcements.json`

Currently empty. It will hold class-targeted teacher announcements and all-teacher admin announcements. Deletion is soft: status changes rather than removal.

### `data/blog-posts.json`

Currently empty. It is the admin-managed Markdown blog store.

### `data/changelog-events.json`

An object keyed by student username, currently populated for 6 users. It is a compact in-portal activity feed generated from `js/data.js` diffs and capped at 30 events per student.

## 13. Question banks and grading

Zenith maintains four subject/type banks.

### Calculus T-bank

`calculus-t-bank.json` contains 10 chapters and 595 problems/answers total: Functions; Limits and Continuity; Differentiation; Applications of Differential Calculus; Antidifferentiation; Definite Integrals; Applications of Integration to Geometry; Further Applications of Integration; Differential Equations; Sequences and Series.

Each chapter has a title, `problems[]`, and `answer_key`. Problem fields use `stem_tex`, `choices_tex`, and `correct`; there are no pre-written Calculus explanations. Chapter 4 problem T45 embeds table choices in the stem, leaving `choices_tex` empty.

### Chemistry T-bank

`chemistry-t-bank.json` contains 10 chapters with 30 questions each, 300 total: Atomic Structure; Molecular/Ionic Structure; Intermolecular Forces; Reactions/Stoichiometry; Kinetics; Thermodynamics; Equilibrium; Acids/Bases; Applications of Thermodynamics; Experiments/Lab Analysis.

It has the same T-bank structure plus `explanation_tex`.

### Calculus C-bank

`calculus-c-bank.json` contains chapters 1–12 and 745 problems total. Chapters 1–11 are MCQ with answer keys; chapter 12 has 39 free-response problems without choices/correct/answer key. Its source is cleaned plain text, not true LaTeX, and uses `stem`, `choices`, `correct`, and `explanation`.

Many MCQ choices/explanations lost image-based content during source extraction; blank choices occur frequently. Grading must fall back to the stem and correct letter when needed.

### Chemistry C-bank

`chemistry-c-bank.json` is intentionally `{}`. It is not built and should not be invented without explicit authorization.

### Human grading workflow

For a T or C answer submission:

1. choose the bank by course id and unit prefix;
2. normalize/extract the chapter number;
3. compare submitted letters to the chapter answer key;
4. pull full problem content for every miss;
5. use supplied Chemistry/Calculus-C explanations where reliable, or reason directly from the stem;
6. write encouraging, specific feedback and durable cheat-sheet patterns;
7. update roadmap/Now as appropriate;
8. mark the submission Complete.

### `scripts/grade_pending.py`

This read-only helper grades Pending submissions deterministically. It supports filters for course/chapter/unit and optional JSON report output. It recognizes:

- positional answer strings separated by problem-id groups;
- numbered `N. LETTER` blocks;
- merged positional strings;
- `*` as skipped/unanswered rather than wrong.

It returns GRADED, NEEDS_REVIEW, NEEDS_BANK, or NOT_AUTOGRADABLE, including score, misses, full question context, unanswered ids, parse method, and remarks. It never mutates submission/student data; a human must review and apply feedback/status changes.

### Bank regeneration

Banks were parsed from external `.tex` resources under `/Users/kyj/Documents/zenith-resources/`. `scripts/parse_calculus_c_bank.py` regenerates the Calculus C-bank with regex-based A/B problem and A–D choice detection. Generated banks should be regenerated from source, not hand-maintained.

## 14. Write automation: `automation/zenith-data-writer.gs`

This standalone Apps Script Web App is the common mutation gateway. The browser POSTs either one `{action,payload}` or `applyBatch` with several operations. The server accepts only named, narrow handlers—never an arbitrary field write.

Supported actions are:

- submissions: `submitWork`, `markSubmissionComplete`;
- student course state: `updateRoadmapStatus`, `addFeedback`, `addCheatSheetEntry`, `updateRightNow`, `addMetricEntry`, `setApScore`;
- requests: `submitRequest`, `updateRequestStatus`;
- scheduled mail: `scheduleNotification`, `cancelScheduledNotification`;
- calendar: `createEvent`, `cancelEvent`;
- sign-ups/accounts: `submitSignup`, `approveSignup`, `declineSignup`, `createStudentAccount`, `createTeacherAccount`;
- classes/enrollment: `createClass`, `approveClassRegistration`, `declineClassRegistration`, `enrollStudentInCourse`;
- blog: `publishBlogPost`, `updateBlogPost`, `deleteBlogPost`;
- announcements: `postAnnouncement`, `deleteAnnouncement`.

Validation includes whitelisted statuses, roles, categories, units, chapters, metric types, score fields, event roles, announcement audiences, username syntax, required fields, uniqueness, ownership rules, and class/course existence.

Operations are grouped by target. All changes to the same file share one read/mutate/write commit. Cross-file batches produce multiple commits because the Contents API cannot atomically update several files. Account creation runs before signup approval, and enrollment before class confirmation, reducing the chance of an Approved/confirmed record without its underlying account/course.

`js/data.js` is JavaScript rather than JSON, so the writer locates a named const array by bracket-depth parsing that skips string contents, evaluates only that trusted array, mutates it, and splices it back. Student serialization keeps roadmap items compact to prevent one status flip from reformatting thousands of lines.

All writes follow GitHub GET → mutate → PUT and retry on HTTP 409 conflicts. Script properties configure token, owner, repo, branch, and target paths. The token should be fine-grained and restricted to repository Contents read/write.

Best-effort MailApp emails are sent only after a successful commit to avoid duplicate mail during retries. Email failure does not roll back the stored action.

The script's header repeatedly warns that many newest paths still require a live Apps Script redeploy and deliberate end-to-end testing. The URL is present in `js/data.js`, but comments/docs disagree about whether the current deployed version contains all repository actions. Treat the checked-in file as reference source and verify/redeploy before relying on new features.

## 15. Legacy/external submission compiler

`automation/submissions-compiler.gs` must remain bound to the external Google Form because form-submit triggers live in that container-bound project.

On submission it:

1. reads question/answer pairs generically;
2. extracts course/username/chapter/unit by case-insensitive title prefix rather than exact label;
3. normalizes numeric chapters to `Chapter N`;
4. makes uploaded files link-viewable;
5. OCRs uploads by copying them to temporary Google Docs, reads the text, then trashes the temporary docs;
6. appends a Pending entry to `data/submissions-log.json` on `main` with 409 retry;
7. emails the student a receipt if an email exists;
8. resolves assigned teachers from `CLASSES` and notifies them.

There is a one-time sharing backfill for older uploads. Earlier real submissions exposed form-label drift and stale course-name mapping; prefix matching and slug-valued course options remove those failure modes. The repository copy is not the live script until pasted into the Form's Apps Script editor.

## 16. Notification systems

Zenith has several distinct email mechanisms.

### Push-triggered student digest

When `js/data.js` changes on `main`, GitHub Actions compares the previous/current `STUDENTS` data and sends one bundled digest per affected existing student. It detects:

- any change to the whole `rightNow` object;
- new feedback by array-length growth/newest-first prefix;
- new cheat-sheet entries by array-length growth/oldest-first suffix;
- roadmap status differences by item name.

New students receive a separate welcome email. Linked parents can receive a copy of ongoing student digests.

Known blind spots: edited existing feedback/cheat-sheet text, new courses on existing students, shape changes that keep a username, and any student without email.

### Portal changelog

The same diff is converted to `data/changelog-events.json`, committed by GitHub Actions, and shown in the portal as an unread “What's new” feed.

### Public-content broadcast

Pushes touching `js/blog-data.js`, `resources.html`, or `philosophy.html` generate one bundled broadcast per student/parent email. Blog additions are length-based, resources are detected by new link href, and Philosophy uses whole-file comparison. The newer JSON blog store is not in this workflow's watched paths, so admin-published JSON posts do not automatically trigger this legacy content broadcast.

### Weekly reminder

A fixed weekly student reminder exists and can run manually. It has no active cron because real weekly sessions are not yet formalized. The workflow carefully avoids matching the 15-minute scheduled-mail cron.

### Teacher-scheduled notifications

The live `*/15 * * * *` GitHub Actions job reads Pending rows whose `sendAt` has passed, resolves recipient usernames fresh against `STUDENTS`, sends through Gmail SMTP/Nodemailer, marks each row Sent with timestamp/count, and commits the JSON file. Missing users/emails are skipped independently. GitHub cron may run late but never intentionally early.

### Action-specific immediate emails

The Apps Script writer sends or routes best-effort messages for:

- work received to student and assigned teachers;
- submission graded to student;
- sign-up received to applicant and admins;
- approval/decline to applicant;
- normal requests to admins;
- Ask My Teacher requests to assigned teachers instead;
- request status changes to the original submitter.

Gmail Actions jobs use `GMAIL_USER` and `GMAIL_APP_PASSWORD` secrets. Local scripts offer `--dry-run` modes. Documentation says most jobs are locally tested but have not yet been proven through real GitHub Actions runs, so first executions must be monitored.

## 17. Native calendar and events

Event visibility is role-aware:

- student: only explicit participant events;
- parent: events involving a linked student;
- teacher: events they created or events scoped to their classes;
- admin: all events.

Teachers/admins can select whole classes and hand-picked people. Creating an event with “also notify” produces an event operation plus an ordinary scheduled-notification operation in one batch, linked by event id. An event creator may cancel their own event; admins can cancel broadly; another teacher cannot cancel someone else's event. Cancellation is soft and records `cancelledAt`.

## 18. Requests, sign-up, class, and announcement lifecycles

### Request lifecycle

```text
guest/logged-in submission -> New -> In Progress -> Completed
```

Resource Requests can be anonymous; other guest categories are rejected. Ask My Teacher requires student/course context and follows class assignment. Confirmation/routing mail happens after persistence.

### Sign-up lifecycle

```text
browser hashes password -> Pending request -> admin Approve or Decline
Approve -> create account + mark Approved -> approval email
Decline -> mark Declined -> decline email
```

Approval can be bulked, though STUDENTS and TEACHERS are separate const arrays and therefore may require separate commits.

### Class registration lifecycle

```text
admin creates class with candidate students -> Pending registration
Approve -> clone existing course roadmap + add student to class roster
Decline -> reject/remove pending candidacy
```

There is no genuine template-backed enrollment yet and no student-side registration action.

### Announcement lifecycle

```text
teacher -> class audience -> Active -> soft Deleted
admin -> all-teachers audience -> Active -> soft Deleted
```

Unread state is browser-local and announcements currently do not email.

## 19. Blog authoring paths

There are two blog systems:

1. the current admin UI writes full Markdown posts to `data/blog-posts.json`;
2. `scripts/publish-blog.js` converts a limited frontmatter+Markdown draft into pre-rendered HTML strings and prepends it to `js/blog-data.js`.

The script requires slug/title/date/excerpt and supports level-two headings, lists, bold, links, and paragraphs. It prevents duplicate slugs but directly rewrites the source file. The admin route supports richer marked.js Markdown, tags, author, live preview, edit, and delete and should be considered the newer path.

## 20. Internationalization

`js/i18n.js` stores a `zenithLang` preference in localStorage and renders an English/Korean toggle. Korean dictionaries currently cover the public Resources interface and parent-dashboard static labels/statuses. Most of the product, including teacher/admin tools and tutor-authored learning content, remains English.

## 21. Security and privacy realities

The repository and public website contain sensitive educational/operational data. Important facts:

- hand-authored account passwords are shipped client-side in plaintext;
- new SHA-256 hashes are unsalted and publicly downloadable;
- login/role state is trusted from localStorage;
- `js/data.js`, submission logs, OCR text, requests, sign-ups, changelog, and event data are served publicly by GitHub Pages unless external controls intervene;
- upload file ids are present in public JSON and files are deliberately link-viewable so thumbnails work;
- the Apps Script endpoint is visible and currently relies on narrow action validation, not caller authentication;
- client-supplied recipient emails/lists are trusted by several best-effort mail paths;
- innerHTML/Markdown/HTML/LaTeX content paths require care against injection, especially because teacher-authored feedback explicitly allows HTML and admin blog Markdown renders in-browser;
- repository commits create long-lived history even when current JSON entries are deleted or soft-deleted.

The narrow whitelisted mutation design, redirect allowlist, client-side password hashing for new accounts, restricted GitHub token guidance, ownership checks, server-side enums, and soft-delete semantics reduce risk but do not make this suitable for high-stakes/private data. Secure login and broader privacy hardening remain essential future work.

## 22. Operational limitations and documentation drift

Several documents are historical snapshots rather than reliable current architecture:

- `README.md`, `documentation.md`, and `features-dev.md` point to `PROGRESS.md`, but that file is absent from the current repository.
- README still calls the teacher dashboard a placeholder, while the current application contains full class scope, grading, requests, notifications, announcements, metrics, and editing workflows.
- README's file tree omits most new admin/class/request/calendar/blog JSON features.
- development history ends in July and does not cover the large August feature set.
- comments around `TEACHER_DATA_WRITE_URL` say “not deployed yet” despite containing a URL; the Apps Script header says newest actions remain untested/redeployment-dependent.
- notification documentation calls the system “three triggers” while describing additional scheduled and action-specific mechanisms.
- some old comments still describe calendar/portal/submit as iframe pages even though native calendar and native text submission now exist.
- `CALENDAR_URL` remains as legacy data even though native calendar is authoritative.
- `js/data.js` says no dashboard creates classes, but `admin.html` now does.
- `todo.md` is the best record of recent shipped work, but many “Done” entries still warn that live Apps Script deployment is required.

Current code and data should therefore win over old prose. Updating README/FAQ/history and restoring or replacing the missing architecture handoff are explicit needs.

## 23. Major open work

The present backlog centers on:

- philosophy/About page, real blog content, manual/PDF/video introduction, and social posts;
- recruiting students and teachers, Zenith Local/club/proposal/presentation;
- clearer teacher next-action workflow;
- submission autoparsing, autograding, and photo support in the native form;
- formalized in-person sessions, logs, photos, and session documentation;
- formalized/editable metrics;
- student-side class registration and proper course templates;
- admin clearing/triaging of logs;
- public server-level announcements;
- daily/weekly encouragement digests;
- AP Physics resources/roadmap and Biology/Chemistry refinements;
- mobile optimization;
- question search, hints, and question-database product features;
- secure authentication;
- deeper “how to study” and Inner Excellence content;
- mentorship/community programs and eventual local/institutional expansion.

## 24. Historical evolution

Zenith evolved through these broad phases:

1. **July 15:** a tiny static student login and per-student Notion embed.
2. **July 16–20:** styling, public pages, calendar, resources, FAQ, social footer, brand/favicons, redirect hardening.
3. **July 21–25:** richer resource content, planning documents, data experiments.
4. **July 27:** Right Now, Submit, Feedback, Cheat Sheet, teacher role, blog, and the first native roadmap table.
5. **July 27–29:** multi-course enrollment, portal app launcher, selected-course state, Curve/Cards/Orbit views, public self-study roadmap, progress indicators.
6. **Late July/August:** structured submission logs, OCR, question banks, deterministic grading, teacher queue/detail/metrics, parent dashboard, notifications, and changelog.
7. **August expansion:** admin role, requests, hashed sign-up approval, classes/catalog/enrollment, scheduled notifications, native calendar, native text submission, JSON blog editor, announcements, and systematized emails.
8. **Copyright cleanup:** public self-study tracks were taken down and book links replaced with retailer searches.

The historical docs were generated from commits through 2026-07-29 and should not be mistaken for a complete August changelog.

## 25. Repository map

### Public/application pages

- `index.html`: home.
- `philosophy.html`: three pillars.
- `resources.html`: bilingual curated resources.
- `faq.html`: public guidance and feature explanations.
- `blog.html`, `blog-post.html`: JSON+legacy blog display.
- `login.html`, `signup.html`: login and account request.
- `requests.html`: guest/logged-in request intake and history.
- `portal.html`, `catalog.html`, `roadmap.html`, `right-now.html`, `week.html`, `feedback.html`, `cheatsheet.html`, `submit.html`, `calendar.html`: student experience.
- `teacher.html`, `teacher-overview.html`, `teacher-student.html`: teacher workflow.
- `parent.html`: read-only linked-student dashboard.
- `admin.html`: request/signup/blog/announcement/class administration.
- four `*-self-study.html` files: currently unavailable public track shells.

### Browser code

- `js/data.js`: primary account/class/course database and endpoint URLs.
- `js/app.js`: all auth, selection, rendering, submission, request, admin, teacher, parent, calendar, blog, catalog, changelog, and roadmap logic.
- `js/layout.js`: shared header/footer/navigation.
- `js/i18n.js`: language preference and Korean Resources/parent copy.
- `js/blog-data.js`: legacy blog posts, currently empty.
- `js/social-links.js`: shared social/contact definitions.
- `css/style.css`: complete visual system.

### Mutable data

- `data/submissions-log.json`
- `data/requests-log.json`
- `data/signup-requests.json`
- `data/scheduled-notifications.json`
- `data/calendar-events.json`
- `data/announcements.json`
- `data/blog-posts.json`
- `data/changelog-events.json`
- four test/coursework banks and their README.

### Automation and tools

- `automation/zenith-data-writer.gs`: unified browser write endpoint.
- `automation/submissions-compiler.gs`: Form-bound OCR/log compiler.
- `automation/notifications/`: diff, render, SMTP, scheduled sending, links, and docs.
- `.github/workflows/notify.yml`: push/manual/cron orchestration.
- `scripts/grade_pending.py`: read-only deterministic grader.
- `scripts/parse_calculus_c_bank.py`: Calculus C-bank generator.
- `scripts/publish-blog.js`: legacy Markdown-to-`BLOG_POSTS` publisher.

### Documentation and assets

- `README.md`, `CLAUDE.md`, `documentation.md`, `features-dev.md`, `todo.md`, automation READMEs/TRIGGERS.
- favicon/touch-icon binaries, `.nojekyll`, `.gitignore`.
- `automation/notifications/package.json` depends on Nodemailer; its lock file fixes the installed version.

## 26. Zenith's complete operating loop

In its intended mature form, Zenith's loop is:

```text
student signs up
-> admin approves account and assigns a class/course
-> student opens a personalized roadmap and one Right Now task
-> student studies actively and submits work
-> assigned teacher is notified and grades/reviews it
-> teacher records feedback and reusable cheat-sheet patterns
-> teacher updates metrics, roadmap status, and the next Right Now task
-> student/parent receive relevant updates and see the portal changelog
-> sessions, announcements, requests, calendar events, and scheduled messages keep the relationship active
-> mistakes and progress continuously refine the next cycle
```

Much of this loop now exists. Its weakest links are security, live-deployment verification, automated grading integration, photo-native submission, template-based curriculum management, documentation freshness, and making the Inner Excellence/mentorship philosophy as concrete as the roadmap machinery.
