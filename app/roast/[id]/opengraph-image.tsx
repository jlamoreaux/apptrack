import { ImageResponse } from "next/og";
import { createClient } from "@/lib/supabase/server";
import { OG_COLORS, OG_SIZE } from "@/components/og";

export const runtime = "edge";

export const alt = "Resume Roast Results";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { id } = await params;
  
  const { data: roast } = await supabase
    .from("roasts")
    .select("emoji_score, score_label, first_name, tagline")
    .eq("shareable_id", id)
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
            width: 100,
            height: 100,
            background: `linear-gradient(135deg, ${OG_COLORS.fire.yellow} 0%, ${OG_COLORS.fire.orange} 100%)`,
            borderRadius: "50% 0% 50% 0%",
            transform: "rotate(45deg)",
            opacity: 0.15,
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 40,
            width: 100,
            height: 100,
            background: `linear-gradient(135deg, ${OG_COLORS.fire.red} 0%, ${OG_COLORS.fire.purple} 100%)`,
            borderRadius: "50% 0% 50% 0%",
            transform: "rotate(45deg)",
            opacity: 0.15,
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
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative",
          }}
        >
          {/* Person's name if available */}
          {firstName && (
            <div
              style={{
                position: "absolute",
                top: 30,
                fontSize: 26,
                color: OG_COLORS.fire.orange,
                fontWeight: "600",
                display: "flex",
              }}
            >
              {firstName} just got roasted 🔥
            </div>
          )}
          
          {/* Emoji Score */}
          <div
            style={{
              fontSize: 160,
              fontWeight: "900",
              marginBottom: 20,
              display: "flex",
            }}
          >
            {emojiScore}
          </div>
          
          {/* Score Label */}
          <div
            style={{
              fontSize: 40,
              fontWeight: "700",
              color: OG_COLORS.fire.red,
              marginBottom: 20,
              display: "flex",
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
              display: "flex",
            }}
          >
            "{tagline}"
          </div>
          
          {/* Subtle domain */}
          <div
            style={{
              fontSize: 16,
              color: OG_COLORS.mutedLight,
              opacity: 0.7,
              display: "flex",
            }}
          >
            apptrack.ing
          </div>
        </div>
      </div>
    ),
    size
  );
}