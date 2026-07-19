export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { CaseBuilder } from "@/components/careerotter/case-builder";

/**
 * Review prep / promo case builder (CareerOtter M4). Pro-gated at the API; the
 * page renders for any signed-in user and the API returns a clear 403 for Free.
 */
export default async function ReviewPrepPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Review prep</h1>
          <p className="text-sm text-muted-foreground">
            Assemble your logged wins into a case you can walk in with.
          </p>
        </div>
        <CaseBuilder />
      </main>
    </div>
  );
}
