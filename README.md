# Student Portal — GitHub Pages Starter

A small, static student site. Each student logs in and gets two
personal pages: a Notion portal and a Google Calendar. It's plain
HTML, CSS, and JavaScript, so there's no build step and nothing to
install: edit the files and refresh the page.

## ⚠️ This login is NOT secure — on purpose

GitHub Pages only serves static files; there's no server checking
passwords. The "login" is just a JavaScript check against the list
in `js/data.js`, and that whole file is downloaded to every visitor's
browser. Anyone who opens their browser's dev tools (or just views
the page source) can see every student's username, password, and
Notion link.

That's fine for what this was built for — a low-stakes, local site
where the goal is just "students shouldn't casually see each other's
stuff," not real security.

One more thing worth knowing, specific to embedding: a Notion page
has to be published, and a Google Calendar has to be public, for
either iframe to actually show content — so that content is
technically viewable by anyone with the link, logged into this site
or not. The login only decides which links load on which pages — it
doesn't make the linked content itself private. Don't publish
anything genuinely sensitive to either service for this.

## File structure

```
student-portal/
├── index.html          Home page (About Us style intro)
├── philosophy.html     Our teaching philosophy
├── resources.html      Grouped links and resources
├── login.html          Login form
├── portal.html         Welcome bar + embedded Notion iframe
├── calendar.html        Same bar + embedded Google Calendar iframe
├── favicon.svg          Browser tab icon (modern browsers)
├── favicon.ico          Browser tab icon (fallback)
├── apple-touch-icon.png "Add to home screen" icon (iOS/Android)
├── css/
│   └── style.css   All styling — colors and fonts are CSS variables at the top
├── js/
│   ├── data.js          The "student list" — edit this to add students or change their links
│   ├── social-links.js   The footer's social icons — edit this to change/add/remove any
│   └── app.js            Login/logout/page/footer logic — rarely needs editing
├── .nojekyll        Tells GitHub Pages to serve the files as-is
└── README.md        This file
```

Every public page (Home, Philosophy, Resources, Login) shares the
same header and nav, so all four are always reachable from any one
of them. `portal.html` and `calendar.html` bounce to `login.html` if
nobody's logged in, and share their own bar (with a link back Home,
plus Portal/Calendar tabs) so students can switch between the two.

## Getting a student's Notion link

1. Open the student's page in Notion.
2. Click **Share** (top right) → the **Publish** tab → **Publish**.
3. Click **Embed this page** → **Copy this code**.
4. That gives you a snippet containing `<iframe src="...">`. Copy
   just the URL inside the quotes.
5. Paste it into that student's `notionUrl` in `js/data.js`.

Note: publishing a page also publishes all of its subpages, so make
sure everything underneath is meant to be public too.

## Getting a student's Google Calendar link

1. In Google Calendar (on a computer — this option isn't in the
   mobile app), open **Settings** (top right).
2. On the left, click the specific calendar you want to embed.
3. Click **Integrate calendar**.
4. Under "Embed code," copy the URL inside `<iframe src="...">` —
   it looks like `https://calendar.google.com/calendar/embed?src=...`.
5. Paste it into that student's `calendarUrl` in `js/data.js`.
6. On the same settings page, under **Access permissions**, turn on
   **Make available to public** — otherwise visitors see an empty
   grid instead of actual events.

## If a Notion embed doesn't show up

- Check the URL for stray characters, especially a double slash
  partway through the path. `.../ebd//abc123` (two slashes) will
  often silently fail to load even though it looks almost right —
  it needs to be `.../ebd/abc123` (one slash).
- Re-copy the link straight from Notion's "Copy this code" button
  rather than retyping or re-pasting it through something else, to
  rule out a slip.
- Make sure the link came specifically from Share → the **Publish**
  tab → Publish → **Embed this page** → Copy this code — not from
  the separate "Share to web" toggle. Notion blocks plain public
  share links from being displayed in a frame on other sites (a
  security header tells the browser not to allow it); only the
  dedicated Embed this page flow is meant to get around that.
- If the link has `?v=` in it, that page contains a linked
  database view — and Notion requires the *underlying database* to
  be published/shared separately from the page around it, or
  visitors just see a blank space where it should be. Open the
  database itself (not just the page it sits on), then repeat
  Share → Publish → Publish there too.
- Open the portal page, open your browser's dev tools (F12) → the
  Console tab, and reload. An error mentioning "X-Frame-Options" or
  "Content-Security-Policy" confirms Notion itself is refusing to
  be framed for that link — the fix is getting a proper Embed this
  page link (see above), not anything in this site's code.
- A third-party proxy like embednotion.com is a reliable fallback
  when a native embed won't cooperate — worth knowing its free tier
  typically caps you around 1 embedded page before asking you to
  upgrade, so it fits a single page better than a whole class list.

## Editing Home, Philosophy, and Resources

These three are plain HTML with no dynamic parts — just open the
file and edit the text directly:

- `index.html` — the intro paragraph and the three teaser cards
- `philosophy.html` — swap in your actual four (or however many)
  principles inside the `.cards` block
- `resources.html` — each `.resource-item` is one link; the `href="#"`
  placeholders don't go anywhere yet, so replace them with real
  links (or a `mailto:` link for something like "Contact Us")

Copy an existing `.card` or `.resource-item` block to add another
one — the layout adjusts automatically.

## Editing the footer's social icons

Open `js/social-links.js` — it's a short list, one line per icon:

```js
{ name: "Instagram", icon: "instagram", url: "https://instagram.com/YOUR_HANDLE" }
```

Change `url` to your real link and you're done — it updates on
every page at once (every page except `portal.html` and
`calendar.html`, which skip the footer on purpose so the embedded
iframe can use the full page height).

- To remove an icon, delete its line.
- To add one, copy a line and change all three values. `icon` must
  be a valid slug from simpleicons.org — search the brand name
  there and the slug is shown under it.
- For an emailed contact instead of a profile page (like the Gmail
  entry), use `"mailto:you@example.com"` as the url.

## The favicon

`favicon.svg` is a simple generated mark (a rounded square in the
site's dark background color with a gold "S") — `favicon.ico` and
`apple-touch-icon.png` are the same design, rendered as fallbacks
for browsers and devices that don't support SVG favicons. To use
your own logo instead, replace all three files with your own (same
filenames), or just replace `favicon.svg` and re-export the other
two from it.

## Adding, editing, or removing a student

Open `js/data.js`. Every student is one entry in the `STUDENTS` list:

```js
{
  username: "alice",
  password: "alice123",
  name: "Alice Johnson",
  portal: {
    notionUrl: "https://your-workspace.notion.site/alice-page",
    calendarUrl: "https://calendar.google.com/calendar/embed?src=alice%40gmail.com"
  }
}
```

Copy an existing entry, change the values, and save. To remove a
student, delete their entry. No other file needs to change.

## Changing what a page shows

`portal.html` and `calendar.html` are nearly identical — each has
just a welcome bar and one iframe, both filled in by the same
`renderEmbedPage()` function in `js/app.js`. The only difference
between the two pages is which URL they pass in:

```js
// in portal.html:
renderEmbedPage(student, student.portal.notionUrl, "Notion");
// in calendar.html:
renderEmbedPage(student, student.portal.calendarUrl, "Google Calendar");
```

To add a third page like this later (a syllabus, an assignments
board, anything that's really "log in and see one embedded thing"),
copy `calendar.html`, point its `<iframe id="embed-frame">` and the
`renderEmbedPage()` call at a new field you add to each student in
`js/data.js`, and add a matching tab in the `.portal-nav` of every
page's bar.

## The theme

Every page shares one dark theme (background `#191919`, matched to
Notion's own dark mode) so there's no visible seam where the embed
starts. Colors and fonts all live as CSS variables at the top of
`css/style.css` — `--bg`, `--text`, `--accent`, and so on — change
them there and the whole site updates together.

## Test it locally

Either works:

- **Simplest:** double-click `index.html` to open it in your browser.
- **Closer to production:** from this folder, run
  `python3 -m http.server`, then visit `http://localhost:8000`.

Try logging in with `alice / alice123` (or `bob` / `charlie`, same
pattern), then switch between the Portal and Calendar tabs. Until
you swap in real links, both iframes will show an empty or
"not found" state from Notion/Google — that's expected.

## Deploy to GitHub Pages

1. Create a new repository on GitHub.
2. Push the contents of this folder to the repo, so these files sit
   at the repo's root (not inside an extra subfolder).
3. In the repo, go to **Settings → Pages**.
4. Under "Build and deployment," choose **Deploy from a branch**,
   then pick your branch (usually `main`) and the `/ (root)` folder.
5. Save. GitHub gives you a URL like
   `https://your-username.github.io/your-repo-name/` within a minute
   or two.

Every future update is just: edit a file, commit, push — GitHub
Pages redeploys automatically.

## Ideas for later

- Replace the demo students with your real class list and their
  real Notion links.
- If real privacy ever matters — for the login or for keeping each
  student's page truly private — the usual next step is a free auth
  service like Firebase Authentication or Supabase, paired with
  Notion's API instead of public embeds. Happy to help set that up
  if this project grows.
