'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { X, Cookie, Settings } from 'lucide-react'
import Link from 'next/link'

export function CookieBanner() {
  const [isVisible, setIsVisible] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true, // Always true, cannot be disabled
    analytics: false,
    marketing: false,
    personalization: false,
  })

  useEffect(() => {
    // Check if user has already made a choice
    const cookieConsent = localStorage.getItem('cookie-consent')
    if (!cookieConsent) {
      setIsVisible(true)
    } else {
      // Load saved preferences
      try {
        const savedPreferences = JSON.parse(cookieConsent)
        setPreferences(savedPreferences)
      } catch (error) {
      }
    }
  }, [])

  const savePreferences = (prefs: typeof preferences) => {
    localStorage.setItem('cookie-consent', JSON.stringify(prefs))
    setIsVisible(false)
    
    // Apply preferences to actual services
    if (!prefs.analytics) {
      // Disable analytics tracking
      if (typeof window !== 'undefined') {
        localStorage.setItem('disable-analytics', 'true')
      }
    } else {
      localStorage.removeItem('disable-analytics')
    }
  }

  const acceptAll = () => {
    const allAccepted = {
      necessary: true,
      analytics: true,
      marketing: true,
      personalization: true,
    }
    setPreferences(allAccepted)
    savePreferences(allAccepted)
  }

  const acceptNecessaryOnly = () => {
    const necessaryOnly = {
      necessary: true,
      analytics: false,
      marketing: false,
      personalization: false,
    }
    setPreferences(necessaryOnly)
    savePreferences(necessaryOnly)
  }

  const saveCustomPreferences = () => {
    savePreferences(preferences)
  }

  if (!isVisible) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t shadow-lg">
      <div className="container mx-auto px-4 py-4">
        {!showPreferences ? (
          // Main banner
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <Cookie className="h-5 w-5 mt-1 text-primary flex-shrink-0" />
              <div className="flex-1">
                <h3 className="font-semibold text-sm mb-1">We use cookies</h3>
                <p className="text-sm text-muted-foreground">
                  We use cookies to enhance your experience, analyze site traffic, and personalize content. 
                  By clicking "Accept All", you consent to our use of cookies. You can manage your preferences or learn more in our{' '}
                  <Link href="/cookies" className="text-primary hover:underline">
                    Cookie Policy
                  </Link>
                  .
                </p>
              </div>
            </div>
            
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPreferences(true)}
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                Preferences
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={acceptNecessaryOnly}
              >
                Necessary Only
              </Button>
              <Button
                size="sm"
                onClick={acceptAll}
              >
                Accept All
              </Button>
            </div>
          </div>
        ) : (
          // Preferences panel
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Cookie Preferences</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowPreferences(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="space-y-4">
              {/* Necessary Cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Necessary Cookies</h4>
                  <p className="text-xs text-muted-foreground">
                    Essential for the website to function properly. Cannot be disabled.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.necessary}
                  disabled
                  className="rounded border-gray-300"
                />
              </div>
              
              {/* Analytics Cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Analytics Cookies</h4>
                  <p className="text-xs text-muted-foreground">
                    Help us understand how visitors interact with our website.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.analytics}
                  onChange={(e) => setPreferences({ ...preferences, analytics: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              
              {/* Marketing Cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Marketing Cookies</h4>
                  <p className="text-xs text-muted-foreground">
                    Used to track visitors and display relevant ads.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.marketing}
                  onChange={(e) => setPreferences({ ...preferences, marketing: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
              
              {/* Personalization Cookies */}
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium text-sm">Personalization Cookies</h4>
                  <p className="text-xs text-muted-foreground">
                    Remember your preferences and customize your experience.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={preferences.personalization}
                  onChange={(e) => setPreferences({ ...preferences, personalization: e.target.checked })}
                  className="rounded border-gray-300"
                />
              </div>
            </div>
            
            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={acceptNecessaryOnly}
                className="flex-1"
              >
                Reject All
              </Button>
              <Button
                size="sm"
                onClick={saveCustomPreferences}
                className="flex-1"
              >
                Save Preferences
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}