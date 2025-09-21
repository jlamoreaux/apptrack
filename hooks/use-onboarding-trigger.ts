"use client"

import { useEffect, useState } from 'react'
import { useSupabaseAuthSimple } from '@/hooks/use-supabase-auth-simple'
import { useOnboarding } from '@/lib/onboarding/context'

export function useOnboardingTrigger() {
  const { user } = useSupabaseAuthSimple()
  const { startFlow } = useOnboarding()
  const [hasChecked, setHasChecked] = useState(false)

  useEffect(() => {
    if (!user || hasChecked) return

    const checkUserStatus = async () => {
      try {
        // Call API route to check onboarding status
        const response = await fetch('/api/onboarding/status')
        
        if (!response.ok) {
          console.error('Failed to check onboarding status')
          return
        }
        
        const data = await response.json()
        
        console.log('Onboarding check:', data)
        
        if (data.shouldStartOnboarding) {
          console.log('Starting onboarding flow...')
          await startFlow('new-user-onboarding')
        }
      } catch (error) {
        console.error('Error checking onboarding status:', error)
      }
      
      setHasChecked(true)
    }

    checkUserStatus()
  }, [user, hasChecked, startFlow])
}

export function useFeatureAnnouncement(announcementId: string) {
  const { user } = useSupabaseAuthSimple()
  const [hasSeenAnnouncement, setHasSeenAnnouncement] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setIsLoading(false)
      return
    }

    const checkAnnouncement = async () => {
      try {
        const response = await fetch(`/api/onboarding/announcements?announcementId=${announcementId}`)
        
        if (!response.ok) {
          console.error('Failed to check announcement')
          setIsLoading(false)
          return
        }
        
        const data = await response.json()
        setHasSeenAnnouncement(data.hasSeenAnnouncement)
      } catch (error) {
        console.error('Error checking announcement:', error)
      }
      
      setIsLoading(false)
    }

    checkAnnouncement()
  }, [user, announcementId])

  const markAsSeen = async () => {
    if (!user) return
    
    try {
      const response = await fetch('/api/onboarding/announcements', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ announcementId })
      })
      
      if (response.ok) {
        setHasSeenAnnouncement(true)
      }
    } catch (error) {
      console.error('Error marking announcement as seen:', error)
    }
  }

  return { hasSeenAnnouncement, markAsSeen, isLoading }
}