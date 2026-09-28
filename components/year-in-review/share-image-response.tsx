import { ImageResponse } from "next/og";
import { resolveSharePayload } from "@/lib/year-in-review/share-page";
import { SHARE_IMAGE_SIZES, ShareCard, type ShareCardLayout } from "./share-card";

/**
 * Renders a downloadable share image. The otter is fetched from the request's
 * own origin, so previews render with their own assets.
 */
export function shareImageResponse(request: Request, token: string, layout: Exclude<ShareCardLayout, "landscape">) {
  const payload = resolveSharePayload(token);
  if (!payload) return new Response("Not Found", { status: 404 });

  return new ImageResponse(<ShareCard payload={payload} origin={new URL(request.url).origin} layout={layout} />, {
    ...SHARE_IMAGE_SIZES[layout],
    headers: {
      // The token is the content: the same token always renders the same image.
      "Cache-Control": "public, max-age=31536000, immutable",
      "Content-Disposition": `inline; filename="year-in-review-${payload.y}-${layout}.png"`,
    },
  });
}
