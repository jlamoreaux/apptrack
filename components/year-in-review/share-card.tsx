import { LABELS, UNLABELED } from "@/lib/year-in-review/labels";
import type { SharePayload } from "@/lib/year-in-review/share-token";

// Rendered by next/og (Satori), which supports only flexbox and inline styles.
// Every element with children needs display: flex.

export const STORY_SIZE = { width: 1080, height: 1920 } as const;

interface ShareCardProps {
  payload: SharePayload;
  origin: string;
  layout: "story" | "landscape";
}

function statRows(payload: SharePayload): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    [payload.a.toLocaleString("en-US"), payload.a === 1 ? "application" : "applications"],
    [payload.c.toLocaleString("en-US"), payload.c === 1 ? "company" : "companies"],
  ];
  if (payload.i > 0) rows.push([payload.i.toLocaleString("en-US"), payload.i === 1 ? "interview" : "interviews"]);
  return rows;
}

export function ShareCard({ payload, origin, layout }: ShareCardProps) {
  const label = payload.l ? LABELS[payload.l] : null;
  const tint = label?.tint ?? UNLABELED.tint;
  const ink = label?.ink ?? UNLABELED.ink;
  const image = `${origin}${label?.image ?? UNLABELED.image}`;
  const story = layout === "story";
  const rows = statRows(payload);

  const text = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: story ? 44 : 28, color: ink, opacity: 0.75 }}>
        {`My ${payload.y} job search`}
      </div>
      {label && (
        <div style={{ display: "flex", fontSize: story ? 104 : 60, fontWeight: 800, color: ink, lineHeight: 1.05, marginTop: 12 }}>
          {label.name}
        </div>
      )}
      {label && (
        <div style={{ display: "flex", fontSize: story ? 38 : 24, color: ink, marginTop: 16, lineHeight: 1.35, maxWidth: story ? 900 : 620 }}>
          {label.description}
        </div>
      )}
      <div style={{ display: "flex", marginTop: story ? 48 : 28 }}>
        {rows.map(([value, unit]) => (
          <div key={unit} style={{ display: "flex", flexDirection: "column", marginRight: story ? 56 : 36 }}>
            <div style={{ display: "flex", fontSize: story ? 88 : 52, fontWeight: 800, color: ink }}>{value}</div>
            <div style={{ display: "flex", fontSize: story ? 32 : 20, color: ink, opacity: 0.75 }}>{unit}</div>
          </div>
        ))}
      </div>
      {payload.hc && (
        <div style={{ display: "flex", fontSize: story ? 44 : 26, fontWeight: 700, color: ink, marginTop: story ? 40 : 24 }}>
          {`Landed at ${payload.hc}`}
        </div>
      )}
      <div style={{ display: "flex", fontSize: story ? 30 : 18, color: ink, opacity: 0.75, marginTop: story ? 48 : 24 }}>
        careerotter.io
      </div>
    </div>
  );

  if (story) {
    return (
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: tint, padding: 72 }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only */}
        <img
          src={image}
          alt=""
          width={705}
          height={940}
          style={{ objectFit: "cover", borderRadius: 32, alignSelf: "center" }}
        />
        {text}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", background: tint, padding: 48, alignItems: "center" }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only */}
      <img src={image} alt="" width={400} height={534} style={{ objectFit: "cover", borderRadius: 24, marginRight: 48 }} />
      {text}
    </div>
  );
}
