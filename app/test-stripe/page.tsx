"use client"

import { Navigation } from "@/components/navigation"
import { StripeTestPanel } from "@/components/stripe-test-panel"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

export default function TestStripePage() {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="container mx-auto py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>

          <div>
            <h1 className="text-3xl font-bold mb-2">Stripe Integration Test</h1>
            <p className="text-muted-foreground">
              Test your Stripe integration to ensure everything is working correctly before going live.
            </p>
          </div>

          <StripeTestPanel />
        </div>
      </div>
    </div>
  )
}
