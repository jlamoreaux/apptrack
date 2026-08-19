/**
 * The markdown renderings are built from the same constants the pages render,
 * so these tests assert the wiring holds rather than pinning exact copy.
 */

import {
  estimateTokens,
  renderMarkdownPage,
} from "@/lib/agent-discovery/markdown-pages";
import { FREE_TOOLS } from "@/lib/constants/free-tools";
import { PRICING_TIERS } from "@/lib/constants/homepage-content";
import { getAllPosts } from "@/lib/blog";

describe("renderMarkdownPage", () => {
  it("renders the homepage from the live pricing and tool constants", () => {
    const markdown = renderMarkdownPage("/");

    expect(markdown).not.toBeNull();
    for (const tier of PRICING_TIERS) {
      expect(markdown).toContain(tier.name);
      expect(markdown).toContain(tier.price);
    }
    for (const tool of FREE_TOOLS) {
      expect(markdown).toContain(tool.title);
    }
  });

  it("lists every free tool with its path", () => {
    const markdown = renderMarkdownPage("/free-tools")!;

    for (const tool of FREE_TOOLS) {
      expect(markdown).toContain(tool.title);
      expect(markdown).toContain(tool.href);
    }
  });

  it("renders a blog post from its MDX source", () => {
    const posts = getAllPosts();
    // Asserted rather than guarded: an early return on an empty blog would let
    // a regression in blog markdown rendering pass silently.
    expect(posts.length).toBeGreaterThan(0);

    for (const post of posts) {
      const markdown = renderMarkdownPage(`/blog/${post.slug}`)!;
      expect(markdown).toContain(`# ${post.title}`);
      expect(markdown).toContain(post.description);
    }
  });

  it("returns null for a path without a rendering", () => {
    expect(renderMarkdownPage("/dashboard")).toBeNull();
    expect(renderMarkdownPage("/blog/does-not-exist")).toBeNull();
    expect(renderMarkdownPage("/blog/a/b")).toBeNull();
  });
});

describe("estimateTokens", () => {
  it("scales with length and never returns zero for real content", () => {
    expect(estimateTokens("")).toBe(0);
    expect(estimateTokens("abcd")).toBe(1);
    expect(estimateTokens("a".repeat(4001))).toBe(1001);
  });
});
