"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Navigation } from "@/components/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, ArrowRight } from "lucide-react"
import { trackLinkedInPurchase } from "@/lib/analytics/linkedin"
import { trackConversionEvent, CONVERSION_EVENTS } from "@/lib/analytics/conversion-events"
import { useFeatureFlag, FEATURE_FLAGS } from "@/lib/hooks/use-feature-flag"

export default function UpgradeSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")
  const [countdown, setCountdown] = useState(5)
  const hasTracked = useRef(false)
  const isAuditEnabled = useFeatureFlag(FEATURE_FLAGS.DASHBOARD_UX_AUDIT)

  // Track purchase conversion once on successful checkout
  useEffect(() => {
    if (sessionId && !hasTracked.current) {
      hasTracked.current = true
      trackLinkedInPurchase()
      trackConversionEvent(CONVERSION_EVENTS.UPGRADE_COMPLETED, {
        session_id: sessionId,
      })
    }
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) {
      router.push("/dashboard/upgrade")
      return
    }

    // Start countdown and redirect to dashboard
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          router.push("/dashboard")
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionId, router])

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8">
        <div className="max-w-2xl mx-auto">
          <Card className="text-center">
            <CardHeader>
              <div className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${isAuditEnabled ? "bg-secondary/20" : "bg-green-100"}`}>
                <CheckCircle className={`h-8 w-8 ${isAuditEnabled ? "text-secondary" : "text-green-600"}`} />
              </div>
              <CardTitle className="text-2xl">Welcome to Pro!</CardTitle>
              <CardDescription>
                Your subscription has been activated successfully. You now have unlimited access to track job
                applications.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className={`p-4 rounded-lg ${isAuditEnabled ? "bg-secondary/10" : "bg-green-50"}`}>
                <h3 className={`font-semibold mb-2 ${isAuditEnabled ? "text-foreground" : "text-green-900"}`}>What&apos;s included in your AI Coach plan:</h3>
                <ul className={`text-sm space-y-1 text-left ${isAuditEnabled ? "text-muted-foreground" : "text-green-700"}`}>
                  <li>• Unlimited job applications</li>
                  <li>• AI-powered resume analysis</li>
                  <li>• Interview preparation</li>
                  <li>• Job fit analysis</li>
                  <li>• Custom cover letter generation</li>
                  <li>• Cancel anytime</li>
                </ul>
              </div>

              <div className={`p-4 rounded-lg ${isAuditEnabled ? "bg-info/10" : "bg-blue-50"}`}>
                <p className={`text-sm ${isAuditEnabled ? "text-info-foreground" : "text-blue-800"}`}>
                  Redirecting to your dashboard in <span className="font-bold">{countdown}</span> seconds...
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/dashboard" className="flex-1">
                  <Button className="w-full">
                    Go to Dashboard Now
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </Link>
                <Link href="/dashboard/add" className="flex-1">
                  <Button variant="outline" className="w-full">
                    Add Your First Application
                  </Button>
                </Link>
              </div>

              <p className="text-xs text-muted-foreground">
                You can manage your subscription anytime from your dashboard. We'll send you a receipt via email
                shortly.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
