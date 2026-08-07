## 1. Absolute Clarity
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Question database and like searching, asking questions, hints, etc.
- [ ] mobile optimization for the new features 
- [ ] alert teachers for new submissions, a nice view for the teachers too like what to do exactly is shown 
- [ ] notification checking for teachers as well, and thinking of teacher student workflow completely
- [ ] improve submission process(e.g. autoparsing, auto grading)
- [ ] scheduled email alert and to set them via teacher article 
- [ ] formalized IRL sessions 
- [ ] metric formalization 

## 2. Inner Excellence 
- [ ] Daily motivation & Inner excellence quotes
- [ ] Dedicated study-technique library page/section — spaced repetition, active recall, how to use the Cheat Sheet during review
- [ ] Regular IRL Sessions -> 발상노트 점검 + go through one whole chapter and check understanding + test/mock
- [ ] make aspects of the program as encouraging as possible 
- [ ] Every day motivational article + regular check-ins

## 3. Genuine Mentorship
We're truly serious about this. Not top-down teacher-student, but a guide/companion (kalyāṇamitra) relationship — we see versions of ourselves in our students' growth, and want them to become people who pass that same devotion on to others, not just to guarantee a 5.

## 4. Admin
- [ ] Create discord community 
- [ ] AP Physics self study track
- [ ] Make zenith blog - articles that showcase our thoughts and etc.
  - [ ] Study-technique deep dives
  - [ ] Subject-specific pitfall posts (e.g. IVT vs MVT vs Rolle's, straight from real cheat sheet entries)
  - [ ] Student spotlight / progress stories
  - [ ] watch the velocity, not the displacement 
  - [ ] inner excellence 
  - [ ] the zenith story 
  - [ ] what if students missed wasnt studies but true compass in life? 
  - [ ] genuine mentorship 
  - [ ] teach inner excellence like we teach math 
- [ ] Maybe about us page that showcases the people involved in this
- [ ] For the first timers, we need a comprehensive introduction - maybe a video, article, etc. i.e. a manual
- [ ] alumni/results page showing outcomes 
- [ ] create a timeline of features 
- [ ] biology, chemistry view for couse  and other subjects too 
- [ ] video making - upload the video directly in youtube 
- [ ] fix biology and chemistry course 
- [ ] improve korean version for resource page in my own wording 

## 5. Kickstart
- [ ] Get New people
- [ ] Instagram post, social media 

## 6. Intra-school Relation
- [ ] Make presentation
- [ ] Formal proposal document
- [ ] Zenith Local

## Done
- [x] New-submission teacher email notification — automation/submissions-compiler.gs's notifyTeachers_ emails every TEACHERS entry (js/data.js) with an email on file right after logging a submission, alongside the existing student "we got it" email. Optional per-teacher `courses` array (e.g. ["ap-calculus-bc"]) scopes notifications to specific subjects — unset means "notify about everything," the default for the current single-teacher setup. Reuses the same bracket-depth array-reading approach as zenith-data-writer.gs (copied in, since this is a separate Apps Script project). No new Script Properties needed. Still needs: (1) a real email filled into TEACHERS[0].email in js/data.js, (2) the updated submissions-compiler.gs pasted into the live Form-bound Apps Script editor.
