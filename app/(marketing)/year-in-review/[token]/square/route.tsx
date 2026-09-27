import { shareImageResponse } from "@/components/year-in-review/share-image-response";

/** 1080x1080 image for Instagram and LinkedIn feed posts. */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return shareImageResponse(request, token, "square");
}
