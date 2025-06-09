"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { CheckCircle, Heart, Sparkles, Loader2 } from "lucide-react"

interface OfferReceivedModalProps {
  isOpen: boolean
  onClose: () => void
  companyName: string
  roleName: string
  isSubscribed: boolean
  userId: string
}

export function OfferReceivedModal({
  isOpen,
  onClose,
  companyName,
  roleName,
  isSubscribed,
  userId,
}: OfferReceivedModalProps) {
  const [showCancelOption, setShowCancelOption] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleContinue = () => {
    if (isSubscribed) {
      setShowCancelOption(true)
    } else {
      onClose()
    }
  }

  const handleCancelSubscription = async () => {
    setLoading(true)
    try {
      const response = await fetch("/api/stripe/cancel-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (data.success) {
        alert(
          "Your subscription has been canceled. You'll continue to have access until the end of your billing period.",
        )
        onClose()
      } else {
        alert("Failed to cancel subscription. Please contact support.")
      }
    } catch (error) {
      console.error("Error canceling subscription:", error)
      alert("Something went wrong. Please try again or contact support.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        {!showCancelOption ? (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
              <DialogTitle className="text-xl">Congratulations! 🎉</DialogTitle>
              <DialogDescription className="text-center">
                {"You've marked your application for "}
                <span className="font-semibold">{roleName}</span>
                {" at "}
                <span className="font-semibold">{companyName}</span>
                {" as received an offer!"}
              </DialogDescription>
            </DialogHeader>
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-4">
                {"We're so excited for your success! This is a huge milestone in your job search journey."}
              </p>
              {isSubscribed && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Heart className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-900">We care about you!</span>
                  </div>
                  <p className="text-xs text-blue-700">
                    Since you may no longer need our job tracking service, would you like to cancel your subscription to
                    avoid unnecessary charges?
                  </p>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={handleContinue} className="w-full">
                {isSubscribed ? "Continue" : "Awesome!"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                <Sparkles className="h-8 w-8 text-blue-600" />
              </div>
              <DialogTitle>Manage Your Subscription</DialogTitle>
              <DialogDescription className="text-center">
                {
                  "Since you've received an offer, you might not need to track applications anymore. We want to make sure you're not paying for something you don't need."
                }
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h4 className="font-medium text-green-900 mb-2">Keep Your Subscription If:</h4>
                <ul className="text-sm text-green-700 space-y-1">
                  <li>• {"You're still considering other offers"}</li>
                  <li>• You want to keep your application history</li>
                  <li>• {"You might job search again soon"}</li>
                </ul>
              </div>
              <div className="bg-orange-50 p-4 rounded-lg">
                <h4 className="font-medium text-orange-900 mb-2">Cancel Your Subscription If:</h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  <li>• {"You've accepted the offer"}</li>
                  <li>• {"You won't be job searching for a while"}</li>
                  <li>• You want to avoid unnecessary charges</li>
                </ul>
              </div>
            </div>
            <DialogFooter className="flex-col space-y-2">
              <Button onClick={handleCancelSubscription} variant="outline" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Canceling...
                  </>
                ) : (
                  "Cancel My Subscription"
                )}
              </Button>
              <Button onClick={onClose} className="w-full" disabled={loading}>
                Keep My Subscription
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
