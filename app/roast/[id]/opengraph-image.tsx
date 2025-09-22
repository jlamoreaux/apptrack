import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export const alt = "Resume Roast Results";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const supabase = await createClient();
  
  const { data: roast } = await supabase
    .from("roasts")
    .select("emoji_score, score_label, first_name, tagline")
    .eq("shareable_id", params.id)
    .single();

  const emojiScore = roast?.emoji_score || "💀/10";
  const label = roast?.score_label || "Resume Crime Scene";
  const firstName = roast?.first_name;
  const tagline = roast?.tagline || "Your resume just got absolutely demolished";

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
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          position: "relative",
        }}
      >
        {/* Background pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: "repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(255,255,255,.05) 35px, rgba(255,255,255,.05) 70px)",
            opacity: 0.4,
          }}
        />
        
        {/* Main content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            borderRadius: 24,
            padding: "60px 80px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative",
          }}
        >
          {/* Top badge */}
          <div
            style={{
              position: "absolute",
              top: -30,
              backgroundColor: "#10b981",
              color: "white",
              padding: "12px 24px",
              borderRadius: 100,
              fontSize: 24,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            Resume Roasted
          </div>
          
          {/* Emoji Score */}
          <div
            style={{
              fontSize: 140,
              fontWeight: "bold",
              marginTop: 20,
              marginBottom: 20,
            }}
          >
            {emojiScore}
          </div>
          
          {/* Score Label */}
          <div
            style={{
              fontSize: 36,
              fontWeight: "600",
              color: "#6b7280",
              marginBottom: 20,
            }}
          >
            {label}
          </div>
          
          {/* Tagline */}
          <div
            style={{
              fontSize: 24,
              color: "#374151",
              textAlign: "center",
              maxWidth: 800,
              lineHeight: 1.4,
              fontStyle: "italic",
              marginBottom: 30,
            }}
          >
            "{tagline}"
          </div>
          
          {/* Person's name if available */}
          {firstName && (
            <div
              style={{
                fontSize: 28,
                color: "#9333ea",
                fontWeight: "600",
              }}
            >
              {firstName} just got roasted 🔥
            </div>
          )}
        </div>
        
        {/* Bottom branding */}
        <div
          style={{
            position: "absolute",
            bottom: 30,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <div
            style={{
              backgroundColor: "white",
              padding: "8px 16px",
              borderRadius: 8,
              fontSize: 20,
              fontWeight: "600",
              color: "#6b7280",
            }}
          >
            AppTrack.fyi
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}