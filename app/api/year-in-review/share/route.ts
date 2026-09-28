import { NextRequest, NextResponse, after } from "next/server";
import { z } from "zod";
import { getUser } from "@/lib/supabase/server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { getAppUrl } from "@/lib/constants/site-config";
import { isYearInReviewEnabled } from "@/lib/year-in-review/gate";
import { loadYearInReview } from "@/lib/year-in-review/load";
import { isReviewableYear } from "@/lib/year-in-review/years";
import { buildShareCaption } from "@/lib/year-in-review/caption";
import { buildSharePayload, encodeShareToken, getShareSecret } from "@/lib/year-in-review/share-token";

const ShareRequestSchema = z.object({
  year: z.number().int(),
  includeOutcome: z.boolean().default(false),
});

/**
 * Mints a public share link. Stats are recomputed here rather than accepted
 * from the client, so a link can only ever carry the owner's real numbers.
 */
export async function POST(request: NextRequest) {
  if (!isYearInReviewEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const secret = getShareSecret();
  if (!secret) {
    loggerService.error("Year in review share secret is not configured", undefined, {
      category: LogCategory.API,
      userId: user.id,
      action: "year_in_review_share_unconfigured",
    });
    return NextResponse.json({ error: "Sharing is not available right now" }, { status: 503 });
  }

  let body: z.infer<typeof ShareRequestSchema>;
  try {
    body = ShareRequestSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  if (!isReviewableYear(body.year, new Date())) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  try {
    const stats = await loadYearInReview(user.id, body.year);
    if (stats.volume.applications === 0) {
      return NextResponse.json({ error: "Nothing to share for this year" }, { status: 400 });
    }

    const payload = buildSharePayload(stats, { includeOutcome: body.includeOutcome });
    const token = encodeShareToken(payload, secret);
    const url = `${getAppUrl()}/year-in-review/${token}`;

    after(() =>
      captureServerEvent(user.id, "year_in_review_shared", {
        year: body.year,
        label: stats.label,
        include_outcome: body.includeOutcome,
      })
    );

    return NextResponse.json({
      url,
      storyImageUrl: `${url}/story`,
      squareImageUrl: `${url}/square`,
      caption: buildShareCaption(payload),
    });
  } catch (error) {
    loggerService.error("Failed to create year in review share link", error, {
      category: LogCategory.API,
      userId: user.id,
      action: "year_in_review_share_error",
      metadata: { year: body.year },
    });
    return NextResponse.json({ error: "Failed to create share link" }, { status: 500 });
  }
}
