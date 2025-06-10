import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const userId = formData.get("userId") as string

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    // Count actual applications
    const { data: applications, error: appsError } = await supabaseAdmin
      .from("applications")
      .select("id")
      .eq("user_id", userId)

    if (appsError) {
      return NextResponse.json({ error: "Error counting applications" }, { status: 500 })
    }

    const actualCount = applications?.length || 0

    // Update usage tracking
    const { error: usageError } = await supabaseAdmin.from("usage_tracking").upsert({
      user_id: userId,
      applications_count: actualCount,
      updated_at: new Date().toISOString(),
    })

    if (usageError) {
      return NextResponse.json({ error: "Error updating usage" }, { status: 500 })
    }

    // Redirect back to debug page
    return NextResponse.redirect(new URL("/debug/subscription", request.url))
  } catch (error) {
    console.error("Error updating usage:", error)
    return NextResponse.json({ error: "An unexpected error occurred" }, { status: 500 })
  }
}
