export const dynamic = 'force-dynamic';

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ResumeManagementContainer } from "@/components/resume-management/ResumeManagementContainer";

export default async function ResumesPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <FileText className="h-8 w-8 text-primary" />
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Resume Management
              </h1>
            </div>
            <p className="text-muted-foreground">
              Upload and manage your resumes. Select which resume to use for different
              job applications and AI-powered features.
            </p>
          </div>

          <ResumeManagementContainer userId={user.id} />
        </div>
      </div>
    </div>
  );
}
