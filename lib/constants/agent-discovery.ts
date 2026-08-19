/**
 * Routing contract for the agent-facing markdown renderings, shared by
 * middleware (which rewrites), the negotiation helpers, and the page renderer.
 *
 * Kept free of Node built-ins: middleware runs in the edge runtime and reaches
 * these constants, so nothing here may pull in the filesystem-backed renderers.
 */

/** Internal route the middleware rewrites a markdown request to. */
export const MARKDOWN_REWRITE_PATH = "/api/markdown";

/** Query parameter carrying the original pathname across that rewrite. */
export const MARKDOWN_PATH_PARAM = "path";

/** Paths with a markdown rendering that is not derived from a blog slug. */
export const STATIC_MARKDOWN_PATHS = ["/", "/free-tools", "/blog"] as const;

export const BLOG_PATH_PREFIX = "/blog/";
