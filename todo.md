# Zenith TODO

Organized around what makes us different, plus one bucket for the operational grind-work that supports all three:

1. **System** — absolute clarity
2. **Active Engagement & Motivation** — forcing real grind and effort
3. **Advice & Direction** — community, regular guidance, AI
4. **Admin** — lower-effort operational upkeep

Items that clearly serve two pillars are listed in both places on purpose (not a duplicate to clean up) — e.g. Instagram AI and 발상노트.


Check past work
Feedback process(should be encouraging than realistic)
submission process 
(future) automatic unit updates, right now updates by AI 
or we can "expect" and plan next one as they press smth or what get inta message etc 
cross check the tone across the website and program to be as encouraging as possible 

## 1. System — Absolute Clarity
The one big consolidated place a student (and us) can look to know exactly where things stand: portal, forms, records.

- [ ] Self Track Version 만들기 (portal)
- [ ] Google Classroom replacement in website
- [ ] One universal submission form — just submit and we sort it out (replaces one-off forms)
- [ ] Make this totally intra-site, no more dependencies on Notion
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.)
- [ ] Instagram notifications / Instagram bot
- [ ] Instagram AI *(also: Active Engagement & Motivation)*
- [ ] 발상노트 등등 제출할거 systematically — regular, structured submission flow *(also: Active Engagement & Motivation)*
- [ ] 발상노트를 주기적으로 제출할때마다 정리된 피드백이랑 AI 인풋이 있는 pdf 보여주기 웹사이트에 *(also: Active Engagement & Motivation; ties into AI integration below)*
- [ ] Add a **T (Test)** section to every chapter — extends the portal structure to B/C/S/T *(also: Active Engagement & Motivation — full philosophy listed there)*

## 2. Active Engagement & Motivation
Forcing actual grind and active effort, not just handing over information — direct checking, consistent high-ROI activity, keeping it human.

- [ ] Weekly IRL (or Zoom, if circumstances don't allow) session — roughly once a week, under 90 minutes, purely for running the T tests below. Not a general class/lecture slot.
- [ ] **T (Test) section per chapter** *(also: System — part of the B/C/S/T portal structure)*
  - [ ] Worksheet built by us (probably AI-assisted) targeting the chapter's most important questions, with numbers changed and trap questions worked in from C — not a copy of C
  - [ ] Same test date for every student regardless of individual B/C/S progress — administered IRL as a physical worksheet with a strict time limit (lean extension available if we didn't calibrate the timing well)
  - [ ] Goal: since students already did B + C + Review/feedback beforehand, they should be well-prepared going in — T should land as fun/rewarding, not scary, specifically because they did well
  - [ ] **Core philosophy — speed matters, not just correctness.** Being able to 100% solve something isn't enough if it's too slow (e.g. a past student — Bogue — could solve almost everything correctly but never quickly). Fix: have students actively review their 발상노트 before T, specifically to drill speed, not just re-check accuracy
- [ ] Instagram AI *(also: System)*
- [ ] 발상노트 습관화 — reflecting on mistakes via the physical notebook *(also: System)*
- [ ] 장기적인 몰입을 위한 많은 단기적 몰입 — 주기적으로 시험을 보고 피드백을 거치는 등, 어렵지만 ROI 높은 활동을 강제로 꾸준히 해야함 *(this is what T above is the concrete version of)*
- [ ] Motivational articles / Zenith blog — our own regular writing and input
- [ ] Make the grind enjoyable — genuine love for learning, not just forcing
- [ ] Brainstorm more ways to force/encourage real effort (open-ended)

## 3. Advice & Direction — Community
Regular, direct guidance instead of one-off help — AI integration, dynamic plans, chats with us, and a community around it.

- [ ] **Make HOW TO STUDY absolutely clear — top priority for this pillar (VERY IMPORTANT)**. Not just what's due, but the actual technique/method of studying well *(also: Active Engagement & Motivation)*
- [ ] AI chat integration — students chat with a Zenith-specialized AI (site stays static on GitHub Pages; needs a small serverless function elsewhere to hold the API key and call the model — see conversation)
- [ ] Dynamic, personalized study plans — tailored pace/direction per student, dynamically scheduled rather than one fixed calendar for everyone
- [ ] Individual/personalized feedback (human + AI)
- [ ] Zenith community space — Discord / Instagram / Facebook
- [ ] Direct 1:1 guidance channel (DMs)
- [ ] Regular check-ins with direct advice, not just reminders

## 4. Admin

- [ ] AP Resource Page — fill out the empty subject sections (Bio, Chem, Physics, CS A)
- [ ] AP Bio Notion page
- [ ] AP Chem Notion page
- [ ] AP CS Notion page
- [ ] Barron's AP Calc BC book 
- [ ] Master formula sheet for AP Calc (we already have cheat sheets)
- [ ] Automate/systematize the calendar scheduling process
- [ ] Automate notifications (general — deadlines, reminders, beyond Instagram)
- [ ] Add new website pages / resources as needed (ongoing)
- [ ] Update philosophy.html copy to reflect the refined framework (clarity / active engagement & motivation / advice & direction)

---

## Done
- [x] Portal nav: added "Right Now" and "Submit" tabs beside Portal/Calendar
- [x] Right Now page (right-now.html) — single-focal-card design (your-move / waiting / empty states), driven by each student's `rightNow` field in js/data.js
- [x] Submit page (submit.html) — embeds the shared Google Form via iframe (`SUBMISSION_FORM_URL` in js/data.js). Note: the form itself currently requires signing in with a Google account before it'll load — worth checking that's intended, since it'll block students without a matching account
- [x] Renamed portal-bar nav labels: Portal → Roadmap, Right Now → Now (Calendar/Submit unchanged); scoped to the internal 4-tab nav only, not the public site-header "Portal" links
- [x] "Message us when done" on the Now page opens a contact menu (Instagram, Facebook, YouTube, Gmail — pulled from js/social-links.js, auto-skips any still-placeholder entry) instead of a hardcoded mailto link
