# Zenith TODO

## 1. System — Absolute Clarity

- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.)
- [ ] Instagram notifications / Instagram bot / AI
- [ ] Roadmap nice css design each journey view, node view, side scrollable box view
- [ ] use various colors to represent different states encode this well int he roadmap and feedback and now
- [ ] Clear up the process for every user - what we have to exactly do, what the teachers have to exactly do, what the students have to exactly do and so on. also the logic, how the teachers work and so on 
- [ ] Systematic way to work on form submission parsing + feedback + cheat sheet(maybe AI agent)
- [ ] Figure out algorithm and AI agent whatever to make the corresponding T sections for each of the chapters 
- [ ] Progress percentage per course — roll up roadmap items into a "62% complete" number on the course app tile in portal.html and at the top of roadmap.html
- [ ] "Next up" breadcrumb on every portal page — persistent strip showing the current Now task, visible outside right-now.html too
- [ ] Search/filter on the roadmap table by chapter/category
- [ ] Collapsible chapters in Table view — collapse each chapter's B/C/S/R/T rows by default, expand on click
- [ ] Sync Table and Curve views — clicking a Table row highlights/scrolls to its Curve gem and vice versa
- [ ] Student-facing changelog / "what's new" feed so returning students notice new unlocks or feedback
- [ ] Cross-course dashboard for multi-enrolled students (Hamin, David) — combined "your week across all courses" view
- [ ] Track the Notion-independence finish line — list remaining subjects (Bio/Chem/Physics/CS A) still on Notion and set a target date
- [ ] Locked-row tooltip explaining exactly why/when it unlocks, instead of just a grey pill
- [ ] Parent view — read-only, course-scoped progress summary for parents
- [ ] Spaced-repetition review queue — auto-resurface Cheat Sheet entries a few weeks after they're written
- [ ] Exam countdown + pacing math on right-now.html — given exam date + current chapter, show "clear ~1 chapter every X days"

## 2. Active Engagement & Motivation
Forcing actual grind and active effort, not just handing over information — direct checking, consistent high-ROI activity, keeping it human.

- [ ] Weekly IRL (or Zoom, if circumstances don't allow) session — roughly once a week, under 90 minutes, purely for running the T tests below. Not a general class/lecture slot.
- [ ] **T (Test) section per chapter** *(also: System — part of the B/C/S/T portal structure)* — AP Calc BC already has this for every chapter; AP Biology is the concrete gap (currently I/L/N/C/S/F only, no T). See [curriculum-template.md](curriculum-template.md).
- [ ] Motivational articles / Zenith blog — our own regular writing and input
- [ ] Make the grind enjoyable — genuine love for learning, not just forcing
- [ ] Brainstorm more ways to force/encourage real effort (open-ended)
- [ ] **Make HOW TO STUDY absolutely clear — top priority for this pillar (VERY IMPORTANT)**. Not just what's due, but the actual technique/method of studying well *(also: Active Engagement & Motivation)*
  - [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
- [ ] think seriously about what's the meaning beyond the furriculum and score - what do they want? what are they ultiamtely aiming for?
- [ ] cross check the tone across the website and program to be as encouraging as possible 
- [ ] make the feedback process as encouraging as possible think a lot on thise this is very important 
- [ ] Post-T reflection prompt — "what tripped you up?" box that feeds Cheat Sheet candidates instead of writing every entry manually
- [ ] Voice-of-student testimonials on right-now.html or philosophy page

## 3. Advice & Direction — Community
Regular, direct guidance instead of one-off help — AI integration, dynamic plans, chats with us, and a community around it.

- [ ] AI chat integration — students chat with a Zenith-specialized AI (site stays static on GitHub Pages; needs a small serverless function elsewhere to hold the API key and call the model — see conversation)
- [ ] Ways to make the community active, engaged, and no confict and encouarge helpfulness. what would trigger them to be genuinely helpful others 
and do things for the greater good?
- [ ] Community events, competitions, rewards, etc.
- [ ] idea : for each chapter, highest scorer in the T part within a given period will get like a prize
- [ ] Scope the AI chat to the student's own roadmap + cheat sheet data (not a general chatbot) *(also: System)*
- [ ] Async question box per chapter — lightweight "ask about Chapter 4" thread (could start as a Google Form like submit.html)
- [ ] Peer study pairing — match two students on the same chapter for accountability check-ins
- [ ] Monthly "state of your progress" personal note from a teacher — short direction check-in, not a full feedback entry
- [ ] Alumni/results page showing outcomes (with permission) *(also: Get People)*

## 4. Maintenance - updating existing features
- [ ] make like a buffer, just in case someone is done ahead of time like always do 2 "now" page entries at a time, and they can see it if theyre like done with everything. maybe the can click a button confirm(show extra stuff) and move on conditionally, and teachers remove it 
- [ ] Improve Zenith CLI - there's so much new features so this gotta follow 
  - [ ] new entires in faq 
  - [ ] new entries in blog 
  - [ ] new entries in resources 
  - [ ] roadmap editing 
  - [ ] database student and teacher adding and editing information 
  - [ ] editing the now page 
  - [ ] adding feedback page 
  - [ ] and maybe teacher dashboard in the future 
  - [ ] Improve feedback portion, the markdown and the structure all that 
  - [ ] regular article writing in blog 
- [ ] Add real content back to the resources page's "Getting Help" (office hours, contact us) and "Further Reading" sections — removed for now since they were just placeholder "#" links with no real content
- [ ] aesthetic updates throughout the website
  - [ ] Light/alternate theme option (currently hard-locked dark to match Notion embeds — removable once Notion dependency is fully gone)
  - [ ] Chapter-colored accents carried into the Table view's chapter column background, not just text color
  - [ ] Dedicated empty/first-login state for students with zero courses (Alice, Yong Joon currently just see an empty folder)
  - [ ] Loading/skeleton states for future network calls (AI chat, backend auth)
- [ ] Build out the Teacher Dashboard (currently just "Structure coming soon" in teacher.html)
  - [ ] Attention queue — submissions awaiting review, students with no feedback in 7+ days, students stuck on a Locked item
  - [ ] Bulk roadmap status editor — flip a student's item Locked/Unlocked without hand-editing js/data.js
  - [ ] Cross-student view by chapter — see who's on which chapter to plan the weekly T-test session
  - [ ] Feedback composer form that appends to a student's feedback array in the right shape
  - [ ] Teacher-only internal notes per student (not shown to the student)
- [ ] Move auth off plaintext client-side JS — js/data.js currently ships real usernames/passwords to every visitor's browser; needs a backend or managed auth service
- [ ] Data validation script enforcing the course/roadmap schema so a hand-edit to data.js can't silently produce a broken roadmap
- [ ] Extract shared header/footer markup — every page hand-copies the same header, so one navigation change means editing 15+ files
- [ ] Explicit mobile audit — Table view's 5-column layout and the Curve SVG on small screens
- [ ] Fix known placeholder issues:
  - [ ] href="#" placeholder links still in resources.html (Office Hours, Contact Us, Recommended Reading List)
  - [ ] Duplicated College Board Bluebook URL in resources.html
  - [ ] Unfinished FAQ answers and empty AP resource subsections (Bio/Chem/Physics/CS A)
  - [ ] Placeholder Discord/WhatsApp/KakaoTalk social URLs in js/social-links.js
- [ ] Script to clone/relink a roadmap when enrolling a new student in an existing course, instead of hand-copying ~88 JSON rows each time

## 5. Admin
- [ ] Create discord community 
- [ ] AP Resource Page — fill out the empty subject sections (Bio, Chem, Physics, CS A)
- [ ] AP Bio Notion page
- [ ] AP Chem Notion page
- [ ] AP CS Notion page
- [ ] Automate/systematize the calendar scheduling process
- [ ] Automate notifications (general — deadlines, reminders, beyond Instagram)
- [ ] Add new website pages / resources as needed (ongoing)
- [ ] Make the T chapters for all the calculus 
- [ ] Update the calculus notion to have B-C-S-T-R(T for test, R for review)
- [ ] Upgrade Zenith CLI for easy editing and feedback for added database element
- [ ] Make zenith blog - articles that showcase our thoughts and etc.
  - [ ] Study-technique deep dives
  - [ ] Subject-specific pitfall posts (e.g. IVT vs MVT vs Rolle's, straight from real cheat sheet entries)
  - [ ] Student spotlight / progress stories
- [ ] Maybe about us page that showcases the people involved in this
- [ ] For the first timers, we need a comprehensive introduction - maybe a video, article, etc.
- [ ] upload advertisements/모집 글 in instragram and social media 
- [ ] insta posts and etc in social media 
- [ ] SEO basics — meta descriptions + OpenGraph tags on blog and resources pages *(also: Get People)*
- [ ] Instagram bot posting weekly digest summaries pulled straight from js/data.js (e.g. "This week: 4 students hit Chapter 6") *(also: System, Get People)*

## 6. Get People 

- [ ] SEO basics — meta descriptions + OpenGraph tags on blog and resources pages *(also: Admin)*
- [ ] Resources page as a lead magnet — one open, no-login self-study track per subject (like the new AP Calc BC one) once Bio/Chem/Physics/CS A content exists, cross-posted on social
- [ ] Alumni/results page showing outcomes (with permission) *(also: Advice & Direction)*
- [ ] Instagram bot weekly digest posts *(also: System, Admin)*

## 7. documentation

- [ ] Rewrite README.md to match the current architecture (it still describes the old single-iframe portal/calendar setup) — or trim it to point at PROGRESS.md as the source of truth
- [ ] Document the course/roadmap JSON schema somewhere stable (fields, allowed category/status values) so hand-edits to data.js don't silently drift
- [ ] get claude or codex to view all the change logs in the commit logs, and make a documentation.md file to keep track of all the updates we made and their timelines. 

## 8. Intra-school Relation
