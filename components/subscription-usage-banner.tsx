"use client"

import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Crown, AlertTriangle } from "lucide-react"
import Link from "next/link"
import { useSubscription } from "@/hooks/use-subscription"
import { PLAN_LIMITS } from "@/lib/constants/plans"

interface SubscriptionUsageBannerProps {
  userId: string
}

export function SubscriptionUsageBanner({ userId }: SubscriptionUsageBannerProps) {
  const {
    subscription,
    usage,
    canAddApplication,
    getUsagePercentage,
    getRemainingApplications,
    isOnFreePlan,
    loading,
  } = useSubscription(userId)

  // Don't render anything while loading or if not on free plan
  if (loading || !isOnFreePlan()) return null

  // Don't render if we don't have the data yet
  if (!subscription && !usage) return null

  const remaining = getRemainingApplications()
  const percentage = getUsagePercentage()
  const isNearLimit = percentage >= 80 && isOnFreePlan()
  const isAtLimit = !canAddApplication() && isOnFreePlan()

  return (
    <Card
      className={`mb-6 ${isAtLimit ? "border-red-200 bg-red-50" : isNearLimit ? "border-yellow-200 bg-yellow-50" : ""}`}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-4 w-4 text-primary" />
              <span className="font-medium">Free Plan</span>
              {isAtLimit && <AlertTriangle className="h-4 w-4 text-red-500" />}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Applications used</span>
                <span>
                  {usage?.applications_count || 0} / {subscription?.subscription_plans?.max_applications || PLAN_LIMITS.FREE_MAX_APPLICATIONS}
                </span>
              </div>
              <Progress value={percentage} className="h-2" />
              {isAtLimit ? (
                <p className="text-sm text-red-600">
                  {"You've reached your application limit. Upgrade to AI Coach to add unlimited applications."}
                </p>
              ) : isNearLimit ? (
                <p className="text-sm text-yellow-700">
                  Only {remaining} applications remaining. Consider upgrading to AI Coach for unlimited applications.
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">{remaining} applications remaining</p>
              )}
            </div>
          </div>
          <div className="ml-4">
            <Link href="/dashboard/upgrade">
              <Button size="sm" variant={isAtLimit ? "default" : "outline"}>
                {isAtLimit ? "Upgrade Now" : "Upgrade to AI Coach"}
              </Button>
            </Link>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
