# Zenith TODO

## 1. Absolute Clarity
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Onboarding from the dashboard — add a new student account, or enroll an existing student in a new course, without hand-editing js/data.js. Needs the COURSE_TEMPLATES concept sketched in js/data.js's comments (not built yet) so a new enrollment can clone a clean roadmap instead of copying + stripping another student's progress by hand. New-course/new-subject scaffolding (a brand new template key) is the same next step, content-authoring aside.
- [ ] Workflow(Basically zenith CLI)
  - [ ] Course Unlock + Now + Update
  - [ ] Submission + submission log update + systematic grading
  - [ ] Feedback + cheat sheet
  - [ ] way to create scheduled messaged for students especially when theres an event 
- [ ] AI autopilot 
- [ ] Fully automating above workflow
- [ ] instructions for the submission process, e.g. the template 
- [ ] Question database and like searching, asking questions, hints, etc.
- [ ] Metric and stats for students, viewable to teachers 
- [ ] mobile optimization for the new features 
- [ ] function to delete entry 
- [ ] fix teacher dashboard course view with the new editing feature 
- [ ] deleting entries 
- [ ] alert teachers for new submissions, a nice view for the teachers too like what to do exactly is shown 
- [ ] autochecking 
- [ ] notification checking for teachers as well, and thinking of teacher student workflow completely
- [ ] the entire cycle would start from submit -> then teachers also notified, see the remarks, and update and repeat 
- [ ] two bugs for teacher database, if u click portal first it doesnt work + automatically logs out unlike student
- [ ] fix issue where the new database is too long 

## 2. Inner Excellence 
- [ ] Brainstorm more ways to force/encourage real effort (open-ended)
- [ ] **Make HOW TO STUDY absolutely clear — top priority for this pillar (VERY IMPORTANT)**. Not just what's due, but the actual technique/method of studying well *(also: Active Engagement & Motivation)*
- [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
- [ ] Motivational articles in blog 
- [ ] think seriously about what's the meaning beyond the furriculum and score - inner excellence
- [ ] make the feedback process as encouraging as possible think a lot on thise this is very important 
- [ ] Regular IRL Sessions -> 발상노트 점검 + go through one whoel chapter and check understanding + test/mock
- [ ] Every day motivational article + regular check-ins
- [ ] mobile optimization for the new features 

## 3. Community
- [ ] Community events, competitions, rewards, etc.
- [ ] Teach-back slots during weekly IRL/Zoom session — student who nailed a topic runs a 5-10 min mini-explainer for others
- [ ] Small study squads (3-4 students) per subject/chapter — more resilient than 1:1 pairing when one partner goes inactive, yeah maybe grind together 
- [ ] Alumni-as-mentors — loop former students into Discord/AMAs once the alumni/results page exists
- [ ] Go to trips together, listen to their concerns and yeah having fun together 

## 4. Admin
- [ ] Create discord community 
- [ ] AP Physics self study track
- [ ] Make zenith blog - articles that showcase our thoughts and etc.
  - [ ] Study-technique deep dives
  - [ ] Subject-specific pitfall posts (e.g. IVT vs MVT vs Rolle's, straight from real cheat sheet entries)
  - [ ] Student spotlight / progress stories
- [ ] Maybe about us page that showcases the people involved in this
- [ ] For the first timers, we need a comprehensive introduction - maybe a video, article, etc. i.e. a manual
- [ ] insta posts and etc in social media 
- [ ] alumni/results page showing outcomes 
- [ ] create a timeline of features 
- [ ] biology, chemistry view for couse  and other subjects too 
- [ ] video making
- [ ] fix biology and chemistry course 
- [ ] maybe make it such that everytime the email is sent to students, it's also all sent to my own account 

## 5. Get People 

## 6. Intra-school Relation
- [ ] Make presentation
- [ ] Formal proposal document
- [ ] Zenith Local

## Done
- [x] AP Biology roadmap — removed stray submit.html links from N-Notes Submission rows and C-coursework rows' submissionUrl field (data-only, matches Chemistry/Calculus pattern)
- [x] Teacher dashboard regular-workflow write actions — automation/zenith-data-writer.gs (new Apps Script Web App, not deployed yet) plus teacher-student.html controls to unlock/change a roadmap item's status, add feedback, add a cheat sheet entry, update Right Now, and log a metrics data point (or set AP predicted/final score) — all backed by TEACHER_DATA_WRITE_URL in js/data.js
- [x] submissionCourseId() exact-id-first match — tries entry.answers.course against a real course.id before falling back to name-matching, so switching the intake Form's "Course" dropdown to emit slugs (e.g. "ap-chemistry") will resolve correctly with no further code changes
- [x] Updated automation/submissions-compiler.gs for the Form's Course dropdown now emitting slug ids (ap-calculus-bc, ap-chemistry, etc.) instead of display names — removed the COURSE_IDS lookup table entirely (courseId is now a direct pass-through), updated automation/README.md's docs to match. Still needs pasting into the live Form-bound Apps Script editor to take effect (reference copy only, same as always).
- [x] Merged submission-status-updater.gs into zenith-data-writer.gs — one standalone Web App now backs every teacher-dashboard write action (mark submission Complete, plus everything on teacher-student.html), down from two. Deleted the old script; js/data.js now has a single TEACHER_DATA_WRITE_URL instead of two separate URL consts. Only two Apps Script deployments needed going forward: this one, and the Form-bound submissions-compiler.gs (which has to stay separate — Google requires Form-triggered scripts to live in that Form's own container-bound project).
- [x] Batch multiple teacher-student.html changes into one commit — stage a roadmap unlock, feedback, cheat sheet entry, Right Now update, and/or a metrics entry (any mix, across categories) and hit "Apply" once instead of saving each individually. New sticky pending-changes panel (queue/remove/discard-all) on teacher-student.html; automation/zenith-data-writer.gs's doPost now dispatches a list of operations instead of one, so a batch that only touches js/data.js lands as exactly one commit. Not deployed yet, same as the rest of zenith-data-writer.gs.
- [x] Fixed teacher-student.html's roadmap table getting cut off on the right (Actions column pushed off-screen on non-ultra-wide windows) — root cause was `.roadmap-table`'s shared `max-width: 900px` combined with `table-layout: fixed`, which meant shrinking the Actions/Category/Status columns didn't shrink the table at all (the Name column just absorbed the freed space). Gave the teacher variant its own `.teacher-roadmap-table { max-width: 780px }` and stacked the per-row status select + Set button vertically instead of side-by-side. Verified it now fits with no horizontal cutoff down to a 900px-wide window.
- [x] Fixed invisible typed-answer submissions — submissionLogItemHtml (submit.html) and teacherSubmissionCardHtml (teacher-student.html) only ever showed an uploaded photo or its OCR text; a submission with neither (typed multiple-choice letters into the Form's text-answer question instead of uploading a photo) displayed nothing, and the teacher view even said "No photos or OCR text on this submission" despite a real answer being on file. New submissionTextAnswer() finds that typed text (any non-metadata string answer) and both views now render it. Fixes this retroactively for existing log entries too, not just new ones.
- [x] Made every submission card's pieces (photos, OCR text, submitted answer, remark) independently foldable, on all three pages that render one — submit.html, teacher.html's grading queue, and teacher-student.html's submissions list. New shared submissionFoldHtml()/submissionFoldSectionsHtml() in js/app.js, reused by submissionLogItemHtml/teacherQueueItemHtml/teacherSubmissionCardHtml so all three stay in sync instead of duplicating the logic three times; teacher-student.html now nests these folds inside its existing per-submission <details> card. Removed now-dead .teacher-queue-remark/.teacher-queue-ocr CSS.
- [x] Uploaded photos now made public-viewable automatically — automation/submissions-compiler.gs's makeFilePublic_ sets "anyone with the link can view" on every new file upload (the file's id is already public via data/submissions-log.json, so this doesn't add exposure, it just makes the already-public link's thumbnail actually load instead of showing broken). Added backfillFileSharing_ as a one-time manual run (Apps Script editor, pick from function dropdown) to fix sharing on photos uploaded before this existed.
- [x] zenith-data-writer.gs now writes roadmap items compactly (one line each, e.g. `{ "name": ..., "status": ... }`) instead of JSON.stringify's default one-field-per-line — a single status change used to reformat that whole item across 5 lines and read like the item was replaced rather than one field flipped. New stringifyStudents_/compactObjectString_ match plain JSON.stringify(...,null,2) everywhere except roadmap arrays. Verified against real js/data.js: round-trips losslessly, and a steady-state write now diffs exactly one line for one field change. First write after deploying this still reformats every roadmap item once (one-time cost, file was already fully expanded from earlier writes) — every write after that stays compact.
