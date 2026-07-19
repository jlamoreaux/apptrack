import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Flame, FileSearch, MessageSquare, Target } from "lucide-react";
import { NavigationServer } from "@/components/navigation-server";
import { getUser, getApplications } from "@/lib/supabase/server";
import { DashboardApplicationsList } from "@/components/dashboard-applications-list";

export const dynamic = "force-dynamic";

// Job-hunt tools live here now (the former standalone "AI Coach" hub). Land it =
// acquisition surface: the roast is free, the AI tools are Pro-gated at the API.
const JOB_TOOLS = [
  { href: "/roast-my-resume", label: "Roast my resume", icon: Flame },
  { href: "/dashboard/ai-coach?tab=resume", label: "Resume analysis", icon: FileSearch },
  { href: "/dashboard/ai-coach?tab=interview", label: "Interview prep", icon: MessageSquare },
  { href: "/dashboard/ai-coach?tab=job-fit", label: "Job fit", icon: Target },
];

export default async function JobSearchPage() {
  const user = await getUser();
  if (!user) {
    redirect("/login");
  }

  const applications = await getApplications(user.id);

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto px-4 py-6 sm:py-8 space-y-6 sm:space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
            Job search
          </h1>
          <p className="text-muted-foreground">
            Track your applications and sharpen your hunt.
          </p>
        </div>

        {/* Job-hunt tools (Land it) */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {JOB_TOOLS.map((t) => (
            <Link key={t.href} href={t.href}>
              <Card className="transition-colors hover:border-primary/50">
                <CardContent className="flex items-center gap-2 p-4 text-sm font-medium">
                  <t.icon className="h-4 w-4 text-primary" />
                  {t.label}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        {/* Applications list */}
        <DashboardApplicationsList
          userId={user.id}
          initialApplications={applications}
          initialTotal={applications.length}
        />
      </div>
    </div>
  );
}
