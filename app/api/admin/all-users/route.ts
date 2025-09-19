import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";

export async function GET() {
  try {
    const user = await getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = await AdminService.isAdmin(user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Forbidden - Admin access required" }, { status: 403 });
    }

    const users = await AdminService.getAllUsersWithSubscriptions();
    const stats = await AdminService.getUserStats();

    return NextResponse.json({ users, stats });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}