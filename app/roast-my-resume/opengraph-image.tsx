import { ImageResponse } from "next/og";

export const runtime = "edge";

export const alt = "Resume Roast - Get Brutally Honest AI Feedback";
export const size = {
  width: 1200,
  height: 630,
};
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
        
        {/* Main card */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "white",
            borderRadius: 24,
            padding: "80px 100px",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
            position: "relative",
          }}
        >
          {/* NEW badge */}
          <div
            style={{
              position: "absolute",
              top: -30,
              right: 40,
              backgroundColor: "#10b981",
              color: "white",
              padding: "12px 24px",
              borderRadius: 100,
              fontSize: 20,
              fontWeight: "bold",
              textTransform: "uppercase",
              letterSpacing: 2,
            }}
          >
            NEW
          </div>
          
          {/* Main Title */}
          <div
            style={{
              fontSize: 72,
              fontWeight: "bold",
              marginBottom: 20,
              display: "flex",
              alignItems: "center",
              gap: 20,
            }}
          >
            {/* Flame Icon (SVG-like) */}
            <div
              style={{
                width: 60,
                height: 60,
                background: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
                borderRadius: "50% 0% 50% 0%",
                transform: "rotate(45deg)",
              }}
            />
            <span style={{
              background: "linear-gradient(135deg, #f97316 0%, #ef4444 50%, #9333ea 100%)",
              backgroundClip: "text",
              color: "transparent",
            }}>
              Resume Roast
            </span>
            {/* Flame Icon (SVG-like) */}
            <div
              style={{
                width: 60,
                height: 60,
                background: "linear-gradient(135deg, #ef4444 0%, #9333ea 100%)",
                borderRadius: "50% 0% 50% 0%",
                transform: "rotate(45deg)",
              }}
            />
          </div>
          
          {/* Subtitle */}
          <div
            style={{
              fontSize: 32,
              color: "#4b5563",
              marginBottom: 40,
              textAlign: "center",
            }}
          >
            Get Brutally Honest AI Feedback
          </div>
          
          {/* Icon representations */}
          <div
            style={{
              display: "flex",
              gap: 30,
              marginBottom: 40,
            }}
          >
            {/* Skull-like icon */}
            <div style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#374151",
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                top: 15,
                left: 12,
                width: 8,
                height: 8,
                background: "white",
                borderRadius: "50%",
              }} />
              <div style={{
                position: "absolute",
                top: 15,
                right: 12,
                width: 8,
                height: 8,
                background: "white",
                borderRadius: "50%",
              }} />
            </div>
            
            {/* Alert icon */}
            <div style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
              fontSize: 30,
              fontWeight: "bold",
            }}>
              !
            </div>
            
            {/* Frown icon */}
            <div style={{
              width: 50,
              height: 50,
              borderRadius: "50%",
              background: "#fbbf24",
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                bottom: 12,
                left: "50%",
                transform: "translateX(-50%)",
                width: 20,
                height: 10,
                borderBottom: "3px solid #374151",
                borderRadius: "0 0 20px 20px",
              }} />
            </div>
            
            {/* Fire icon */}
            <div style={{
              width: 50,
              height: 50,
              background: "linear-gradient(135deg, #f97316 0%, #ef4444 100%)",
              borderRadius: "50% 0% 50% 0%",
              transform: "rotate(45deg)",
            }} />
            
            {/* Trash icon */}
            <div style={{
              width: 50,
              height: 50,
              borderRadius: 8,
              background: "#6b7280",
              position: "relative",
            }}>
              <div style={{
                position: "absolute",
                top: -5,
                left: 10,
                right: 10,
                height: 10,
                background: "#6b7280",
                borderRadius: 4,
              }} />
            </div>
          </div>
          
          {/* Feature text */}
          <div
            style={{
              fontSize: 24,
              color: "#6b7280",
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            Upload your resume • Get roasted • Share the laughs
          </div>
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