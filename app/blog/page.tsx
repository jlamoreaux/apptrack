import Link from "next/link";
import { getAllPosts } from "@/lib/blog";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Blog | AppTrack",
  description: "Job search tips, product updates, and advice from the team at AppTrack.",
};

export default function BlogPage() {
  const posts = getAllPosts();

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-16 max-w-2xl">
        <h1 className="text-3xl font-bold mb-2">Blog</h1>
        <p className="text-muted-foreground mb-12">
          Job search tips and advice from the team at AppTrack.
        </p>

        {posts.length === 0 ? (
          <p className="text-muted-foreground">No posts yet. Check back soon.</p>
        ) : (
          <div className="space-y-10">
            {posts.map((post) => (
              <article key={post.slug}>
                <p className="text-sm text-muted-foreground mb-1">
                  {new Date(post.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <h2 className="text-xl font-semibold mb-2">
                  <Link
                    href={`/blog/${post.slug}`}
                    className="hover:text-primary transition-colors"
                  >
                    {post.title}
                  </Link>
                </h2>
                <p className="text-muted-foreground">{post.description}</p>
                <Link
                  href={`/blog/${post.slug}`}
                  className="mt-2 inline-flex min-h-[44px] items-center text-sm text-primary hover:underline"
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
