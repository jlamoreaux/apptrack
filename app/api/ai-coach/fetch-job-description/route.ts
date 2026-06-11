import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { checkAICoachAccess, type AICoachAuthResult } from "@/lib/middleware/ai-coach-auth";
import { htmlToText } from "@/lib/utils/html-to-text";
import { fetchPublicUrl, readBodyCapped } from "@/lib/utils/safe-fetch";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  // Declared outside the try so the catch block can log them.
  let authResult: AICoachAuthResult | undefined;
  let url: string | undefined;

  try {
    // Check authentication and AI Coach access
    authResult = await checkAICoachAccess('FETCH_JOB_DESCRIPTION');
    if (!authResult.authorized) {
      loggerService.warn('Unauthorized job description fetch attempt', {
        category: LogCategory.SECURITY,
        action: 'fetch_job_description_unauthorized',
        metadata: {
          reason: authResult.reason || 'unknown'
        }
      });
      // checkAICoachAccess always supplies a response on denial, but guard
      // against a missing one so we never dereference null and leak access.
      return (
        authResult.response ??
        NextResponse.json({ error: "Forbidden" }, { status: 403 })
      );
    }

    const supabase = await createClient();
    const user = authResult.user;

    ({ url } = await request.json());

    if (!url || typeof url !== "string") {
      loggerService.warn('Job description fetch missing URL', {
        category: LogCategory.API,
        userId: user.id,
        action: 'fetch_job_description_missing_url',
        duration: Date.now() - startTime
      });
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      loggerService.warn('Job description fetch invalid URL', {
        category: LogCategory.API,
        userId: user.id,
        action: 'fetch_job_description_invalid_url',
        duration: Date.now() - startTime,
        metadata: { url }
      });
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Fetch the webpage. fetchPublicUrl re-validates every redirect hop
    // against the SSRF guards (blocked hosts, DNS rebinding).
    let response: Response;
    try {
      response = await fetchPublicUrl(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)",
        },
        timeoutMs: 10_000,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message === 'Blocked host' || message === 'Too many redirects') {
        loggerService.warn('Job description fetch blocked', {
          category: LogCategory.SECURITY,
          userId: user.id,
          action: 'fetch_job_description_blocked_host',
          duration: Date.now() - startTime,
          metadata: { url, reason: message }
        });
        return NextResponse.json(
          { error: "This URL cannot be fetched" },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!response.ok) {
      loggerService.error('Failed to fetch webpage', new Error(`HTTP ${response.status}`), {
        category: LogCategory.API,
        userId: user.id,
        action: 'fetch_job_description_http_error',
        duration: Date.now() - startTime,
        metadata: {
          url,
          status: response.status
        }
      });
      return NextResponse.json(
        { error: "Failed to fetch the webpage" },
        { status: 400 }
      );
    }

    const html = await readBodyCapped(response, 2 * 1024 * 1024);

    // Basic HTML parsing to extract text content
    const cleanHtml = htmlToText(html);

    // Try to find job-related content (this is a simple approach)
    // In a production app, you might want to use a more sophisticated parser
    const jobKeywords = [
      "responsibilities",
      "requirements",
      "qualifications",
      "experience",
      "skills",
      "job description",
      "role",
      "position",
      "duties",
    ];

    // Split into paragraphs and find relevant sections
    const paragraphs = cleanHtml.split(/[.!?]\s+/);
    const relevantParagraphs = paragraphs.filter((paragraph) =>
      jobKeywords.some((keyword) => paragraph.toLowerCase().includes(keyword))
    );

    let description =
      relevantParagraphs.length > 0 ? relevantParagraphs.join(". ") : cleanHtml;

    // Limit length to avoid overwhelming the AI
    if (description.length > 3000) {
      description = description.substring(0, 3000) + "...";
    }

    if (!description.trim()) {
      loggerService.warn('Could not extract job description', {
        category: LogCategory.API,
        userId: user.id,
        action: 'fetch_job_description_no_content',
        duration: Date.now() - startTime,
        metadata: { url }
      });
      return NextResponse.json(
        { error: "Could not extract job description from the URL" },
        { status: 400 }
      );
    }

    loggerService.info('Job description fetched successfully', {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: 'fetch_job_description_success',
      duration: Date.now() - startTime,
      metadata: {
        url,
        descriptionLength: description.length,
        relevantParagraphs: relevantParagraphs.length,
        truncated: description.length >= 3000
      }
    });

    return NextResponse.json({ description });
  } catch (error) {
    loggerService.error('Job description fetch error', error, {
      category: LogCategory.API,
      userId: authResult?.user?.id,
      action: 'fetch_job_description_error',
      duration: Date.now() - startTime,
      metadata: { url }
    });
    return NextResponse.json(
      { error: "Failed to fetch job description" },
      { status: 500 }
    );
  }
}
