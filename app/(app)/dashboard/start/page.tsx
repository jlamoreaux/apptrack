export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { ZeroToCaseFlow } from "@/components/careerotter/zero-to-case-flow";

/**
 * Zero to Case onboarding (CareerOtter M2c). The first thing after signup: three
 * questions, a generated starter case. Free once for everyone (the API enforces
 * idempotency).
 */
export default async function StartPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Start your case</h1>
          <p className="text-sm text-muted-foreground">
            Two minutes. You leave with a real first draft, not an empty journal.
          </p>
        </div>
        <ZeroToCaseFlow />
      </main>
    </div>
  );
}
