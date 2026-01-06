import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedUser } from "@/lib/auth/extension-auth";
import { createClient } from "@/lib/supabase/server-client";
import { escapeIlike } from "@/lib/security/data-sanitizer";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

/**
 * GET /api/applications/check-duplicate
 *
 * Check if user already has an application for a company/role combination.
 * Supports both session cookie auth (web app) and Bearer token auth (extension).
 *
 * Query params:
 * - company: string (required)
 * - role: string (required)
 *
 * Response:
 * - 200: { exists: false } or { exists: true, application: {...} }
 * - 400: Missing required query params
 * - 401: Unauthorized
 * - 500: Server error
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    // Authenticate via session or Bearer token
    const user = await getAuthenticatedUser(request);

    if (!user) {
      loggerService.warn("Unauthorized duplicate check attempt", {
        category: LogCategory.SECURITY,
        action: "duplicate_check_unauthorized",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const company = searchParams.get("company");
    const role = searchParams.get("role");

    // Validate required params
    if (!company || !role) {
      loggerService.warn("Duplicate check missing required params", {
        category: LogCategory.API,
        userId: user.id,
        action: "duplicate_check_validation_error",
        metadata: {
          hasCompany: !!company,
          hasRole: !!role,
        },
      });
      return NextResponse.json(
        { error: "company and role query parameters are required" },
        { status: 400 }
      );
    }

    // Validate input length (prevent excessively long queries)
    const MAX_INPUT_LENGTH = 200;
    if (company.length > MAX_INPUT_LENGTH || role.length > MAX_INPUT_LENGTH) {
      loggerService.warn("Duplicate check input too long", {
        category: LogCategory.API,
        userId: user.id,
        action: "duplicate_check_input_too_long",
        metadata: {
          companyLength: company.length,
          roleLength: role.length,
        },
      });
      return NextResponse.json(
        { error: "company and role must be less than 200 characters" },
        { status: 400 }
      );
    }

    // Escape ILIKE special characters to prevent wildcard injection
    const sanitizedCompany = escapeIlike(company);
    const sanitizedRole = escapeIlike(role);

    // Query for existing application with case-insensitive match
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("applications")
      .select("id, company, role, status, date_applied")
      .eq("user_id", user.id)
      .ilike("company", sanitizedCompany)
      .ilike("role", sanitizedRole)
      .eq("archived", false)
      .limit(1)
      .maybeSingle();

    if (error) {
      loggerService.error("Error checking for duplicate application", error, {
        category: LogCategory.DATABASE,
        userId: user.id,
        action: "duplicate_check_db_error",
        duration: Date.now() - startTime,
      });
      return NextResponse.json(
        { error: "Failed to check for duplicates" },
        { status: 500 }
      );
    }

    const exists = data !== null;

    loggerService.info("Duplicate check completed", {
      category: LogCategory.BUSINESS,
      userId: user.id,
      action: "duplicate_check_completed",
      duration: Date.now() - startTime,
      metadata: {
        exists,
        authSource: user.source,
        // Don't log actual company/role for privacy
      },
    });

    if (exists) {
      return NextResponse.json({
        exists: true,
        application: {
          id: data.id,
          company: data.company,
          role: data.role,
          status: data.status,
          date_applied: data.date_applied,
        },
      });
    }

    return NextResponse.json({ exists: false });
  } catch (error) {
    loggerService.error("Error in duplicate check", error, {
      category: LogCategory.API,
      action: "duplicate_check_error",
      duration: Date.now() - startTime,
    });
    return NextResponse.json(
      { error: "Failed to check for duplicates" },
      { status: 500 }
    );
  }
}
