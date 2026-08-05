# Zenith TODO

## 1. Absolute Clarity
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Live-editable teacher dashboard — write path (unlock units, post feedback/cheat sheet, mark submissions Complete) straight from teacher.html instead of hand-editing js/data.js; needs a serverless write endpoint (e.g. GitHub Actions workflow-dispatch or Apps Script committing to main, same pattern as the submission compiler)
- [ ] Workflow(Basically zenith CLI)
  - [ ] Course Unlock + Now + Update(includes percentage, chapter status update) 
  - [ ] Submission + submission log update + systematic grading
  - [ ] Feedback + cheat sheet
  - [ ] way to create scheduled messaged for students especially when theres an event 
- [ ] AI autopilot 
- [ ] Fully automating above workflow
- [ ] instructions for the submission process, e.g. the template 
- [ ] now page update
- [ ] Question database and like searching, asking questions, hints, etc.
- [ ] Metric and stats for students, viewable to teachers 

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

## 5. Get People 

## 6. Intra-school Relation
- [ ] Make presentation
- [ ] Formal proposal document
- [ ] Zenith Local

## Done
- [x] Teacher-only per-student metrics section on teacher-student.html (topic mastery, C/T chapter scores, motivation-over-time, mock scores, AP final score) — new `course.metrics` draft shape in js/data.js, placeholder data on one course only, nothing wired into the real teacher database yet
- [x] teacher-overview.html — new portal page, comprehensive table of every student × enrolled course in one place (progress, mastery, C/T score, motivation, mock avg, AP final, latest feedback), subject filter, click-through to teacher-student.html; linked from teacher.html
- [x] Teacher/All Students tabs in the portal header nav (js/layout.js `nav: "teacher"`) — replaces the old single "Teacher Dashboard" label
- [x] Time-to-completion-per-chapter stat added to course.metrics (days from chapter unlock to Complete) — shown on teacher-student.html and as an "Avg pace" column on teacher-overview.html
- [x] teacher-overview.html table widened/tightened so all columns fit without side-scrolling on a normal desktop width; dropped the "Latest feedback" column (not useful)
- [x] Submissions on teacher-student.html collapsed to a click-to-expand box (native details/summary) instead of showing OCR text/thumbnails inline for every entry — student's own submit.html view unchanged
