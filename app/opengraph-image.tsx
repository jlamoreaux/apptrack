import { ImageResponse } from "next/og"
import { SITE_CONFIG } from "@/lib/constants/site-config"

export const runtime = "edge"

export const alt = "AppTrack - Smart Job Application Tracker"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(to bottom right, #1e40af, #3b82f6)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "40px",
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: "20px",
            padding: "60px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: "90%",
            height: "80%",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          }}
        >
          <h1
            style={{
              fontSize: "72px",
              fontWeight: "bold",
              background: "linear-gradient(to right, #1e40af, #3b82f6)",
              backgroundClip: "text",
              color: "transparent",
              marginBottom: "20px",
              textAlign: "center",
            }}
          >
            {SITE_CONFIG.name}
          </h1>
          <p
            style={{
              fontSize: "36px",
              color: "#1f2937",
              textAlign: "center",
              marginBottom: "40px",
              maxWidth: "800px",
            }}
          >
            {SITE_CONFIG.tagline}
          </p>
          <div
            style={{
              display: "flex",
              gap: "40px",
              marginTop: "20px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#10b981",
                }}
              />
              <span style={{ fontSize: "24px", color: "#6b7280" }}>
                AI-Powered Coaching
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#10b981",
                }}
              />
              <span style={{ fontSize: "24px", color: "#6b7280" }}>
                Track Applications
              </span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  background: "#10b981",
                }}
              />
              <span style={{ fontSize: "24px", color: "#6b7280" }}>
                Start Free
              </span>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}