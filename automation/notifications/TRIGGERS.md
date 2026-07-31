# How each trigger is caught, and what gets bundled together

This is the "what exactly counts as a change" reference — `README.md` covers
setup, this covers detection logic. Written after a few real test pushes
turned up gaps between what we assumed would fire and what actually fired.

## The two push-triggered jobs, and how they relate

`.github/workflows/notify.yml` runs two independent jobs on every push to
`main` (each only does anything if a file it cares about actually changed):

- **`notify-on-push`** — per-student, personal changes. Watches `js/data.js`.
- **`notify-content-updates`** — broadcast, same-for-everyone changes. Watches
  `js/blog-data.js`, `resources.html`, `philosophy.html`.

They're separate jobs so a push that only changes a student's deadline
doesn't also trigger a "check out our new blog post" scan, and vice versa.
Neither job cares what the other detects.

## Bundling: one email per recipient per job, not one per change

Within `notify-on-push`, every change detected for a given student in a
single push — a deadline change, three new feedback entries, two roadmap
unlocks, whatever combination — is collected into **one list** and rendered
as **one digest email** to that student (see `computeChanges` in
`compute-changes.js`, and `renderDigestEmail` in `render-digest.js`). Same
push, same student, five changes → one email with five bullet points, not
five emails.

The **welcome email** (brand-new student) and a **parent's copy of their
student's digest** are separate email sends within the same job run — a
push that both changes an existing student's deadline and adds a new
student sends two emails: one digest, one welcome (plus a parent copy of the
digest, if that student has a linked parent with an email).

`notify-content-updates` works the same way for the broadcast case: if a
push adds a blog post *and* a resource *and* edits `philosophy.html`, that's
still one email per recipient, listing all three.

## Per-trigger detection logic

### Deadline (`rightNow`)
**File:** `compute-changes.js`, inside `computeChanges`.
**Logic:** `JSON.stringify` the whole `rightNow` object, old vs. new — any
difference at all (chapter, unit, instruction text, due date, state) counts
as one change. Fires on the *first* push where a course already existed in
the previous commit — a course that's brand-new this push is skipped (see
"Known gaps" below).

### Feedback (new entries)
**File:** `compute-changes.js`, `computeFeedbackChanges`.
**Logic:** compares array *length* only. `feedback` is prepended (newest at
the top, per `js/data.js`'s own header comment), so if the new array is N
entries longer, the first N entries are read as "new" and each becomes one
change. **Editing the text of an existing entry does not change the array
length, so it is invisible to this check** — confirmed by a real test push
that edited two feedback entries' wording and triggered nothing for them.

### Cheat sheet (new entries)
**File:** `compute-changes.js`, `computeCheatSheetChanges`.
**Same length-based logic as feedback, but entries are appended (oldest
first)**, so the *last* N entries are the new ones, not the first. Same
blind spot as feedback: editing existing entry text is invisible.

### Roadmap status
**File:** `compute-changes.js`, `computeRoadmapChanges`.
**Logic:** items are matched old-to-new by `name` (no stable id exists), and
any status string difference (`Locked`→`Unlocked`, `Unlocked`→`Complete`,
etc., in either direction) is one change. Unlike feedback/cheat sheet this
one *does* catch edits, because status is a single field being compared
directly, not an array being measured by length.

### Welcome email (new student)
**File:** `compute-changes.js`, `computeNewStudents`.
**Logic:** a `username` present in the new `STUDENTS` array but absent from
the old one. A student who already existed — even if their whole shape
changed (e.g. moved from the old legacy top-level fields into a proper
`courses` array) — is *not* "new" by this check, since the username was
already present. Confirmed by a real test: converting `kyjv9981` from
legacy shape to `courses` sent no welcome email, because the username
already existed.

### Parent CC
**File:** `compute-changes.js`, `computeParentRecipients`.
**Logic:** runs *after* `computeChanges`, over its output — for every parent
in `PARENTS` with a non-empty `email`, for every username in their
`linkedStudents`, if that username has a digest this push, the parent gets
a copy of the same digest (`renderParentDigestEmail`). A parent is never
CC'd on a welcome email, only on the student's ongoing digest.

### New blog post
**File:** `diff-content.js`, `computeBlogChanges`.
**Logic:** length-based, same shape as feedback — `BLOG_POSTS` is prepended
(newest first, per its own header comment), so a longer new array means the
first N posts are new.

### New resource
**File:** `diff-content.js`, `computeResourceChanges`.
**Logic:** no data file backs `resources.html` — each `<a class=
"resource-item">` is regex-extracted as `{href, title}`. A `href` present in
the new HTML but not the old is "new." Editing an existing resource's title
or description without changing its `href` is invisible to this check
(same class of blind spot as feedback/cheat sheet text edits).

### Philosophy page change
**File:** `diff-content.js`, `computePhilosophyChanges`.
**Logic:** whole-file text comparison, trimmed. Any difference at all — one
word or a full rewrite — is exactly one change, since there's no
itemizable structure to break it down further.

### Submission received
**File:** `automation/submissions-compiler.gs`, `sendConfirmationEmail_`.
**Not part of either push-triggered job** — fires directly off the Google
Form's `onFormSubmit` trigger, the instant a student submits. Looks up the
submitting username against `js/data.js`'s `STUDENTS` (fetched fresh via the
GitHub API) and sends one confirmation if that student has an email;
silently does nothing otherwise.

### Weekly session reminder
**File:** `notify-session-reminder.js`.
**Built, not currently wired to fire on its own** — no `schedule:` cron is
set in `.github/workflows/notify.yml` yet (no IRL sessions are running as
of this writing). Emails everyone with a non-empty email, unconditionally —
no diffing involved at all. Still runnable manually via the workflow's
`workflow_dispatch` input.

## Known gaps (confirmed by real pushes, not yet fixed)

- **Editing an existing feedback/cheat-sheet entry's text** (not adding a
  new one) is invisible — only array *length growing* is checked.
- **A student with no `email` filled in is skipped entirely**, no matter how
  much of their data changes — confirmed with `davidheo`.
- **A brand-new course on an existing student is skipped once** (not
  compared against anything, since there's nothing to compare against) —
  confirmed with `kyjv9981`'s legacy-shape → `courses` migration.
- **A student whose entire shape changes but keeps the same username** does
  not trigger the welcome email, only the (skipped, per above) course-level
  diff.
- **Editing an existing resource's title/description without changing its
  `href`** is invisible, same class of gap as feedback/cheat sheet edits.
