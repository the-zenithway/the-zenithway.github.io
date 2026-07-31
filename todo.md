# Zenith TODO

## 1. System — Absolute Clarity
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Instagram notifications / Instagram bot / AI
- [ ] Clear up the process for every user - what we have to exactly do, what the teachers have to exactly do, what the students have to exactly do and so on. also the logic, how the teachers work and so on 
- [ ] Systematic way to work on form submission parsing + feedback + cheat sheet(maybe AI agent) and like unit updates everything 
- [ ] Figure out algorithm and AI agent whatever to make the corresponding T sections for each of the chapters 
- [ ] Cross-course dashboard for multi-enrolled students (Hamin, David) — combined "your week across all courses" view - more important is a way to manage many subjects without getting overwhelmed(need to think)
- [ ] Biology view 
- [ ] Chemistry View 
- [ ] Questions database and systematic way to ask, i.e. also giving AI prompts that make them learn efficiently and like yeah per problem reviews too 
- [ ] place where they can encode all the questions and we might be able to answer them IRL
- [ ] teacher dashboared
- [ ] orbit/card view doesn't show links(open page), and maybe for the open page we can just enode it directly from the names

## 2. Active Engagement & Motivation
- [ ] Weekly IRL (or Zoom, if circumstances don't allow) session — roughly once a week, under 90 minutes, purely for running the T tests. Not a general class/lecture slot.
- [ ] Motivational articles / Zenith blog — our own regular writing and input
- [ ] Make the grind enjoyable — genuine love for learning, not just forcing
- [ ] Brainstorm more ways to force/encourage real effort (open-ended)
- [ ] **Make HOW TO STUDY absolutely clear — top priority for this pillar (VERY IMPORTANT)**. Not just what's due, but the actual technique/method of studying well *(also: Active Engagement & Motivation)*
  - [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
- [ ] think seriously about what's the meaning beyond the furriculum and score - what do they want? what are they ultiamtely aiming for?
- [ ] cross check the tone across the website and program to be as encouraging as possible 
- [ ] make the feedback process as encouraging as possible think a lot on thise this is very important 

## 3. Advice & Direction — Community
- [ ] Ways to make the community active, engaged, and no confict and encouarge helpfulness. what would trigger them to be genuinely helpful others 
and do things for the greater good?
- [ ] Community events, competitions, rewards, etc.
- [ ] idea : for each chapter, highest scorer in the T part within a given period will get like a prize
- [ ] Scope the AI chat to the student's own roadmap + cheat sheet data (not a general chatbot) *(also: System)*
- [ ] Peer study pairing — match two students on the same chapter for accountability check-ins
- [ ] Monthly "state of your progress" personal note from a teacher — short direction check-in, not a full feedback entry
- [ ] Maybe YPT community

## 4. Maintenance - updating existing features
- [ ] Improve Zenith CLI - there's so much new features so this gotta follow 
- [ ] aesthetic updates throughout the website
- [ ] Extract shared header/footer markup — every page hand-copies the same header, so one navigation change means editing 15+ files
- [ ] Fix known placeholder issues:
  - [ ] Unfinished FAQ answers and empty AP resource subsections (Bio/Chem/Physics/CS A)
  - [ ] Placeholder Discord/WhatsApp/KakaoTalk social URLs in js/social-links.js

## 5. Admin
- [ ] Create discord community 
- [ ] AP Physics self study track 
- [ ] AP Chem page
- [ ] AP CS page
- [ ] Automate notifications (general — deadlines, reminders, beyond Instagram) also related to teacher dashboard and all that 
- [ ] Upgrade Zenith CLI for easy editing and feedback for added database element
- [ ] Make zenith blog - articles that showcase our thoughts and etc.
  - [ ] Study-technique deep dives
  - [ ] Subject-specific pitfall posts (e.g. IVT vs MVT vs Rolle's, straight from real cheat sheet entries)
  - [ ] Student spotlight / progress stories
- [ ] Maybe about us page that showcases the people involved in this
- [ ] For the first timers, we need a comprehensive introduction - maybe a video, article, etc.
- [ ] upload advertisements/모집 글 in instragram and social media 
- [ ] insta posts and etc in social media 
- [ ] Rewrite README.md to match the current architecture (it still describes the old single-iframe portal/calendar setup) — or trim it to point at PROGRESS.md as the source of truth

## 6. Get People 
- [ ] Alumni/results page showing outcomes (with permission) *(also: Advice & Direction)*
- [ ] Instagram bot weekly digest posts *(also: System, Admin)*

## 7. documentation
- [ ] Document the course/roadmap JSON schema somewhere stable (fields, allowed category/status values) so hand-edits to data.js don't silently drift
- [ ] get claude or codex to view all the change logs in the commit logs, and make a documentation.md file to keep track of all the updates we made and their timelines. 
- [ ] create a specific timeline of the features we want to add and yeah an entire project roadmap - what we're doing, where we're going 

## 8. Intra-school Relation
- [ ] Make presentation
- [ ] Formal proposal document 

## Done
- [x] Submission compiler (compile-only, no feedback/cheat sheet writing yet) — Apps Script (`automation/submissions-compiler.gs`) OCRs uploaded images via Drive and appends every Form response as a status-tracked entry to `data/submissions-log.json` on a separate `submissions-log` branch, never touching main
