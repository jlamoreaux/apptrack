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
import { StatusBadge } from "@/components/status-badge";
import { unarchiveApplicationAction } from "@/lib/actions";

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
        <Card>
          <CardHeader>
            <CardTitle className="text-primary">
              Archived Applications
            </CardTitle>
            <CardDescription>
              Applications you've archived to keep your dashboard clean
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archivedApplications.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Archive className="h-12 w-12 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  No archived applications
                </h3>
                <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                  Applications you archive will appear here. This helps keep
                  your main dashboard focused on active opportunities.
                </p>
                <Link href="/dashboard">
                  <Button>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to Dashboard
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {archivedApplications.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{app.role}</h3>
                        {app.role_link && (
                          <a
                            href={app.role_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground flex-shrink-0"
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {app.company}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Applied:{" "}
                        {new Date(app.date_applied).toLocaleDateString()} •
                        Archived:{" "}
                        {new Date(app.updated_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <StatusBadge status={app.status} />
                      <form
                        action={async (formData: FormData) => {
                          await unarchiveApplicationAction(app.id);
                        }}
                      >
                        <Button variant="outline" size="sm" type="submit">
                          Unarchive
                        </Button>
                      </form>
                      <Link href={`/dashboard/application/${app.id}`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-primary/20 text-primary hover:bg-primary hover:text-primary-foreground"
                        >
                          View
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}

                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    {archivedApplications.length} archived application
                    {archivedApplications.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
