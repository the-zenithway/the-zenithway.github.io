# Student Portal — GitHub Pages Starter

A small, static student portal. Each student logs in and sees their
own page — a personal note and their grades. It's plain HTML, CSS,
and JavaScript, so there's no build step and nothing to install:
edit the files and refresh the page.

## ⚠️ This login is NOT secure — on purpose

GitHub Pages only serves static files; there's no server checking
passwords. The "login" is just a JavaScript check against the list
in `js/data.js`, and that whole file is downloaded to every visitor's
browser. Anyone who opens their browser's dev tools (or just views
the page source) can see every student's username, password, and
portal content.

That's fine for what this was built for — a low-stakes, local site
where the goal is just "students shouldn't casually see each other's
stuff," not real security. Don't put anything genuinely sensitive in
here (real grades that matter, medical or family info, etc.) if the
site will be reachable outside your class.

If real privacy between users ever matters, the usual next step is a
free auth service like Firebase Authentication or Supabase — happy
to help set that up later if this project grows.

## File structure

```
student-portal/
├── index.html      Home page
├── login.html      Login form
├── portal.html     Personalized portal (bounces to login.html if not logged in)
├── css/
│   └── style.css   All styling — colors and fonts are CSS variables at the top
├── js/
│   ├── data.js      The "student list" — edit this to add/remove students
│   └── app.js       Login/logout/portal logic — rarely needs editing
├── .nojekyll        Tells GitHub Pages to serve the files as-is
└── README.md        This file
```

## Adding, editing, or removing a student

Open `js/data.js`. Every student is one entry in the `STUDENTS` list:

```js
{
  username: "alice",
  password: "alice123",
  name: "Alice Johnson",
  portal: {
    announcement: "Great job on your last project!",
    grades: [{ subject: "Math", grade: "A" }]
  }
}
```

Copy an existing entry, change the values, and save. To remove a
student, delete their entry. No other file needs to change.

## Changing what the portal page shows

Open `js/app.js` and look at `renderPortal()` near the bottom — it's
the only place that decides what appears on `portal.html`. Add a new
`<div class="panel">...</div>` block there for a new section (a
schedule, a resource list, anything), and add matching data to each
student in `js/data.js`.

## Test it locally

Either works:

- **Simplest:** double-click `index.html` to open it in your browser.
- **Closer to production:** from this folder, run
  `python3 -m http.server`, then visit `http://localhost:8000`.

Try logging in with `alice / alice123` (or `bob` / `charlie`, same
pattern) to see the personalized portal.

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

- Replace the demo students with your real class list.
- Add more portal sections: schedule, assignments, resource links.
- Rename the site and adjust the colors in `css/style.css` (all
  named as variables at the top of the file).
- If real privacy ever matters, move the student list into Firebase
  or Supabase instead of `js/data.js`.
