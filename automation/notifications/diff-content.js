"use strict";

const vm = require("vm");

// js/blog-data.js is a plain <script> file too (const BLOG_POSTS = [...]),
// same situation as js/data.js — read it out via vm rather than requiring it.
function extractBlogPosts(sourceText) {
  const script = `${sourceText}\n;this.__BLOG_POSTS__ = BLOG_POSTS;`;
  const sandbox = {};
  vm.createContext(sandbox);
  vm.runInContext(script, sandbox, { filename: "blog-data.js" });
  return sandbox.__BLOG_POSTS__ || [];
}

// resources.html has no per-item ids or a data file backing it — each
// resource is just `<a href="..." class="resource-item"><h3>Title</h3>...`
// written by hand. Regex-extract {href, title} pairs directly out of the
// markup rather than adding a data file just for this.
function extractResourceItems(html) {
  const items = [];
  const re = /<a\s+href="([^"]+)"[^>]*class="resource-item"[^>]*>\s*<h3>([\s\S]*?)<\/h3>/g;
  let match;
  while ((match = re.exec(html))) {
    const title = match[2].replace(/<[^>]+>/g, "").trim();
    items.push({ href: match[1], title });
  }
  return items;
}

// Blog posts are prepended (per js/blog-data.js's own header comment: "Add
// new posts to the TOP"), so the newest `addedCount` are the first entries.
function computeBlogChanges(oldSource, newSource) {
  const oldPosts = extractBlogPosts(oldSource);
  const newPosts = extractBlogPosts(newSource);
  const addedCount = newPosts.length - oldPosts.length;
  if (addedCount <= 0) return [];
  return newPosts.slice(0, addedCount).map((post) => ({ type: "blog", post }));
}

function computeResourceChanges(oldHtml, newHtml) {
  const oldHrefs = new Set(extractResourceItems(oldHtml).map((item) => item.href));
  return extractResourceItems(newHtml)
    .filter((item) => !oldHrefs.has(item.href))
    .map((item) => ({ type: "resource", item }));
}

function computePhilosophyChanges(oldHtml, newHtml) {
  if (oldHtml.trim() === newHtml.trim()) return [];
  return [{ type: "philosophy" }];
}

module.exports = { computeBlogChanges, computeResourceChanges, computePhilosophyChanges };
