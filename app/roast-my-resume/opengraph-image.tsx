import { ImageResponse } from "next/og";
import { OG_COLORS, OG_SIZE } from "@/components/og";

export const runtime = "edge";
export const alt = "Resume Roast - Get Brutally Honest AI Feedback";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: `linear-gradient(135deg, ${OG_COLORS.fire.orange} 0%, ${OG_COLORS.fire.red} 50%, ${OG_COLORS.fire.purple} 100%)`,
          position: "relative",
        }}
      >
        {/* Flame decorations */}
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 40,
            width: 120,
            height: 120,
            background: `linear-gradient(135deg, ${OG_COLORS.fire.yellow} 0%, ${OG_COLORS.fire.orange} 100%)`,
            borderRadius: "50% 0% 50% 0%",
            transform: "rotate(45deg)",
            opacity: 0.2,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 40,
            width: 120,
            height: 120,
            background: `linear-gradient(135deg, ${OG_COLORS.fire.red} 0%, ${OG_COLORS.fire.purple} 100%)`,
            borderRadius: "50% 0% 50% 0%",
            transform: "rotate(45deg)",
            opacity: 0.2,
          }}
        />
        
        {/* Main card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            borderRadius: 24,
            padding: "60px 80px",
            boxShadow: "0 30px 60px -15px rgba(0, 0, 0, 0.3)",
            position: "relative",
            maxWidth: "90%",
          }}
        >
          {/* Main Title with Flame Icons */}
          <div
            style={{
              fontSize: 80,
              fontWeight: "900",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 30,
            }}
          >
            <svg
              width="70"
              height="70"
              viewBox="0 0 24 24"
              fill={OG_COLORS.fire.orange}
              style={{ display: 'flex' }}
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
            <div style={{
              background: `linear-gradient(135deg, ${OG_COLORS.fire.orange} 0%, ${OG_COLORS.fire.red} 50%, ${OG_COLORS.fire.purple} 100%)`,
              backgroundClip: "text",
              color: "transparent",
              display: "flex",
              flexDirection: "column",
              lineHeight: 0.9,
            }}>
              <span>Resume</span>
              <span>Roast</span>
            </div>
            <svg
              width="70"
              height="70"
              viewBox="0 0 24 24"
              fill={OG_COLORS.fire.red}
              style={{ display: 'flex' }}
            >
              <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" />
            </svg>
          </div>
          
          {/* Subtitle */}
          <div
            style={{
              fontSize: 28,
              color: OG_COLORS.muted,
              marginBottom: 35,
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            Get Brutally Honest AI Feedback
          </div>
          
          {/* Score emojis */}
          <div
            style={{
              display: "flex",
              gap: 35,
              marginBottom: 35,
              fontSize: 50,
            }}
          >
            <span>💀</span>
            <span>🤢</span>
            <span>😬</span>
            <span>🔥</span>
            <span>🗑️</span>
          </div>
          
          {/* Feature text */}
          <div
            style={{
              fontSize: 22,
              color: OG_COLORS.mutedLight,
              textAlign: "center",
              fontWeight: "500",
            }}
          >
            Upload your resume • Get roasted • Share the laughs
          </div>
        </div>
        
        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span
            style={{
              color: "white",
              fontSize: "16px",
              opacity: 0.8,
            }}
          >
            apptrack.ing
          </span>
        </div>
      </div>
    ),
    size
  );
}