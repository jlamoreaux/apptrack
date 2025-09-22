import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromResume, filterPII } from "@/lib/roast/resume-parser";
import { generateRoast } from "@/lib/roast/roast-generator";
import { cookies, headers } from "next/headers";
import * as crypto from "crypto";
import { checkRoastRateLimit } from "@/lib/roast/rate-limiter";
import { 
  RoastError, 
  RateLimitError, 
  FileValidationError, 
  AuthorizationError, 
  ProcessingError,
  handleRoastError 
} from "@/lib/roast/errors";
import { ROAST_CONSTANTS, ROAST_ERRORS } from "@/lib/constants/roast";

export const runtime = "nodejs";
export const maxDuration = 30; // 30 seconds timeout

// Helper to generate browser fingerprint
async function generateBrowserFingerprint(req: NextRequest): Promise<string> {
  const headersList = await headers();
  const userAgent = headersList.get("user-agent") || "";
  const acceptLanguage = headersList.get("accept-language") || "";
  const acceptEncoding = headersList.get("accept-encoding") || "";
  
  const fingerprint = `${userAgent}-${acceptLanguage}-${acceptEncoding}`;
  return crypto.createHash("sha256").update(fingerprint).digest("hex");
}

// Helper to hash IP address for privacy
function hashIP(ip: string): string {
  return crypto.createHash("sha256").update(ip + process.env.IP_SALT || "default-salt").digest("hex");
}

export async function POST(req: NextRequest) {
  try {
    // Check if maintenance mode or feature flag
    if (process.env.ROAST_DISABLED === "true") {
      throw new RoastError("Resume roasting is temporarily unavailable", "SERVICE_UNAVAILABLE", 503);
    }
    
    const supabase = await createClient();
    
    // Get IP and browser fingerprint for rate limiting
    const headersList = await headers();
    const ip = headersList.get("x-forwarded-for") || headersList.get("x-real-ip") || "unknown";
    const ipHash = hashIP(ip);
    const browserFingerprint = await generateBrowserFingerprint(req);
    
    // Check for existing roast from this browser/IP in last 30 days (usage limiting)
    const { data: existingRoast } = await supabase
      .from("roasts")
      .select("id")
      .or(`ip_hash.eq.${ipHash},browser_fingerprint.eq.${browserFingerprint}`)
      .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    
    // Check if user is authenticated
    const { data: { user } } = await supabase.auth.getUser();
    
    // If not authenticated and already used free roast, return error
    if (!user && existingRoast && existingRoast.length > 0) {
      throw new AuthorizationError(ROAST_ERRORS.ALREADY_USED, true);
    }
    
    // Check rate limiting for authenticated users
    if (user) {
      const rateLimit = await checkRoastRateLimit(user.id);
      if (!rateLimit.allowed) {
        throw new RateLimitError(
          `Rate limit exceeded. You can roast ${rateLimit.limit} resumes per ${rateLimit.limit === 3 ? "hour" : "day"}. Try again later.`,
          rateLimit.resetAt,
          rateLimit.remaining
        );
      }
    }
    
    // Parse the form data
    const formData = await req.formData();
    const file = formData.get("resume") as File;
    
    if (!file) {
      throw new FileValidationError("No file provided");
    }
    
    // Validate file type
    if (!ROAST_CONSTANTS.SUPPORTED_FILE_TYPES.includes(file.type)) {
      // Check file extension as fallback
      const extension = file.name.split('.').pop()?.toLowerCase();
      if (!extension || !ROAST_CONSTANTS.SUPPORTED_EXTENSIONS.includes(extension)) {
        throw new FileValidationError(
          ROAST_ERRORS.INVALID_FILE_TYPE,
          { providedType: file.type, fileName: file.name }
        );
      }
    }
    
    // Validate file size
    if (file.size > ROAST_CONSTANTS.MAX_FILE_SIZE) {
      throw new FileValidationError(
        ROAST_ERRORS.FILE_TOO_LARGE,
        { size: file.size, maxSize: ROAST_CONSTANTS.MAX_FILE_SIZE }
      );
    }
    
    // Extract text from resume with error handling
    let rawText: string;
    let firstName: string | null;
    
    try {
      const result = await extractTextFromResume(file);
      rawText = result.text;
      firstName = result.firstName;
    } catch (error) {
      console.error("Failed to extract text from resume:", error);
      throw new ProcessingError(
        "Failed to read your resume. Please ensure it's a valid PDF or Word document.",
        { originalError: error instanceof Error ? error.message : "Unknown error" }
      );
    }
    
    if (!rawText || rawText.length < 100) {
      throw new FileValidationError(
        "Could not extract enough text from the resume. Please ensure it contains readable text.",
        { extractedLength: rawText?.length || 0 }
      );
    }
    
    // Filter PII from the text
    const filteredText = filterPII(rawText, firstName);
    
    // Generate the roast with error handling
    let roast;
    try {
      roast = await generateRoast(filteredText, firstName);
    } catch (error) {
      console.error("Failed to generate roast:", error);
      throw new ProcessingError(
        "Our AI roaster is having a moment. Please try again in a few seconds.",
        { step: "generation" }
      );
    }
    
    // Save to database
    const { data: savedRoast, error: saveError } = await supabase
      .from("roasts")
      .insert({
        content: roast.content,
        emoji_score: roast.emojiScore,
        score_label: roast.scoreLabel,
        tagline: roast.tagline,
        first_name: firstName,
        roast_categories: roast.categories,
        ip_hash: ipHash,
        browser_fingerprint: browserFingerprint,
        user_id: user?.id || null,
        metadata: {
          fileType: file.type,
          fileSize: file.size,
          textLength: rawText.length,
        },
      })
      .select("shareable_id")
      .single();
    
    if (saveError) {
      console.error("Error saving roast:", saveError);
      throw new ProcessingError(
        "Failed to save your roast. Please try again.",
        { dbError: saveError.message }
      );
    }
    
    // Set cookies to track usage and ownership
    const cookieStore = await cookies();
    cookieStore.set("roast_used", "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
    
    // Set a cookie to identify the creator of this specific roast
    cookieStore.set(`roast_creator_${savedRoast.shareable_id}`, "true", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: "/",
    });
    
    return NextResponse.json({
      roastId: savedRoast.shareable_id,
      success: true,
    });
    
  } catch (error) {
    const errorResponse = handleRoastError(error);
    return NextResponse.json(errorResponse, { status: errorResponse.statusCode });
  }
}