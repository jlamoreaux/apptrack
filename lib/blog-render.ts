import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeSanitize from "rehype-sanitize";
import rehypeStringify from "rehype-stringify";

/**
 * Markdown-to-HTML rendering for blog post bodies.
 *
 * Split out of lib/blog.ts so that reading post metadata — which the sitemap,
 * llms.txt, and the agent markdown renderings all do — doesn't pull in the
 * ESM-only remark/rehype chain along with it.
 */

const markdownProcessor = unified()
  .use(remarkParse)
  .use(remarkRehype)
  .use(rehypeSanitize)
  .use(rehypeStringify);

export async function renderMarkdown(source: string): Promise<string> {
  const result = await markdownProcessor.process(source);
  return String(result);
}
