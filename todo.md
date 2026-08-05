# Zenith TODO

## 1. Absolute Clarity
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Onboarding from the dashboard — add a new student account, or enroll an existing student in a new course, without hand-editing js/data.js. Needs the COURSE_TEMPLATES concept sketched in js/data.js's comments (not built yet) so a new enrollment can clone a clean roadmap instead of copying + stripping another student's progress by hand. New-course/new-subject scaffolding (a brand new template key) is the same next step, content-authoring aside.
- [ ] Workflow(Basically zenith CLI)
  - [ ] Course Unlock + Now + Update(includes percentage, chapter status update) 
  - [ ] Submission + submission log update + systematic grading
  - [ ] Feedback + cheat sheet
  - [ ] way to create scheduled messaged for students especially when theres an event 
- [ ] AI autopilot 
- [ ] Fully automating above workflow
- [ ] instructions for the submission process, e.g. the template 
- [ ] Question database and like searching, asking questions, hints, etc.
- [ ] Metric and stats for students, viewable to teachers 
- [ ] mobile optimization for the new features 

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
- [ ] updated script for the forms 
- [ ] maybe make it such that everytime the email is sent to students, it's also all sent to my own account 

## 5. Get People 

## 6. Intra-school Relation
- [ ] Make presentation
- [ ] Formal proposal document
- [ ] Zenith Local

## Done
- [x] AP Biology roadmap — removed stray submit.html links from N-Notes Submission rows (data-only, matches Chemistry/Calculus pattern)
- [x] Teacher dashboard regular-workflow write actions — automation/zenith-data-writer.gs (new Apps Script Web App, not deployed yet) plus teacher-student.html controls to unlock/change a roadmap item's status, add feedback, add a cheat sheet entry, update Right Now, and log a metrics data point (or set AP predicted/final score) — all backed by TEACHER_DATA_WRITE_URL in js/data.js
- [x] submissionCourseId() exact-id-first match — tries entry.answers.course against a real course.id before falling back to name-matching, so switching the intake Form's "Course" dropdown to emit slugs (e.g. "ap-chemistry") will resolve correctly with no further code changes
