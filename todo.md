## 1. Priority Stuff
- [ ] Philosophy, About us page
- [ ] Blogs(1+)
- [ ] Manual(pdf) + Video on yt 
- [ ] Social Media posts
- [ ] Get People 
- [ ] Get teachers
- [ ] Zenith Local, Club, Proposal, Presentation

## 2. Maintenance & Improvement 
- [ ] Teacher/admin dashboard view of submitted requests (data/requests-log.json) — triage queue, status updates (New/In Progress/Done/Declined), admin dashboard doesn't exist yet either
- [ ] view for the teachers too like what to do exactly is shown 
- [ ] notification checking for teachers as well, and thinking of teacher student workflow completely
- [ ] improve submission process(e.g. autoparsing, auto grading)
- [ ] formalized IRL sessions 
- [ ] metric formalization, also but fix for some metrics not being edited 
- [ ] registering to classes via the website at signup/after approval — classes intertwined to students and teachers and notifications and submissions and teacher portal based on that (accounts themselves now come through signup.html + admin approval, see Done below — this is just the remaining "which course(s)" half, deliberately skipped for now)
- [ ] course templates for the above sign up too, like if there is a new format for the course easier universal change 
- [ ] submission doesn't use google form, purely intra-site 
- [ ] request access for units(e.g. please unlock x) 
- [ ] IRL session log and like calendar view is improved, mayhbe a better view(wseek view) 
- [ ] Formalied documentations 
- [ ] teachers can send scheduled messages and set irl sessions via portal 
- [ ] daily/weekly digest, notifications for encouragement 
- [ ] cross checking features across, e.g. feedback for teachers as well and what they see in their dashbaord 
- [ ] admin dashboard can assign classes, approvals for class registration, make new classes assign teachers and so on (signup approval itself is done, see Done below — this is the remaining class-assignment half)
- [ ] admin dashboard can clear requests and concersna and all that similar to submissions like the teacher dashboard 

- [ ] add the new physics resources 
- [ ] AP Physics self study track
- [ ] fix biology and chemistry course 
- [ ] Refine biology view 
- [ ] physics view 
- [ ] update readme 
- [ ] mobile optimization for the new features 
- [ ] Update FAQ
- [ ] improve parent portal 
- [ ] Question database and like searching, asking questions, hints, etc.
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
- [x] "Ask My Teacher" request category — students can ask their own teacher a direct question from requests.html (picks which enrolled course it's about, so CLASSES can resolve the right teacher); shows up in a new "Needs to review" queue on teacher.html (between Needs grading and Schedule a notification), where a teacher moves it New → In Progress → Completed via a real status <select> + Update button — a Completed one drops off that queue but stays visible, with its status, on the student's own requests.html history and on that student's teacher-student.html page (new "Requests to you" section, read-only there — status only changes from the queue). Backed by a new updateRequestStatus action in zenith-data-writer.gs; also fixed REQUEST_ROLES_ there, which never included "admin" and would have rejected an admin's own request submission. Also redid the "Schedule a notification" recipient checklist's CSS — bigger rows, hover state, accent checkboxes, class tags as right-aligned pills (hidden entirely for a single-class teacher), live "N selected" counter — the previous version was cramped and hard to scan.
- [x] Student/teacher signup + admin approval — new signup.html (role, name, username, email, password, confirm; password is SHA-256-hashed in the browser via Web Crypto before it ever leaves the page, so it's never stored or transmitted as plaintext, not even in the public data/signup-requests.json log) posts a new `submitSignup` action to zenith-data-writer.gs, landing as a "Pending" row. Admin.html got a second tab, "Sign-ups" (alongside the existing Requests tab), listing every signup filterable by status/role, with per-row Approve/Decline plus checkbox-driven bulk actions ("Approve selected"/"Decline selected") — approving sends one applyBatch request per click that both flips the signup to Approved and appends a brand-new STUDENTS or TEACHERS entry (createStudentAccount/createTeacherAccount — account creation is ordered to run first server-side, so a failed creation never leaves a signup marked Approved with no real account behind it). New accounts carry no enrolled courses yet — course/class registration during signup is deliberately deferred, see the open todo lines above. login() now checks a `passwordHash` field (hashing the attempt and comparing) when present, falling back to the legacy plaintext `password` field for every pre-existing account — both shapes coexist. Two emails: one the moment a signup is submitted (mentions the 15-minutes-to-1-day review window) and one the moment it's approved. Apps Script deployment still needs the new SIGNUPS_PATH script property and a redeploy with the updated code before real signups land — see automation/zenith-data-writer.gs's setup steps.
- [x] Removed unused Roadmap tab/page from Teacher Dashboard (team-roadmap.html)
