/**
 * Per-application tailored resume drafts.
 *
 * POST /api/careerotter/tailored-resume  { applicationId }
 * GET  /api/careerotter/tailored-resume?applicationId=...
 *
 * Pro-only (it calls the model), same gate as the coach. Generates a resume
 * draft rewritten against the application's saved job description using the
 * user's uploaded resume text, and keeps the latest draft per application.
 */

import { type NextRequest, NextResponse, after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin-client";
import { PermissionMiddleware } from "@/lib/middleware/permissions";
import { callOpenAI } from "@/lib/openai/client";
import { captureServerEvent } from "@/lib/analytics/posthog-server";
import { loggerService } from "@/lib/services/logger.service";
import { LogCategory } from "@/lib/services/logger.types";

export const maxDuration = 60;

const MIN_JD_LENGTH = 50;
const MIN_RESUME_LENGTH = 100;

const TAILOR_SYSTEM_PROMPT = `You rewrite resumes to target a specific job description. Rules:
- Use ONLY facts, employers, dates, and accomplishments present in the original resume. Never invent experience, metrics, titles, or skills.
- Reorder and reword so the experience most relevant to the job description leads each section.
- Mirror the job description's terminology where the resume already demonstrates the skill (for keyword matching), but never claim skills the resume does not support.
- Keep it to the same overall length or shorter than the original. Plain text, standard resume sections, no commentary before or after the resume itself.`;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const applicationId = request.nextUrl.searchParams.get("applicationId");
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("tailored_resumes")
    .select("tailored_text, created_at")
    .eq("user_id", user.id)
    .eq("application_id", applicationId)
    .maybeSingle();

  return NextResponse.json({
    tailoredText: data?.tailored_text ?? null,
    createdAt: data?.created_at ?? null,
  });
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const plan = await PermissionMiddleware.getUserPlanInfo(user.id);
  if (!plan.isPro) {
    return NextResponse.json(
      { error: "Tailored resumes are a Pro feature.", requiredPlan: "Pro" },
      { status: 403 }
    );
  }

  let body: { applicationId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const applicationId = typeof body.applicationId === "string" ? body.applicationId : null;
  if (!applicationId) {
    return NextResponse.json({ error: "applicationId is required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const [{ data: application }, { data: resume }] = await Promise.all([
    admin
      .from("applications")
      .select("company, role, job_description")
      .eq("id", applicationId)
      .eq("user_id", user.id)
      .maybeSingle(),
    admin
      .from("user_resumes")
      .select("extracted_text")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }
  const jobDescription = application.job_description?.trim() ?? "";
  if (jobDescription.length < MIN_JD_LENGTH) {
    return NextResponse.json(
      { error: "Save a job description on this application first." },
      { status: 400 }
    );
  }
  const resumeText = resume?.extracted_text?.trim() ?? "";
  if (resumeText.length < MIN_RESUME_LENGTH) {
    return NextResponse.json(
      { error: "Upload a resume first so there is something to tailor." },
      { status: 400 }
    );
  }

  let tailoredText = "";
  try {
    tailoredText = await callOpenAI({
      systemPrompt: TAILOR_SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Job: ${application.role} at ${application.company}\n\nJob description:\n${jobDescription}\n\nOriginal resume:\n${resumeText}`,
        },
      ],
      maxTokens: 2500,
      temperature: 0.3,
    });
  } catch (error) {
    loggerService.error("Tailored resume generation failed", error, {
      category: LogCategory.AI_SERVICE,
      userId: user.id,
      action: "tailored_resume_generation_failed",
    });
    return NextResponse.json(
      { error: "Could not generate a draft right now. Please try again." },
      { status: 502 }
    );
  }

  const { error: saveError } = await admin.from("tailored_resumes").upsert(
    {
      user_id: user.id,
      application_id: applicationId,
      tailored_text: tailoredText,
      created_at: new Date().toISOString(),
    },
    { onConflict: "user_id,application_id" }
  );
  if (saveError) {
    loggerService.error("Tailored resume save failed", saveError, {
      category: LogCategory.DATABASE,
      userId: user.id,
      action: "tailored_resume_save_failed",
    });
    // The draft was generated; return it even if persistence failed.
  }

  after(
    captureServerEvent(user.id, "tailored_resume_generated", {
      application_id: applicationId,
      jd_length: jobDescription.length,
      resume_length: resumeText.length,
    })
  );

  return NextResponse.json({ tailoredText });
}
