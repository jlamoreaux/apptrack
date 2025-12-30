import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { createClient } from "@/lib/supabase/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role-client";
import { AuditService } from "@/lib/services/audit.service";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const supabase = await createClient();

    // First get the current plan for audit logging
    const { data: currentPlan, error: fetchError } = await supabase
      .from("subscription_plans")
      .select("*")
      .eq("id", resolvedParams.id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch pricing plan:", fetchError);
      if (fetchError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Pricing plan not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch pricing plan" },
        { status: 500 }
      );
    }

    // Build update object, excluding undefined values
    const updateData: any = {};
    if (body.description !== undefined) updateData.description = body.description;
    if (body.price_monthly !== undefined) updateData.price_monthly = body.price_monthly;
    if (body.price_yearly !== undefined) updateData.price_yearly = body.price_yearly;
    if (body.features !== undefined) updateData.features = body.features;
    if (body.max_applications !== undefined) updateData.max_applications = body.max_applications;

    // Use service role client to bypass RLS
    const serviceClient = createServiceRoleClient();
    
    // Update the pricing plan
    const { data, error } = await serviceClient
      .from("subscription_plans")
      .update(updateData)
      .eq("id", resolvedParams.id)
      .select();

    if (error) {
      console.error("Failed to update pricing plan:", error);
      return NextResponse.json(
        { error: "Failed to update pricing plan" },
        { status: 500 }
      );
    }

    if (!data || data.length === 0) {
      return NextResponse.json(
        { error: "No rows were updated" },
        { status: 404 }
      );
    }

    const updatedPlan = data[0];

    // Log the admin action
    if (currentPlan && updatedPlan) {
      await AuditService.logPricingPlanUpdated(
        user.id,
        resolvedParams.id,
        updatedPlan.name,
        {
          description: currentPlan.description,
          price_monthly: currentPlan.price_monthly,
          price_yearly: currentPlan.price_yearly,
          features: currentPlan.features,
          max_applications: currentPlan.max_applications,
        },
        {
          description: body.description,
          price_monthly: body.price_monthly,
          price_yearly: body.price_yearly,
          features: body.features,
          max_applications: body.max_applications,
        },
        req
      );
    }

    return NextResponse.json(updatedPlan);
  } catch (error) {
    console.error("Error updating pricing plan:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}