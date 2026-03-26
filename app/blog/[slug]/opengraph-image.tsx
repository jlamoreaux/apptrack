import { ImageResponse } from "next/og"
import { readFileSync } from "fs"
import { join } from "path"
import { OG_COLORS, OG_SIZE } from "@/components/og"
import { getPostBySlug, getAllPosts } from "@/lib/blog"

export const runtime = "nodejs"
export const alt = "AppTrack Blog"
export const size = OG_SIZE
export const contentType = "image/png"

const logoPath = join(process.cwd(), "public/logo_square.png")
const logoBase64 = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`

export async function generateStaticParams() {
  const posts = getAllPosts()
  return posts.map((post) => ({ slug: post.slug }))
}

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)

  const title = post?.title ?? "AppTrack Blog"

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
            src={logoBase64}
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
            AppTrack
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
            apptrack.ing
          </span>
        </div>
      </div>
    ),
    size
  )
}
