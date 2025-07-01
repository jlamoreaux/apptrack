import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";
import { NavigationServer } from "@/components/navigation-server";
import { getUser, getApplications } from "@/lib/supabase/server";
import { DashboardApplicationsList } from "@/components/dashboard-applications-list";

export default async function ApplicationsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  // Get all applications for this user
  const applications = await getApplications(user.id);

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto py-8 space-y-8">
        {/* Header Section */}
        <div className="flex items-center gap-4">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-primary">All Applications</h1>
            <p className="text-muted-foreground">
              Manage and track all your job applications
            </p>
          </div>
          <Link href="/dashboard/add">
            <Button className="bg-secondary hover:bg-secondary/90">
              <Plus className="h-4 w-4 mr-2" />
              Add Application
            </Button>
          </Link>
        </div>

        {/* Applications List with Pagination */}
        <DashboardApplicationsList
          userId={user.id}
          initialApplications={applications}
          initialTotal={applications.length}
        />
      </div>
    </div>
  );
}
