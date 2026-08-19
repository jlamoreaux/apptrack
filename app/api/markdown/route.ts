import { NextRequest } from "next/server";
import {
  estimateTokens,
  renderMarkdownPage,
} from "@/lib/agent-discovery/markdown-pages";

/**
 * Markdown rendering of a public page, reached only via the internal rewrite in
 * middleware.ts when a request carries `Accept: text/markdown`. The `path`
 * query parameter is the original pathname.
 *
 * Falls back to a 404 rather than HTML: middleware only rewrites paths that
 * claim a markdown rendering, so reaching here without one means the path was
 * hand-crafted (or a blog slug that doesn't exist).
 */
export function GET(request: NextRequest): Response {
  const pathname = request.nextUrl.searchParams.get("path") ?? "/";
  const markdown = renderMarkdownPage(pathname);

  if (markdown === null) {
    return new Response("Not Found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      // The same URL serves HTML or markdown depending on Accept, so caches
      // must key on it.
      Vary: "Accept",
      "x-markdown-tokens": String(estimateTokens(markdown)),
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
