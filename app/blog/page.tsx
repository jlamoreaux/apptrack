import Link from "next/link";
import { getAllPosts, formatPostDate } from "@/lib/blog";
import { generatePageMetadata } from "@/lib/metadata";
import { NavigationStatic } from "@/components/navigation-static";

const BLOG_DESCRIPTION = "Job search tips, product updates, and advice from the team at AppTrack.";

export const metadata = generatePageMetadata("Blog", BLOG_DESCRIPTION, "/blog");

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Blog</h1>
        <p className="text-muted-foreground mb-12">
          Job search tips and advice from the team at AppTrack.
        </p>

        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-8">
            {posts.map((post) => (
              <article key={post.slug} className="rounded-lg border border-border p-6 transition-colors hover:border-primary/50">
                <p className="text-sm text-muted-foreground mb-1">
                  {formatPostDate(post.date)}
                </p>
                <h2 className="text-xl font-semibold mb-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground mb-4">{post.description}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="inline-flex min-h-[44px] items-center text-sm font-medium text-primary hover:underline"
                >
                  Read more
                </Link>
              </article>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
