"use client"

import { useEffect, useState } from "react"
import { NavigationStatic } from "@/components/navigation-static"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import Link from "next/link"

export default function DashboardLoading() {
  const [isTimedOut, setIsTimedOut] = useState(false)

  useEffect(() => {
    // Set a timeout to show a refresh option if loading takes too long
    const timeoutId = setTimeout(() => {
      setIsTimedOut(true)
    }, 8000) // 8 seconds timeout

    return () => clearTimeout(timeoutId)
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <NavigationStatic />
      <div className="container mx-auto py-8">
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="text-center space-y-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Loading your dashboard...</p>

            {isTimedOut && (
              <div className="mt-8 space-y-4">
                <p className="text-sm text-muted-foreground">This is taking longer than expected. You can try:</p>
                <div className="flex flex-col gap-2 items-center">
                  <Button
                    variant="outline"
                    onClick={() => window.location.reload()}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Refresh the page
                  </Button>
                  <Link href="/dashboard">
                    <Button variant="link" className="text-sm">
                      Go to dashboard
                    </Button>
                  </Link>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
