import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { AnalyticsComingSoon } from "@/components/ComingSoonPage";

export default async function AnalyticsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <AnalyticsComingSoon />
    </div>
  );
}
