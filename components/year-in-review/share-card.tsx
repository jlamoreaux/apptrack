import { LABELS, UNLABELED } from "@/lib/year-in-review/labels";
import type { SharePayload } from "@/lib/year-in-review/share-token";

// Rendered by next/og (Satori), which supports only flexbox and inline styles.
// Every element with children needs display: flex.

export type ShareCardLayout = "story" | "square" | "landscape";

export const SHARE_IMAGE_SIZES: Record<ShareCardLayout, { width: number; height: number }> = {
  /** Instagram and LinkedIn stories. */
  story: { width: 1080, height: 1920 },
  /** Instagram and LinkedIn feed posts. */
  square: { width: 1080, height: 1080 },
  /** Link previews (Open Graph). */
  landscape: { width: 1200, height: 630 },
};

export const STORY_SIZE = SHARE_IMAGE_SIZES.story;

interface Scale {
  header: number;
  name: number;
  description: number;
  descriptionWidth: number;
  value: number;
  unit: number;
  outcome: number;
  footer: number;
  gap: number;
  /** Space between the stat columns. */
  statGap: number;
}

const SCALES: Record<ShareCardLayout, Scale> = {
  story: { header: 44, name: 104, description: 38, descriptionWidth: 900, value: 88, unit: 32, outcome: 44, footer: 30, gap: 48, statGap: 56 },
  square: { header: 34, name: 72, description: 30, descriptionWidth: 430, value: 64, unit: 24, outcome: 34, footer: 24, gap: 36, statGap: 28 },
  landscape: { header: 28, name: 60, description: 24, descriptionWidth: 620, value: 52, unit: 20, outcome: 26, footer: 18, gap: 28, statGap: 36 },
};

interface ShareCardProps {
  payload: SharePayload;
  origin: string;
  layout: ShareCardLayout;
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
  const s = SCALES[layout];
  const rows = statRows(payload);

  const text = (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
      <div style={{ display: "flex", fontSize: s.header, color: ink, opacity: 0.75 }}>
        {`My ${payload.y} job search`}
      </div>
      {/* Same heading as the share page when there is no label. */}
      <div style={{ display: "flex", fontSize: s.name, fontWeight: 800, color: ink, lineHeight: 1.05, marginTop: 12 }}>
        {label?.name ?? "A year of showing up"}
      </div>
      {label && (
        <div style={{ display: "flex", fontSize: s.description, color: ink, marginTop: 16, lineHeight: 1.35, maxWidth: s.descriptionWidth }}>
          {label.description}
        </div>
      )}
      <div style={{ display: "flex", marginTop: s.gap }}>
        {rows.map(([value, unit]) => (
          <div key={unit} style={{ display: "flex", flexDirection: "column", marginRight: s.statGap }}>
            <div style={{ display: "flex", fontSize: s.value, fontWeight: 800, color: ink }}>{value}</div>
            <div style={{ display: "flex", fontSize: s.unit, color: ink, opacity: 0.75 }}>{unit}</div>
          </div>
        ))}
      </div>
      {payload.hc && (
        <div style={{ display: "flex", fontSize: s.outcome, fontWeight: 700, color: ink, marginTop: s.gap - 8 }}>
          {`Landed at ${payload.hc}`}
        </div>
      )}
      <div style={{ display: "flex", fontSize: s.footer, color: ink, opacity: 0.75, marginTop: s.gap }}>
        careerotter.io
      </div>
    </div>
  );

  if (layout === "story") {
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

  // Square and landscape put the otter beside the text. Image boxes keep the
  // illustrations' 3:4 ratio so "cover" never crops them.
  const square = layout === "square";
  return (
    <div
      style={{ display: "flex", width: "100%", height: "100%", background: tint, padding: square ? 60 : 48, alignItems: "center" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img only */}
      <img
        src={image}
        alt=""
        width={square ? 480 : 400}
        height={square ? 640 : 534}
        style={{ objectFit: "cover", borderRadius: square ? 28 : 24, marginRight: square ? 56 : 48 }}
      />
      {text}
    </div>
  );
}
