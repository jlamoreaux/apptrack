"use client"

import { useSubscription } from "@/hooks/use-subscription"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function SubscriptionDebugInfo() {
  const { user } = useSupabaseAuth()
  const { subscription, usage, canAddApplication, isOnProPlan, loading } = useSubscription(user?.id || null)

  if (loading) return <div>Loading subscription info...</div>

  return (
    <Card className="mb-4 border-yellow-200 bg-yellow-50">
      <CardHeader>
        <CardTitle className="text-sm">Debug Info</CardTitle>
      </CardHeader>
      <CardContent className="text-xs space-y-1">
        <div>User ID: {user?.id}</div>
        <div>Has Subscription: {subscription ? "Yes" : "No"}</div>
        <div>Plan: {subscription?.subscription_plans?.name || "None"}</div>
        <div>Max Apps: {subscription?.subscription_plans?.max_applications ?? "Unknown"}</div>
        <div>Current Usage: {usage?.applications_count || 0}</div>
        <div>Is Pro: {isOnProPlan() ? "Yes" : "No"}</div>
        <div>Can Add: {canAddApplication() ? "Yes" : "No"}</div>
      </CardContent>
    </Card>
  )
}
