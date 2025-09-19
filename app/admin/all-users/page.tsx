import { notFound } from "next/navigation";
import { getUser } from "@/lib/supabase/server";
import { AdminService } from "@/lib/services/admin.service";
import { AllUsersClient } from "./all-users-client";

export default async function AllUsersPage() {
  const user = await getUser();

  if (!user) {
    notFound();
  }

  const isAdmin = await AdminService.isAdmin(user.id);

  if (!isAdmin) {
    notFound();
  }

  // Initial data fetched server-side
  const initialData = await AdminService.getAllUsersWithSubscriptions();
  const stats = await AdminService.getUserStats();

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <AllUsersClient initialData={initialData} initialStats={stats} />
    </div>
  );
}