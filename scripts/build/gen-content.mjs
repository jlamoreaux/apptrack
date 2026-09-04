#!/usr/bin/env node
/**
 * Inlines everything under content/ into a generated TypeScript module.
 *
 * Why: lib/blog.ts and lib/agent-discovery/skills.ts read content/ from disk at request
 * time. Cloudflare Workers has no filesystem, and a Workers bundle does not ship the
 * source tree, so those reads cannot work there. Generating a module at build time is
 * portable — it works identically under Next, Vite/vinext, and Workers.
 *
 * Runs from `prebuild`, and can be run by hand:  node scripts/build/gen-content.mjs
 */
import { readdirSync, readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");
const OUT = join(ROOT, "lib/content/generated.ts");

function readBlogPosts() {
  const dir = join(ROOT, "content/blog");
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir)
      .filter((f) => f.endsWith(".mdx"))
      .sort()
      .map((f) => [f.replace(/\.mdx$/, ""), readFileSync(join(dir, f), "utf-8")])
  );
}

function readSkills() {
  const dir = join(ROOT, "content/agent-skills");
  if (!existsSync(dir)) return {};
  return Object.fromEntries(
    readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && existsSync(join(dir, e.name, "SKILL.md")))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((e) => [e.name, readFileSync(join(dir, e.name, "SKILL.md"), "utf-8")])
  );
}

const posts = readBlogPosts();
const skills = readSkills();

const contents = `// GENERATED FILE — DO NOT EDIT.
// Produced by scripts/build/gen-content.mjs from content/. Regenerate with:
//   pnpm gen:content
//
// content/ is inlined at build time rather than read at request time because Cloudflare
// Workers has no filesystem and the deployed bundle does not include the source tree.

/** Raw MDX for every post under content/blog, keyed by slug. */
export const BLOG_POSTS_RAW: Readonly<Record<string, string>> = ${JSON.stringify(posts, null, 2)};

/** Raw Markdown for every SKILL.md under content/agent-skills, keyed by directory name. */
export const AGENT_SKILL_BODIES: Readonly<Record<string, string>> = ${JSON.stringify(skills, null, 2)};
`;

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, contents);
console.log(
  `wrote lib/content/generated.ts — ${Object.keys(posts).length} blog post(s), ${Object.keys(skills).length} skill(s)`
);
