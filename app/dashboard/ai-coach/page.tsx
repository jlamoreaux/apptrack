import { redirect } from "next/navigation"
import { NavigationServer } from "@/components/navigation-server"
import { getUser, getSubscription } from "@/lib/supabase/server"
import { AICoachDashboard } from "@/components/ai-coach/ai-coach-dashboard"

export default async function AICoachPage() {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  // Check if user has AI Coach subscription
  const subscription = await getSubscription(user.id)
  const hasAICoachAccess = subscription?.subscription_plans?.name === "AI Coach"

  if (!hasAICoachAccess) {
    redirect("/dashboard/upgrade?highlight=ai-coach")
  }

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto py-8">
        <div className="max-w-6xl mx-auto space-y-8">
          {/* Header */}
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-primary flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 flex items-center justify-center">
                <span className="text-white text-xl">🤖</span>
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
