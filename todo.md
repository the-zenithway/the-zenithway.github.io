## 1. Priority Stuff
- [ ] Philosophy, About us page
- [ ] Blogs(1+)
- [ ] Manual(pdf) + Video on yt 
- [ ] Social Media posts
- [ ] Get People 
- [ ] Get teachers
- [ ] Zenith Local, Club, Proposal, Presentation

## 2. Maintenance & Improvement 
- [ ] view for the teachers too like what to do exactly is shown 
- [ ] improve submission process(e.g. autoparsing, auto grading)
- [ ] formalized IRL sessions 
- [ ] metric formalization, also but fix for some metrics not being edited 
- [ ] registering to classes via the website at signup/after approval — classes intertwined to students and teachers and notifications and submissions and teacher portal based on that (accounts themselves now come through signup.html + admin approval, see Done below — this is just the remaining "which course(s)" half, deliberately skipped for now)
- [ ] course templates for the above sign up too, like if there is a new format for the course easier universal change 
- [ ] photo attachments still aren't supported on submit.html's intra-site form (every text-based unit — B/C/S/R/T/N/L — is done, see Done below) — a submission that needs a photo of written work still has to go through the external Google Form
- [ ] daily/weekly digest, notifications for encouragement 
- [x] admin dashboard can assign classes, approvals for class registration, make new classes assign teachers and so on (signup approval itself is done, see Done below — this is the remaining class-assignment half) — done, see Done below
- [ ] admin dashboard can clear requests and concersna and all that similar to submissions like the teacher dashboard 
- [ ] Sessions log and upload pictures documentation those kinda stuff, maybe create a schedule session thing, session log and all that 
- [ ] server-level website announcements (a public, no-login banner) — teacher/class announcements and admin-to-teacher announcements are done, see Done below; this is just the remaining public-facing half, deliberately not built this pass
- [ ] fix unnecessarily long data.js 

- [ ] add the new physics resources 
- [ ] AP Physics self study track
- [ ] fix biology and chemistry course 
- [ ] Refine biology view 
- [ ] physics view 
- [ ] update readme 
- [ ] mobile optimization for the new features 
- [ ] Update FAQ
- [ ] Question database and like searching, asking questions, hints, etc.
- [x] handle copyright issues resources page 
- [ ] secure login

## 3. Improvement Brainstorm(Ideas)
- [ ] Philosophies 
  - [ ] 1. Absolute Clarity
  - [ ] 2. Inner Excellence 
    - [ ] Daily motivation & Inner excellence quotes
    - [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
    - [ ] Regular IRL Sessions -> 발상노트 점검 + go through one whole chapter and check understanding + test/mock
    - [ ] make aspects of the program as encouraging as possible 
    - [ ] Every day motivational article + regular check-ins
  - [ ] 3. Genuine Mentorship — Kalyāṇamitra
    - [ ] We're truly serious about this. Not top-down teacher-student, but a guide/companion (kalyāṇamitra) relationship — we see versions of ourselves in our students' growth, and want them to become people who pass that same devotion on to others, not just to guarantee a 5.
- [ ] Blog 
  - [ ] Study-technique deep dives
  - [ ] Subject-specific pitfall posts (e.g. IVT vs MVT vs Rolle's, straight from real cheat sheet entries)
  - [ ] Student spotlight / progress stories
  - [ ] watch the velocity, not the displacement 
  - [ ] inner excellence 
  - [ ] the zenith story 
  - [ ] what if students missed wasnt studies but true compass in life? 
  - [ ] genuine mentorship 
  - [ ] teach inner excellence like we teach math 

## Done
- [x] Admin dashboard's request cards are now status-editable too (New/In Progress/Completed), not just teacher.html's "Needs to review" queue — reuses the same updateRequestStatus action as-is (it was never scoped to Ask My Teacher specifically), so Feature/Resource/Bug/Concern requests all get the same status <select> + Update button.
- [x] Replaced calendar.html's Google Calendar embed with a native, role-aware in-site calendar. A month grid (student/teacher/parent/admin all see events scoped to them — a student/parent sees only events they/their linked student are an explicit participant in, a teacher sees anything they created or their classes are scoped to, admin sees everything) where clicking an event shows who's participating. Teachers and admins can create an event, picking participants via the same class-shortcut + hand-pick checklist UX the scheduled-notification form already uses, with an optional "also notify" sub-form that reuses the scheduleNotification action itself (linked back via eventId) in the same applyBatch request. New `createEvent`/`cancelEvent` actions in zenith-data-writer.gs write to a new data/calendar-events.json — needs the usual manual redeploy of automation/zenith-data-writer.gs to the live Apps Script project before either actually writes anything.
- [x] admin.html Blog tab — a markdown post editor (title/slug/author/date/tags/excerpt/content) with a live preview that converts Markdown to HTML as you type (marked.js), plus a post list with Edit/Delete. New `publishBlogPost`/`updateBlogPost`/`deleteBlogPost` actions in zenith-data-writer.gs write to a new data/blog-posts.json (slug enforced unique on publish, immutable on edit). blog.html/blog-post.html now merge that live JSON list with the existing hand-authored BLOG_POSTS array (js/blog-data.js), newest JSON posts first; blog-post.html renders contentMd through the same marked.js call the admin preview uses. Needs the usual manual redeploy of automation/zenith-data-writer.gs to the live Apps Script project before Publish actually writes anything — verified locally that the client posts the right payload and fails gracefully against the not-yet-redeployed live endpoint.
- [x] Announcements: teachers can post to their own class (visible to that class's students, with an unread badge) from a new "Announce to your class" section on teacher.html; admins can post to every teacher from a new "Announcements" tab on admin.html, which teachers see in a "From Admin" feed (also badged) on teacher.html. New `postAnnouncement`/`deleteAnnouncement` actions in zenith-data-writer.gs write to data/announcements.json (soft-delete only, same Active/Deleted shape as scheduleNotification's Pending/Cancelled — no edit). In-app only, deliberately no email this pass. The public, no-login site-wide banner half of the old combined todo line is still open, see above.
- [x] Systematized email notifications across every write action in zenith-data-writer.gs, not just the ones that already had one. New: a new submission emails the assigned teacher(s), a graded submission emails the student, a new signup emails every admin, a declined signup emails the applicant, a new request emails every admin UNLESS it's "Ask My Teacher" (which emails the assigned teacher(s) instead), and a request status change emails the original submitter. All follow the same pattern the existing confirmation emails already used — sent from doPost after the commit succeeds, best-effort (a MailApp failure never fails the write), silently skipped if the address/list is missing. Every recipient list is resolved client-side (STUDENTS/TEACHERS/CLASSES/ADMINS are already loaded via js/data.js on every page that can trigger one of these) and trusted server-side, same model scheduleNotification's recipient list already used — no new js/data.js re-fetch added to the Apps Script. Apps Script deployment still needs a redeploy with the updated code before any of this actually sends — see automation/zenith-data-writer.gs's setup steps.
- [x] submit.html's submission form is now purely intra-site for every text-based unit — B (Book chapter), C (Coursework), S (Solution manual), R (Review), T (Test), N (Notes Submission), L (Learning) — over a fixed Chapter 1-12 / M1-M16 chapter list, no more redirect to the external Google Form for those. New `submitWork` action in zenith-data-writer.gs appends straight to data/submissions-log.json (same entry shape buildEntryFromResponse_ in submissions-compiler.gs already produces, so every existing reader — the log display, teacher grading queue, CLAUDE.md's grading workflow — treats it identically), and validates both chapter and unit server-side against fixed whitelists (SUBMISSION_CHAPTERS_/SUBMISSION_UNITS_) matching submit.html's dropdowns exactly. A submission that needs a photo attached still has to go through the Google Form — see the open todo line above.
- [x] Took down calc-bc/bio/chem/CS A self-study tracks (were serving Barron's book chapters via public Drive links, no login) — replaced with "temporarily unavailable" notice
- [x] Swapped all 11 Barron's book links on resources page from personal Drive copies to Amazon search links
- [x] Swapped remaining resources-page book links (Erica Meltzer Reading/Grammar, Blue Book of Grammar, Word Smart I & II) from Drive copies to Amazon search links
- [x] New Catalog tab in the student portal (catalog.html) — every class in CLASSES, one card per class, showing its subject (looked up by courseId) and assigned teacher(s), plus a per-student registration badge (Enrolled/Pending approval/Registration locked — see the Classes entry below for how those states get set).
- [x] Admin-managed classes: a new "Classes" tab on admin.html lets an admin create a class (name, subject, teacher(s), and a candidate/"pending" student roster) — it shows up in the catalog immediately. A separate "Pending registrations" list lets the admin Approve or Decline each candidate individually; approving is a 2-op batch (`enrollStudentInCourse` + `approveClassRegistration`) that both marks them a confirmed class member and appends a real course entry onto their STUDENTS record — roadmap cloned from whichever other student already has that courseId (no COURSE_TEMPLATES yet), with Chapter 0/Chapter 1 set "Unlocked" and everything else "Locked", the same shape every hand-enrolled student already has. New `createClass`/`approveClassRegistration`/`declineClassRegistration`/`enrollStudentInCourse` actions in zenith-data-writer.gs, all committing straight to js/data.js's CLASSES/STUDENTS consts via the same GitHub-commit mechanism createStudentAccount already uses. Only works for a subject at least one student is already enrolled in (all 4 current subjects qualify) — a genuinely new subject with zero students still has no roadmap to clone, same deferred COURSE_TEMPLATES limitation noted elsewhere in js/data.js. Needs the usual manual redeploy of automation/zenith-data-writer.gs to the live Apps Script project before Create/Approve/Decline actually write anything.
