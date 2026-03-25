import { getPostBySlug, getAllPosts, formatPostDate, renderMarkdown } from "@/lib/blog";
import { generatePageMetadata } from "@/lib/metadata";
import { NavigationStatic } from "@/components/navigation-static";
import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return generatePageMetadata(post.title, post.description, `/blog/${slug}`);
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  const html = await renderMarkdown(post.content);

  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <Link
          href="/blog"
          className="mb-8 inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to blog
        </Link>

        <article>
          <p className="text-sm text-muted-foreground mb-2">
            {post.author && `${post.author} · `}{formatPostDate(post.date)}
          </p>
          <h1 className="text-3xl font-bold mb-8 pb-8 border-b border-border">{post.title}</h1>

          <div
            className="prose prose-neutral dark:prose-invert max-w-none"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>
      </main>
    </div>
  );
}
