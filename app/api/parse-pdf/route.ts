import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";
import { createClient } from "@/lib/supabase/server";
import { RateLimitService } from "@/lib/services/rate-limit.service";
import { getUserSubscriptionTier } from "@/lib/middleware/rate-limit.middleware";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let userId: string | undefined;

  try {
    // Authentication check
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      loggerService.warn("Unauthorized PDF parse request", {
        category: LogCategory.SECURITY,
        action: "pdf_parse_unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    userId = user.id;

    // Rate limiting
    const subscriptionTier = await getUserSubscriptionTier(user.id);
    const rateLimitService = RateLimitService.getInstance();
    const rateLimitResult = await rateLimitService.checkLimit(
      user.id,
      "pdf_parse",
      subscriptionTier
    );

    if (!rateLimitResult.allowed) {
      loggerService.warn("Rate limit exceeded for PDF parse", {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: "pdf_parse_rate_limit_exceeded",
      });
      return NextResponse.json(
        {
          error: "Rate limit exceeded",
          message: "Too many PDF parsing requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return NextResponse.json({ error: "File must be a PDF" }, { status: 400 });
    }

    // Validate file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File size must be less than 5MB" }, { status: 400 });
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text from PDF
    const data = await pdf(buffer);

    // Track usage
    rateLimitService.trackUsage(user.id, "pdf_parse", true).catch((err) => {
      loggerService.error("Failed to track PDF parse usage", err, {
        category: LogCategory.PERFORMANCE,
        userId: user.id,
      });
    });

    loggerService.info("PDF parsed successfully", {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "pdf_parse_success",
      duration: Date.now() - startTime,
      metadata: {
        fileSize: file.size,
        textLength: data.text.length,
      },
    });

    return NextResponse.json({ text: data.text });
  } catch (error) {
    loggerService.error("Error parsing PDF", error, {
      category: LogCategory.API,
      userId,
      action: "pdf_parse_error",
      duration: Date.now() - startTime,
    });

    return NextResponse.json(
      { error: "Failed to parse PDF. Please ensure the file is a valid PDF." },
      { status: 500 }
    );
  }
}
