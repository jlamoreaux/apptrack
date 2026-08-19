import { SITE_CONFIG } from "@/lib/constants/site-config";
import { FREE_TOOLS, ROLE_LANDING_PAGES } from "@/lib/constants/free-tools";
import { PRICING_TIERS, FAQS } from "@/lib/constants/homepage-content";
import { getAllPosts, getPostBySlug, formatPostDate } from "@/lib/blog";
import { STATIC_MARKDOWN_PATHS } from "@/lib/constants/agent-discovery";
import {
  blogSlugFromPath,
  hasMarkdownRendering,
} from "@/lib/agent-discovery/markdown-negotiation";

/**
 * Markdown renderings of the public pages, served when an agent sends
 * `Accept: text/markdown` (see middleware.ts and app/api/markdown/route.ts).
 *
 * These are built from the same constants the pages render, not scraped from
 * the HTML, so the two can't describe different pricing or a different tool
 * list. Pages whose copy lives only in JSX are deliberately absent: they keep
 * serving HTML rather than a stale hand-written summary.
 */

function absolute(pathname: string): string {
  return `${SITE_CONFIG.url}${pathname}`;
}

function renderHomepage(): string {
  const tools = FREE_TOOLS.map(
    (tool) => `- [${tool.title}](${absolute(tool.href)}) — ${tool.description}`,
  ).join("\n");

  const pricing = PRICING_TIERS.map((tier) => {
    const features = tier.features.map((f) => `- ${f}`).join("\n");
    return `### ${tier.name} — ${tier.price}${tier.cadence.startsWith("/") ? tier.cadence : ` ${tier.cadence}`}\n\n${tier.tagline}\n\n${features}`;
  }).join("\n\n");

  const faqs = FAQS.map((faq) => `### ${faq.question}\n\n${faq.answer}`).join("\n\n");

  return `# ${SITE_CONFIG.name}

> ${SITE_CONFIG.tagline}

${SITE_CONFIG.description}

## What it does

- **Land it.** Unlimited application tracking, free forever. Resume Roast tells
  you what's broken before recruiters do.
- **Track it.** Ten-second win logging, comp history, and a Friday recap that
  writes itself — months of evidence no fresh chatbot session can fake.
- **Win it.** The coach turns logged wins into a promotion case, a review doc,
  and help making the comp ask.

## Free tools, no account required

${tools}

## Pricing

${pricing}

## FAQ

${faqs}

## Links

- Sign up: ${absolute("/signup")}
- Blog: ${absolute("/blog")}
- Terms: ${absolute("/terms")}
- Privacy: ${absolute("/privacy")}
- Agent-oriented site map: ${absolute("/llms.txt")}
`;
}

function renderFreeTools(): string {
  const tools = FREE_TOOLS.map((tool) => {
    const features = tool.features.map((f) => `- ${f}`).join("\n");
    return `## ${tool.title}\n\n${tool.description}\n\n${features}\n\nOpen: ${absolute(tool.href)}`;
  }).join("\n\n");

  const roles = ROLE_LANDING_PAGES.map(
    (role) => `- [${role.name}](${absolute(`/cover-letter-generator/${role.slug}`)})`,
  ).join("\n");

  return `# Free tools — ${SITE_CONFIG.name}

Every tool below is free and needs no account. Each is limited to one use per 24
hours per browser; a second attempt in that window is rejected.

${tools}

## Cover letters by role

Role-specific versions of the cover letter generator:

${roles}
`;
}

function renderBlogIndex(): string {
  const posts = getAllPosts();

  if (posts.length === 0) {
    return `# Blog — ${SITE_CONFIG.name}\n\nNo posts published yet.\n`;
  }

  const entries = posts
    .map(
      (post) =>
        `## [${post.title}](${absolute(`/blog/${post.slug}`)})\n\n${formatPostDate(post.date)} · ${post.author}\n\n${post.description}`,
    )
    .join("\n\n");

  return `# Blog — ${SITE_CONFIG.name}\n\n${entries}\n`;
}

function renderBlogPost(slug: string): string | null {
  const post = getPostBySlug(slug);
  if (!post) return null;

  return `# ${post.title}

> ${post.description}

${formatPostDate(post.date)} · ${post.author}

---

${post.content.trim()}
`;
}

/** Every path that has a markdown rendering, for the sitemap-style listings. */
export function listMarkdownPaths(): string[] {
  return [
    ...STATIC_MARKDOWN_PATHS,
    ...getAllPosts().map((post) => `/blog/${post.slug}`),
  ];
}

export function renderMarkdownPage(pathname: string): string | null {
  switch (pathname) {
    case "/":
      return renderHomepage();
    case "/free-tools":
      return renderFreeTools();
    case "/blog":
      return renderBlogIndex();
  }

  const slug = blogSlugFromPath(pathname);
  if (slug === null || !hasMarkdownRendering(pathname)) return null;

  return renderBlogPost(slug);
}

/**
 * Rough token count for the `x-markdown-tokens` response header. Four
 * characters per token is the usual English approximation; this is a hint for
 * budgeting, not an exact count from any specific tokenizer.
 */
export function estimateTokens(markdown: string): number {
  return Math.ceil(markdown.length / 4);
}
