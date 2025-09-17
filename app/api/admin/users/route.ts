import { NextRequest, NextResponse } from "next/server";
import { createClient, getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

// GET /api/admin/users - Get all admin users
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

    const adminUsers = await AdminService.getAdminUsers();

    // Get user details for each admin
    const supabase = await createClient();
    const adminUserIds = adminUsers.map(admin => admin.user_id);
    
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", adminUserIds);

    // Combine admin data with profile data
    const adminsWithProfiles = adminUsers.map(admin => {
      const profile = profiles?.find(p => p.user_id === admin.user_id);
      return {
        ...admin,
        full_name: profile?.full_name || null,
        email: profile?.email || null,
      };
    });

    return NextResponse.json({ admins: adminsWithProfiles });
  } catch (error) {
    console.error("Error fetching admin users:", error);
    return NextResponse.json(
      { error: "Failed to fetch admin users" },
      { status: 500 }
    );
  }
}

// POST /api/admin/users - Add a new admin user
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

    const { userId, notes } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const success = await AdminService.addAdminUser(userId, notes);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Admin user added successfully" 
      });
    } else {
      return NextResponse.json(
        { error: "Failed to add admin user" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error adding admin user:", error);
    return NextResponse.json(
      { error: "Failed to add admin user" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/users - Remove an admin user
export async function DELETE(request: NextRequest) {
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

    const { searchParams } = new URL(request.url);
    const userIdToRemove = searchParams.get("userId");

    if (!userIdToRemove) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Prevent removing yourself
    if (userIdToRemove === user.id) {
      return NextResponse.json(
        { error: "You cannot remove yourself as an admin" },
        { status: 400 }
      );
    }

    const success = await AdminService.removeAdminUser(userIdToRemove);
    
    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: "Admin user removed successfully" 
      });
    } else {
      return NextResponse.json(
        { error: "Failed to remove admin user" },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error("Error removing admin user:", error);
    return NextResponse.json(
      { error: "Failed to remove admin user" },
      { status: 500 }
    );
  }
}