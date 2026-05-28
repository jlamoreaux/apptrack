import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email/client";
import { escapeHtml, safeUrl } from "@/lib/email/transactional";
import {
  SUPPORT_EMAIL,
  SUPPORT_CATEGORIES,
  type SupportCategory,
} from "@/lib/constants/site-config";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

// Validation caps (named to avoid magic numbers).
const SUBJECT_MIN = 1;
const SUBJECT_MAX = 200;
const MESSAGE_MIN = 1;
const MESSAGE_MAX = 5000;
const CONTEXT_URL_MAX = 2000;
const CONTEXT_ERROR_MESSAGE_MAX = 1000;
const CONTEXT_TOTAL_MAX = 4000;

// Per-user rate limit.
const RATE_LIMIT_MAX_REQUESTS = 5;
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Best-effort, per-user rate limit backed by an in-module Map of request
 * timestamps. NOTE: this is per-serverless-instance and NOT durable across
 * instances or cold starts — it is a cheap spam/quota guard, not a hard
 * guarantee. A distributed store (e.g. Redis) would be required for that.
 */
const rateLimitBuckets = new Map<string, number[]>();

function isRateLimited(userId: string, now: number): boolean {
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitBuckets.get(userId) ?? []).filter(
    (timestamp) => timestamp > windowStart
  );

  if (recent.length >= RATE_LIMIT_MAX_REQUESTS) {
    rateLimitBuckets.set(userId, recent);
    return true;
  }

  recent.push(now);
  rateLimitBuckets.set(userId, recent);
  return false;
}

interface ValidatedContext {
  url?: string;
  errorMessage?: string;
}

interface ValidatedSupportRequest {
  subject: string;
  message: string;
  category: SupportCategory;
  context: ValidatedContext;
}

type ValidationResult =
  | { ok: true; value: ValidatedSupportRequest }
  | { ok: false; error: string };

function isSupportCategory(value: unknown): value is SupportCategory {
  return (
    typeof value === "string" &&
    (SUPPORT_CATEGORIES as readonly string[]).includes(value)
  );
}

function validateBody(body: unknown): ValidationResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Request body must be an object." };
  }

  const { subject, message, category, context } = body as Record<
    string,
    unknown
  >;

  if (typeof subject !== "string") {
    return { ok: false, error: "Subject is required." };
  }
  const trimmedSubject = subject.trim();
  if (
    trimmedSubject.length < SUBJECT_MIN ||
    trimmedSubject.length > SUBJECT_MAX
  ) {
    return {
      ok: false,
      error: `Subject must be between ${SUBJECT_MIN} and ${SUBJECT_MAX} characters.`,
    };
  }

  if (typeof message !== "string") {
    return { ok: false, error: "Message is required." };
  }
  const trimmedMessage = message.trim();
  if (
    trimmedMessage.length < MESSAGE_MIN ||
    trimmedMessage.length > MESSAGE_MAX
  ) {
    return {
      ok: false,
      error: `Message must be between ${MESSAGE_MIN} and ${MESSAGE_MAX} characters.`,
    };
  }

  if (!isSupportCategory(category)) {
    return { ok: false, error: "Invalid category." };
  }

  // Read only known keys from context; ignore everything else.
  const validatedContext: ValidatedContext = {};
  if (typeof context === "object" && context !== null) {
    const { url, errorMessage } = context as Record<string, unknown>;
    if (typeof url === "string") {
      if (url.length > CONTEXT_URL_MAX) {
        return { ok: false, error: "Context URL is too long." };
      }
      validatedContext.url = url;
    }
    if (typeof errorMessage === "string") {
      validatedContext.errorMessage = errorMessage.slice(
        0,
        CONTEXT_ERROR_MESSAGE_MAX
      );
    }
  }

  if (JSON.stringify(validatedContext).length > CONTEXT_TOTAL_MAX) {
    return { ok: false, error: "Context is too large." };
  }

  return {
    ok: true,
    value: {
      subject: trimmedSubject,
      message: trimmedMessage,
      category,
      context: validatedContext,
    },
  };
}

function buildSupportEmailHtml(params: {
  userId: string;
  userEmail: string | undefined;
  subject: string;
  message: string;
  category: SupportCategory;
  context: ValidatedContext;
}): string {
  const { userId, userEmail, subject, message, category, context } = params;

  const replyNote = userEmail
    ? `<p style="margin: 0 0 4px;"><strong>Reply to:</strong> ${escapeHtml(userEmail)}</p>`
    : `<p style="margin: 0 0 4px; color: #b91c1c;"><strong>No reply address on file</strong> — replies will not reach this user.</p>`;

  const urlRow = context.url
    ? `<p style="margin: 0 0 4px;"><strong>Page:</strong> <a href="${safeUrl(context.url)}">${escapeHtml(context.url)}</a></p>`
    : "";

  const errorRow = context.errorMessage
    ? `<p style="margin: 0 0 4px;"><strong>Error:</strong> ${escapeHtml(context.errorMessage)}</p>`
    : "";

  return `
    <h2 style="margin: 0 0 12px;">New support request</h2>
    <p style="margin: 0 0 4px;"><strong>Category:</strong> ${escapeHtml(category)}</p>
    <p style="margin: 0 0 4px;"><strong>Subject:</strong> ${escapeHtml(subject)}</p>
    <p style="margin: 0 0 4px;"><strong>User ID:</strong> ${escapeHtml(userId)}</p>
    ${replyNote}
    ${urlRow}
    ${errorRow}
    <hr style="margin: 16px 0; border: none; border-top: 1px solid #e4e4e7;" />
    <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
    <p style="margin: 0; white-space: pre-wrap;">${escapeHtml(message)}</p>
  `;
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  // Declared in function scope so the catch block can log it safely.
  let user: Awaited<
    ReturnType<Awaited<ReturnType<typeof createClient>>["auth"]["getUser"]>
  >["data"]["user"] = null;

  try {
    const supabase = await createClient();
    const {
      data: { user: authedUser },
      error: authError,
    } = await supabase.auth.getUser();
    user = authedUser;

    if (authError || !user) {
      loggerService.warn("Unauthorized support request attempt", {
        category: LogCategory.SECURITY,
        action: "support_unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let rawBody: unknown;
    try {
      rawBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid request body." },
        { status: 400 }
      );
    }

    const validation = validateBody(rawBody);
    if (!validation.ok) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    if (isRateLimited(user.id, Date.now())) {
      loggerService.warn("Support request rate limit exceeded", {
        category: LogCategory.SECURITY,
        userId: user.id,
        action: "support_rate_limited",
      });
      return NextResponse.json(
        { error: "Too many support requests. Please try again later." },
        { status: 429 }
      );
    }

    const { subject, message, category, context } = validation.value;
    const replyTo = user.email ?? undefined;

    const html = buildSupportEmailHtml({
      userId: user.id,
      userEmail: user.email ?? undefined,
      subject,
      message,
      category,
      context,
    });

    const result = await sendEmail({
      to: SUPPORT_EMAIL,
      replyTo,
      subject: `[Support] [${category}] ${subject}`,
      html,
    });

    if ("mock" in result && result.mock === true) {
      loggerService.info("Support request email mocked (no RESEND_API_KEY)", {
        category: LogCategory.EMAIL,
        userId: user.id,
        action: "support_email_mocked",
        duration: Date.now() - startTime,
        metadata: { category },
      });
      return NextResponse.json({ success: true });
    }

    loggerService.info("Support request email sent", {
      category: LogCategory.EMAIL,
      userId: user.id,
      action: "support_email_sent",
      duration: Date.now() - startTime,
      metadata: { category },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    loggerService.error("Failed to send support request", error, {
      category: LogCategory.API,
      userId: user?.id,
      action: "support_error",
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Failed to send support request." },
      { status: 500 }
    );
  }
}
