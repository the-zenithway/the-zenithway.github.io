/**
 * Zenith — Teacher dashboard data writer
 * -----------------------------------------
 * Standalone Apps Script Web App (a separate deployment from the
 * Form-bound submissions-compiler.gs — that one has to stay separate,
 * see the note below) that backs every "write" control on the teacher
 * dashboard: marking a submission Complete, unlocking a roadmap item,
 * adding a feedback entry, adding a cheat sheet entry, updating a
 * course's Right Now task, logging a metrics data point, submitting a
 * feature/resource request, scheduling a notification email to a
 * class, and (as of 2026-08-10) the student/teacher signup + admin
 * approval flow. It writes to five different files depending on the
 * action — see "TARGET FILES" below.
 *
 * SIGNUP (added 2026-08-10) backs signup.html (submitSignup, called by
 * anyone, no login) and admin.html's "Sign-ups" tab
 * (approveSignup/declineSignup/createStudentAccount/
 * createTeacherAccount, called by an admin). A signup starts as a
 * "Pending" row in data/signup-requests.json — nothing else happens
 * until an admin approves or declines it. Approving is sent as a
 * batch of TWO ops (e.g. `{action: "approveSignup", ...}` +
 * `{action: "createStudentAccount", ...}`) so the account only gets
 * created if the signup itself can still be marked Approved, and vice
 * versa — see the doPost op-ordering note below for why
 * createStudentAccount/createTeacherAccount run BEFORE approveSignup
 * even though both are part of the same batch. Declining only flips
 * status, no account is created. The password never travels or sits
 * anywhere as plaintext: signup.html hashes it (SHA-256, Web Crypto)
 * before it ever leaves the browser, so both data/signup-requests.json
 * and the eventual STUDENTS/TEACHERS entry only ever hold
 * `passwordHash`, never `password`. This is the one path that DOES
 * touch STUDENTS/TEACHERS beyond the narrow field-level mutations
 * described below — seemingly in tension with "never touching
 * TEACHERS ... or any student's login credentials" above, but the
 * risk model is the same: submitSignup only ever APPENDS a Pending
 * row nobody acts on automatically, and createStudentAccount/
 * createTeacherAccount only ever APPEND a brand new account (never
 * edit or delete an existing one — both handlers throw if the
 * username's already taken) and can only run at all from an
 * approveSignup batch — i.e. only after a human admin reviewed it.
 *
 * This used to be two separate standalone scripts (this one, plus a
 * submission-status-updater.gs that only handled marking a submission
 * Complete) — merged into one on 2026-08-05 since there was no longer
 * anything left of Google's own constraints keeping them apart: a
 * Form-bound trigger script (submissions-compiler.gs) genuinely has to
 * live inside that Form's own container-bound Apps Script project,
 * but two standalone Web Apps have no such requirement, so having two
 * of them was just extra deployment work for no benefit. If you
 * already deployed the old submission-status-updater.gs separately,
 * you can delete that deployment — everything it did now lives here
 * under the `markSubmissionComplete` action.
 *
 * This endpoint is deliberately narrow rather than deployment-access-
 * restricted: TEACHER_DATA_WRITE_URL (js/data.js) is visible to
 * anyone who views page source — same as everything else in that file
 * (see its "NOT SECURE" header comment). What actually bounds the
 * risk is that every action below is a single, specific, whitelisted
 * mutation (flip one roadmap item's status, mark one submission
 * Complete, append one feedback/cheat-sheet/metrics entry, replace
 * one course's rightNow, append one request, append/cancel one
 * scheduled notification, append one Pending signup) — never an
 * arbitrary field write, never an edit or delete of an existing
 * STUDENTS/TEACHERS entry, and never touching PARENTS/ADMINS or any
 * EXISTING account's login credentials at all. Batching (below)
 * doesn't change this: a batch is just a list of these same narrow
 * actions, applied together. The one deliberate exception is
 * createStudentAccount/createTeacherAccount (see the SIGNUP note
 * above) — each APPENDS one brand new account and nothing else, can
 * only be reached from an admin-approved signup, and still can't
 * touch an existing entry (both throw on a taken username rather than
 * overwriting it).
 *
 * scheduleNotification/cancelScheduledNotification (added 2026-08-10)
 * back teacher.html's "Schedule a notification" form. This action
 * ONLY writes the Pending row to data/scheduled-notifications.json —
 * it does not send anything itself. The actual sending is a separate
 * GitHub Actions cron job (automation/notifications/
 * send-scheduled-notifications.js), polling that file independently
 * of this endpoint. See that script and .github/workflows/notify.yml.
 *
 * submitWork (added 2026-08-10) backs submit.html's own in-site
 * submission form — a typed-answer alternative to that page's external
 * Google Form link, covering every submittable roadmap unit —
 * B (Book chapter), C (Coursework), S (Solution manual), R (Review),
 * T (Test), N (Notes Submission), L (Learning) — see SUBMISSION_UNITS_
 * below — over a fixed chapter list (Chapter 1-12, plus M1-M16 for
 * mocks — see SUBMISSION_CHAPTERS_ below). The Google Form is still the
 * only path for a submission that needs a photo attached, since this
 * action only accepts typed text.
 * Writes to data/submissions-log.json, same as markSubmissionComplete
 * and the Form-bound submissions-compiler.gs — see ACTIONS.submitWork
 * below for the entry shape.
 *
 * publishBlogPost/updateBlogPost/deleteBlogPost (added 2026-08-10)
 * back admin.html's new Blog tab — a markdown editor with a live
 * preview (rendered client-side via marked.js, same call blog-post.html
 * uses to render the published post, so there's exactly one markdown->
 * HTML code path, not two that could drift). Writes append/edit/remove
 * one entry in data/blog-posts.json; nothing here renders markdown or
 * touches HTML — contentMd is stored raw. slug is admin-typed (auto-
 * suggested from the title, editable) and enforced unique by
 * publishBlogPost, then immutable across edits (updateBlogPost/
 * deleteBlogPost both look the post up BY that same slug), so a
 * blog-post.html?slug=... link already shared out never breaks out
 * from under a later edit. No approval step, no notification email —
 * unlike signups/requests this is admin-authored content, not
 * something submitted by someone else that needs review.
 *
 * postAnnouncement/deleteAnnouncement (added 2026-08-10) back
 * teacher.html's "Announce to your class" form and admin.html's new
 * "Announcements" tab — both write to data/announcements.json.
 * `audience: "class"` (teacher-authored, carries classId/className/
 * courseId from CLASSES) is visible to that class's students;
 * `audience: "teachers"` (admin-authored) is visible to every teacher
 * — see teacherClasses_/classesForStudent_ in js/app.js for how each
 * side filters this same file down to what it's allowed to see.
 * deleteAnnouncement is a soft delete (status Active -> Deleted, same
 * shape as cancelScheduledNotification's Pending -> Cancelled) rather
 * than an array splice, so history isn't destroyed — only the entry's
 * own createdBy can delete it. In-app only, deliberately no email for
 * this pass (unlike every other action covered by the NOTIFICATIONS
 * paragraph right below).
 *
 * createEvent/cancelEvent (added 2026-08-10) back calendar.html's "New
 * event" form (teacher/admin only) — writes to data/calendar-events.json.
 * A teacher or admin picks a title/description/start/end time and
 * participants (a class shortcut and/or hand-picked individual
 * students/co-teachers, resolved client-side the same way
 * scheduleNotification's recipient picker already works), and can
 * optionally also schedule a one-time notification in the SAME
 * applyBatch request (one createEvent op + one scheduleNotification op
 * carrying payload.eventId) — see js/app.js's createCalendarEventForm_.
 * The event's id is the one deliberate exception to "ids are always
 * minted server-side" in this file: doPost only ever returns
 * {ok:true} (never echoes a generated id back), so linking a
 * same-batch notification to its event requires the id to already be
 * known client-side before the request goes out — see
 * ACTIONS.createEvent's own comment for the full reasoning.
 * cancelEvent is a soft delete (Active -> Cancelled, same shape as
 * cancelScheduledNotification), cancellable by the event's own creator
 * OR any admin (admin has global, unscoped calendar visibility/
 * management, unlike a teacher who's scoped to classes they teach —
 * see teacherCalendarEvents_/adminCalendarEvents_ in js/app.js).
 * Cancelling an event does NOT cascade-cancel its linkedNotificationId,
 * if one exists — that's a known v1.1 gap, not an oversight.
 *
 * SESSION PHOTO REMINDER (added 2026-08-10): every createEvent also
 * auto-schedules its own companion notification — no opt-in, no extra
 * click — reminding the event's teacher participants to file session
 * photos in the shared Drive folder 30 minutes after the event ends.
 * See sessionPhotoReminderOp_ (defined right after doPost) for the
 * exact message/timing and SESSION_PHOTOS_DRIVE_FOLDER_URL_ for the
 * destination folder. Built entirely on the EXISTING
 * scheduleNotification/send-scheduled-notifications.js machinery — no
 * new file, no new cron job — which is why
 * automation/notifications/send-scheduled-notifications.js's recipient
 * resolution had to widen from STUDENTS-only to STUDENTS+TEACHERS on
 * this same date (a scheduleNotification's recipientUsernames used to
 * always be a student's; this is the first case where it's a
 * teacher's). Deliberately unconditional ("any scheduled event", not
 * just ones explicitly flagged as an IRL session) since there's no
 * "this is an in-person session" field on a calendar event to gate on.
 *
 * createClass/addPendingClassStudents/approveClassRegistration/
 * declineClassRegistration/enrollStudentInCourse (added 2026-08-10,
 * addPendingClassStudents added shortly after) back admin.html's
 * "Classes" tab, the write path behind catalog.html. createClass
 * appends a new CLASSES entry with an empty confirmed roster and a
 * candidate ("pending") roster of whichever students the admin picked
 * at creation — nothing touches STUDENTS yet. addPendingClassStudents
 * is the same idea applied to a class that already exists — it's what
 * lets an admin keep nominating candidates for a class after creation,
 * including the 3 originally hand-authored classes (calc-a/bio-a/
 * chem-a), which had no way to gain candidates through the UI before
 * this. Approving one candidate is sent as a batch of TWO ops, same
 * shape as signup approval: enrollStudentInCourse (target "students",
 * runs first) actually appends the course — cloning a roadmap template
 * from whichever other student already has that courseId, since
 * there's still no COURSE_TEMPLATES (see js/data.js) — paired with
 * approveClassRegistration (target "classes"), which moves the
 * username from pending to confirmed. Declining just removes the
 * candidate, no STUDENTS mutation. All of these write to js/data.js via
 * commitClassesMutation_/commitStudentsMutation_ under the same
 * DATA_PATH property STUDENTS/TEACHERS already use — no new script
 * property needed.
 *
 * NOTIFICATIONS (systematized 2026-08-10): every write action that
 * should tell someone something now does, on top of the "we got it"
 * confirmations that already existed — a new submission emails the
 * assigned teacher(s) (notifyTeachersOfWork_), a graded submission
 * emails the student (sendSubmissionGradedEmail_), a new signup emails
 * every admin (notifyAdminsOfSignup_), a declined signup emails the
 * applicant (sendSignupDeclinedEmail_), a new request emails every
 * admin UNLESS it's "Ask My Teacher" which emails the assigned
 * teacher(s) instead (notifyAdminsOfRequest_/notifyTeachersOfRequest_),
 * and a request status change emails the original submitter
 * (sendRequestStatusChangedEmail_). Extended again for the Classes
 * feature: createClass/addPendingClassStudents each email every new
 * candidate student (sendClassCandidateAddedEmail_, one per
 * payload.candidateStudents entry), approveClassRegistration emails
 * both the newly-enrolled student (sendClassRegistrationApprovedEmail_)
 * and that class's teacher(s) (notifyTeachersOfClassEnrollment_), and
 * declineClassRegistration emails the candidate
 * (sendClassRegistrationDeclinedEmail_). All of these follow the exact same
 * pattern the existing confirmation emails already established: sent
 * from doPost AFTER the relevant commit succeeds (never from inside a
 * handler — see the submitRequest email comment below for why),
 * best-effort (a MailApp failure never fails the write itself), and
 * silently skipped if the needed address/list is missing. Recipient
 * addresses are never looked up server-side here — every one rides in
 * on the payload, resolved client-side from STUDENTS/TEACHERS/CLASSES/
 * ADMINS (all already loaded in the browser via js/data.js on every
 * page that can trigger one of these actions), same trust model
 * scheduleNotification's client-resolved recipientUsernames already
 * established — see each notify*_/send*_ function below for exactly
 * which payload fields it expects.
 *
 * PHOTO UPLOADS (added 2026-08-10): submitWork and submitRequest can
 * both carry one optional photo — a submitted photo of written work, or
 * a bug-report screenshot — as `payload.photo` ({ dataBase64, mimeType,
 * filename }, already downsized client-side by
 * readImageAsCompressedBase64_ in js/app.js). doPost uploads it BEFORE
 * any of the target-grouped commits below (see the photo-upload
 * preprocessing step near the top of doPost), replacing `photo` with a
 * plain `photoUrl` string so ACTIONS.submitWork/submitRequest's
 * handlers never see the raw image data at all — just the URL they
 * store on the new entry. Uploaded straight into this repo via
 * commitFile_ (commitUploadedPhoto_, near commitFile_ below) rather
 * than to Google Drive, the way the Form-bound submissions-compiler.gs
 * does it — that needs no new OAuth scope on top of the GITHUB_TOKEN
 * this deployment already has, at the cost of the front-end (js/app.js)
 * needing to render two different photo shapes: a bare Drive file ID
 * (legacy Form uploads) or a full URL (this path) — see
 * submissionFileIds/submissionThumbHtml_ in js/app.js. Unlike the
 * notification emails above, a failed photo upload is NOT best-effort —
 * it throws and aborts the whole request, since a photo the submitter
 * explicitly attached silently going missing would be real content
 * loss, not a missed nice-to-have.
 *
 * submitRequest (added 2026-08-09) is called from requests.html by
 * students/teachers/parents, not just teacher.html — despite the
 * "TEACHER_DATA_WRITE_URL" name (kept as-is to avoid renaming churn
 * across js/app.js and js/data.js), this endpoint isn't
 * teacher-exclusive, it's just this repo's one data-write Web App.
 * requests.html also lets a "Resource Request" through with no login
 * at all (every other category still needs an account) — enforced
 * here, not just client-side, see ACTIONS.submitRequest.handler below.
 * Every successful submitRequest also sends a "got it" confirmation
 * email via sendRequestConfirmationEmail_ — the first real submission
 * after deploying this may prompt for an additional MailApp
 * authorization scope ("Send email as you"); approve it once and it
 * won't ask again.
 *
 * BATCHING: since 2026-08-05, teacher-student.html can stage several
 * changes (a roadmap unlock, a feedback entry, a Right Now update,
 * etc.) and send them as one `applyBatch` request instead of one
 * request per change — see doPost below. Every action here writes to
 * one of eight files (js/data.js, data/submissions-log.json,
 * data/requests-log.json, data/scheduled-notifications.json,
 * data/signup-requests.json, data/blog-posts.json,
 * data/announcements.json, or data/calendar-events.json — see "TARGET
 * FILES"); a batch whose
 * actions all target the same file becomes exactly ONE git commit, no
 * matter how many actions it contains. A batch that mixes targets
 * (i.e. includes markSubmissionComplete, submitRequest, or
 * scheduleNotification/cancelScheduledNotification alongside anything
 * else) still produces one commit per distinct file — that's a hard
 * limit of GitHub's Contents API, not something worth working around,
 * since markSubmissionComplete lives on a different page
 * (teacher.html) and isn't part of any teacher-student.html batch in
 * practice. An approveSignup batch is the one case that deliberately
 * mixes targets every time (approveSignup itself targets "signups",
 * paired with a createStudentAccount/createTeacherAccount targeting
 * "students"/"teachers") — see doPost's op-ordering note for why that
 * specific pairing runs account-creation first.
 *
 * This file is a reference copy for version history — the version
 * that actually runs lives inside its own Apps Script project (step 2
 * below), not here. Copy it in by hand; nothing auto-syncs.
 *
 * ---------------------------------------------------------------
 * TARGET FILES
 * ---------------------------------------------------------------
 * `markSubmissionComplete`/`submitWork` write to data/submissions-log.json,
 * `submitRequest`/`updateRequestStatus` write to data/requests-log.json,
 * `scheduleNotification`/`cancelScheduledNotification` write to
 * data/scheduled-notifications.json, `submitSignup`/`approveSignup`/
 * `declineSignup` write to data/signup-requests.json,
 * `publishBlogPost`/`updateBlogPost`/`deleteBlogPost` write to
 * data/blog-posts.json, `postAnnouncement`/`deleteAnnouncement`
 * write to data/announcements.json, and `createEvent`/`cancelEvent`
 * write to data/calendar-events.json — all seven are plain JSON files, so
 * read/mutate/write there is a straightforward JSON.parse/
 * JSON.stringify (same as submissions-compiler.gs already does for the
 * first), and all seven share one committer function,
 * commitJsonArrayMutation_ below.
 *
 * An eighth, different-shaped target: submitWork/submitRequest's
 * optional photo (see the PHOTO UPLOADS note above) commits straight to
 * a fresh path under data/uploads/ — a raw binary file, not a JSON
 * array entry, so it's NOT one of the seven above and doesn't go
 * through commitJsonArrayMutation_ at all. See commitUploadedPhoto_
 * near commitFile_ below.
 *
 * Every other action writes to js/data.js, which is a hand-authored
 * JavaScript file (`const STUDENTS = [...]` / `const TEACHERS = [...]`),
 * NOT JSON — it can't be read with a plain JSON.parse.
 * findConstArraySpan_/readConstArray_/spliceConstArray_ below solve
 * that by locating exactly one `const <NAME> = [ ... ]` span in the
 * raw file text (a bracket-depth scanner that also tracks string-
 * literal boundaries, so it finds the true matching close, not just
 * the first stray "]"), evaluating only that span (safe here — this
 * is trusted first-party code reading its own repo's data, not
 * arbitrary user input), mutating the resulting plain object in
 * memory, then re-serializing with JSON.stringify and splicing it
 * back into the original file text in place of the old span.
 * Everything outside that span — the header comment, the other
 * consts — is left untouched byte-for-byte. Two separate consts in
 * this one file can each be targeted this way: `commitStudentsMutation_`
 * for STUDENTS (existing "students" target), `commitTeachersMutation_`
 * for TEACHERS (new "teachers" target, added for createTeacherAccount)
 * — PARENTS/ADMINS have no writer and stay off-limits, per the "never
 * touching TEACHERS/PARENTS or any student's login credentials" line
 * above (createTeacherAccount is the one narrow, deliberate exception
 * to the TEACHERS half of that, see the SIGNUP note above for why).
 *
 * Caveat worth knowing: any hand-written comment *inside* a STUDENTS
 * array entry (there are none as of this writing) would be lost the
 * next time this script writes, since JSON.stringify can't preserve
 * comments. Same tradeoff js/data.js's own header comment already
 * describes for zenith-cli.
 *
 * FORMATTING: stringifyStudents_/stringifyValue_ below produce the
 * same output as JSON.stringify(value, null, 2) for everything
 * EXCEPT roadmap items, which print compactly (one line each, via
 * compactObjectString_) to match how they were originally hand-
 * authored — a single status change should read as a one-line diff,
 * not a 5-line reformat of the whole item. Added 2026-08-05; the
 * FIRST write after this fix still reformats every roadmap item in
 * one big diff (the whole file was already in expanded multi-line
 * form from writes before this existed) — that's a one-time cost,
 * not a bug. Every write after that stays compact and only touches
 * whatever actually changed.
 *
 * ---------------------------------------------------------------
 * ONE-TIME SETUP
 * ---------------------------------------------------------------
 * 1. script.google.com -> New project. Paste this whole file in,
 *    replacing whatever is in Code.gs. (Its own standalone project —
 *    not the same one as the Form-bound submissions-compiler.gs.)
 *
 * 2. Project Settings (gear icon) -> Script Properties -> add:
 *      GITHUB_TOKEN      Fine-grained PAT scoped to ONLY this repo, with
 *                        "Contents: Read and write" permission.
 *      GITHUB_OWNER      the-zenithway
 *      GITHUB_REPO       the-zenithway.github.io
 *      GITHUB_BRANCH     main
 *      DATA_PATH             js/data.js
 *      LOG_PATH              data/submissions-log.json
 *      REQUESTS_LOG_PATH     data/requests-log.json
 *      NOTIFICATIONS_PATH    data/scheduled-notifications.json
 *      SIGNUPS_PATH          data/signup-requests.json
 *      ANNOUNCEMENTS_PATH    data/announcements.json
 *      BLOG_PATH              data/blog-posts.json
 *      EVENTS_PATH            data/calendar-events.json
 *
 * 3. Deploy -> New deployment -> "Web app".
 *      Execute as:      Me
 *      Who has access:  Anyone
 *    Copy the resulting /exec URL — NOT the raw "Deployment ID" shown
 *    if you click into the deployment's own details, which is a
 *    different thing and not what TEACHER_DATA_WRITE_URL needs.
 *
 *    Before moving on: run testMailAppAuthorization_ once by hand
 *    (function dropdown, top toolbar -> testMailAppAuthorization_ ->
 *    Run) and approve the consent prompt it triggers. Every email this
 *    file sends happens inside a try/catch that fails silently — an
 *    unauthorized MailApp scope looks EXACTLY like "email just didn't
 *    send, no error, no clue why" otherwise. See that function's own
 *    comment for the full reasoning.
 *
 * 4. Paste that URL into TEACHER_DATA_WRITE_URL in js/data.js and
 *    commit. Both "Mark complete" (teacher.html) and every write
 *    control on teacher-student.html use this one URL.
 *
 * 5. Try one action for real (e.g. add a cheat sheet entry to a test
 *    student, and separately mark a real test submission Complete)
 *    and check main on GitHub for two commits, each updating exactly
 *    the one file/field that action touches and nothing else. Then
 *    try a real batch (stage a couple of changes on teacher-student.html
 *    and hit Apply) and confirm it's exactly ONE commit covering all
 *    of them. Also submit one real request from requests.html (both
 *    logged in and, separately, the no-login Resource Request path)
 *    and confirm data/requests-log.json gets exactly one new entry
 *    each time, and that a confirmation email actually arrives — the
 *    first send may trigger a one-time MailApp authorization prompt
 *    in the Apps Script editor (approve it, then retry). Also schedule
 *    one real notification from teacher.html and confirm
 *    data/scheduled-notifications.json gets exactly one new "Pending"
 *    entry — actually sending it is a separate system, see
 *    automation/notifications/send-scheduled-notifications.js. Also
 *    submit one real signup from signup.html (both roles) and confirm
 *    data/signup-requests.json gets a new "Pending" entry and a
 *    "we got your signup" email arrives; then from admin.html's
 *    Sign-ups tab approve one and decline one, and confirm: the
 *    approved one flips to "Approved" in data/signup-requests.json,
 *    js/data.js gets a new STUDENTS or TEACHERS entry (2 commits, one
 *    per file) with a passwordHash but no plaintext password, an
 *    approval email arrives, and the new account can actually log in;
 *    the declined one just flips to "Declined" with no js/data.js
 *    commit and no account created. Also try approving two signups at
 *    once (bulk) and confirm it's still just 2 commits total (one for
 *    data/signup-requests.json covering both status flips, one for
 *    js/data.js covering both new accounts — or two js/data.js commits
 *    if one signup is a student and the other a teacher, since those
 *    are two different consts, see commitTeachersMutation_ below).
 *    Also publish one real post from admin.html's Blog tab and confirm
 *    data/blog-posts.json gets exactly one new entry, that it shows up
 *    on blog.html, and that blog-post.html?slug=... renders its
 *    markdown as HTML; then edit that same post (confirm the slug
 *    stays the same and the content updates in place) and finally
 *    delete it (confirm the entry disappears from data/blog-posts.json
 *    and both public pages). Also post one real class announcement from
 *    teacher.html and one admin announcement from admin.html's
 *    Announcements tab, and confirm data/announcements.json gets one new
 *    "Active" entry each time; delete one and confirm it flips to
 *    "Deleted" in the file rather than disappearing, and that it drops
 *    off both the author's own list and the recipient's badge/dropdown.
 *    Also create one real calendar event from calendar.html (as a
 *    teacher, with a hand-picked individual student AND a whole-class
 *    shortcut both checked) with the "also notify participants" toggle
 *    ON, and confirm the single applyBatch request produces TWO
 *    commits — one adding an "Active" entry to
 *    data/calendar-events.json, one adding a "Pending" entry to
 *    data/scheduled-notifications.json whose eventId matches the new
 *    event's id. Then cancel that event (as the creator) and confirm
 *    it flips to "Cancelled" with a cancelledAt timestamp; separately
 *    create a second event as one teacher and confirm a DIFFERENT
 *    teacher can't cancel it (expect an error) but an admin can.
 *
 * ---------------------------------------------------------------
 * WHAT COUNTS AS "DONE" HERE
 * ---------------------------------------------------------------
 * Untested against a real deployment — I can't run Apps Script
 * myself. The GitHub Contents API read/PUT/retry pattern is copied
 * directly from submissions-compiler.gs, which IS confirmed working.
 * findConstArraySpan_ has been verified independently (in Node, not
 * Apps Script) against the real js/data.js — round-tripped a real
 * mutation and syntax-checked the result — but that's not the same as
 * a real Apps Script + GitHub API run. The batching logic (doPost's
 * operations-list dispatch, commitStudentsMutation_/commitJsonArrayMutation_
 * taking a list of ops) is new as of 2026-08-05 and hasn't run for
 * real either. submitRequest/commitJsonArrayMutation_'s generalization
 * from commitLogMutation_ is new as of 2026-08-09 and untested too — it's
 * the same code path markSubmissionComplete already exercises, just
 * parameterized to a second path, so risk is low, but still unverified
 * against a real deployment. The whole SIGNUP path (submitSignup/
 * approveSignup/declineSignup/createStudentAccount/
 * createTeacherAccount, commitTeachersMutation_) is new as of
 * 2026-08-10 and completely unexercised — commitTeachersMutation_ in
 * particular is a fresh near-duplicate of commitStudentsMutation_,
 * never round-tripped against the real js/data.js the way
 * findConstArraySpan_ was for STUDENTS. If step 5 throws or produces
 * an unexpected diff, send the exact error text or diff. submitWork
 * (2026-08-10) is new and untested too — same log-append code path
 * markSubmissionComplete already exercises via commitJsonArrayMutation_,
 * just a different handler, so risk is low, but try one real submission
 * from submit.html's form and confirm data/submissions-log.json gets a
 * new "pending" entry with the right chapter/unit/answer before relying
 * on it. The whole NOTIFICATIONS layer (2026-08-10) is new and
 * completely unexercised too — every notify*_/send*_ function added
 * with it follows the same MailApp.sendEmail pattern the
 * already-working confirmation emails use, so the mechanism itself is
 * low-risk, but the actual trigger wiring (which action fires which
 * email, reading the right payload fields) hasn't run for real. Worth
 * testing deliberately: submit one piece of work and confirm both the
 * student "received" email and the teacher "new submission" email
 * arrive; mark it complete and confirm the student gets a "graded"
 * email; submit a signup and confirm every admin gets a "new signup"
 * email (in addition to the applicant's existing "received" email);
 * decline one and confirm the applicant gets a "not this time" email;
 * submit a Feature Request and confirm every admin gets it, then submit
 * an Ask My Teacher and confirm the assigned teacher gets it INSTEAD of
 * admins; and update a request's status from teacher.html and confirm
 * the original submitter gets a status-change email. publishBlogPost/
 * updateBlogPost/deleteBlogPost (2026-08-10) are new and completely
 * unexercised too — same commitJsonArrayMutation_ path every other
 * "log" target already uses, so the mechanism is low-risk, but try the
 * publish/edit/delete sequence in step 5 above before relying on it.
 * postAnnouncement/deleteAnnouncement (2026-08-10) are new and
 * unexercised too — same commitJsonArrayMutation_ path, so the
 * mechanism is low-risk, but the audience-based validation (class vs
 * teachers, which fields are required/forbidden for each) hasn't run
 * for real; try both audiences and one delete in step 5 above before
 * relying on it. createEvent/cancelEvent (2026-08-10) are new and
 * completely unexercised too — same commitJsonArrayMutation_ path as
 * every other "log"-shaped target, so the mechanism is low-risk, but
 * the two-target applyBatch pairing with scheduleNotification (and the
 * client-generated id it depends on) has never actually run against a
 * real deployment; try the full sequence in step 5 above — create with
 * a linked notification, cancel as creator, confirm a non-creator
 * teacher can't cancel but an admin can — before relying on it.
 * PHOTO UPLOADS (2026-08-10) are new and completely unexercised too —
 * commitUploadedPhoto_ is a straightforward reuse of commitFile_ (the
 * confirmed-working GitHub Contents API write path), so the mechanism
 * is low-risk, but the doPost preprocessing step that rewrites `photo`
 * to `photoUrl` before any target-grouped commit runs has never fired
 * for real, and this is also the first thing in this whole file
 * committing binary (non-JSON, non-js/data.js) content — worth
 * confirming the resulting data/uploads/*.jpg actually opens as a valid
 * image, not just that the commit succeeds. Try one real submitWork
 * with a photo attached and confirm data/submissions-log.json's new
 * entry has a working photoUrl; separately try one submitRequest (e.g.
 * a Bug Report) with a screenshot attached and confirm the same for
 * data/requests-log.json. Also worth trying a too-large photo (over the
 * ~8MB MAX_PHOTO_MB_ ceiling — client-side resizing in
 * readImageAsCompressedBase64_ should normally prevent this, but a
 * direct POST could bypass it) and confirming it fails loudly rather
 * than silently truncating.
 * SESSION PHOTO REMINDER (2026-08-10) is new and unexercised too —
 * sessionPhotoReminderOp_ itself is pure/synchronous (no network calls
 * of its own; it just builds a plain object), so the real risk is
 * entirely in the two things around it: the doPost wiring (does every
 * createEvent actually produce and commit a companion notification?)
 * and send-scheduled-notifications.js's newly-widened recipient pool
 * (does a teacher username actually resolve now, where it silently
 * wouldn't have before?) — the latter WAS verified locally (real `node
 * send-scheduled-notifications.js ... --dry-run` run against a
 * synthetic fixture with a teacher recipient, confirmed the email
 * would send and render correctly), but only as a Node script against
 * fixture data, not through this Apps Script or a real GitHub Actions
 * run. Try creating one real calendar event from calendar.html and
 * confirm data/scheduled-notifications.json gets a second new "Pending"
 * entry (not just the event itself in data/calendar-events.json) with
 * sendAt 30 minutes after the event's end time and recipientUsernames
 * matching the event's teacher participants; then either wait for it or
 * hand-edit its sendAt into the past and run
 * send-scheduled-notifications.js for real (not --dry-run) to confirm
 * the teacher actually receives the email with a working Drive folder
 * link.
 */

// Every request becomes a list of { action, payload } operations — a
// single-action request (the shape every write control sent before
// batching existed) is just the N=1 case, via `applyBatch`:
//   { "action": "addFeedback", "payload": {...} }
//     -> operations = [{ action: "addFeedback", payload: {...} }]
//   { "action": "applyBatch", "payload": { "operations": [...] } }
//     -> operations = payload.operations as-is
// All ops targeting js/data.js ("students") are applied to ONE read
// of that file and committed in ONE write; same for any ops targeting
// data/submissions-log.json ("log"). A batch mixing both kinds still
// produces two commits — one per file — since GitHub's Contents API
// can't atomically commit to two different files in one call.
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var operations = body.action === "applyBatch"
      ? ((body.payload && body.payload.operations) || [])
      : [{ action: body.action, payload: body.payload || {} }];

    if (operations.length === 0) throw new Error("No operations to apply");
    operations.forEach(function (op) {
      if (!ACTIONS[op.action]) throw new Error("Unknown action: " + op.action);
    });

    var props = PropertiesService.getScriptProperties();
    var token = props.getProperty("GITHUB_TOKEN");
    var owner = props.getProperty("GITHUB_OWNER");
    var repo = props.getProperty("GITHUB_REPO");
    var branch = props.getProperty("GITHUB_BRANCH") || "main";

    if (!token || !owner || !repo) {
      throw new Error("Missing GITHUB_TOKEN/GITHUB_OWNER/GITHUB_REPO script property — see setup steps at the top of this file.");
    }

    // submitWork/submitRequest can carry an optional `photo` (base64 +
    // mimeType, from readImageAsCompressedBase64_ in js/app.js) — upload
    // it FIRST, before any of the target-grouped commits below, and
    // replace it with a plain `photoUrl` string on the op's payload.
    // Deliberately NOT best-effort like the notification emails further
    // down: a photo the submitter explicitly attached silently going
    // missing would be a real content loss, not a missed nice-to-have,
    // so a failed upload here throws and aborts the whole request rather
    // than silently logging a photo-less submission. See
    // commitUploadedPhoto_ below for why this uploads straight into the
    // repo rather than to Google Drive.
    operations.forEach(function (op) {
      if (!op.payload || !op.payload.photo) return;
      op.payload.photoUrl = commitUploadedPhoto_(owner, repo, branch, token, op.payload.photo);
      delete op.payload.photo;
    });

    var studentsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "students"; });
    var teachersOps = operations.filter(function (op) { return ACTIONS[op.action].target === "teachers"; });
    var logOps = operations.filter(function (op) { return ACTIONS[op.action].target === "log"; });
    var requestsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "requests"; });
    var notificationsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "notifications"; });
    var signupsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "signups"; });
    var blogOps = operations.filter(function (op) { return ACTIONS[op.action].target === "blog"; });
    var eventsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "events"; });
    var announcementsOps = operations.filter(function (op) { return ACTIONS[op.action].target === "announcements"; });
    var classesOps = operations.filter(function (op) { return ACTIONS[op.action].target === "classes"; });

    // studentsOps/teachersOps (createStudentAccount/createTeacherAccount)
    // run BEFORE signupsOps (approveSignup) on purpose: an
    // approve-a-signup batch sends both in one request, and if account
    // creation throws (e.g. the username got taken in the meantime),
    // this whole function throws before ever reaching the signupsOps
    // block below — so the signup is left "Pending" instead of getting
    // marked "Approved" for an account that doesn't actually exist. The
    // reverse order would risk exactly that: a signup marked Approved
    // whose account creation then failed.
    if (studentsOps.length > 0) {
      var dataPath = props.getProperty("DATA_PATH") || "js/data.js";
      commitStudentsMutation_(owner, repo, branch, dataPath, token, studentsOps);
    }
    if (teachersOps.length > 0) {
      var teachersDataPath = props.getProperty("DATA_PATH") || "js/data.js";
      commitTeachersMutation_(owner, repo, branch, teachersDataPath, token, teachersOps);
    }
    // classesOps (createClass/approveClassRegistration/
    // declineClassRegistration) run AFTER studentsOps on purpose, same
    // ordering reasoning as signups above: an approve-a-registration
    // batch pairs enrollStudentInCourse (target "students") with
    // approveClassRegistration (target "classes") in one applyBatch, so
    // if enrolling the student throws (e.g. already enrolled), this
    // function throws before ever reaching the classesOps commit below
    // — the class never shows a "confirmed" student with no real course
    // behind it.
    if (classesOps.length > 0) {
      var classesDataPath = props.getProperty("DATA_PATH") || "js/data.js";
      commitClassesMutation_(owner, repo, branch, classesDataPath, token, classesOps);
      // Same "send after the commit, not inside the handler" reasoning
      // as submitRequest above. createClass/addPendingClassStudents
      // each email every new candidate in payload.candidateStudents (one
      // MailApp call per student — see sendClassCandidateAddedEmail_);
      // approveClassRegistration emails the newly-enrolled student AND
      // the class's teacher(s); declineClassRegistration emails the
      // student. By the time we get here, any paired
      // enrollStudentInCourse op already committed successfully (see the
      // ordering note above), so the "you're enrolled" email never
      // promises a course that isn't actually there.
      classesOps.forEach(function (op) {
        if (op.action === "createClass" || op.action === "addPendingClassStudents") {
          var candidates = op.payload.candidateStudents || [];
          candidates.forEach(function (student) {
            try { sendClassCandidateAddedEmail_(student, op.payload); } catch (e) { /* best-effort only */ }
          });
        } else if (op.action === "approveClassRegistration") {
          try { sendClassRegistrationApprovedEmail_(op.payload); } catch (e) { /* best-effort only */ }
          try { notifyTeachersOfClassEnrollment_(op.payload); } catch (e) { /* best-effort only */ }
        } else if (op.action === "declineClassRegistration") {
          try { sendClassRegistrationDeclinedEmail_(op.payload); } catch (e) { /* best-effort only */ }
        }
      });
    }
    if (logOps.length > 0) {
      var logPath = props.getProperty("LOG_PATH") || "data/submissions-log.json";
      commitJsonArrayMutation_(owner, repo, branch, logPath, token, logOps);
      // Same "send after the commit, not inside the handler" reasoning as
      // submitRequest below — avoids a duplicate email on a 409 retry.
      // Every recipient address (student, teacher) rides in on the
      // payload rather than being looked up here — submit.html/
      // teacher.html already have STUDENTS/TEACHERS/CLASSES loaded
      // client-side (same trust model as scheduleNotification's
      // recipientUsernames, see the file header), so there's no reason
      // to re-fetch and re-parse js/data.js from inside this Apps
      // Script just to re-derive an email address the caller already has.
      logOps.forEach(function (op) {
        if (op.action === "submitWork") {
          try { sendWorkReceivedEmail_(op.payload); } catch (e) { /* best-effort only */ }
          try { notifyTeachersOfWork_(op.payload); } catch (e) { /* best-effort only */ }
        } else if (op.action === "markSubmissionComplete") {
          try { sendSubmissionGradedEmail_(op.payload); } catch (e) { /* best-effort only */ }
        }
      });
    }
    if (notificationsOps.length > 0) {
      var notificationsPath = props.getProperty("NOTIFICATIONS_PATH") || "data/scheduled-notifications.json";
      commitJsonArrayMutation_(owner, repo, branch, notificationsPath, token, notificationsOps);
    }
    if (requestsOps.length > 0) {
      var requestsPath = props.getProperty("REQUESTS_LOG_PATH") || "data/requests-log.json";
      commitJsonArrayMutation_(owner, repo, branch, requestsPath, token, requestsOps);
      // Sent here, AFTER the commit succeeds — not from inside
      // ACTIONS.submitRequest.handler — because a 409 retry re-runs
      // every op's handler again from a fresh read (see
      // commitJsonArrayMutation_ below); doing it there would send a
      // duplicate confirmation email per retry. A failure to email
      // (bad address, MailApp quota, etc.) is swallowed rather than
      // failing the whole request — the log entry is already
      // committed at this point, so the submitter still gets counted
      // even if the confirmation email doesn't go out.
      requestsOps.forEach(function (op) {
        if (op.action === "submitRequest") {
          try { sendRequestConfirmationEmail_(op.payload); } catch (e) { /* best-effort only */ }
          // "Ask My Teacher" routes to the assigned teacher(s) instead of
          // admins — that's the whole point of the category (see
          // REQUEST_CATEGORIES_ above); every other category goes to
          // admins, who triage from admin.html's Requests tab.
          if (op.payload.category === "Ask My Teacher") {
            try { notifyTeachersOfRequest_(op.payload); } catch (e) { /* best-effort only */ }
          } else {
            try { notifyAdminsOfRequest_(op.payload); } catch (e) { /* best-effort only */ }
          }
        } else if (op.action === "updateRequestStatus") {
          try { sendRequestStatusChangedEmail_(op.payload); } catch (e) { /* best-effort only */ }
        }
      });
    }
    if (signupsOps.length > 0) {
      var signupsPath = props.getProperty("SIGNUPS_PATH") || "data/signup-requests.json";
      commitJsonArrayMutation_(owner, repo, branch, signupsPath, token, signupsOps);
      // Same "send after the commit, not inside the handler" reasoning
      // as submitRequest above (avoids a duplicate email on a 409
      // retry). By the time we get here, any paired
      // createStudentAccount/createTeacherAccount op already committed
      // successfully (see the ordering note above) — the account is
      // real by the time this "you're approved" email goes out.
      signupsOps.forEach(function (op) {
        if (op.action === "submitSignup") {
          try { sendSignupReceivedEmail_(op.payload); } catch (e) { /* best-effort only */ }
          try { notifyAdminsOfSignup_(op.payload); } catch (e) { /* best-effort only */ }
        } else if (op.action === "approveSignup") {
          try { sendSignupApprovedEmail_(op.payload); } catch (e) { /* best-effort only */ }
        } else if (op.action === "declineSignup") {
          try { sendSignupDeclinedEmail_(op.payload); } catch (e) { /* best-effort only */ }
        }
      });
    }
    if (blogOps.length > 0) {
      var blogPath = props.getProperty("BLOG_PATH") || "data/blog-posts.json";
      commitJsonArrayMutation_(owner, repo, branch, blogPath, token, blogOps);
    }
    if (announcementsOps.length > 0) {
      var announcementsPath = props.getProperty("ANNOUNCEMENTS_PATH") || "data/announcements.json";
      commitJsonArrayMutation_(owner, repo, branch, announcementsPath, token, announcementsOps);
    }
    if (eventsOps.length > 0) {
      var eventsPath = props.getProperty("EVENTS_PATH") || "data/calendar-events.json";
      commitJsonArrayMutation_(owner, repo, branch, eventsPath, token, eventsOps);
      // No email here — createEvent/cancelEvent send nothing themselves.
      // The optional "also notify participants" step is just a second,
      // ordinary scheduleNotification op riding in the same applyBatch
      // (see createCalendarEventForm_ in js/app.js) — its own
      // notificationsOps block above already handles it; payload.eventId
      // just rides along as an extra field on that entry.

      // SESSION PHOTO REMINDER (added 2026-08-10): every createEvent
      // automatically gets its own companion "Pending" scheduled
      // notification too, addressed to the event's teacher
      // participants, reminding them to file session photos in the
      // shared Drive folder — see sessionPhotoReminderOp_ and
      // SESSION_PHOTOS_DRIVE_FOLDER_URL_ below. Unconditional, not
      // opt-in — every event gets one, independent of whatever
      // optional student-facing "also notify" message the creator
      // attached above. Committed as its OWN commitJsonArrayMutation_
      // call — a second write to data/scheduled-notifications.json
      // within this one request if the "also notify" op above also
      // targeted it — safe, since each call does its own fresh
      // GET/PUT/retry cycle rather than sharing state.
      // Known gap: if the event is later cancelled (cancelEvent), this
      // reminder is NOT automatically cancelled with it — the creating
      // teacher can cancel it by hand from teacher.html's "Scheduled
      // notifications" list, same as any other one they created (it's
      // attributed to them there, not to "Zenith" — see
      // sessionPhotoReminderOp_ for why).
      var photoReminderOps = eventsOps
        .filter(function (op) { return op.action === "createEvent"; })
        .map(sessionPhotoReminderOp_);
      if (photoReminderOps.length > 0) {
        var photoReminderNotificationsPath = props.getProperty("NOTIFICATIONS_PATH") || "data/scheduled-notifications.json";
        commitJsonArrayMutation_(owner, repo, branch, photoReminderNotificationsPath, token, photoReminderOps);
      }
    }
    return jsonResponse_({ ok: true });
  } catch (err) {
    return jsonResponse_({ ok: false, error: String(err) });
  }
}

// Shared session-documentation folder every teacher files photos
// under, one subfolder per session — a single fixed destination, not
// per-course/per-teacher, since there's only one standing
// documentation folder as of this writing. If that ever needs to
// change without a redeploy, move it to a Script Property (same as
// GITHUB_TOKEN etc.) instead — left as a plain constant for now since
// it's expected to be stable.
var SESSION_PHOTOS_DRIVE_FOLDER_URL_ = "https://drive.google.com/drive/folders/1enTgIl53iVLCEfKzUWqOp_7-unDEpF-9?usp=sharing";

// Builds the companion scheduleNotification op for one createEvent
// op — see the SESSION PHOTO REMINDER note in doPost above for when/
// why this runs. sendAt is 30 minutes after the event ends (endAt,
// falling back to startAt if the event has no explicit end time) —
// long enough that the session has actually wrapped up, short enough
// that it's still top-of-mind. recipientUsernames reuses the exact
// same "force-include the creator" computation
// ACTIONS.createEvent.handler already ran on this same payload object
// — recomputed here rather than read back from the just-committed
// event, since this Apps Script has no cheap way to read its own
// commit's result back out without a second GitHub API round trip, and
// the payload already has everything needed. `username` is set to the
// EVENT'S creator, not some generic "system" account, specifically so
// this reminder shows up in (and can be cancelled from) that teacher's
// own "Scheduled notifications" list on teacher.html, exactly like any
// notification they scheduled by hand — `name` carries "Zenith" so the
// email still reads as system-generated, not as a message from a
// colleague.
function sessionPhotoReminderOp_(op) {
  var payload = op.payload;
  var teacherParticipants = payload.participantTeacherUsernames || [];
  if (teacherParticipants.indexOf(payload.username) === -1) {
    teacherParticipants = teacherParticipants.concat([payload.username]);
  }
  var endAt = payload.endAt ? new Date(payload.endAt) : new Date(payload.startAt);
  var sendAt = new Date(endAt.getTime() + 30 * 60 * 1000);
  return {
    action: "scheduleNotification",
    payload: {
      username: payload.username,
      name: "Zenith",
      recipientUsernames: teacherParticipants,
      recipientNames: teacherParticipants,
      subject: "Upload photos from \"" + payload.title + "\"",
      message: "Session's done — time to file the photos.\n\n" +
        "1. Open the shared session folder: " + SESSION_PHOTOS_DRIVE_FOLDER_URL_ + "\n" +
        "2. Create a new folder inside it for \"" + payload.title + "\" (e.g. dated).\n" +
        "3. Upload every relevant photo/file from the session into that new folder.",
      sendAt: sendAt.toISOString(),
      eventId: payload.id
    }
  };
}

function jsonResponse_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Not called by doPost or anything else — a manual, one-time-use
// utility to surface MailApp's authorization prompt. Every real email
// send in this file (sendRequestConfirmationEmail_, notifyAdminsOfSignup_,
// etc.) runs inside a try/catch that swallows failures silently — the
// right call for a live doPost request (a bad email address shouldn't
// fail the whole write), but that same silence means an UNAUTHORIZED
// MailApp scope fails exactly the same way: no error, no email, no clue
// why. A web app trigger runs unattended, so it can't show the
// interactive consent screen MailApp needs the first time — only a
// function you run BY HAND from this editor can. Run this one once
// (function dropdown, top toolbar -> testMailAppAuthorization_ -> Run),
// approve the "wants to send email as you" prompt it pops up (Review
// permissions -> your account -> Advanced -> Go to (project name)
// (unsafe) -> Allow), and check your own inbox for the test email. Once
// authorized, every other MailApp.sendEmail call in this file works
// from doPost too — the grant applies to the whole project/deployment,
// not just this one function. Safe to leave in permanently; costs
// nothing sitting unused, and saves reconstructing this from scratch on
// the next redeploy to a fresh Apps Script project.
function testMailAppAuthorization_() {
  var me = Session.getActiveUser().getEmail();
  MailApp.sendEmail(me, "Zenith — MailApp test", "If this arrived, MailApp is authorized — every other email in zenith-data-writer.gs will now actually send.");
  Logger.log("Sent a test email to " + me + " — check your inbox.");
}

// "We got it" confirmation for a submitRequest — mirrors
// sendConfirmationEmail_ in submissions-compiler.gs in spirit, but
// simpler: that one looks the student's email up server-side from
// js/data.js by username (a Form submission only ever carries a
// trusted username, never a raw email). Here payload.email is
// whatever requests.html sent — the logged-in submitter's own email
// (from STUDENTS/TEACHERS/PARENTS/ADMINS) or, for an anonymous
// Resource Request, whatever they typed into the guest email field.
// Trusting it directly is fine for a same-request "got it" notice —
// this endpoint already doesn't authenticate its caller for anything
// (see the file header), and the worst case of a bogus address is one
// wasted email, not a data leak.
function sendRequestConfirmationEmail_(payload) {
  if (!payload.email) return; // no email on file / not given — nothing to send
  MailApp.sendEmail(payload.email,
    "Zenith — request received",
    "Got your " + payload.category + " — \"" + payload.title + "\". We'll take it from here." +
      (payload.username ? "" : "\n\n(You submitted this without logging in, so this email is the only way we can follow up with you.)"));
}

// "We got it" confirmation for submitSignup — sent right after the
// Pending row lands in data/signup-requests.json, same "AFTER the
// commit, from doPost, not from inside the handler" reasoning as
// sendRequestConfirmationEmail_ above. payload.email is whatever
// signup.html sent (whatever the applicant typed into the signup
// form) — not yet a real account, so there's nothing server-side to
// look it up against.
function sendSignupReceivedEmail_(payload) {
  if (!payload.email) return;
  MailApp.sendEmail(payload.email,
    "Zenith — signup received",
    "Hey " + payload.name + ",\n\n" +
    "We got your " + payload.role + " signup (username \"" + payload.username + "\"). " +
    "An admin reviews every signup by hand, which usually takes anywhere from 15 minutes to 1 day " +
    "depending on when you signed up — you'll get a second email the moment it's approved and your " +
    "account is ready to log into.\n\nThanks for your patience.");
}

// "You're in" notice for approveSignup — sent right after BOTH the
// signup's status flip AND its paired createStudentAccount/
// createTeacherAccount commit have succeeded (see doPost's op-
// ordering note), so this email never promises an account that
// doesn't actually exist yet. payload here is whatever admin.html
// sent along with the approveSignup op (name/email/username/role
// snapshotted from the signup entry being approved).
function sendSignupApprovedEmail_(payload) {
  if (!payload.email) return;
  MailApp.sendEmail(payload.email,
    "Zenith — you're approved!",
    "Hey " + payload.name + ",\n\n" +
    "Your " + payload.role + " signup was just approved — you can log in now with username \"" +
    payload.username + "\" and the password you picked when you signed up.\n\nSee you inside.");
}

// "Not this time" notice for declineSignup — same trigger point as
// sendSignupApprovedEmail_ (after the status-flip commit succeeds), the
// other half of the same decision. payload here is whatever admin.html
// sent along with the declineSignup op — see signupDeclineOp_ in
// js/app.js, which snapshots name/email/role from the signup entry the
// same way signupApproveOp_ already does for approveSignup.
function sendSignupDeclinedEmail_(payload) {
  if (!payload.email) return;
  MailApp.sendEmail(payload.email,
    "Zenith — about your signup",
    "Hey " + payload.name + ",\n\n" +
    "Your " + payload.role + " signup (username \"" + payload.username + "\") wasn't approved. " +
    "If you think this is a mistake, reply to this email and we'll sort it out.");
}

// Tells every admin a new signup is waiting on them in admin.html's
// Sign-ups tab. payload.adminEmails is whatever signup.html resolved
// client-side from ADMINS in js/data.js (already public information —
// every visitor's browser already has the full ADMINS array, same
// "NOT SECURE" trust model the file header describes) — trusted the
// same way scheduleNotification already trusts a client-resolved
// recipient list, rather than this Apps Script re-fetching and
// re-parsing js/data.js just to re-derive the same addresses.
function notifyAdminsOfSignup_(payload) {
  var emails = payload.adminEmails || [];
  if (emails.length === 0) return;
  var subject = "Zenith — new " + (payload.role || "signup") + " signup to review";
  var body = (payload.name || "Someone") + " (username \"" + payload.username + "\") just signed up as a " +
    (payload.role || "user") + ". Review it on admin.html's Sign-ups tab.";
  emails.forEach(function (email) { MailApp.sendEmail(email, subject, body); });
}

// "We got it" confirmation for submitWork — same idea as
// sendRequestConfirmationEmail_, and the intra-site equivalent of
// submissions-compiler.gs's sendConfirmationEmail_ for a Form
// submission, so a student sees the same behavior regardless of which
// path they submitted through. payload.email is whatever submit.html
// sent (the logged-in student's own email, from STUDENTS).
function sendWorkReceivedEmail_(payload) {
  if (!payload.email) return;
  var chapterUnit = [payload.chapter, payload.unit].filter(Boolean).join(" · ") || "your course";
  MailApp.sendEmail(payload.email,
    "Zenith — submission received",
    "Got your submission for " + chapterUnit + ". We'll take it from here — you'll get another email once feedback is written.");
}

// Notifies every teacher assigned to this submission's student+course —
// the intra-site equivalent of submissions-compiler.gs's
// notifyTeachers_ for a Form submission. payload.teacherEmails is
// whatever submit.html resolved client-side via CLASSES/TEACHERS in
// js/data.js (same trust model as notifyAdminsOfSignup_ above).
function notifyTeachersOfWork_(payload) {
  var emails = payload.teacherEmails || [];
  if (emails.length === 0) return;
  var chapterUnit = [payload.chapter, payload.unit].filter(Boolean).join(" · ") || "chapter/unit not recorded";
  var subject = "Zenith — new submission (" + (payload.name || payload.username || "unknown student") + ", " + chapterUnit + ")";
  var body = (payload.name || payload.username || "A student") + " just submitted " + chapterUnit +
    (payload.courseName ? " for " + payload.courseName : "") + ".\n\n" +
    "Review it on the Teacher Dashboard's grading queue.";
  emails.forEach(function (email) { MailApp.sendEmail(email, subject, body); });
}

// "It's graded" notice for markSubmissionComplete — the one step in
// the submission lifecycle that never emailed anyone before. payload
// here is whatever teacher.html/teacher-student.html sent alongside
// {id}: email/name/chapter/unit/courseName, snapshotted client-side
// from the STUDENTS record and the submission entry itself (both
// already in memory there — see markSubmissionComplete_ in js/app.js)
// rather than this Apps Script re-fetching js/data.js just to look up
// one email address by username.
function sendSubmissionGradedEmail_(payload) {
  if (!payload.email) return;
  var chapterUnit = [payload.chapter, payload.unit].filter(Boolean).join(" · ") || "your submission";
  MailApp.sendEmail(payload.email,
    "Zenith — your submission was graded",
    "Your submission for " + chapterUnit +
    (payload.courseName ? " (" + payload.courseName + ")" : "") +
    " has been marked complete. Log in to see any feedback left on it.");
}

// "You're a candidate" notice for createClass's initial roster and
// addPendingClassStudents' later additions — mirrors
// sendSignupReceivedEmail_'s "we got it, still needs a human step"
// framing: this isn't an enrollment yet, just a heads-up that one is
// pending. `student` is one entry of payload.candidateStudents (each
// {username, name, email}, resolved client-side in
// classCandidateEmailInfo_ in js/app.js); `payload` is the createClass/
// addPendingClassStudents op's own payload, for className/courseName —
// addPendingClassStudents sends `className`, createClass sends `name`
// (its own class-name field), hence the fallback.
function sendClassCandidateAddedEmail_(student, payload) {
  if (!student.email) return;
  var className = payload.className || payload.name;
  MailApp.sendEmail(student.email,
    "Zenith — you've been added to a class",
    "Hey " + student.name + ",\n\n" +
    "An admin added you as a candidate for \"" + className + "\"" +
    (payload.courseName ? " (" + payload.courseName + ")" : "") + ". " +
    "This isn't final yet — you'll get another email once an admin approves it and the course shows up in your portal.");
}

// "You're enrolled" notice for approveClassRegistration — sent only
// after BOTH the paired enrollStudentInCourse (STUDENTS) commit and
// this class's own commit have succeeded (see the classesOps ordering
// note in doPost), so this never promises a course that doesn't
// actually exist yet on the student's record. payload is
// approveClassRegistration's own payload — studentEmail/studentName/
// className/courseName snapshotted client-side in the Approve button's
// click handler (see renderAdminClassesLists_ in js/app.js).
function sendClassRegistrationApprovedEmail_(payload) {
  if (!payload.studentEmail) return;
  MailApp.sendEmail(payload.studentEmail,
    "Zenith — you're enrolled!",
    "Hey " + payload.studentName + ",\n\n" +
    "You're officially enrolled in \"" + payload.className + "\"" +
    (payload.courseName ? " (" + payload.courseName + ")" : "") + " — it's live in your portal now.");
}

// Tells this class's teacher(s) they just gained a student — the
// class-enrollment equivalent of notifyTeachersOfWork_ above. Sent
// alongside sendClassRegistrationApprovedEmail_, same trigger point.
// payload.teacherEmails is classTeacherEmails_(cls) from js/app.js,
// same client-resolved-recipient trust model as every other notify*_
// function here.
function notifyTeachersOfClassEnrollment_(payload) {
  var emails = payload.teacherEmails || [];
  if (emails.length === 0) return;
  var subject = "Zenith — new student in " + payload.className;
  var body = (payload.studentName || "A student") + " was just approved into \"" + payload.className + "\"" +
    (payload.courseName ? " (" + payload.courseName + ")" : "") + " — they'll now show up on your dashboard.";
  emails.forEach(function (email) { MailApp.sendEmail(email, subject, body); });
}

// "Not this time" notice for declineClassRegistration — the class
// registration equivalent of sendSignupDeclinedEmail_. No STUDENTS
// record was ever touched for a declined candidate, so there's nothing
// to undo — just the email.
function sendClassRegistrationDeclinedEmail_(payload) {
  if (!payload.studentEmail) return;
  MailApp.sendEmail(payload.studentEmail,
    "Zenith — about your class registration",
    "Hey " + payload.studentName + ",\n\n" +
    "Your candidate registration for \"" + payload.className + "\"" +
    (payload.courseName ? " (" + payload.courseName + ")" : "") + " wasn't approved this time. " +
    "If you think this is a mistake, reply to this email and we'll sort it out.");
}

// Tells every admin a new request landed in admin.html's Requests tab —
// every category except "Ask My Teacher", which routes to a teacher
// instead (see notifyTeachersOfRequest_ below). payload.adminEmails is
// client-resolved from ADMINS, same trust model as notifyAdminsOfSignup_.
function notifyAdminsOfRequest_(payload) {
  var emails = payload.adminEmails || [];
  if (emails.length === 0) return;
  var subject = "Zenith — new " + payload.category + ": " + payload.title;
  var body = (payload.name || "Someone") + " submitted a " + payload.category + " — \"" + payload.title + "\":\n\n" +
    payload.details + "\n\nReview it on admin.html's Requests tab.";
  emails.forEach(function (email) { MailApp.sendEmail(email, subject, body); });
}

// Tells the assigned teacher(s) a student asked them something via
// "Ask My Teacher" — this is what actually gets a teacher's attention
// beyond having to remember to check teacher.html's "Needs to review"
// queue. payload.teacherEmails is client-resolved via CLASSES/TEACHERS
// from the student's own courseId, same as notifyTeachersOfWork_ above.
function notifyTeachersOfRequest_(payload) {
  var emails = payload.teacherEmails || [];
  if (emails.length === 0) return;
  var subject = "Zenith — " + (payload.name || "a student") + " asked you a question";
  var body = (payload.name || "A student") + (payload.courseName ? " (" + payload.courseName + ")" : "") +
    " asked: \"" + payload.title + "\"\n\n" + payload.details +
    "\n\nReply on the Teacher Dashboard's \"Needs to review\" queue.";
  emails.forEach(function (email) { MailApp.sendEmail(email, subject, body); });
}

// Tells the original submitter their request's status changed —
// updateRequestStatus never emailed anyone before this. payload here is
// whatever teacher.html sent alongside {id, status}: email/name/title/
// category, snapshotted client-side from the request entry itself
// (already in memory in the "Needs to review" queue — see
// renderTeacherRequestsQueue_ in js/app.js) rather than this Apps
// Script re-fetching data/requests-log.json just to look the entry back
// up by id.
function sendRequestStatusChangedEmail_(payload) {
  if (!payload.email) return;
  MailApp.sendEmail(payload.email,
    "Zenith — your request is now \"" + payload.status + "\"",
    "Your " + (payload.category || "request") + " — \"" + payload.title + "\" — is now \"" + payload.status + "\".");
}

// ---------------------------------------------------------------
// Action handlers. Each has a `target` ("students", "teachers", "log",
// "requests", "notifications", "signups", "blog", or "announcements")
// saying which file it mutates, and a `handler(data, payload)` that
// mutates `data` in place
// (the STUDENTS array for "students", the TEACHERS array for
// "teachers", the submissions log array for "log", etc.) and throws a
// descriptive error on any missing/invalid input. Kept deliberately
// narrow: one action, one specific mutation, nothing generic/
// arbitrary.
// ---------------------------------------------------------------

var ROADMAP_STATUSES_ = ["Locked", "Unlocked", "Complete", "Review", "Optional-Reading"];
var METRIC_ARRAY_TYPES_ = ["topicMastery", "chapterScores", "motivation", "mockScores", "timeToCompletion", "personality"];
var AP_SCORE_FIELDS_ = ["apPredictedScore", "apFinalScore", "responsiveness"];
var REQUEST_CATEGORIES_ = ["Feature Request", "Resource Request", "Bug Report", "Ask My Teacher", "Concern / Other"];
// "admin" was missing here until 2026-08-10 — an admin submitting a
// request via requests.html (getCurrentPerson() supports all 4 roles)
// would have been rejected server-side with "Invalid role: admin",
// even though nothing in the client ever stopped them from trying.
var REQUEST_ROLES_ = ["student", "teacher", "parent", "admin"];
var REQUEST_STATUSES_ = ["New", "In Progress", "Completed"];
var SIGNUP_ROLES_ = ["student", "teacher"];
// Only a teacher or an admin can create/cancel a calendar event — a
// student/parent can only ever be a participant, never an organizer.
var CALENDAR_EVENT_ROLES_ = ["teacher", "admin"];
var ANNOUNCEMENT_AUDIENCES_ = ["class", "teachers"];
var ANNOUNCEMENT_ROLES_ = ["teacher", "admin"];
// Every roadmap unit letter submittable through submit.html's in-site
// form — matches the fixed <option> list hardcoded into submit.html's
// "Type" dropdown. I-information, F-Final Self Check, and M-Mock are
// deliberately excluded: Mock isn't a unit here, it's a chapter — see
// SUBMISSION_CHAPTERS_ just below.
var SUBMISSION_UNITS_ = ["B", "C", "S", "R", "T", "N", "L"];
// Every chapter selectable through submit.html's "Chapter" dropdown —
// Chapter 1 through 12, plus M1 through M16 for mocks. Mock roadmap
// items in js/data.js all share the literal chapter value "Chapter M"
// regardless of which mock number they are (see the M-Mock category),
// so there's no way to derive "M1"..."M16" from course.roadmap the way
// the regular chapters could be — this list is hand-authored to match
// submit.html's markup instead.
var SUBMISSION_CHAPTERS_ = (function () {
  var chapters = [];
  for (var i = 1; i <= 12; i++) chapters.push("Chapter " + i);
  for (var i = 1; i <= 16; i++) chapters.push("M" + i);
  return chapters;
})();
// 3-30 chars, letters/numbers/underscore/period/hyphen — same rough
// shape as every existing STUDENTS/TEACHERS username, just not
// formally enforced anywhere until now since every existing one was
// hand-typed by us, not submitted by a stranger over the network.
var USERNAME_PATTERN_ = /^[a-zA-Z0-9_.-]{3,30}$/;

function findCourse_(students, username, courseId) {
  var student = students.find(function (s) { return s.username === username; });
  if (!student) throw new Error("No student with username " + username);
  var course = (student.courses || []).find(function (c) { return c.id === courseId; });
  if (!course) throw new Error("Student " + username + " is not enrolled in course " + courseId);
  return course;
}

var ACTIONS = {
  markSubmissionComplete: {
    target: "log",
    handler: function (log, payload) {
      if (!payload.id) throw new Error("markSubmissionComplete requires an id");
      var entry = log.find(function (e) { return e.id === payload.id; });
      if (!entry) throw new Error("No submission with id " + payload.id + " found in the log");
      entry.status = "Complete";
    }
  },

  // Backs submit.html's in-site submission form — an alternative to
  // going through the external Google Form + submissions-compiler.gs
  // pipeline, for any of SUBMISSION_UNITS_'s roadmap categories
  // (answerable as typed text) over any of SUBMISSION_CHAPTERS_'s
  // chapters, with an optional single photo (payload.photoUrl — already
  // uploaded and rewritten from `photo` by doPost's photo-upload
  // preprocessing step above by the time this handler runs; see
  // commitUploadedPhoto_). Only the Google Form still supports more than
  // one photo per submission. Produces an entry shaped exactly like
  // buildEntryFromResponse_ in submissions-compiler.gs
  // (id/receivedAt/status/courseId/username/chapter/unit/answers/
  // ocrText/formResponseId/photoUrl) so every existing reader
  // (renderSubmissionLog, teacherSubmissionCardHtml,
  // submissionTextAnswer, the grading workflow in CLAUDE.md) treats a
  // form-submitted and a site-submitted entry identically — photoUrl is
  // the one field the Form path never populates (that path's photos
  // stay in `answers` as Drive file IDs instead; see submissionFileIds
  // in js/app.js, which reads both shapes). ocrText and formResponseId
  // are always null here — there's no OCR run on an intra-site photo and
  // no Google Form response behind this path. See doPost's NOTIFICATIONS
  // note above for the "we got it"/teacher-notify emails this sends.
  submitWork: {
    target: "log",
    handler: function (log, payload) {
      if (!payload.username || !payload.courseId || !payload.chapter || !payload.unit || !payload.answer) {
        throw new Error("submitWork requires username, courseId, chapter, unit, and answer");
      }
      if (SUBMISSION_UNITS_.indexOf(payload.unit) === -1) {
        throw new Error("Invalid unit: " + payload.unit + " (must be one of " + SUBMISSION_UNITS_.join(", ") + ")");
      }
      if (SUBMISSION_CHAPTERS_.indexOf(payload.chapter) === -1) {
        throw new Error("Invalid chapter: " + payload.chapter + " (must be one of " + SUBMISSION_CHAPTERS_.join(", ") + ")");
      }
      log.unshift({
        id: "sub_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
        receivedAt: new Date().toISOString(),
        status: "pending",
        courseId: payload.courseId,
        username: payload.username,
        chapter: payload.chapter,
        unit: payload.unit,
        answers: {
          username: payload.username,
          course: payload.courseId,
          chapter: payload.chapter,
          unit: payload.unit,
          answer: payload.answer,
          "feedback-and-remarks": payload.remarks || ""
        },
        ocrText: null,
        formResponseId: null,
        photoUrl: payload.photoUrl || null
      });
    }
  },

  updateRoadmapStatus: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (ROADMAP_STATUSES_.indexOf(payload.status) === -1) {
        throw new Error("Invalid status: " + payload.status);
      }
      var item = (course.roadmap || []).find(function (it) {
        return it.chapter === payload.chapter && it.name === payload.name;
      });
      if (!item) throw new Error("No roadmap item matching chapter \"" + payload.chapter + "\" / name \"" + payload.name + "\"");
      item.status = payload.status;
    }
  },

  addFeedback: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (!payload.date || !payload.chapter || !payload.unit || !payload.content) {
        throw new Error("addFeedback requires date, chapter, unit, and content");
      }
      if (!course.feedback) course.feedback = [];
      course.feedback.unshift({
        date: payload.date,
        chapter: payload.chapter,
        unit: payload.unit,
        content: payload.content
      });
    }
  },

  addCheatSheetEntry: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (!payload.topic || !payload.source || !payload.pattern) {
        throw new Error("addCheatSheetEntry requires topic, source, and pattern");
      }
      if (!course.cheatSheet) course.cheatSheet = [];
      course.cheatSheet.push({
        topic: payload.topic,
        source: payload.source,
        pattern: payload.pattern
      });
    }
  },

  updateRightNow: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      var rightNow = payload.rightNow;
      if (!rightNow || (rightNow.state !== "your-move" && rightNow.state !== "waiting")) {
        throw new Error("updateRightNow requires rightNow.state to be \"your-move\" or \"waiting\"");
      }
      if (!rightNow.chapter || !rightNow.unit) {
        throw new Error("updateRightNow requires rightNow.chapter and rightNow.unit");
      }
      if (rightNow.state === "your-move" && !rightNow.instruction) {
        throw new Error("updateRightNow requires rightNow.instruction when state is \"your-move\"");
      }
      if (rightNow.state === "waiting" && !rightNow.note) {
        throw new Error("updateRightNow requires rightNow.note when state is \"waiting\"");
      }
      course.rightNow = rightNow;
      if (payload.rightNowNext) course.rightNowNext = payload.rightNowNext;
      else delete course.rightNowNext;
    }
  },

  addMetricEntry: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (METRIC_ARRAY_TYPES_.indexOf(payload.metricType) === -1) {
        throw new Error("Invalid metricType: " + payload.metricType);
      }
      if (!payload.entry) throw new Error("addMetricEntry requires an entry");
      if (!course.metrics) course.metrics = {};
      if (!course.metrics[payload.metricType]) course.metrics[payload.metricType] = [];
      course.metrics[payload.metricType].push(payload.entry);
    }
  },

  // Name is legacy (started as ap-only) but the handler is generic —
  // any single-value (not array) metrics field in AP_SCORE_FIELDS_
  // goes through here, "responsiveness" included.
  setApScore: {
    target: "students",
    handler: function (students, payload) {
      var course = findCourse_(students, payload.username, payload.courseId);
      if (AP_SCORE_FIELDS_.indexOf(payload.field) === -1) {
        throw new Error("Invalid field: " + payload.field);
      }
      if (!payload.value) throw new Error("setApScore requires a value");
      if (!course.metrics) course.metrics = {};
      course.metrics[payload.field] = payload.value;
    }
  },

  // Backs requests.html. id/receivedAt are generated here (not trusted
  // from the client) same reasoning as submissions-compiler.gs's
  // "sub_" ids — a timestamp+random suffix, "req_" prefixed. Every new
  // request starts "New"; status transitions (In Progress/Done/
  // Declined) are a teacher/admin-dashboard concern, not this action.
  // Logged-in submitters (any role) can use any category. A request
  // with no username — requests.html's guest path, reachable without
  // logging in — is only allowed for "Resource Request", enforced
  // here rather than trusting the client-side dropdown lock on
  // requests.html, since that's just UI (a direct POST could claim
  // any category otherwise). Anonymous submissions also require an
  // email, since it's the only way to follow up with someone who
  // isn't a logged-in account — see sendRequestConfirmationEmail_. An
  // optional single photo/screenshot (payload.photoUrl — most useful
  // for a Bug Report, but not restricted to it) works the same way as
  // submitWork's does: already uploaded and rewritten from `photo` by
  // doPost's photo-upload preprocessing step by the time this handler
  // runs — see commitUploadedPhoto_.
  submitRequest: {
    target: "requests",
    handler: function (requests, payload) {
      if (!payload.category || !payload.title || !payload.details) {
        throw new Error("submitRequest requires category, title, and details");
      }
      if (REQUEST_CATEGORIES_.indexOf(payload.category) === -1) {
        throw new Error("Invalid category: " + payload.category);
      }
      if (payload.role && REQUEST_ROLES_.indexOf(payload.role) === -1) {
        throw new Error("Invalid role: " + payload.role);
      }
      if (!payload.username) {
        if (payload.category !== "Resource Request") {
          throw new Error("Submitting without an account is only allowed for Resource Request");
        }
        if (!payload.email) {
          throw new Error("An email is required when submitting without an account");
        }
      }
      if (payload.category === "Ask My Teacher" && !payload.courseId) {
        throw new Error("Ask My Teacher requires a courseId, so a teacher can be found for it");
      }
      requests.unshift({
        id: "req_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
        receivedAt: new Date().toISOString(),
        status: "New",
        username: payload.username || null,
        name: payload.name || null,
        email: payload.email || null,
        role: payload.role || null,
        category: payload.category,
        courseId: payload.courseId || null,
        courseName: payload.courseName || null,
        title: payload.title,
        details: payload.details,
        photoUrl: payload.photoUrl || null
      });
    }
  },

  // Backs teacher.html's "Needs to review" queue (Ask My Teacher
  // requests) — a teacher moves one from New to In Progress to
  // Completed (or straight to Completed). No ownership check against
  // CLASSES here (same trust level as every other action in this
  // file, see the header comment): the UI only ever shows a teacher
  // their own students' requests, via teacherCanSeeCourse_ in
  // js/app.js, client-side.
  updateRequestStatus: {
    target: "requests",
    handler: function (requests, payload) {
      if (!payload.id || !payload.status) {
        throw new Error("updateRequestStatus requires id and status");
      }
      if (REQUEST_STATUSES_.indexOf(payload.status) === -1) {
        throw new Error("Invalid status: " + payload.status);
      }
      var entry = requests.find(function (r) { return r.id === payload.id; });
      if (!entry) throw new Error("No request with id " + payload.id);
      entry.status = payload.status;
    }
  },

  // Backs teacher.html's "Schedule a notification" form — a teacher
  // checks off any number of individual students (pooled across every
  // class they teach — teacherClasses_ in js/app.js, since one teacher
  // can have several), writes a subject/message, and picks a future
  // send time. Doesn't send anything itself: this only appends a
  // "Pending" row to data/scheduled-notifications.json; automation/
  // notifications/send-scheduled-notifications.js (a separate GitHub
  // Actions cron job, not this Apps Script) polls that file and does
  // the actual sending once payload.sendAt has passed.
  //
  // recipientUsernames isn't cross-checked against CLASSES here (same
  // trust level as every other teacher-initiated action in this file —
  // see the header comment); the payload is trusted for who it's
  // allowed to address, same as addFeedback trusts payload.courseId.
  // recipientNames is a display-only snapshot (so the teacher.html list
  // still shows real names even if a student is later renamed/removed)
  // — the actual send in send-scheduled-notifications.js re-resolves
  // emails fresh from js/data.js by username, never from this snapshot.
  scheduleNotification: {
    target: "notifications",
    handler: function (notifications, payload) {
      if (!payload.username || !payload.recipientUsernames || !payload.recipientUsernames.length || !payload.subject || !payload.message || !payload.sendAt) {
        throw new Error("scheduleNotification requires username, recipientUsernames (non-empty), subject, message, and sendAt");
      }
      var sendAt = new Date(payload.sendAt);
      if (isNaN(sendAt.getTime())) throw new Error("Invalid sendAt: " + payload.sendAt);
      notifications.unshift({
        id: "notif_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
        createdBy: payload.username,
        createdByName: payload.name || payload.username,
        createdAt: new Date().toISOString(),
        sendAt: sendAt.toISOString(),
        recipientUsernames: payload.recipientUsernames,
        recipientNames: payload.recipientNames && payload.recipientNames.length === payload.recipientUsernames.length
          ? payload.recipientNames : payload.recipientUsernames,
        subject: payload.subject,
        message: payload.message,
        status: "Pending",
        sentAt: null,
        recipientCount: null,
        // Set only when this notification was scheduled alongside a
        // calendar event (createCalendarEventForm_'s "also notify"
        // sub-form, js/app.js) — an ordinary teacher.html notification
        // never sets this, so it stays null there. Purely informational;
        // nothing currently reads it back (no cascade-cancel yet — see
        // ACTIONS.cancelEvent, which doesn't touch this file).
        eventId: payload.eventId || null
      });
    }
  },

  // A teacher can only cancel their own scheduled notification (checked
  // against createdBy, not just "any teacher"), and only while it's
  // still Pending — once send-scheduled-notifications.js has sent it,
  // cancelling would be misleading (the emails are already out).
  cancelScheduledNotification: {
    target: "notifications",
    handler: function (notifications, payload) {
      if (!payload.id || !payload.username) {
        throw new Error("cancelScheduledNotification requires id and username");
      }
      var entry = notifications.find(function (n) { return n.id === payload.id; });
      if (!entry) throw new Error("No scheduled notification with id " + payload.id);
      if (entry.createdBy !== payload.username) {
        throw new Error("Only the teacher who scheduled this notification can cancel it");
      }
      if (entry.status !== "Pending") {
        throw new Error("Only a Pending notification can be cancelled (this one is " + entry.status + ")");
      }
      entry.status = "Cancelled";
    }
  },

  // Backs calendar.html's "New event" form (teacher.html/admin.html's
  // in-site calendar) — creates one Active event in
  // data/calendar-events.json. The event's own id is CLIENT-generated
  // (payload.id), unlike every other action in this file, because
  // doPost only ever returns {ok:true} — an id minted here could never
  // be echoed back in time to let the caller link a same-request
  // scheduleNotification (payload.eventId) to this event via one
  // applyBatch. participantStudentUsernames/participantTeacherUsernames/
  // classIds aren't cross-checked against CLASSES here — same trust
  // level as scheduleNotification's recipientUsernames (see header
  // comment). The creator is force-included as a teacher participant
  // even if the client forgot to check their own box.
  createEvent: {
    target: "events",
    handler: function (events, payload) {
      if (!payload.id || !payload.username || !payload.role || !payload.title || !payload.startAt) {
        throw new Error("createEvent requires id, username, role, title, and startAt");
      }
      if (CALENDAR_EVENT_ROLES_.indexOf(payload.role) === -1) {
        throw new Error("Invalid role: " + payload.role);
      }
      if (events.some(function (e) { return e.id === payload.id; })) {
        throw new Error("Event id already exists: " + payload.id);
      }
      var startAt = new Date(payload.startAt);
      if (isNaN(startAt.getTime())) throw new Error("Invalid startAt: " + payload.startAt);
      var endAt = null;
      if (payload.endAt) {
        endAt = new Date(payload.endAt);
        if (isNaN(endAt.getTime())) throw new Error("Invalid endAt: " + payload.endAt);
        if (endAt.getTime() < startAt.getTime()) throw new Error("endAt can't be before startAt");
      }
      var teacherParticipants = payload.participantTeacherUsernames || [];
      if (teacherParticipants.indexOf(payload.username) === -1) {
        teacherParticipants = teacherParticipants.concat([payload.username]);
      }
      events.unshift({
        id: payload.id,
        title: payload.title,
        description: payload.description || "",
        startAt: startAt.toISOString(),
        endAt: endAt ? endAt.toISOString() : null,
        createdBy: payload.username,
        createdByName: payload.name || payload.username,
        createdByRole: payload.role,
        classIds: payload.classIds || [],
        participantStudentUsernames: payload.participantStudentUsernames || [],
        participantTeacherUsernames: teacherParticipants,
        linkedNotificationId: payload.linkedNotificationId || null,
        status: "Active",
        createdAt: new Date().toISOString(),
        cancelledAt: null
      });
    }
  },

  // Only the event's own creator or an admin can cancel it (an admin
  // override, unlike cancelScheduledNotification, since admin has
  // global calendar visibility/management — see teacherCalendarEvents_/
  // adminCalendarEvents_ in js/app.js). No updateEvent yet — same
  // create+cancel-only precedent as scheduleNotification/
  // cancelScheduledNotification; editing is a natural v1.1 addition on
  // this same "events" target scaffolding, deliberately deferred.
  cancelEvent: {
    target: "events",
    handler: function (events, payload) {
      if (!payload.id || !payload.username || !payload.role) {
        throw new Error("cancelEvent requires id, username, and role");
      }
      var entry = events.find(function (e) { return e.id === payload.id; });
      if (!entry) throw new Error("No event with id " + payload.id);
      if (entry.createdBy !== payload.username && payload.role !== "admin") {
        throw new Error("Only the event's creator or an admin can cancel it");
      }
      if (entry.status !== "Active") {
        throw new Error("Only an Active event can be cancelled (this one is " + entry.status + ")");
      }
      entry.status = "Cancelled";
      entry.cancelledAt = new Date().toISOString();
    }
  },

  // Backs signup.html — anyone, no login required (that's the whole
  // point). Appends one "Pending" row to data/signup-requests.json;
  // nothing else happens until an admin approves or declines it from
  // admin.html. id/receivedAt/status are generated here, never trusted
  // from the client, same as submitRequest above. passwordHash is
  // whatever signup.html computed client-side (SHA-256 over the
  // password, via Web Crypto) — this endpoint never sees, stores, or
  // forwards a plaintext password anywhere, for either role.
  //
  // Uniqueness is only checked against OTHER non-Declined signups in
  // this same file — this handler has no visibility into js/data.js's
  // STUDENTS/TEACHERS (different file, different commit). The real,
  // authoritative uniqueness check happens at approval time, inside
  // createStudentAccount/createTeacherAccount below, which DO read the
  // live STUDENTS/TEACHERS array right before writing to it. That means
  // two people could both submit the same desired username and both
  // land in the Pending queue — that's fine, intentional even: an
  // admin sees both, and approving whichever one first simply makes
  // the other's later approval attempt fail with a clear "already
  // taken" error instead of silently colliding.
  submitSignup: {
    target: "signups",
    handler: function (signups, payload) {
      if (!payload.role || SIGNUP_ROLES_.indexOf(payload.role) === -1) {
        throw new Error("Invalid role: " + payload.role);
      }
      if (!payload.username || !payload.name || !payload.email || !payload.passwordHash) {
        throw new Error("submitSignup requires username, name, email, and passwordHash");
      }
      if (!USERNAME_PATTERN_.test(payload.username)) {
        throw new Error("Username must be 3-30 characters: letters, numbers, underscore, period, or hyphen only");
      }
      var alreadyPending = signups.some(function (s) {
        return s.username === payload.username && s.status !== "Declined";
      });
      if (alreadyPending) {
        throw new Error("A signup for username \"" + payload.username + "\" is already pending or approved");
      }
      signups.unshift({
        id: "signup_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
        receivedAt: new Date().toISOString(),
        status: "Pending",
        role: payload.role,
        username: payload.username,
        name: payload.name,
        email: payload.email,
        passwordHash: payload.passwordHash,
        decidedAt: null,
        decidedBy: null
      });
    }
  },

  // Backs admin.html's "Approve" control (single or bulk — bulk just
  // sends one applyBatch with N of these, one per selected signup,
  // each paired with its own createStudentAccount/createTeacherAccount
  // op — see the doPost op-ordering note for why account-creation
  // always runs first). Only a still-Pending signup can be approved,
  // so double-approving (e.g. two admins racing) fails loudly on the
  // second attempt rather than silently no-op-ing.
  approveSignup: {
    target: "signups",
    handler: function (signups, payload) {
      if (!payload.id) throw new Error("approveSignup requires an id");
      var entry = signups.find(function (s) { return s.id === payload.id; });
      if (!entry) throw new Error("No signup with id " + payload.id);
      if (entry.status !== "Pending") {
        throw new Error("Signup " + payload.id + " is not Pending (it's " + entry.status + ")");
      }
      entry.status = "Approved";
      entry.decidedAt = new Date().toISOString();
      entry.decidedBy = payload.decidedBy || null;
    }
  },

  // Backs admin.html's "Decline" control (single or bulk, same
  // shape as approveSignup). Only flips status — never touches
  // js/data.js, since nothing should exist for a declined signup.
  declineSignup: {
    target: "signups",
    handler: function (signups, payload) {
      if (!payload.id) throw new Error("declineSignup requires an id");
      var entry = signups.find(function (s) { return s.id === payload.id; });
      if (!entry) throw new Error("No signup with id " + payload.id);
      if (entry.status !== "Pending") {
        throw new Error("Signup " + payload.id + " is not Pending (it's " + entry.status + ")");
      }
      entry.status = "Declined";
      entry.decidedAt = new Date().toISOString();
      entry.decidedBy = payload.decidedBy || null;
    }
  },

  // Only reachable as part of an approveSignup batch from admin.html
  // (see the SIGNUP header note) — appends ONE brand new STUDENTS
  // entry with no enrolled courses yet (course registration is future
  // work, deliberately out of scope here — see todo.md). Throws if the
  // username is already taken by an existing student, which is the
  // real (as opposed to submitSignup's best-effort) uniqueness gate,
  // since this reads the live STUDENTS array right before writing it.
  createStudentAccount: {
    target: "students",
    handler: function (students, payload) {
      if (!payload.username || !payload.name || !payload.passwordHash) {
        throw new Error("createStudentAccount requires username, name, and passwordHash");
      }
      if (!USERNAME_PATTERN_.test(payload.username)) {
        throw new Error("Invalid username: " + payload.username);
      }
      var taken = students.some(function (s) { return s.username === payload.username; });
      if (taken) throw new Error("Username already taken: " + payload.username);
      students.push({
        username: payload.username,
        name: payload.name,
        passwordHash: payload.passwordHash,
        email: payload.email || "",
        courses: []
      });
    }
  },

  // Same idea as createStudentAccount, appending to TEACHERS instead
  // (see commitTeachersMutation_ below for how that gets written back
  // — TEACHERS has no "courses" field of its own; which classes a
  // teacher sees is entirely CLASSES-driven, assigned by hand
  // separately, same as for any existing teacher).
  createTeacherAccount: {
    target: "teachers",
    handler: function (teachers, payload) {
      if (!payload.username || !payload.name || !payload.passwordHash) {
        throw new Error("createTeacherAccount requires username, name, and passwordHash");
      }
      if (!USERNAME_PATTERN_.test(payload.username)) {
        throw new Error("Invalid username: " + payload.username);
      }
      var taken = teachers.some(function (t) { return t.username === payload.username; });
      if (taken) throw new Error("Username already taken: " + payload.username);
      teachers.push({
        username: payload.username,
        name: payload.name,
        passwordHash: payload.passwordHash,
        email: payload.email || ""
      });
    }
  },

  // CLASSES (added 2026-08-10) — backs admin.html's "Classes" tab.
  // createClass appends a brand-new class with a confirmed roster of
  // zero and a candidate ("pending") roster of whichever students the
  // admin picked at creation time — nobody's STUDENTS record is touched
  // yet. A student only actually gets the course once an admin approves
  // them individually (approveClassRegistration below, always paired
  // with enrollStudentInCourse — see the doPost ordering note for why
  // that pairing is safe). id is a stable slug (auto-suggested
  // client-side from the class name, same idea as blog's slug) and must
  // be unique across CLASSES, same as every other id-keyed collection in
  // this file.
  createClass: {
    target: "classes",
    handler: function (classes, payload) {
      if (!payload.id || !payload.name || !payload.courseId || !payload.teacherUsernames || !payload.teacherUsernames.length) {
        throw new Error("createClass requires id, name, courseId, and at least one teacherUsername");
      }
      if (!/^[a-z0-9-]{2,60}$/.test(payload.id)) {
        throw new Error("Class id must be 2-60 characters: lowercase letters, numbers, and hyphens only");
      }
      var taken = classes.some(function (c) { return c.id === payload.id; });
      if (taken) throw new Error("A class with id \"" + payload.id + "\" already exists");
      classes.push({
        id: payload.id,
        name: payload.name,
        courseId: payload.courseId,
        teacherUsernames: payload.teacherUsernames,
        studentUsernames: [],
        pendingStudentUsernames: payload.pendingStudentUsernames || []
      });
    }
  },

  // Appends more candidates to an ALREADY-EXISTING class's
  // pendingStudentUsernames — createClass only sets the initial
  // candidate roster at creation time; this is what lets an admin keep
  // nominating students for a class afterward, including the 3
  // originally hand-authored classes (calc-a/bio-a/chem-a), which
  // otherwise have no candidates and no way to gain any through the
  // UI. Silently skips (never throws for) any username already on
  // either the confirmed or pending roster, so re-submitting an
  // already-checked box is harmless — same idempotent-ish spirit as
  // approveClassRegistration only throwing on a genuinely bad state.
  addPendingClassStudents: {
    target: "classes",
    handler: function (classes, payload) {
      if (!payload.classId || !payload.usernames || !payload.usernames.length) {
        throw new Error("addPendingClassStudents requires classId and at least one username");
      }
      var cls = classes.find(function (c) { return c.id === payload.classId; });
      if (!cls) throw new Error("No class with id " + payload.classId);
      cls.studentUsernames = cls.studentUsernames || [];
      cls.pendingStudentUsernames = cls.pendingStudentUsernames || [];
      payload.usernames.forEach(function (username) {
        if (cls.studentUsernames.indexOf(username) === -1 && cls.pendingStudentUsernames.indexOf(username) === -1) {
          cls.pendingStudentUsernames.push(username);
        }
      });
    }
  },

  // Moves one username from pendingStudentUsernames to
  // studentUsernames on the given class — the confirmed roster
  // (studentUsernames) is what teacherCanSeeCourse_/teacherClasses_ in
  // js/app.js actually key visibility off of, so this is the moment a
  // teacher gains visibility into this student, not class creation.
  // Only reachable paired with enrollStudentInCourse in one applyBatch
  // from admin.html (see the doPost ordering note above) — never called
  // alone, so a class can't show a confirmed student with no course.
  approveClassRegistration: {
    target: "classes",
    handler: function (classes, payload) {
      if (!payload.classId || !payload.username) {
        throw new Error("approveClassRegistration requires classId and username");
      }
      var cls = classes.find(function (c) { return c.id === payload.classId; });
      if (!cls) throw new Error("No class with id " + payload.classId);
      var pending = cls.pendingStudentUsernames || [];
      var idx = pending.indexOf(payload.username);
      if (idx === -1) throw new Error(payload.username + " is not a pending registration for class " + payload.classId);
      pending.splice(idx, 1);
      cls.pendingStudentUsernames = pending;
      if (cls.studentUsernames.indexOf(payload.username) === -1) cls.studentUsernames.push(payload.username);
    }
  },

  // Just removes the candidate from pendingStudentUsernames — no
  // STUDENTS mutation, since nothing was ever created for a declined
  // registration (same shape as declineSignup above).
  declineClassRegistration: {
    target: "classes",
    handler: function (classes, payload) {
      if (!payload.classId || !payload.username) {
        throw new Error("declineClassRegistration requires classId and username");
      }
      var cls = classes.find(function (c) { return c.id === payload.classId; });
      if (!cls) throw new Error("No class with id " + payload.classId);
      var pending = cls.pendingStudentUsernames || [];
      var idx = pending.indexOf(payload.username);
      if (idx === -1) throw new Error(payload.username + " is not a pending registration for class " + payload.classId);
      pending.splice(idx, 1);
      cls.pendingStudentUsernames = pending;
    }
  },

  // Appends one real course entry onto an EXISTING student's `courses`
  // — the actual "enrollment," only reachable from an
  // approveClassRegistration batch (see above). There's still no
  // COURSE_TEMPLATES (see the NOT YET IMPLEMENTED note near the top of
  // js/data.js), so the roadmap has to be cloned from whichever other
  // student already has this exact courseId — cloneRoadmapTemplate_
  // below does that, resetting every item's status to "Unlocked" for
  // Chapter 0/Chapter 1 (Chapter 0 is always-available reference
  // material — real roadmap data has zero Chapter-0 items ever
  // "Locked" — and Chapter 1 is the standard starting point) and
  // "Locked" everywhere else. Throws if no student anywhere has this
  // courseId yet (nothing to clone) or if this student is already
  // enrolled in it.
  enrollStudentInCourse: {
    target: "students",
    handler: function (students, payload) {
      if (!payload.username || !payload.courseId) {
        throw new Error("enrollStudentInCourse requires username and courseId");
      }
      var student = students.find(function (s) { return s.username === payload.username; });
      if (!student) throw new Error("No student with username " + payload.username);
      student.courses = student.courses || [];
      var already = student.courses.some(function (c) { return c.id === payload.courseId; });
      if (already) throw new Error(payload.username + " is already enrolled in " + payload.courseId);
      var template = cloneRoadmapTemplate_(students, payload.courseId);
      student.courses.push({
        id: payload.courseId,
        name: template.name,
        icon: template.icon,
        roadmap: template.roadmap,
        feedback: [],
        cheatSheet: []
      });
    }
  },

  // Backs admin.html's Blog tab "Publish" button (added 2026-08-10) —
  // appends one post to data/blog-posts.json. Markdown is stored raw
  // (payload.contentMd, never pre-rendered to HTML here) since
  // blog-post.html renders it client-side with the same marked.js call
  // admin.html's live preview already uses — one rendering code path,
  // not two that could drift. slug is admin-typed (auto-suggested from
  // the title client-side, editable before publish) rather than
  // generated here, so the URL is stable and human-chosen; uniqueness
  // IS enforced here since two posts sharing a slug would silently
  // shadow each other on blog-post.html's ?slug= lookup.
  publishBlogPost: {
    target: "blog",
    handler: function (posts, payload) {
      if (!payload.slug || !payload.title || !payload.author || !payload.contentMd) {
        throw new Error("publishBlogPost requires slug, title, author, and contentMd");
      }
      if (!/^[a-z0-9-]{3,80}$/.test(payload.slug)) {
        throw new Error("Slug must be 3-80 characters: lowercase letters, numbers, and hyphens only");
      }
      var taken = posts.some(function (p) { return p.slug === payload.slug; });
      if (taken) throw new Error("A post with slug \"" + payload.slug + "\" already exists");
      posts.unshift({
        slug: payload.slug,
        title: payload.title,
        author: payload.author,
        date: payload.date || new Date().toISOString().slice(0, 10),
        publishedAt: payload.publishedAt || new Date().toISOString(),
        tags: payload.tags || [],
        excerpt: payload.excerpt || "",
        contentMd: payload.contentMd,
        publishedBy: payload.publishedBy || null,
        createdAt: new Date().toISOString(),
        updatedAt: null
      });
    }
  },

  // Backs admin.html's "Save changes" on an existing post — looked up
  // by slug, which stays immutable once published (the admin UI keeps
  // the slug field locked when editing) so blog-post.html?slug=... links
  // already shared out never break out from under an edit.
  updateBlogPost: {
    target: "blog",
    handler: function (posts, payload) {
      if (!payload.slug) throw new Error("updateBlogPost requires slug");
      var entry = posts.find(function (p) { return p.slug === payload.slug; });
      if (!entry) throw new Error("No post with slug " + payload.slug);
      if (!payload.title || !payload.author || !payload.contentMd) {
        throw new Error("updateBlogPost requires title, author, and contentMd");
      }
      entry.title = payload.title;
      entry.author = payload.author;
      entry.date = payload.date || entry.date;
      entry.publishedAt = payload.publishedAt || entry.publishedAt;
      entry.tags = payload.tags || [];
      entry.excerpt = payload.excerpt || "";
      entry.contentMd = payload.contentMd;
      entry.updatedAt = new Date().toISOString();
    }
  },

  // Backs admin.html's "Delete" control on a post card — permanent,
  // no undo (same as every other delete-shaped control in this repo,
  // there are none yet; this is the first). No confirmation step
  // exists server-side — admin.html's own confirm() dialog is the only
  // guard, same trust level as every other action in this file.
  deleteBlogPost: {
    target: "blog",
    handler: function (posts, payload) {
      if (!payload.slug) throw new Error("deleteBlogPost requires slug");
      var index = posts.findIndex(function (p) { return p.slug === payload.slug; });
      if (index === -1) throw new Error("No post with slug " + payload.slug);
      posts.splice(index, 1);
    }
  },

  // Backs teacher.html's "Announce to your class" form
  // (audience: "class") and admin.html's "Announcements" tab
  // (audience: "teachers"). classId/className/courseId are required
  // for "class" (resolved client-side from CLASSES, same trust level
  // as scheduleNotification trusts recipientUsernames — see the file
  // header) and forbidden for "teachers", since an admin announcement
  // has no single class to scope to. id/createdAt/status are generated
  // here, never trusted from the client, same as every other "append a
  // log row" action above.
  postAnnouncement: {
    target: "announcements",
    handler: function (announcements, payload) {
      if (!payload.username || !payload.name || !payload.title || !payload.message) {
        throw new Error("postAnnouncement requires username, name, title, and message");
      }
      if (ANNOUNCEMENT_ROLES_.indexOf(payload.createdByRole) === -1) {
        throw new Error("Invalid createdByRole: " + payload.createdByRole);
      }
      if (ANNOUNCEMENT_AUDIENCES_.indexOf(payload.audience) === -1) {
        throw new Error("Invalid audience: " + payload.audience);
      }
      if (payload.audience === "class") {
        if (!payload.classId || !payload.className || !payload.courseId) {
          throw new Error("postAnnouncement requires classId, className, and courseId when audience is \"class\"");
        }
      } else if (payload.classId || payload.className || payload.courseId) {
        throw new Error("postAnnouncement must not include classId/className/courseId when audience is \"teachers\"");
      }
      announcements.unshift({
        id: "ann_" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8),
        createdBy: payload.username,
        createdByName: payload.name,
        createdByRole: payload.createdByRole,
        createdAt: new Date().toISOString(),
        audience: payload.audience,
        classId: payload.classId || null,
        className: payload.className || null,
        courseId: payload.courseId || null,
        title: payload.title,
        message: payload.message,
        status: "Active"
      });
    }
  },

  // A teacher/admin can only delete their own announcement (checked
  // against createdBy), and only while it's still Active. Soft delete
  // (status -> "Deleted"), same shape as cancelScheduledNotification —
  // keeps the row for history instead of splicing it out, unlike
  // deleteBlogPost above (that one's a real delete, since a published
  // post has no "who can still see it" audience concern the way an
  // announcement does).
  deleteAnnouncement: {
    target: "announcements",
    handler: function (announcements, payload) {
      if (!payload.id || !payload.username) {
        throw new Error("deleteAnnouncement requires id and username");
      }
      var entry = announcements.find(function (a) { return a.id === payload.id; });
      if (!entry) throw new Error("No announcement with id " + payload.id);
      if (entry.createdBy !== payload.username) {
        throw new Error("Only the author of this announcement can delete it");
      }
      if (entry.status !== "Active") {
        throw new Error("This announcement was already deleted");
      }
      entry.status = "Deleted";
    }
  }
};

// ---------------------------------------------------------------
// js/data.js text <-> real object bridge
// ---------------------------------------------------------------

// Finds `const <constName> = [ ... ]` in raw source text and returns
// the exact character span of the array literal (including its own
// brackets), by walking the text tracking [ { } ] depth and skipping
// over string-literal contents (so a "]" inside a URL or feedback
// string doesn't get mistaken for the end of the array).
function findConstArraySpan_(source, constName) {
  var marker = "const " + constName + " = [";
  var markerStart = source.indexOf(marker);
  if (markerStart === -1) throw new Error("Could not find \"" + marker + "\" in the file");

  var literalStart = markerStart + marker.length - 1; // index of the "["
  var depth = 0;
  var inString = false;
  var stringChar = "";
  var i = literalStart;

  for (; i < source.length; i++) {
    var ch = source.charAt(i);
    var prevCh = i > 0 ? source.charAt(i - 1) : "";

    if (inString) {
      if (ch === stringChar && prevCh !== "\\") inString = false;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "[" || ch === "{") {
      depth++;
    } else if (ch === "]" || ch === "}") {
      depth--;
      if (depth === 0) { i++; break; } // i now points just past the matching "]"
    }
  }

  if (depth !== 0) throw new Error("Could not find the matching closing bracket for " + constName);
  return { literalStart: literalStart, literalEnd: i };
}

// Reads `const <constName> = [...]`'s current value as a real JS
// array. eval is safe here specifically because this is trusted
// first-party code reading its own repo's data file, not arbitrary
// user/network input.
function readConstArray_(source, constName) {
  var span = findConstArraySpan_(source, constName);
  var literalText = source.slice(span.literalStart, span.literalEnd);
  return eval("(" + literalText + ")");
}

// Replaces `const <constName> = [...]`'s array literal with a
// pretty-printed version of newValue — everything else in the file
// (comments, other consts) is left untouched.
function spliceConstArray_(source, constName, newValue) {
  var span = findConstArraySpan_(source, constName);
  var newLiteral = stringifyStudents_(newValue);
  return source.slice(0, span.literalStart) + newLiteral + source.slice(span.literalEnd);
}

// Used by enrollStudentInCourse — scans `students` (already loaded for
// this same commit) for any existing course entry with this courseId
// and deep-copies its roadmap as the template for a brand-new
// enrollment, resetting every item's status along the way: "Unlocked"
// for Chapter 0 (reference material — never actually "Locked" in real
// data) and Chapter 1 (the standard starting point), "Locked"
// everywhere else. Throws if no student anywhere has this courseId,
// since there's nothing to clone (no COURSE_TEMPLATES yet — see the
// NOT YET IMPLEMENTED note near the top of js/data.js).
function cloneRoadmapTemplate_(students, courseId) {
  var found = null;
  students.some(function (s) {
    var course = (s.courses || []).find(function (c) { return c.id === courseId; });
    if (course) { found = course; return true; }
    return false;
  });
  if (!found) throw new Error("No existing student has courseId \"" + courseId + "\" — nothing to clone a roadmap from");

  var roadmap = found.roadmap.map(function (item) {
    var copy = {};
    Object.keys(item).forEach(function (k) { copy[k] = item[k]; });
    copy.status = (item.chapter === "Chapter 0" || item.chapter === "Chapter 1") ? "Unlocked" : "Locked";
    return copy;
  });
  return { name: found.name, icon: found.icon, roadmap: roadmap };
}

// Same output as JSON.stringify(value, null, 2) EXCEPT roadmap items
// (an array under a "roadmap" key) print as one compact line each,
// matching how they were originally hand-authored/zenith-cli-
// formatted, instead of one line per field. Plain JSON.stringify(...,
// null, 2) — used here before 2026-08-05 — expands every object the
// same way, so a single roadmap status change reformatted that item
// across 5 lines and made the diff look like the whole item was
// replaced rather than one field flipped. Every other array/object in
// STUDENTS (courses, feedback, cheatSheet, metrics, ...) is untouched
// by this — only the "roadmap" key gets the compact treatment.
function stringifyStudents_(value) {
  return stringifyValue_(value, "", null);
}

function stringifyValue_(value, indent, keyName) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);

  var childIndent = indent + "  ";

  if (Array.isArray(value)) {
    if (value.length === 0) return "[]";
    var items;
    if (keyName === "roadmap") {
      items = value.map(function (item) { return childIndent + compactObjectString_(item); });
    } else {
      items = value.map(function (item) { return childIndent + stringifyValue_(item, childIndent, null); });
    }
    return "[\n" + items.join(",\n") + "\n" + indent + "]";
  }

  var keys = Object.keys(value);
  if (keys.length === 0) return "{}";
  var props = keys.map(function (k) {
    return childIndent + JSON.stringify(k) + ": " + stringifyValue_(value[k], childIndent, k);
  });
  return "{\n" + props.join(",\n") + "\n" + indent + "}";
}

// One roadmap item as `{ "name": "...", "category": "...", ... }` —
// spaced like a hand-written object literal (space after "{", after
// every ":" and ",", before "}"), matching the original convention,
// rather than JSON.stringify's compact-but-cramped `{"name":"..."}}`.
function compactObjectString_(obj) {
  var keys = Object.keys(obj);
  var parts = keys.map(function (k) { return JSON.stringify(k) + ": " + JSON.stringify(obj[k]); });
  return "{ " + parts.join(", ") + " }";
}

// ---------------------------------------------------------------
// GitHub Contents API read/mutate/write, same GET -> mutate -> PUT
// (+409 retry) pattern as commitNewEntry_ in submissions-compiler.gs —
// one variant for js/data.js (splice-based, since it's not JSON), one
// generic one (commitJsonArrayMutation_) for any plain-JSON array file
// (the submissions log and the requests log both qualify). All three
// now take a LIST of ops (`ops`, each `{action, payload}`) rather than
// one — every op in the list is applied to the same single read before
// one write, which is what makes "5 roadmap changes = 1 commit"
// possible. A single-action request from doPost is just a 1-element
// list, so there's no separate "non-batch" code path to keep in sync.
//
// On a 409 retry, the whole function re-runs from a fresh GET and
// reapplies every op in `ops` again from scratch — safe and correct
// (not double-applied) because the previous attempt's PUT was
// rejected, so nothing from it was actually written.
// ---------------------------------------------------------------

// Builds a readable commit message: unchanged single-op format when
// there's only one, a summary listing every action name when there's
// more than one.
function commitMessageForOps_(ops) {
  if (ops.length === 1) {
    var op = ops[0], payload = op.payload;
    // submitRequest can come from a student/parent, not just a
    // teacher, so it gets its own prefix instead of the misleading
    // "Teacher dashboard: submitRequest for <username>".
    var prefix = op.action === "submitRequest" ? "Request submitted" : "Teacher dashboard: " + op.action;
    return prefix +
      (payload.username ? " for " + payload.username + (payload.courseId ? " / " + payload.courseId : "") : "") +
      (payload.id ? " (" + payload.id + ")" : "");
  }
  return "Teacher dashboard: " + ops.length + " changes (" +
    ops.map(function (op) { return op.action; }).join(", ") + ")";
}

function commitStudentsMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var students = readConstArray_(source, "STUDENTS");
  ops.forEach(function (op) { ACTIONS[op.action].handler(students, op.payload); }); // mutates `students` in place; throws on invalid payload
  var newSource = spliceConstArray_(source, "STUDENTS", students);
  var newContent = Utilities.base64Encode(newSource, Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitStudentsMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

// Same read/mutate/splice/write/retry shape as commitStudentsMutation_
// just above, parameterized to the TEACHERS const instead of STUDENTS
// — kept as its own near-duplicate function rather than a shared
// helper taking a constName, since this whole file already documents
// itself as "untested against a real deployment" (see the header) and
// duplicating a ~25-line function is a much smaller risk than
// reshaping the one code path (createStudentAccount via
// commitStudentsMutation_) that's closest to having run for real.
// `path` is the same js/data.js as commitStudentsMutation_ — if a
// batch contains both a createStudentAccount and a
// createTeacherAccount, doPost commits STUDENTS first (fresh sha),
// then this function does its own fresh GET (picking up that first
// commit's new sha) before writing TEACHERS — two commits to the same
// file, not a conflict.
function commitTeachersMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var teachers = readConstArray_(source, "TEACHERS");
  ops.forEach(function (op) { ACTIONS[op.action].handler(teachers, op.payload); }); // mutates `teachers` in place; throws on invalid payload
  var newSource = spliceConstArray_(source, "TEACHERS", teachers);
  var newContent = Utilities.base64Encode(newSource, Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitTeachersMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

// Same read/mutate/splice/write/retry shape as commitTeachersMutation_
// just above, parameterized to the CLASSES const instead — same
// near-duplicate-over-shared-helper reasoning as that function's own
// comment. `path` is the same js/data.js as commitStudentsMutation_; an
// approveClassRegistration batch always pairs with enrollStudentInCourse,
// so doPost commits STUDENTS first (fresh sha), then this function does
// its own fresh GET (picking up that commit's new sha) before writing
// CLASSES — two commits to the same file, not a conflict.
function commitClassesMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var source = Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString();

  var classes = readConstArray_(source, "CLASSES");
  ops.forEach(function (op) { ACTIONS[op.action].handler(classes, op.payload); }); // mutates `classes` in place; throws on invalid payload
  var newSource = spliceConstArray_(source, "CLASSES", classes);
  var newContent = Utilities.base64Encode(newSource, Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitClassesMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

function commitJsonArrayMutation_(owner, repo, branch, path, token, ops, attempt) {
  attempt = attempt || 1;
  var apiUrl = "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path + "?ref=" + branch;
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };

  var getResp = UrlFetchApp.fetch(apiUrl, { headers: headers, muteHttpExceptions: true });
  if (getResp.getResponseCode() !== 200) {
    throw new Error("Could not read " + path + " on branch " + branch + " (HTTP " + getResp.getResponseCode() + "): " + getResp.getContentText());
  }
  var file = JSON.parse(getResp.getContentText());
  var log = JSON.parse(Utilities.newBlob(Utilities.base64Decode(file.content)).getDataAsString());

  ops.forEach(function (op) { ACTIONS[op.action].handler(log, op.payload); }); // mutates `log` in place; throws on invalid payload
  var newContent = Utilities.base64Encode(JSON.stringify(log, null, 2), Utilities.Charset.UTF_8);

  var putResp = commitFile_(owner, repo, branch, path, token, newContent, file.sha, commitMessageForOps_(ops));

  if (putResp.getResponseCode() === 409 && attempt < 3) {
    Utilities.sleep(500 * attempt);
    commitJsonArrayMutation_(owner, repo, branch, path, token, ops, attempt + 1);
    return;
  }
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not write " + path + " (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
}

function commitFile_(owner, repo, branch, path, token, base64Content, sha, message) {
  var headers = { Authorization: "token " + token, Accept: "application/vnd.github+json" };
  return UrlFetchApp.fetch(
    "https://api.github.com/repos/" + owner + "/" + repo + "/contents/" + path,
    {
      method: "put",
      headers: headers,
      contentType: "application/json",
      muteHttpExceptions: true,
      payload: JSON.stringify({
        message: message,
        content: base64Content,
        sha: sha,
        branch: branch
      })
    }
  );
}

// Uploads one submitWork/submitRequest photo straight into this repo,
// reusing commitFile_ (the exact same GitHub Contents API write path
// every other action here already uses) rather than adding a second
// storage system like Google Drive — Drive would need this deployment
// to request a new OAuth scope it doesn't have yet, where GitHub needs
// nothing beyond the GITHUB_TOKEN this script already has. `photo` is
// { dataBase64, mimeType, filename } from readImageAsCompressedBase64_
// in js/app.js (already downsized client-side). `sha` is omitted (not
// just null — omitted, since commitFile_'s JSON.stringify drops an
// `undefined` property entirely) because this always creates a brand
// new file at a fresh, timestamp+random path, never overwrites one —
// so there's no existing blob sha to provide, and none is required by
// GitHub's API for a create. Returns the photo's raw.githubusercontent.com
// URL, which serves directly from the git blob on `branch` — no GitHub
// Pages rebuild to wait on, unlike a githubpages.io URL would need.
function commitUploadedPhoto_(owner, repo, branch, token, photo) {
  if (!photo || !photo.dataBase64) throw new Error("Missing photo data");
  var mimeType = photo.mimeType || "image/jpeg";
  var ext = PHOTO_EXTENSIONS_[mimeType] || "jpg";
  if (photo.dataBase64.length > MAX_PHOTO_BASE64_LENGTH_) {
    throw new Error("Photo is too large (max " + MAX_PHOTO_MB_ + "MB) — try a smaller photo.");
  }
  var path = "data/uploads/" + new Date().getTime() + "_" + Math.random().toString(36).slice(2, 8) + "." + ext;
  var putResp = commitFile_(owner, repo, branch, path, token, photo.dataBase64, undefined, "Upload photo: " + path);
  if (putResp.getResponseCode() >= 300) {
    throw new Error("Could not upload photo (HTTP " + putResp.getResponseCode() + "): " + putResp.getContentText());
  }
  return "https://raw.githubusercontent.com/" + owner + "/" + repo + "/" + branch + "/" + path;
}

var PHOTO_EXTENSIONS_ = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
// ~8MB decoded (base64 runs about 4/3 the size of the raw bytes) —
// comfortably under Apps Script's request-size ceiling, and plenty for
// a phone photo once readImageAsCompressedBase64_'s client-side resize
// has already run.
var MAX_PHOTO_MB_ = 8;
var MAX_PHOTO_BASE64_LENGTH_ = MAX_PHOTO_MB_ * 1024 * 1024 * 4 / 3;
