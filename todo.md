## 1. Priority Stuff
- [ ] Philosophy, About us page
- [ ] Blogs(1+)
- [ ] Manual(pdf) + Video on yt 
- [ ] Social Media posts
- [ ] Get People 
- [ ] Get teachers
- [ ] Zenith Local, Club, Proposal, Presentation

## 2. Maintenance & Improvement 
- [ ] Automatic documentation — auto-gather docs from all around (Instagram bot logs, GitHub commit logs across all repos, lecture videos/sessions, session scores, etc.) - partly done, think about more ways to work on this 
- [ ] Question database and like searching, asking questions, hints, etc.
- [ ] mobile optimization for the new features 
- [ ] view for the teachers too like what to do exactly is shown 
- [ ] notification checking for teachers as well, and thinking of teacher student workflow completely
- [ ] improve submission process(e.g. autoparsing, auto grading)
- [ ] formalized IRL sessions 
- [ ] metric formalization, also but fix for some metrics not being edited 
- [ ] AP Physics self study track
- [ ] fix biology and chemistry course 
- [ ] Refine biology view 

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
- [x] Roadmap: Curve is now the default view for AP Calculus BC; every course remembers the last view a student picked (localStorage, per course) and reopens to it
- [x] Two new roadmap views: "Periodic" (Chemistry's default) and "Cell" (Biology's default) — both work on every course, same as Curve does for Calc
- [x] Periodic view draws the full 118-element table (incl. lanthanide/actinide rows) every time, muted gray except the chapters-mapped tiles; tiles size themselves dynamically to exactly fill the screen (no scroll) and are now centered
- [x] Cell view organelles redrawn bolder/more detailed (solid saturated fills, continuous mitochondria cristae wave, gradient Golgi stack, asymmetric nucleolus blob) to read like a real vector-icon cell diagram
- [x] Cell view: fixed a cutoff bug (SVG was scaling by width only via height:auto, so on wide/short windows the top/bottom got clipped) — now contain-fits both axes so the whole cell always fits with margin; added glossy highlight ellipses, a thicker ER ribbon with a lit top edge, and a tighter ribosome cluster
- [x] New "Code" view — Computer Science's default — chapters as syntax-highlighted Java method names inside a fake scrollable source file; click a method name to open its chapter popover
