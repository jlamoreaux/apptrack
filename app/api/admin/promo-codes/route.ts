import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";
import { AdminService } from "@/lib/services/admin.service";

// GET /api/admin/promo-codes - List all promo codes
export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    const { data: promoCodes, error } = await supabase
      .from("promo_codes")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ promoCodes });
  } catch (error) {
    console.error("Error fetching promo codes:", error);
    return NextResponse.json(
      { error: "Failed to fetch promo codes" },
      { status: 500 }
    );
  }
}

// POST /api/admin/promo-codes - Create new promo code
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const {
      code,
      description,
      trialDays = 90,
      planName = "AI Coach",
      maxUses,
      expiresAt,
    } = await request.json();

    if (!code?.trim()) {
      return NextResponse.json(
        { error: "Promo code is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    // Check if code already exists
    const { data: existing } = await supabase
      .from("promo_codes")
      .select("id")
      .eq("code", code.toUpperCase())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: "Promo code already exists" },
        { status: 400 }
      );
    }

    // Create new promo code
    const { data: promoCode, error } = await supabase
      .from("promo_codes")
      .insert({
        code: code.toUpperCase(),
        description,
        trial_days: trialDays,
        plan_name: planName,
        max_uses: maxUses || null,
        expires_at: expiresAt || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      promoCode,
      message: `Promo code '${code}' created successfully` 
    });
  } catch (error) {
    console.error("Error creating promo code:", error);
    return NextResponse.json(
      { error: "Failed to create promo code" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/promo-codes - Update promo code
export async function PUT(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: ERROR_MESSAGES.UNAUTHORIZED },
        { status: 401 }
      );
    }

    if (!(await AdminService.isAdmin(user.id))) {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    const { id, active, maxUses, expiresAt, description } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: "Promo code ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const updateData: any = {};
    
    if (typeof active === "boolean") updateData.active = active;
    if (maxUses !== undefined) updateData.max_uses = maxUses || null;
    if (expiresAt !== undefined) updateData.expires_at = expiresAt || null;
    if (description !== undefined) updateData.description = description;

    const { data: promoCode, error } = await supabase
      .from("promo_codes")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json({ 
      success: true, 
      promoCode,
      message: "Promo code updated successfully" 
    });
  } catch (error) {
    console.error("Error updating promo code:", error);
    return NextResponse.json(
      { error: "Failed to update promo code" },
      { status: 500 }
    );
  }
}