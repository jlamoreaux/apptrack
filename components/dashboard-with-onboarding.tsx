"use client"

import { ReactNode } from 'react'
import { OnboardingProvider } from '@/lib/onboarding/context'
import { OnboardingRenderer } from '@/components/onboarding/onboarding-renderer'
import { useOnboardingTrigger } from '@/hooks/use-onboarding-trigger'

interface DashboardWithOnboardingProps {
  children: ReactNode
}

function DashboardContent({ children }: DashboardWithOnboardingProps) {
  // Check if user needs onboarding
  useOnboardingTrigger()
  
  return (
    <>
      <OnboardingRenderer />
      {children}
    </>
  )
}

export function DashboardWithOnboarding({ children }: DashboardWithOnboardingProps) {
  return (
    <OnboardingProvider>
      <DashboardContent>{children}</DashboardContent>
    </OnboardingProvider>
  )
}