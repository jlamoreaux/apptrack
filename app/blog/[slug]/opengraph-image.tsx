import { ImageResponse } from "next/og"
import { OG_COLORS, OG_SIZE } from "@/components/og"
import { getPostBySlug, getAllPosts } from "@/lib/blog"
// Inlined at build time by scripts/build/gen-content.mjs. This was a module-scope
// readFileSync of public/logo_square.png, which forced `runtime = "nodejs"` and cannot
// work on Cloudflare Workers, where there is no filesystem and the bundle does not ship
// the public directory.
import { LOGO_SQUARE_DATA_URI } from "@/lib/content/generated"
export const alt = "CareerOtter Blog"
export const size = OG_SIZE
export const contentType = "image/png"

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  const title = post?.title ?? "CareerOtter Blog"

  return new ImageResponse(
    (
      <div
        style={{
          background: OG_COLORS.background,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "60px 80px",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={LOGO_SQUARE_DATA_URI}
            width={44}
            height={44}
            alt=""
          />
          <span
            style={{
              fontSize: 28,
              fontWeight: "800",
              color: OG_COLORS.foreground,
              letterSpacing: "-0.5px",
            }}
          >
            CareerOtter
          </span>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: 24,
          }}
        >
          <p
            style={{
              fontSize: 22,
              fontWeight: "600",
              color: OG_COLORS.primary,
              margin: 0,
              textTransform: "uppercase",
              letterSpacing: "1px",
            }}
          >
            Blog
          </p>
          <h1
            style={{
              fontSize: 64,
              fontWeight: "900",
              color: OG_COLORS.foreground,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: "90%",
              margin: 0,
            }}
          >
            {title}
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <span
            style={{
              fontSize: 20,
              color: OG_COLORS.mutedLight,
              fontWeight: "500",
            }}
          >
            careerotter.io
          </span>
        </div>
      </div>
    ),
    size
  )
}
