"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react"

interface SubscriptionStatusPollerProps {
  userId: string
  initialStatus: "pending" | "active" | "error"
}

export function SubscriptionStatusPoller({ userId, initialStatus }: SubscriptionStatusPollerProps) {
  const [status, setStatus] = useState<"pending" | "active" | "error" | "checking">(initialStatus)
  const [attempts, setAttempts] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  // Function to check subscription status
  const checkSubscriptionStatus = async () => {
    if (status === "checking") return

    setStatus("checking")
    setError(null)

    try {
      const response = await fetch(`/api/subscription/check?userId=${userId}`)
      const data = await response.json()

      if (response.ok) {
        if (data.isActive) {
          setStatus("active")
        } else {
          // If we've tried several times and still no active subscription
          if (attempts > 5) {
            setStatus("error")
            setError("Subscription verification is taking longer than expected.")
          } else {
            setStatus("pending")
            setAttempts((prev) => prev + 1)
          }
        }
      } else {
        setStatus("error")
        setError(data.error || "Failed to verify subscription status")
      }
    } catch (err) {
      setStatus("error")
      setError("Network error while checking subscription status")
    }
  }

  // Poll for subscription status
  useEffect(() => {
    if (status === "active") return

    const pollInterval = status === "pending" ? 3000 : 0

    if (pollInterval > 0) {
      const timer = setTimeout(() => {
        checkSubscriptionStatus()
      }, pollInterval)

      return () => clearTimeout(timer)
    }
  }, [status, attempts])

  // Initial check
  useEffect(() => {
    if (initialStatus === "pending") {
      checkSubscriptionStatus()
    }
  }, [])

  if (status === "active") {
    return (
      <div className="flex flex-col items-center space-y-4">
        <div className="flex items-center text-green-600">
          <CheckCircle className="h-5 w-5 mr-2" />
          <span>Subscription active!</span>
        </div>
        <Button onClick={() => router.push("/dashboard")}>Go to Dashboard</Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      {status === "checking" ? (
        <div className="flex items-center text-primary">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          <span>Verifying subscription...</span>
        </div>
      ) : status === "pending" ? (
        <div className="flex items-center text-primary">
          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
          <span>Waiting for subscription confirmation...</span>
        </div>
      ) : (
        <div className="flex items-center text-amber-600">
          <AlertCircle className="h-5 w-5 mr-2" />
          <span>{error || "Subscription verification issue"}</span>
        </div>
      )}

      {status === "error" && (
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">
            Your payment may have been processed, but we're having trouble confirming your subscription.
          </p>
          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            <Button onClick={checkSubscriptionStatus} variant="outline">
              <RefreshCw className="h-4 w-4 mr-2" />
              Try Again
            </Button>
            <Button onClick={() => router.push("/debug/subscription")}>Check Subscription Status</Button>
          </div>
        </div>
      )}
    </div>
  )
}
