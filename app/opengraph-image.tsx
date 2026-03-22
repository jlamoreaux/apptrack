import { ImageResponse } from "next/og"
import { OG_COLORS, OG_SIZE } from "@/components/og"

export const runtime = "edge"
export const alt = "AppTrack - Smart Job Application Tracker"
export const size = OG_SIZE
export const contentType = "image/png"

/**
 * Option A: "Headline Hero"
 * Small logo top-left, big bold headline centered, domain bottom-right.
 * Matches patterns from Linear, Vercel, Raycast.
 */
export default async function Image() {
  const logoData = await fetch(
    new URL("/public/logo_square.png", import.meta.url)
  ).then((res) => res.arrayBuffer())

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
            src={logoData as unknown as string}
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
            apptrack.ing
          </span>
        </div>
      </div>
    ),
    size
  )
}
