import { ImageResponse } from "next/og";
import { ShareCard, STORY_SIZE } from "@/components/year-in-review/share-card";
import { resolveSharePayload } from "@/lib/year-in-review/share-page";

/**
 * 1080x1920 image for Instagram and LinkedIn stories. The otter is fetched from
 * this deployment's own origin, so previews render with their own assets.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const payload = resolveSharePayload(token);
  if (!payload) return new Response("Not Found", { status: 404 });

  return new ImageResponse(<ShareCard payload={payload} origin={new URL(request.url).origin} layout="story" />, {
    ...STORY_SIZE,
    headers: {
      // The token is the content: the same token always renders the same image.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="year-in-review-${payload.y}.png"`,
    },
  });
}
