'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import { supabase } from '@/lib/supabase/browser-client'
import { analyticsAPI } from '@/lib/analytics'

export function AuthTracker() {
  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Identify user client-side so pageviews are attributed to their UUID.
        // posthog-js persists this in localStorage, so subsequent page loads
        // stay identified without needing to call this again.
        posthog.identify(session.user.id)

        // Identify user server-side (fetches subscription plan + traffic source automatically)
        await analyticsAPI.identify()

        // Track sign in event via API
        await analyticsAPI.trackUserSignIn(
          session.user.app_metadata?.provider || 'email'
        )
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        // Re-establish client-side identity on page load in case localStorage
        // was cleared. This is a no-op if already identified.
        posthog.identify(session.user.id)
      } else if (event === 'SIGNED_OUT') {
        // Clear PostHog identity so the next session starts fresh anonymous
        posthog.reset()

        // Track sign out event via API
        await analyticsAPI.trackUserSignOut()
      } else if (event === 'USER_UPDATED' && session?.user) {
        // Update user properties when profile is updated via API
        await analyticsAPI.identify({
          last_updated: new Date().toISOString(),
        })
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}