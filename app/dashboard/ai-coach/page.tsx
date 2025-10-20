export const dynamic = 'force-dynamic';
import { redirect } from "next/navigation"
import { NavigationServer } from "@/components/navigation-server"
import { getUser, getSubscription } from "@/lib/supabase/server"
import { AICoachDashboard } from "@/components/ai-coach/ai-coach-dashboard"

export default async function AICoachPage() {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  // Check if user has AI Coach or Pro subscription (both have AI access now)
  const subscription = await getSubscription(user.id)
  const planName = subscription?.subscription_plans?.name
  const hasAIAccess = planName === "AI Coach" || planName === "Pro"

  if (!hasAIAccess) {
    redirect("/dashboard/upgrade?highlight=ai-coach")
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-primary flex items-center gap-2 sm:gap-3">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 flex items-center justify-center flex-shrink-0">
                <span className="text-white text-lg sm:text-xl">🤖</span>
              </div>
              AI Career Coach
            </h1>
            <p className="text-muted-foreground">
              Get personalized career advice, resume analysis, and interview preparation powered by AI
            </p>
          </div>

          <AICoachDashboard userId={user.id} />
        </div>
      </div>
    </div>
  )
}
