"use strict";

// The live site (this repo's GitHub Pages origin — see `git remote -v`).
// Override with SITE_URL if a custom domain is ever added later.
const SITE_URL = process.env.SITE_URL || "https://the-zenithway.github.io";

function courseLink(page, courseId) {
  return `${SITE_URL}/${page}?course=${encodeURIComponent(courseId)}`;
}

// Courses on the course platform (same list as ZP_CONFIG.COURSES in js/zp-config.js). Other courses are the roadmap only: Right Now, the
// feedback page and the cheat sheet no longer exist for them, so their emails link to the roadmap. On the platform, feedback lives in the
// Mentor page and the cheat sheet became the Concepts Notebook.
const PLATFORM_COURSES = ["ap-calculus-bc", "ap-chemistry"];
const onPlatform = (courseId) => PLATFORM_COURSES.includes(courseId);
const platformLink = (page, courseId, extra) => onPlatform(courseId) ? `${courseLink(page, courseId)}${extra || ""}` : courseLink("roadmap.html", courseId);

const links = {
  rightNow: (courseId) => platformLink("right-now.html", courseId),
  feedback: (courseId) => platformLink("mentor.html", courseId),
  roadmap: (courseId) => courseLink("roadmap.html", courseId),
  cheatSheet: (courseId) => platformLink("notebook.html", courseId, "&view=concepts"),
  calendar: () => `${SITE_URL}/calendar.html`,
  portal: () => `${SITE_URL}/portal.html`,
  parent: () => `${SITE_URL}/parent.html`,
  resources: () => `${SITE_URL}/resources.html`,
  philosophy: () => `${SITE_URL}/philosophy.html`,
  blogPost: (slug) => `${SITE_URL}/blog-post.html?slug=${encodeURIComponent(slug)}`
};

module.exports = { SITE_URL, links };
