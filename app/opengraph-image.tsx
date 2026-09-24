import { ImageResponse } from "next/og"
import { OG_COLORS, OG_SIZE } from "@/components/og"
// Inlined at build time by scripts/build/gen-content.mjs, matching
// app/blog/[slug]/opengraph-image.tsx. Replaces a fetch() of a file:// URL, which only
// worked because the edge runtime polyfilled it — and which fails under static
// prerendering on the nodejs runtime. Workers has no filesystem either way.
import { LOGO_SQUARE_DATA_URI } from "@/lib/content/generated"

// No `runtime` declaration. Next 16 deprecates the edge runtime, and the Cloudflare Workers
// target this app is migrating to has no edge/node split at all — vinext ignores route
// segment `runtime` entirely. Omitting it uses the default (nodejs), which is where this
// ends up regardless.
export const alt = "CareerOtter - Smart Job Application Tracker"
export const size = OG_SIZE
export const contentType = "image/png"

/**
 * Option A: "Headline Hero"
 * Small logo top-left, big bold headline centered, domain bottom-right.
 * Matches patterns from Linear, Vercel, Raycast.
 */
export default async function Image() {
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
        {/* Top bar: logo + brand name */}
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

        {/* Center: headline */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
            gap: 24,
          }}
        >
          <h1
            style={{
              fontSize: 72,
              fontWeight: "900",
              color: OG_COLORS.foreground,
              lineHeight: 1.05,
              letterSpacing: "-2px",
              maxWidth: "85%",
              margin: 0,
            }}
          >
            See exactly where your job search wins and loses
          </h1>
          <p
            style={{
              fontSize: 28,
              color: OG_COLORS.muted,
              fontWeight: "500",
              margin: 0,
              maxWidth: "70%",
            }}
          >
            Track applications, visualize your pipeline, and get AI career coaching.
          </p>
        </div>

        {/* Bottom-right: domain */}
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
