import {
  BLOG_PATH_PREFIX,
  STATIC_MARKDOWN_PATHS,
} from "@/lib/constants/agent-discovery";

/**
 * Accept-header negotiation for markdown responses. The paths and route names
 * themselves live in lib/constants/agent-discovery.
 *
 * Kept free of Node built-ins on purpose: middleware runs in the edge runtime
 * and imports this module, so it must not reach the filesystem-backed page
 * renderers in markdown-pages.ts.
 */

interface AcceptEntry {
  type: string;
  quality: number;
}

function parseAccept(header: string): AcceptEntry[] {
  return header
    .split(",")
    .map((part) => {
      const [rawType, ...params] = part.split(";");
      const type = rawType.trim().toLowerCase();
      if (!type) return null;

      const qParam = params
        .map((p) => p.trim())
        .find((p) => p.toLowerCase().startsWith("q="));
      const quality = qParam ? Number.parseFloat(qParam.slice(2)) : 1;

      return { type, quality: Number.isFinite(quality) ? quality : 1 };
    })
    .filter((entry): entry is AcceptEntry => entry !== null);
}

/**
 * True when the client asked for markdown at least as strongly as HTML.
 *
 * Browsers send `text/html,...` with no markdown entry and are unaffected. A
 * bare `Accept: *​/*` also stays on HTML — a wildcard is not a request for
 * markdown, and treating it as one would flip every default client over.
 */
export function prefersMarkdown(acceptHeader: string | null): boolean {
  if (!acceptHeader) return false;

  const entries = parseAccept(acceptHeader);
  const markdown = entries.find((entry) => entry.type === "text/markdown");
  if (!markdown || markdown.quality <= 0) return false;

  const html = entries.find((entry) => entry.type === "text/html");
  if (html && html.quality > markdown.quality) return false;

  return true;
}

/**
 * True when `pathname` *might* have a markdown rendering. Middleware can't
 * confirm a blog slug exists without filesystem access, so this is deliberately
 * permissive; renderMarkdownPage is the authority and 404s on a miss.
 */
export function hasMarkdownRendering(pathname: string): boolean {
  if ((STATIC_MARKDOWN_PATHS as readonly string[]).includes(pathname)) return true;
  if (!pathname.startsWith(BLOG_PATH_PREFIX)) return false;

  const slug = pathname.slice(BLOG_PATH_PREFIX.length);
  return slug.length > 0 && !slug.includes("/");
}

export function blogSlugFromPath(pathname: string): string | null {
  if (!pathname.startsWith(BLOG_PATH_PREFIX)) return null;

  const slug = pathname.slice(BLOG_PATH_PREFIX.length);
  return slug.length > 0 && !slug.includes("/") ? slug : null;
}
