export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { NavigationServer } from "@/components/navigation-server";
import { getUser } from "@/lib/supabase/server";
import { CoachChat } from "@/components/careerotter/coach-chat";

/**
 * The coach (CareerOtter M3). Pro-gated at the API; the page renders for any
 * signed-in user and the API returns a clear 403 for Free, which the chat
 * surfaces inline.
 */
export default async function CoachPage() {
  const user = await getUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <main className="container mx-auto max-w-3xl px-4 py-8">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-bold">Coach</h1>
          <p className="text-sm text-muted-foreground">
            Grounded in your logged wins, your goal, and your review date.
          </p>
        </div>
        <CoachChat />
      </main>
    </div>
  );
}
