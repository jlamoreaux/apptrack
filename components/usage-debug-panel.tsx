"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { useSupabaseApplications } from "@/hooks/use-supabase-applications"

export function UsageDebugPanel() {
  const { user } = useSupabaseAuth()
  const { subscription, usage, loading: subscriptionLoading, refetch } = useSubscription(user?.id || null)
  const { applications, loading: applicationsLoading } = useSupabaseApplications(user?.id || null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setTimeout(() => setRefreshing(false), 1000)
  }

  const maxApplications = subscription?.subscription_plans?.max_applications || 5
  const canAdd =
    subscription?.subscription_plans?.max_applications === -1 || (usage?.applications_count || 0) < maxApplications

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Usage Debug Info</CardTitle>
        </CardHeader>
        <CardContent>
          <p>Please log in to view usage information.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Usage Debug Info</CardTitle>
        <CardDescription>Debug information for subscription and usage tracking</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button onClick={handleRefresh} disabled={refreshing} variant="outline" size="sm">
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <form action="/api/debug/update-usage" method="POST" className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline" size="sm">
              Reset Usage Count
            </Button>
          </form>

          <form action="/api/debug/create-free-subscription" method="POST" className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" variant="outline" size="sm">
              Create Free Subscription
            </Button>
          </form>

          <form action="/api/debug/complete-setup" method="POST" className="inline">
            <input type="hidden" name="userId" value={user.id} />
            <Button type="submit" size="sm">
              Complete Setup
            </Button>
          </form>
        </div>

        <div className="grid gap-3 text-sm">
          <div>
            <strong>User ID:</strong> {user.id}
          </div>
          <div>
            <strong>Email:</strong> {user.email}
          </div>
          <div className="flex items-center gap-2">
            <strong>Profile:</strong>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-green-600">Exists</span>
          </div>
          <div className="flex items-center gap-2">
            <strong>Subscription:</strong>
            {subscriptionLoading ? (
              <Badge variant="outline">Loading...</Badge>
            ) : subscription ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600">{subscription.subscription_plans?.name || "Unknown"}</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Missing</span>
              </>
            )}
          </div>
          <div>
            <strong>Max Applications:</strong>{" "}
            {subscription?.subscription_plans?.max_applications === -1
              ? "Unlimited"
              : subscription?.subscription_plans?.max_applications || "Unknown"}
          </div>
          <div className="flex items-center gap-2">
            <strong>Usage Tracking:</strong>
            {usage ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600">{usage.applications_count}</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">Missing</span>
              </>
            )}
          </div>
          <div>
            <strong>Actual Count:</strong> {applicationsLoading ? "Loading..." : applications.length}
          </div>
          <div className="flex items-center gap-2">
            <strong>Can Add:</strong>
            {canAdd ? (
              <>
                <CheckCircle className="h-4 w-4 text-green-500" />
                <span className="text-green-600">Yes</span>
              </>
            ) : (
              <>
                <XCircle className="h-4 w-4 text-red-500" />
                <span className="text-red-600">No</span>
              </>
            )}
          </div>
        </div>

        {!subscription && (
          <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-yellow-800">No subscription found</p>
              <p className="text-yellow-700">
                Click "Complete Setup" to automatically find and link your subscription, or create a free subscription
                if none exists.
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
