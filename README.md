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

## Regarding Student Portal and Calendar
for now, the portals are maintained by corresponding notion publish pages(databases) but 
we hope to not rely on it, we'll probably export the whole thing as csv and make it a site-unique thing without any further reliance.
The calendar is an embedding of a preexisting calendar we use for every student, so this might need personalization in the future 
especially if the subject/student number gets bigger and consequently harder to control. 

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
