'use client'

import { useEffect } from 'react'
import posthog from 'posthog-js'
import type { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/browser-client'
import { analyticsAPI } from '@/lib/analytics'

/**
 * Build the person properties to set on the PostHog profile during identify.
 * Without these, person records have email: None and high-intent users can't
 * be identified. Only includes keys with values so we never overwrite an
 * existing property with undefined.
 */
function getPersonProperties(user: User): Record<string, string> {
  const properties: Record<string, string> = {}

  if (user.email) {
    properties.email = user.email
  }

  // Use full_name to match the key set by the server identify route, so person
  // profiles aren't fragmented across two different name properties.
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name
  if (fullName) {
    properties.full_name = fullName
  }

  return properties
}

export function AuthTracker() {
  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Identify user client-side so pageviews are attributed to their UUID.
        // posthog-js persists this in localStorage, so subsequent page loads
        // stay identified without needing to call this again. Set email/name on
        // the person profile so high-intent users are identifiable in PostHog.
        posthog.identify(session.user.id, getPersonProperties(session.user))

        // Identify user server-side (fetches subscription plan + traffic source automatically)
        await analyticsAPI.identify()

        // Track sign in event via API
        await analyticsAPI.trackUserSignIn(
          session.user.app_metadata?.provider || 'email'
        )
      } else if (event === 'INITIAL_SESSION' && session?.user) {
        // Re-establish client-side identity on page load, refreshing the
        // person's email/name properties in case localStorage was cleared.
        posthog.identify(session.user.id, getPersonProperties(session.user))
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