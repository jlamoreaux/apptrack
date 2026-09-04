import matter from "gray-matter";
// Posts are inlined at build time by scripts/build/gen-content.mjs. Reading content/ from
// disk at request time cannot work on Cloudflare Workers: there is no filesystem, and the
// deployed bundle does not include the source tree.
import { BLOG_POSTS_RAW } from "@/lib/content/generated";

export function formatPostDate(dateStr: string): string {
  const parsed = Date.parse(dateStr);
  if (Number.isNaN(parsed)) return dateStr;
  return new Date(parsed).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  date: string;
  author: string;
  content: string;
}

export function getAllPosts(): Omit<BlogPost, "content">[] {
  return Object.entries(BLOG_POSTS_RAW)
    .map(([slug, raw]) => {
      const { data } = matter(raw);

      return {
        slug,
        title: data.title ?? "",
        description: data.description ?? "",
        date: data.date ?? "",
        author: data.author ?? "",
      };
    })
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

export function getPostBySlug(slug: string): BlogPost | null {
  // Key lookup rather than a path join, so traversal is structurally impossible. The
  // explicit guard is kept as defence in depth and to preserve the previous contract.
  if (slug.includes("/") || slug.includes("\\") || slug.includes("..")) {
    return null;
  }

  const raw = BLOG_POSTS_RAW[slug];
  if (raw === undefined) return null;

  const { data, content } = matter(raw);

  return {
    slug,
    title: data.title ?? "",
    description: data.description ?? "",
    date: data.date ?? "",
    author: data.author ?? "",
    content,
  };
}
