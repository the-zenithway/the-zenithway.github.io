"use strict";

// The live site (this repo's GitHub Pages origin — see `git remote -v`).
// Override with SITE_URL if a custom domain is ever added later.
const SITE_URL = process.env.SITE_URL || "https://the-zenithway.github.io";

function courseLink(page, courseId) {
  return `${SITE_URL}/${page}?course=${encodeURIComponent(courseId)}`;
}

const links = {
  rightNow: (courseId) => courseLink("right-now.html", courseId),
  feedback: (courseId) => courseLink("feedback.html", courseId),
  roadmap: (courseId) => courseLink("roadmap.html", courseId),
  cheatSheet: (courseId) => courseLink("cheatsheet.html", courseId),
  calendar: () => `${SITE_URL}/calendar.html`,
  portal: () => `${SITE_URL}/portal.html`,
  parent: () => `${SITE_URL}/parent.html`,
  resources: () => `${SITE_URL}/resources.html`,
  philosophy: () => `${SITE_URL}/philosophy.html`,
  blogPost: (slug) => `${SITE_URL}/blog-post.html?slug=${encodeURIComponent(slug)}`
};

module.exports = { SITE_URL, links };
