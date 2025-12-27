'use client'

import { useEffect } from 'react'
import { supabase } from '@/lib/supabase/browser-client'
import { analyticsAPI } from '@/lib/analytics'

export function AuthTracker() {
  useEffect(() => {
    // Listen for auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        // Identify user via API
        await analyticsAPI.identify({
          subscription_plan: 'free', // You can fetch this from your database
        })

        // Track sign in event via API
        await analyticsAPI.trackUserSignIn(
          session.user.app_metadata?.provider || 'email'
        )
      } else if (event === 'SIGNED_OUT') {
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