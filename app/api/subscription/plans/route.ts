import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const supabase = await createClient();

    // Get subscription plans
    const { data: plans, error } = await supabase
      .from("subscription_plans")
      .select("*")
      .order("price", { ascending: true });

    if (error) {
      console.error("Error fetching subscription plans:", error);
      return NextResponse.json({ error: "Failed to fetch subscription plans" }, { status: 500 });
    }

    return NextResponse.json({ plans });

  } catch (error) {
    console.error("Subscription plans GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}