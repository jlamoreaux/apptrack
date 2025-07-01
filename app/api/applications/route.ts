import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationDAL } from "@/dal/applications";
import type { ApplicationQueryOptions } from "@/dal/applications";

export async function GET(request: NextRequest) {
  try {
    const user = await getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "25", 10);
    const sortField = searchParams.get("sortField") as ApplicationQueryOptions["sortField"] || "updated_at";
    const sortDirection = searchParams.get("sortDirection") as "asc" | "desc" || "desc";
    const statusFilter = searchParams.get("statusFilter")?.split(",").filter(Boolean) || [];
    const includeArchived = searchParams.get("includeArchived") === "true";

    const applicationDAL = new ApplicationDAL();
    
    const result = await applicationDAL.queryApplications(user.id, {
      page,
      pageSize,
      sortField,
      sortDirection,
      statusFilter: statusFilter as any[],
      includeArchived,
    });

    // Also get status counts
    const statusCounts = await applicationDAL.getStatusCounts(user.id);

    return NextResponse.json({
      ...result,
      statusCounts,
    });
  } catch (error) {
    console.error("Error fetching applications:", error);
    return NextResponse.json(
      { error: "Failed to fetch applications" },
      { status: 500 }
    );
  }
}