# Zenith TODO

## 1. System — Absolute Clarity

- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Instagram notifications / Instagram bot / AI
- [ ] Clear up the process for every user - what we have to exactly do, what the teachers have to exactly do, what the students have to exactly do and so on. also the logic, how the teachers work and so on 
- [ ] Systematic way to work on form submission parsing + feedback + cheat sheet(maybe AI agent)
- [ ] Figure out algorithm and AI agent whatever to make the corresponding T sections for each of the chapters 
- [ ] "Next up" breadcrumb on every portal page — persistent strip showing the current Now task, visible outside right-now.html too
- [ ] Student-facing changelog / "what's new" feed so returning students notice new unlocks or feedback
- [ ] Cross-course dashboard for multi-enrolled students (Hamin, David) — combined "your week across all courses" view - more important is a way to manage many subjects without getting overwhelmed(need to think)
- [ ] Parent view — read-only, course-scoped progress summary for parents
- [ ] Spaced-repetition review queue — auto-resurface Cheat Sheet entries a few weeks after they're written
- [ ] Subject-wise views, a trademark of zenith

## 2. Active Engagement & Motivation
Forcing actual grind and active effort, not just handing over information — direct checking, consistent high-ROI activity, keeping it human.

- [ ] Weekly IRL (or Zoom, if circumstances don't allow) session — roughly once a week, under 90 minutes, purely for running the T tests. Not a general class/lecture slot.
- [ ] Motivational articles / Zenith blog — our own regular writing and input
- [ ] Make the grind enjoyable — genuine love for learning, not just forcing
- [ ] Brainstorm more ways to force/encourage real effort (open-ended)
- [ ] **Make HOW TO STUDY absolutely clear — top priority for this pillar (VERY IMPORTANT)**. Not just what's due, but the actual technique/method of studying well *(also: Active Engagement & Motivation)*
  - [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
- [ ] think seriously about what's the meaning beyond the furriculum and score - what do they want? what are they ultiamtely aiming for?
- [ ] cross check the tone across the website and program to be as encouraging as possible 
- [ ] make the feedback process as encouraging as possible think a lot on thise this is very important 
- [ ] Voice-of-student testimonials on right-now.html or philosophy page

## 3. Advice & Direction — Community
Regular, direct guidance instead of one-off help — AI integration, dynamic plans, chats with us, and a community around it.

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
- [ ] aesthetic updates throughout the website
- [ ] Build out the Teacher Dashboard (currently just "Structure coming soon" in teacher.html)
- [ ] Extract shared header/footer markup — every page hand-copies the same header, so one navigation change means editing 15+ files
- [ ] Explicit mobile audit — Table view's 5-column layout and the Curve SVG on small screens
- [ ] Fix known placeholder issues:
  - [ ] href="#" placeholder links still in resources.html (Office Hours, Contact Us, Recommended Reading List)
  - [ ] Duplicated College Board Bluebook URL in resources.html
  - [ ] Unfinished FAQ answers and empty AP resource subsections (Bio/Chem/Physics/CS A)
  - [ ] Placeholder Discord/WhatsApp/KakaoTalk social URLs in js/social-links.js

## 5. Admin
- [ ] Create discord community 
- [ ] AP Resource Page — fill out the empty subject sections (Bio, Chem, Physics, CS A)
- [ ] AP Bio Notion page
- [ ] AP Chem Notion page
- [ ] AP CS Notion page
- [ ] Automate notifications (general — deadlines, reminders, beyond Instagram) also related to teacher dashboard and all that 
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

## 6. Get People 

- [ ] Alumni/results page showing outcomes (with permission) *(also: Advice & Direction)*
- [ ] Instagram bot weekly digest posts *(also: System, Admin)*

## 7. documentation

- [ ] Rewrite README.md to match the current architecture (it still describes the old single-iframe portal/calendar setup) — or trim it to point at PROGRESS.md as the source of truth
- [ ] Document the course/roadmap JSON schema somewhere stable (fields, allowed category/status values) so hand-edits to data.js don't silently drift
- [ ] get claude or codex to view all the change logs in the commit logs, and make a documentation.md file to keep track of all the updates we made and their timelines. 
- [ ] create a specific timeline of the features we want to add and yeah an entire project roadmap - what we're doing, where we're going 

## 8. Intra-school Relation
