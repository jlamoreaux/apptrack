import { redirect } from "next/navigation"
import { NavigationServer } from "@/components/navigation-server"
import { getUser, getSubscription } from "@/lib/supabase/server"
import { UsageDisplay } from "@/components/ai-coach/usage-display"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export const dynamic = 'force-dynamic';

export default async function UsagePage() {
  const user = await getUser()

  if (!user) {
    redirect("/login")
  }

  // Get user's subscription
  const subscription = await getSubscription(user.id)
  const planName = subscription?.subscription_plans?.name || "Free"
  const hasAIAccess = planName === "AI Coach" || planName === "Pro"

  return (
    <div className="min-h-screen bg-background">
      <NavigationServer />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Header */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">AI Feature Usage</h1>
              <p className="text-muted-foreground">
                Monitor your AI feature usage and limits
              </p>
            </div>
          </div>

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>
                Your subscription and AI feature access
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-semibold">{planName} Plan</p>
                  <p className="text-sm text-muted-foreground">
                    {hasAIAccess
                      ? "You have access to AI-powered features"
                      : "Upgrade to AI Coach to access AI features"}
                  </p>
                </div>
                {!hasAIAccess && (
                  <Link href="/dashboard/upgrade">
                    <Button>Upgrade Plan</Button>
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Usage Display */}
          {hasAIAccess ? (
            <UsageDisplay userId={user.id} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground mb-4">
                  AI features are not available on the Free plan
                </p>
                <Link href="/dashboard/upgrade">
                  <Button>View Available Plans</Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Additional Information */}
          {hasAIAccess && (
            <Card>
              <CardHeader>
                <CardTitle>How Usage Limits Work</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  • <strong>Hourly limits</strong> reset every hour to prevent burst usage
                </p>
                <p>
                  • <strong>Daily limits</strong> reset every 24 hours at midnight
                </p>
                <p>
                  • Usage is tracked per feature, so you can use different AI tools independently
                </p>
                <p>
                  • When you reach a limit, you'll need to wait for it to reset or upgrade your plan
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}