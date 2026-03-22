export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { AICoachDashboard } from "@/components/ai-coach/ai-coach-dashboard";

export default async function AICoachPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2 sm:gap-3">
              AI Career Coach
            </h1>
            <p className="text-muted-foreground">
              Get personalized career advice, resume analysis, and interview
              preparation powered by AI
            </p>
          </div>

          <AICoachDashboard userId={user.id} />
        </div>
      </div>
    </div>
  );
}
