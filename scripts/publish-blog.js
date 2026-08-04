#!/usr/bin/env node
/*
  Converts a Markdown draft into a BLOG_POSTS entry and prepends it to
  js/blog-data.js.

  Usage:
    node scripts/publish-blog.js blog-drafts/my-post.md

  Draft format (frontmatter + Markdown body):

    ---
    slug: my-post
    title: My Post
    date: August 3, 2026
    excerpt: One or two sentences shown on the blog index.
    ---

    A normal paragraph. **Bold** and [links](blog-post.html?slug=x) work.

    ## A heading

    Another paragraph.

    - A list item
    - Another item

  Supported inline Markdown: **bold**, [text](url). Block-level: ## headings,
  "- " lists, plain paragraphs. Nothing fancier — write plain prose and it
  reads fine even unconverted.
*/

const fs = require("fs");
const path = require("path");

const draftPath = process.argv[2];
if (!draftPath) {
  console.error("Usage: node scripts/publish-blog.js <draft.md>");
  process.exit(1);
}

const raw = fs.readFileSync(draftPath, "utf8");

function parseFrontmatter(text) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) {
    throw new Error(
      "Draft is missing frontmatter. Expected it to start with a --- block containing slug/title/date/excerpt."
    );
  }
  const [, frontmatterBlock, body] = match;
  const meta = {};
  for (const line of frontmatterBlock.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const value = line.slice(idx + 1).trim();
    meta[key] = value;
  }
  for (const required of ["slug", "title", "date", "excerpt"]) {
    if (!meta[required]) {
      throw new Error(`Draft frontmatter is missing "${required}"`);
    }
  }
  return { meta, body };
}

function escapeAmp(text) {
  // don't double-escape entities that are already there
  return text.replace(/&(?!amp;|lt;|gt;|quot;|#\d+;)/g, "&amp;");
}

function inline(text) {
  let out = escapeAmp(text.trim());
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  return out;
}

function convertBody(body) {
  const blocks = body
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  return blocks.map((block) => {
    const lines = block.split(/\r?\n/);

    if (lines[0].startsWith("## ")) {
      return `<h2>${inline(lines[0].slice(3))}</h2>`;
    }

    if (lines.every((l) => /^[-*]\s+/.test(l))) {
      const items = lines
        .map((l) => `<li>${inline(l.replace(/^[-*]\s+/, ""))}</li>`)
        .join("");
      return `<ul>${items}</ul>`;
    }

    return inline(lines.join(" "));
  });
}

function jsStringLiteral(str) {
  return JSON.stringify(str);
}

const { meta, body } = parseFrontmatter(raw);
const content = convertBody(body);

const blogDataPath = path.join(__dirname, "..", "js", "blog-data.js");
const source = fs.readFileSync(blogDataPath, "utf8");

const marker = "const BLOG_POSTS = [";
const markerIndex = source.indexOf(marker);
if (markerIndex === -1) {
  throw new Error("Could not find `const BLOG_POSTS = [` in js/blog-data.js");
}

const existingSlugs = [...source.matchAll(/"slug":\s*"([^"]+)"/g)].map(
  (m) => m[1]
);
if (existingSlugs.includes(meta.slug)) {
  console.error(`A post with slug "${meta.slug}" already exists. Pick a different slug.`);
  process.exit(1);
}

const entryLines = [
  "  {",
  `    "slug": ${jsStringLiteral(meta.slug)},`,
  `    "title": ${jsStringLiteral(meta.title)},`,
  `    "date": ${jsStringLiteral(meta.date)},`,
  `    "excerpt": ${jsStringLiteral(meta.excerpt)},`,
  '    "content": [',
  content.map((c) => "      " + jsStringLiteral(c)).join(",\n"),
  "    ]",
  "  },",
].join("\n");

const insertAt = markerIndex + marker.length;
const updated =
  source.slice(0, insertAt) +
  "\n" +
  entryLines +
  source.slice(insertAt);

fs.writeFileSync(blogDataPath, updated);
console.log(`Added "${meta.title}" (slug: ${meta.slug}) to js/blog-data.js`);
