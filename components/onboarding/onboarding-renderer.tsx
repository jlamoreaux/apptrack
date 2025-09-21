"use client"

import { useOnboarding } from '@/lib/onboarding/context'
import { Spotlight } from './spotlight'
import { OnboardingModal } from './onboarding-modal'
import { AnnouncementBanner } from './announcement-banner'
import { AnimatePresence } from 'framer-motion'

export function OnboardingRenderer() {
  const {
    currentStep,
    currentStepIndex,
    totalSteps,
    handleAction,
    dismissFlow,
    previousStep
  } = useOnboarding()

  if (!currentStep) return null

  const renderStep = () => {
    switch (currentStep.type) {
      case 'modal':
        return (
          <OnboardingModal
            step={currentStep}
            onAction={handleAction}
            onDismiss={currentStep.skippable ? dismissFlow : undefined}
            onPrevious={currentStepIndex > 0 ? previousStep : undefined}
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
          />
        )
      
      case 'spotlight':
      case 'tooltip':
        return (
          <Spotlight
            step={currentStep}
            onAction={handleAction}
            onDismiss={currentStep.skippable ? dismissFlow : undefined}
            onPrevious={currentStepIndex > 0 ? previousStep : undefined}
            currentStepIndex={currentStepIndex}
            totalSteps={totalSteps}
          />
        )
      
      case 'banner':
        return (
          <AnnouncementBanner
            step={currentStep}
            onAction={handleAction}
            onDismiss={currentStep.skippable ? dismissFlow : undefined}
          />
        )
      
      default:
        return null
    }
  }

  return (
    <AnimatePresence mode="wait">
      {renderStep()}
    </AnimatePresence>
  )
}