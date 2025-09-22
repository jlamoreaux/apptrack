import { ImageResponse } from "next/og"
import { SITE_CONFIG } from "@/lib/constants/site-config"
import { OG_COLORS, OG_SIZE } from "@/components/og"

export const runtime = "edge"
export const alt = "AppTrack - Smart Job Application Tracker"
export const size = OG_SIZE
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(to bottom, ${OG_COLORS.background}, #e8f0ff)`,
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: "20px",
              background: OG_COLORS.primary,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 48,
            }}
          >
            <svg
              width="60"
              height="60"
              viewBox="0 0 24 24"
              fill="white"
              style={{ display: 'flex' }}
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" stroke="white" strokeWidth="2" fill="none"/>
              <line x1="12" y1="11" x2="12" y2="17" stroke={OG_COLORS.primary} strokeWidth="2"/>
            </svg>
          </div>

          {/* Brand name */}
          <h1
            style={{
              fontSize: "90px",
              fontWeight: "900",
              color: OG_COLORS.foreground,
              marginBottom: "30px",
              letterSpacing: "-2px",
            }}
          >
            {SITE_CONFIG.name}
          </h1>

          {/* Tagline */}
          <p
            style={{
              fontSize: "32px",
              color: OG_COLORS.accent,
              fontWeight: "500",
              maxWidth: "700px",
            }}
          >
            {SITE_CONFIG.tagline}
          </p>
        </div>

        {/* Footer - subtle domain */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            fontSize: "18px",
            color: OG_COLORS.muted,
            opacity: 0.6,
          }}
        >
          apptrack.ing
        </div>
      </div>
    ),
    size
  )
}