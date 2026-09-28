import { ImageResponse } from "next/og";
import { OG_SIZE } from "@/components/og";
import { ShareCard } from "@/components/year-in-review/share-card";
import { getAppUrl } from "@/lib/constants/site-config";
import { resolveSharePayload } from "@/lib/year-in-review/share-page";

// No `runtime` declaration: see app/(marketing)/roast/[id]/opengraph-image.tsx.

export const alt = "A year of job searching, in review";
export const size = OG_SIZE;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = resolveSharePayload(token);
  if (!payload) return new Response("Not Found", { status: 404 });

  return new ImageResponse(<ShareCard payload={payload} origin={getAppUrl()} layout="landscape" />, size);
}
