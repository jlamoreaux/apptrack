/**
 * Content negotiation for `Accept: text/markdown`. The important property is
 * the negative one: a browser must never be flipped onto the markdown branch.
 */

import {
  hasMarkdownRendering,
  prefersMarkdown,
} from "@/lib/agent-discovery/markdown-negotiation";

describe("prefersMarkdown", () => {
  it("accepts an explicit markdown request", () => {
    expect(prefersMarkdown("text/markdown")).toBe(true);
    expect(prefersMarkdown("text/markdown, text/html;q=0.9")).toBe(true);
    expect(prefersMarkdown("TEXT/MARKDOWN")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=1.0")).toBe(true);
  });

  it("leaves browsers on HTML", () => {
    const chrome =
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8";

    expect(prefersMarkdown(chrome)).toBe(false);
    expect(prefersMarkdown("text/html")).toBe(false);
    expect(prefersMarkdown("*/*")).toBe(false);
    expect(prefersMarkdown(null)).toBe(false);
    expect(prefersMarkdown("")).toBe(false);
  });

  it("honors q-values when both types are listed", () => {
    expect(prefersMarkdown("text/html;q=0.9, text/markdown;q=0.8")).toBe(false);
    expect(prefersMarkdown("text/html;q=0.8, text/markdown;q=0.9")).toBe(true);
    expect(prefersMarkdown("text/markdown;q=0, text/html")).toBe(false);
    // A tie goes to markdown: the client bothered to name it.
    expect(prefersMarkdown("text/html;q=0.9, text/markdown;q=0.9")).toBe(true);
  });
});

describe("hasMarkdownRendering", () => {
  it("covers the public pages built from shared constants", () => {
    expect(hasMarkdownRendering("/")).toBe(true);
    expect(hasMarkdownRendering("/free-tools")).toBe(true);
    expect(hasMarkdownRendering("/blog")).toBe(true);
    expect(hasMarkdownRendering("/blog/how-to-track-job-applications")).toBe(true);
  });

  it("excludes private surfaces and nested paths", () => {
    expect(hasMarkdownRendering("/dashboard")).toBe(false);
    expect(hasMarkdownRendering("/login")).toBe(false);
    expect(hasMarkdownRendering("/blog/")).toBe(false);
    expect(hasMarkdownRendering("/blog/a/b")).toBe(false);
    expect(hasMarkdownRendering("/api/health")).toBe(false);
  });
});
