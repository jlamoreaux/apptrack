import { shareImageResponse } from "@/components/year-in-review/share-image-response";

/** 1080x1920 image for Instagram and LinkedIn stories. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return shareImageResponse(request, token, "story");
}
