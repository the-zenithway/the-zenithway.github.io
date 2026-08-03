/*
  BLOG DATA
  ---------
  Add, edit, or remove a post by editing the BLOG_POSTS array below.
  Add new posts to the TOP of the array (newest first) — blog.html
  and blog-post.html just render the array in order, no sorting.

  Each post:
    slug:    used in the URL, e.g. blog-post.html?slug=your-slug —
             lowercase, hyphenated, must be unique.
    title:   shown on the index and the post page.
    date:    shown as-is, e.g. "July 20, 2026" — plain text, no
             parsing happens, so format it however you want it read.
    excerpt: one or two sentences shown on the blog index only.
    content: the post body — an array of strings, one per paragraph.
*/

const BLOG_POSTS = [
  {
    "slug": "how-the-zenith-course-works",
    "title": "How the Zenith Course Works",
    "date": "July 31, 2026",
    "excerpt": "We've written about how to use the Portal itself — this is the other half: how we designed the course you actually work through inside it, and what each unit is for.",
    "content": [
      "We've already written about how to use the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a> — the buttons, the pages, the mechanics. What we haven't written about is the thing the Portal is actually a container for: the course itself, and why it's shaped the way it is. This is that explanation; how we designed Zenith, and what we intend for a student going through it.",
      "Every Zenith course is built from chapters — the actual topics — and each chapter is broken into units, where a unit is a specific phase of learning rather than a topic of its own. AP Calculus BC, for example, gives every chapter five units: <strong>B</strong> (book chapter), <strong>C</strong> (coursework — chapter problems), <strong>S</strong> (solution), <strong>R</strong> (review), and <strong>T</strong> (test). What follows is how we intend a student to move through those five, in order.",
      "One thing before the walkthrough: this is a guide, not a script. We'd rather you understand the philosophy behind each unit and fold it into your own way of studying than follow these steps robotically. The order and the intent matter more than the letter of it.",
      "<h2>B — Book Chapter</h2>",
      "Exactly what it sounds like, with one condition: <strong>you have to actively work out every single example problem in the chapter</strong>, not just read through them. Alongside that, we require written notes covering the whole chapter, incorporating every example as you go. These notes get submitted through the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a> — this is not optional.",
      "<h2>C — Coursework / Chapter Problems</h2>",
      "Work through every problem in the chapter set. How you get there has more room to flex, but the problems themselves don't — go through all of them, and write your answers clearly on paper for submission. If you're genuinely stuck, looking up an answer online (Google, ChatGPT, whatever you'd normally reach for) is fine — but mark it when you do. That mark is what lets us actually see where your real gaps are and review them systematically later, instead of a wrong answer just quietly slipping through.",
      "<h2>S — Solution</h2>",
      "The one unit with no submission. Check which problems you got wrong, read the solution, and understand what you'd do differently next time. That understanding is the whole point — there's nothing here to turn in because the only thing that matters is what happens in your head while you're reading it.",
      "<h2>R — Review</h2>",
      "This is one of Zenith's core pillars, not a formality. Every student keeps a dedicated review notebook, where every problem they got wrong gets identified and actually reflected on — not just re-copied. The approach we've adopted for this is called 발상노트 작성, and the clearest explanation of it is <a href=\"https://www.youtube.com/watch?v=jLQSRJeh_tE&pp=ygUM67Cc7IOB64W47Yq4\" target=\"_blank\" rel=\"noopener\">this video</a>. We also provide a template, so you're not starting from a blank page.",
      "<h2>T — Test</h2>",
      "A test covering the entire chapter, run mostly through IRL sessions, under a strict time limit and real testing conditions — not an open-book check-in. And the same rule applies here as everywhere else: reviewing afterward is mandatory. A test without a review afterward just tells you a score; it doesn't teach you anything.",
      "<h2>After the chapters: Mocks</h2>",
      "Once the regular chapters are done, mocks take over — full simulations of real testing conditions, at the scale of the actual exam rather than a single chapter. The emphasis doesn't change: reflection afterward matters as much as the mock itself, if not more.",
      "That's the shape of it: work the chapter, solve the problems, check your solutions, reflect on what went wrong, then get tested on it — five units, one philosophy, repeated chapter after chapter until the mocks tie it all together. None of this is meant to be followed like a checklist. It's meant to be understood well enough that you'd design it yourself, if we hadn't already."
    ]
  },
  {
    "slug": "a-tour-of-zenith-outside-the-portal",
    "title": "A Tour of Zenith, Outside the Portal",
    "date": "July 31, 2026",
    "excerpt": "Home, Philosophy, Resources, FAQ, the Blog, and the footer — everything on the site that isn't the student Portal, and what each one is actually for.",
    "content": [
      "Most of what makes Zenith Zenith happens inside the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a> — that's covered in its own walkthrough. Everything else on the site exists around it: the public pages anyone can read without logging in, and the footer that ties every page together. This is a tour of that half.",
      "<h2>Home</h2>",
      "index.html is deliberately short: one line on what Zenith is, and three cards — Philosophy, Resources, and <a href=\"blog-post.html?slug=how-to-use-zenith\">Your Portal</a>. It's a signpost, not a pitch page — the actual case for the program is one click away, on Philosophy.",
      "<h2>Philosophy</h2>",
      "philosophy.html is the closest thing to a mission statement Zenith has, organized around three ideas that shape everything else on the site:",
      "<ul><li><strong>Absolute Clarity</strong> — you should never have to guess what to do next. This is the idea the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a> exists to deliver: one system, one source of truth for your roadmap, feedback, and calendar.</li><li><strong>Active Engagement &amp; Motivation</strong> — information alone doesn't move anyone forward, so effort gets checked directly (real tests, real feedback) instead of just assigned and forgotten.</li><li><strong>Advice &amp; Direction</strong> — direct, ongoing guidance from real people, not a one-time consultation or a static curriculum.</li></ul>",
      "Below the three pillars is a shorter \"How We Teach\" section — curiosity first, learning by doing, everyone's own pace, community over competition — the four values underneath the day-to-day of actually working with us.",
      "<h2>Resources</h2>",
      "resources.html is open to everyone, no login required — a running list of SAT and AP materials organized by subject. Anything marked with a ★ (\"Highly recommended\") is something we'd point you to first if you could only pick one resource for that subject.",
      "The AP section is broken into per-subject groups, and a few of them — currently AP Calculus BC, AP Biology, and AP Chemistry — include a \"Zenith Self Study Track\": a real, live copy of that subject's actual roadmap (same chapters, same structure you'd see inside the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a>), fully unlocked and open without an account. It's the closest thing to trying the Portal before signing up.",
      "<h2>FAQ</h2>",
      "faq.html answers the questions that come up before and after someone actually starts — grouped into Getting Started, Finding Your Way (grade-level advice, feeling behind, where to begin), Account &amp; Login, Using the Site, and Your Course &amp; Roadmap. That last two sections are really a condensed version of the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal walkthrough</a> in Q&amp;A form — useful if you have one specific question rather than wanting the whole tour.",
      "<h2>Blog</h2>",
      "blog.html — this page. A running, dated log of writing about how Zenith works and why it's built the way it is, newest first. The <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal walkthrough</a> and this tour both live here, alongside more reflective posts on the reasoning behind specific decisions.",
      "<h2>Logging in</h2>",
      "login.html is one box — username and password — for every role. Where you land afterward depends on who you are: students go to the <a href=\"blog-post.html?slug=how-to-use-zenith\">Portal</a>, parents to a read-only dashboard, teachers to their own. The account itself is something we set up for you; see the FAQ's Account &amp; Login section if you don't have one yet.",
      "<h2>The footer</h2>",
      "Every page ends the same way: a row of icons — Instagram, Facebook, YouTube, Discord, KakaoTalk, and a direct Gmail link — and one line underneath: \"The process is clear. Your potential is limitless. Let's get to work.\" It's the one piece of the site that's identical everywhere, on purpose — however you found a given page, the way to actually reach us is never more than a scroll away.",
      "That's everything outside the Portal. For what's inside it, the <a href=\"blog-post.html?slug=how-to-use-zenith\">full walkthrough</a> covers every page and button."
    ]
  },
  {
    "slug": "how-to-use-zenith",
    "title": "How to Use Zenith: A Walkthrough of the Portal",
    "date": "July 31, 2026",
    "excerpt": "Every page, every button, and how submitting your work actually flows through the system — a full walkthrough of the student portal for anyone who wants the map before they start.",
    "content": [
      "Zenith's portal has grown a lot of small pieces over time — a Roadmap with four different views, a submission log, an updates feed — and none of it is explained anywhere on the site itself. This is that explanation: every page, what each button actually does, and how a submission moves from your photo to a reviewed entry.",
      "<h2>Logging in</h2>",
      "One login box on login.html, one account. What you see after logging in depends on your role: students land on the Portal (portal.html), parents land on a read-only dashboard, and teachers land on their own dashboard. Everything below describes the student side, since that's what almost everyone reading this is using.",
      "<h2>The Portal: picking a course</h2>",
      "portal.html is your home base — \"Courses.\" Each subject you're enrolled in shows up as its own tile with an icon, its name, and a progress bar with a percentage underneath. That percentage is weighted, not a flat item count — book chapters and coursework count for more than, say, a solution manual, so it tracks how much of the course actually matters, not just how many boxes are checked. Click a tile and you're into that course's Roadmap.",
      "If you're enrolled in two or more courses, an extra line appears under the tiles: <strong>\"See your week across all courses →.\"</strong> That takes you to a combined view (week.html) showing each course's current \"Now\" task side by side, so you don't have to check every subject separately just to see what's next.",
      "<h2>The header: the same five buttons everywhere</h2>",
      "Once you're inside a course, every page shares the same header:",
      "<ul><li><strong>Courses</strong> — back to the course picker.</li><li><strong>Now</strong> — the single next thing to do for this course.</li><li><strong>Feedback</strong> — every review entry you've received, newest first.</li><li><strong>Calendar</strong> — the course's schedule, embedded directly.</li><li><strong>Submit</strong> — where you turn in finished work (more on this below).</li></ul>",
      "On the right: an <strong>Updates</strong> bell (more below), <strong>All courses</strong> to jump back to the picker, and <strong>Log out</strong>. Note that Submit doesn't appear for every course — it only shows up where there's an actual submission process set up behind it.",
      "<h2>Now: the one thing to actually do</h2>",
      "right-now.html is deliberately narrow. It shows exactly one task — what chapter, what unit, and the actual instruction — and nothing else competing for attention. When you've finished it, <strong>\"Message us when done →\"</strong> opens a menu of every real way to reach us (Discord, WhatsApp, KakaoTalk, whatever's set up), so marking something done is always a real conversation, not a checkbox.",
      "If you finish early and there's already a next task queued up, a second line appears: <strong>\"Already done with this? See what's next →.\"</strong> Clicking it reveals the next task in a second card below, so you're never stuck waiting with nothing to do — but it stays tucked away by default so you don't see it before you're actually ready. Revealed it by accident? <strong>\"Hide ▲\"</strong> folds it back.",
      "Wherever else you go in the course, a thin strip right under the header — \"Next up\" — repeats whatever Now currently says, so you never have to click back to Now just to remember what you're supposed to be doing.",
      "<h2>Roadmap: the whole course, four ways to look at it</h2>",
      "The Roadmap is the full picture — every chapter, every item, in order — viewed however you prefer:",
      "<ul><li><strong>Table</strong> — the complete list: chapter, name, category, status, and links, all in one scannable grid.</li><li><strong>Curve</strong> — every chapter plotted as a gem along a curve, colored by status; click one for the same detail as the table row.</li><li><strong>Cards</strong> — one card per chapter, scrollable, each item's name clickable straight to its link.</li><li><strong>Orbit</strong> — the same cards in a 3D coverflow layout.</li></ul>",
      "Status colors mean the same thing everywhere: <strong>Locked</strong> (not available yet — no links shown), <strong>Unlocked</strong> (marked with a ★ — this is what to work on), <strong>Complete</strong>, <strong>Review</strong>, and <strong>Optional-Reading</strong>. Where a link exists and the item isn't locked, you'll see <strong>Open ↗</strong> (the resource itself) and sometimes <strong>Submit ↗</strong> (a direct link into the submission flow for that specific item). The percentage at the top of the page is the same weighted calculation as the course tile on the Portal.",
      "<h2>Feedback and your Cheat Sheet</h2>",
      "feedback.html lists every review you've gotten, dated, tagged with the chapter and unit it's about, oldest at the bottom. If you have any cheat sheet entries, a banner sits above the list — <strong>\"Your Cheat Sheet\"</strong> — linking to cheatsheet.html, where the actual rules, formulas, and patterns worth remembering are collected in one place (with real math rendering, not plain text).",
      "<h2>Calendar</h2>",
      "calendar.html embeds the course's schedule directly in the page. If it's ever unavailable, an <strong>\"Open ↗\"</strong> link takes you straight to it in a new tab instead.",
      "<h2>Submitting your work</h2>",
      "submit.html has two parts. At the top, <strong>\"Open the submission form ↗\"</strong> takes you to the actual Google Form in a new tab — you'll pick your class, chapter, and unit there, and can attach a photo of your work.",
      "Below that is <strong>\"Your submissions\"</strong> — a running log of everything you've turned in for this course, newest first: the date and time, the chapter and unit, a thumbnail of whatever photo you attached, and the text pulled automatically from that photo. Everything starts tagged <strong>pending</strong> until it's actually been looked at.",
      "<h2>Updates</h2>",
      "The <strong>Updates</strong> button in the header quietly tracks what's changed since your last visit — newly unlocked items, new feedback — and shows a small badge when there's something new. Click it to see what changed; if there's nothing, it just says <strong>\"You're all caught up.\"</strong>",
      "<h2>For parents</h2>",
      "Parents get their own login and their own dashboard — a read-only, course-scoped summary of a linked student's progress, current task, and recent feedback. Nothing on that page is editable or clickable in a way that changes anything; it exists purely so a parent can see where things stand without needing a student's own login.",
      "That's the whole map. If something here doesn't match what you're seeing, or a button does something this article didn't mention, let us know — the portal changes often enough that this is worth revisiting."
    ]
  }
];
