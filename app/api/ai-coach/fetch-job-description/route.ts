import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { cookies: cookieStore }
    );

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { url } = await request.json();

    if (!url || typeof url !== "string") {
      return NextResponse.json({ error: "URL is required" }, { status: 400 });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return NextResponse.json(
        { error: "Invalid URL format" },
        { status: 400 }
      );
    }

    // Fetch the webpage
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; JobTracker/1.0)",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch the webpage" },
        { status: 400 }
      );
    }

    const html = await response.text();

    // Basic HTML parsing to extract text content
    // Remove script and style tags
    const cleanHtml = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

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
      return NextResponse.json(
        { error: "Could not extract job description from the URL" },
        { status: 400 }
      );
    }

    return NextResponse.json({ description });
  } catch (error) {
    console.error("Job description fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch job description" },
      { status: 500 }
    );
  }
}
