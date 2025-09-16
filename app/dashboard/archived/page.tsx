export const dynamic = 'force-dynamic';
import { redirect } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, ExternalLink, Archive } from "lucide-react";
import { NavigationServer } from "@/components/navigation-server";
import { getUser, getArchivedApplications } from "@/lib/supabase/server";
import { ArchivedApplicationsList } from "@/components/archived-applications-list";

export default async function ArchivedApplicationsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  const archivedApplications = await getArchivedApplications(user.id);

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
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary">
              Archived Applications
            </h1>
            <p className="text-muted-foreground">
              View and manage your archived job applications
            </p>
          </div>
        </div>

        {/* Archived Applications List */}
        <ArchivedApplicationsList
          userId={user.id}
          initialApplications={archivedApplications}
          initialTotal={archivedApplications.length}
        />
      </div>
    </div>
  );
}
