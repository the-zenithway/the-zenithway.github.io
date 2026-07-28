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
    "slug": "why-right-now-beats-a-todo-list",
    "title": "Why \"Right Now\" Beats a Todo List",
    "date": "July 24, 2026",
    "excerpt": "A long list of everything you could be doing is not the same as knowing what to do next. Here's why our portal only ever shows one thing.",
    "content": [
      "Open most student portals and you'll find a wall of assignments, due dates, and half-finished modules — everything, all at once, all demanding attention at the same volume.",
      "We built the Now page to do the opposite. At any given moment, it shows exactly one thing: the single next step, and nothing else. If you're waiting on us to review something, it says so, plainly, with nothing left for you to guess at.",
      "The full picture is still there — the Roadmap shows every chapter, in order, so nothing is ever hidden. But being able to see everything and being told what matters right now are two different jobs, and we think most tools quietly fail at the second one by trying to do both at once.",
      "Absolute clarity isn't about showing more. It's about never leaving a student wondering what to do next."
    ]
  },
  {
    "slug": "why-a-physical-notebook",
    "title": "Why We Still Use a Physical Notebook",
    "date": "July 29, 2026",
    "excerpt": "In a program built around a website, the most important habit we ask for happens on paper. Here's why the 발상노트 doesn't have a digital version.",
    "content": [
      "It would be easy to make the reflection notebook digital — a form, a text box, one less physical object to keep track of. We've deliberately kept it on paper.",
      "The 발상노트 isn't a record of what a student got wrong. It's the place where they slow down enough to actually notice why — writing out the mistake, the source of the confusion, and the correct approach, by hand, in their own words.",
      "That slowness is the entire point. A typed note gets skimmed later; a handwritten one gets remembered while it's being written. Before a T test, reviewing that notebook — actively, not just re-reading — is consistently the difference between a student who can solve a problem and one who can solve it fast.",
      "Some habits are worth keeping low-tech on purpose."
    ]
  }
];
