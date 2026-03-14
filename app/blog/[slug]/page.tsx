import { getPostBySlug, getAllPosts } from "@/lib/blog";
import { MDXRemote } from "next-mdx-remote/rsc";
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

  return {
    title: `${post.title} | AppTrack`,
    description: post.description,
    alternates: {
      canonical: `https://www.apptrack.ing/blog/${slug}`,
    },
  };
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) notFound();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <Link
          href="/blog"
          className="mb-8 inline-flex min-h-[44px] items-center text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to blog
        </Link>

        <article>
          <p className="text-sm text-muted-foreground mb-2">
            {(() => {
              const parsed = Date.parse(post.date);
              return Number.isNaN(parsed)
                ? post.date
                : new Date(parsed).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
            })()}
          </p>
          <h1 className="text-3xl font-bold mb-8">{post.title}</h1>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <MDXRemote source={post.content} />
          </div>
        </article>
      </main>
    </div>
  );
}
