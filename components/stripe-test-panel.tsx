"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useSupabaseAuth } from "@/hooks/use-supabase-auth"
import { useSubscription } from "@/hooks/use-subscription"
import { CheckCircle, XCircle, Loader2, CreditCard, Webhook, AlertTriangle } from "lucide-react"

export function StripeTestPanel() {
  const [envError, setEnvError] = useState<string | null>(null)

  // Check for environment variables on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
        setEnvError("NEXT_PUBLIC_SUPABASE_URL is missing")
        return
      }
      if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        setEnvError("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing")
        return
      }
    }
  }, [])

  const { user } = useSupabaseAuth()
  const { subscription, plans, refetch } = useSubscription(user?.id || null)
  const [testResults, setTestResults] = useState<Record<string, boolean | null>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})

  // Show environment error if present
  if (envError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Environment Configuration Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-red-50 p-4 rounded-lg">
            <p className="text-red-700 font-medium">Missing Environment Variable:</p>
            <p className="text-red-600 text-sm mt-1">{envError}</p>
            <div className="mt-4 text-sm text-red-600">
              <p>Please ensure these environment variables are set:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>NEXT_PUBLIC_SUPABASE_URL</li>
                <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                <li>STRIPE_SECRET_KEY</li>
                <li>STRIPE_PRO_MONTHLY_PRICE_ID</li>
                <li>STRIPE_PRO_YEARLY_PRICE_ID</li>
                <li>STRIPE_WEBHOOK_SECRET</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  // Rest of the component remains the same...
  const runTest = async (testName: string, testFn: () => Promise<boolean>) => {
    setLoading((prev) => ({ ...prev, [testName]: true }))
    try {
      const result = await testFn()
      setTestResults((prev) => ({ ...prev, [testName]: result }))
    } catch (error) {
      console.error(`Test ${testName} failed:`, error)
      setTestResults((prev) => ({ ...prev, [testName]: false }))
    } finally {
      setLoading((prev) => ({ ...prev, [testName]: false }))
    }
  }

  const testCheckoutAPI = async () => {
    if (!user) return false

    const proPlan = plans.find((p) => p.name === "Pro")
    if (!proPlan) return false

    try {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planId: proPlan.id,
          billingCycle: "monthly",
          userId: user.id,
        }),
      })

      const data = await response.json()
      return !data.error && data.sessionId
    } catch (error) {
      console.error("Checkout API test failed:", error)
      return false
    }
  }

  const testWebhookEndpoint = async () => {
    try {
      const response = await fetch("/api/stripe/webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ test: true }),
      })

      // Should return 400 for invalid signature, which means endpoint is working
      return response.status === 400
    } catch (error) {
      console.error("Webhook test failed:", error)
      return false
    }
  }

  const testCancelAPI = async () => {
    if (!user) return false

    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })

      const data = await response.json()
      // Should return 404 if no active subscription (which is expected for free users)
      return response.status === 404 || data.success
    } catch (error) {
      console.error("Cancel API test failed:", error)
      return false
    }
  }

  const testEnvironmentVariables = async () => {
    // Test if we can create a checkout (which requires env vars to be set)
    return await testCheckoutAPI()
  }

  const getStatusIcon = (testName: string) => {
    const result = testResults[testName]
    const isLoading = loading[testName]

    if (isLoading) return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
    if (result === true) return <CheckCircle className="h-4 w-4 text-green-500" />
    if (result === false) return <XCircle className="h-4 w-4 text-red-500" />
    return <div className="h-4 w-4 rounded-full bg-gray-300" />
  }

  const getStatusText = (testName: string) => {
    const result = testResults[testName]
    const isLoading = loading[testName]

    if (isLoading) return "Testing..."
    if (result === true) return "Pass"
    if (result === false) return "Fail"
    return "Not tested"
  }

  if (!user) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Stripe Integration Test</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">Please log in to test Stripe integration.</p>
          <div className="mt-4">
            <Button asChild>
              <a href="/login">Go to Login</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CreditCard className="h-5 w-5" />
          Stripe Integration Test Panel
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status */}
        <div className="bg-muted p-4 rounded-lg">
          <h4 className="font-medium mb-2">Current Status</h4>
          <div className="space-y-1 text-sm">
            <div>
              Plan: <Badge variant="outline">{subscription?.subscription_plans?.name || "Free"}</Badge>
            </div>
            <div>
              Status: <Badge variant="outline">{subscription?.status || "active"}</Badge>
            </div>
            <div>
              User ID: <code className="text-xs bg-gray-100 px-1 rounded">{user.id}</code>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="space-y-3">
          <h4 className="font-medium">Integration Tests</h4>

          {/* Environment Variables Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-sm">Environment Variables</div>
              <div className="text-xs text-muted-foreground">STRIPE_SECRET_KEY, PRICE_IDs configured</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getStatusText("envVars")}</Badge>
              {getStatusIcon("envVars")}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runTest("envVars", testEnvironmentVariables)}
                disabled={loading.envVars}
              >
                Test
              </Button>
            </div>
          </div>

          {/* Checkout API Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-sm">Checkout API</div>
              <div className="text-xs text-muted-foreground">/api/stripe/create-checkout endpoint</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getStatusText("checkout")}</Badge>
              {getStatusIcon("checkout")}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runTest("checkout", testCheckoutAPI)}
                disabled={loading.checkout}
              >
                Test
              </Button>
            </div>
          </div>

          {/* Webhook Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-sm flex items-center gap-1">
                <Webhook className="h-3 w-3" />
                Webhook Endpoint
              </div>
              <div className="text-xs text-muted-foreground">/api/stripe/webhook accessibility</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getStatusText("webhook")}</Badge>
              {getStatusIcon("webhook")}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runTest("webhook", testWebhookEndpoint)}
                disabled={loading.webhook}
              >
                Test
              </Button>
            </div>
          </div>

          {/* Cancel API Test */}
          <div className="flex items-center justify-between p-3 border rounded-lg">
            <div>
              <div className="font-medium text-sm">Cancel Subscription API</div>
              <div className="text-xs text-muted-foreground">/api/stripe/cancel-subscription endpoint</div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline">{getStatusText("cancel")}</Badge>
              {getStatusIcon("cancel")}
              <Button
                size="sm"
                variant="outline"
                onClick={() => runTest("cancel", testCancelAPI)}
                disabled={loading.cancel}
              >
                Test
              </Button>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button
            onClick={() => {
              runTest("envVars", testEnvironmentVariables)
              runTest("checkout", testCheckoutAPI)
              runTest("webhook", testWebhookEndpoint)
              runTest("cancel", testCancelAPI)
            }}
            disabled={Object.values(loading).some(Boolean)}
            className="flex-1"
          >
            Run All Tests
          </Button>
          <Button onClick={refetch} variant="outline">
            Refresh Data
          </Button>
        </div>

        {/* Test Cards Info */}
        <div className="bg-blue-50 p-4 rounded-lg">
          <h4 className="font-medium text-blue-900 mb-2">Test Card Numbers</h4>
          <div className="text-sm text-blue-700 space-y-1">
            <div>
              <code>4242 4242 4242 4242</code> - Visa (succeeds)
            </div>
            <div>
              <code>4000 0000 0000 0002</code> - Visa (declined)
            </div>
            <div>Use any future expiry date and any 3-digit CVC</div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
