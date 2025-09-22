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
    .select("score, score_label, first_name")
    .eq("shareable_id", params.id)
    .single();

  const score = roast?.score || 5;
  const label = roast?.score_label || "Room for Improvement";
  const firstName = roast?.first_name;

  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 128,
          background: "linear-gradient(to bottom right, #fed7aa, #fecaca)",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 20 }}>🔥 RESUME ROASTED 🔥</div>
        <div
          style={{
            fontSize: 120,
            fontWeight: "bold",
            background: "linear-gradient(to right, #f97316, #ef4444)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          {score}/10
        </div>
        <div style={{ fontSize: 48, marginTop: 20 }}>{label}</div>
        {firstName && (
          <div style={{ fontSize: 32, marginTop: 20, opacity: 0.8 }}>
            {firstName}'s Resume Got Roasted
          </div>
        )}
        <div style={{ fontSize: 24, marginTop: 40, opacity: 0.6 }}>
          AppTrack - Get Your Resume Roasted
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}