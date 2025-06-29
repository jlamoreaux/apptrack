import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { ApplicationsComingSoon } from "@/components/ComingSoonPage";

export default async function ApplicationsPage() {
  const user = await getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <ApplicationsComingSoon />
    </div>
  );
}
