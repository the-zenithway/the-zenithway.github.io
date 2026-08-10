/*
  BLOG DATA
  ---------
  This array is a manual escape hatch, kept for anything worth typing
  straight into a file — the actual, day-to-day way to publish a post
  is admin.html's Blog tab (markdown editor + live preview), which
  writes to data/blog-posts.json instead of here. renderBlogList() /
  renderBlogPost() (js/app.js) merge both sources: the JSON file's
  posts first (already newest-first, since the write endpoint unshifts
  each new one), then whatever's in this array, in the order below.

  Add, edit, or remove a hand-authored post by editing the BLOG_POSTS
  array below. Add new posts to the TOP of the array (newest first) —
  nothing here gets sorted.

  Each post:
    slug:    used in the URL, e.g. blog-post.html?slug=your-slug —
             lowercase, hyphenated, must be unique (checked against
             BOTH this array and data/blog-posts.json's posts, in your
             head — nothing enforces it across the two automatically).
    title:   shown on the index and the post page.
    date:    shown as-is, e.g. "July 20, 2026" — plain text, no
             parsing happens, so format it however you want it read.
    excerpt: one or two sentences shown on the blog index only.
    content: the post body — an array of strings, one per paragraph.
             (JSON-file posts use contentMd, raw markdown, instead —
             see renderBlogPost's contentMd branch.)
*/

const BLOG_POSTS = [];

