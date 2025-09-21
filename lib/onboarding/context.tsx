"use client"

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react'
import { useSupabaseAuthSimple } from '@/hooks/use-supabase-auth-simple'
import type { OnboardingFlow, OnboardingStep, OnboardingProgress, OnboardingAction } from './types'
import { getOnboardingFlow, getFlowsByTrigger } from './flows'

interface OnboardingContextType {
  currentFlow: OnboardingFlow | null
  currentStep: OnboardingStep | null
  currentStepIndex: number
  totalSteps: number
  progress: OnboardingProgress | null
  startFlow: (flowId: string) => Promise<void>
  nextStep: () => Promise<void>
  previousStep: () => Promise<void>
  skipStep: () => Promise<void>
  completeFlow: () => Promise<void>
  dismissFlow: () => Promise<void>
  handleAction: (action: OnboardingAction) => Promise<void>
  isLoading: boolean
}

const OnboardingContext = createContext<OnboardingContextType | undefined>(undefined)

interface OnboardingProviderProps {
  children: ReactNode
  trigger?: string // Optional trigger to auto-start flows
}

export function OnboardingProvider({ children, trigger }: OnboardingProviderProps) {
  const { user } = useSupabaseAuthSimple()
  const [currentFlow, setCurrentFlow] = useState<OnboardingFlow | null>(null)
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [progress, setProgress] = useState<OnboardingProgress | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const currentStep = currentFlow?.steps[currentStepIndex] || null
  const totalSteps = currentFlow?.steps.length || 0

  // Load user's onboarding progress
  const loadProgress = useCallback(async (flowId: string) => {
    if (!user) return null
    
    try {
      const response = await fetch(`/api/onboarding/progress?flowId=${flowId}`)
      
      if (!response.ok) {
        console.error('Failed to load onboarding progress')
        return null
      }
      
      const data = await response.json()
      return data.progress || null
    } catch (error) {
      console.error('Error loading onboarding progress:', error)
      return null
    }
  }, [user])

  // Save progress to database
  const saveProgress = useCallback(async (update: Partial<OnboardingProgress>) => {
    if (!user || !currentFlow) return
    
    const progressData = {
      flowId: currentFlow.id,
      flowVersion: currentFlow.version,
      currentStepIndex,
      completedSteps: progress?.completedSteps || [],
      skippedSteps: progress?.skippedSteps || [],
      dismissed: update.dismissed,
      completedAt: update.completedAt,
      ...update
    }
    
    try {
      const response = await fetch('/api/onboarding/progress', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(progressData)
      })
      
      if (!response.ok) {
        console.error('Failed to save onboarding progress')
        return
      }
      
      const data = await response.json()
      setProgress(prev => ({ ...prev, ...progressData } as OnboardingProgress))
    } catch (error) {
      console.error('Error saving onboarding progress:', error)
    }
  }, [user, currentFlow, currentStepIndex, progress])

  // Start a flow
  const startFlow = useCallback(async (flowId: string) => {
    const flow = getOnboardingFlow(flowId)
    if (!flow) return
    
    setIsLoading(true)
    const existingProgress = await loadProgress(flowId)
    
    if (existingProgress && !existingProgress.dismissed) {
      // Resume from where they left off
      setCurrentFlow(flow)
      setCurrentStepIndex(existingProgress.current_step_index || 0)
      setProgress(existingProgress)
    } else if (!existingProgress || flow.resetOnUpdate) {
      // Start fresh
      setCurrentFlow(flow)
      setCurrentStepIndex(0)
      await saveProgress({
        flowId,
        flowVersion: flow.version,
        currentStepIndex: 0,
        startedAt: new Date()
      })
    }
    
    setIsLoading(false)
  }, [loadProgress, saveProgress])

  // Navigation functions
  const nextStep = useCallback(async () => {
    if (!currentFlow || !currentStep) return
    
    const newIndex = Math.min(currentStepIndex + 1, totalSteps - 1)
    setCurrentStepIndex(newIndex)
    
    await saveProgress({
      currentStepIndex: newIndex,
      completedSteps: [...(progress?.completedSteps || []), currentStep.id]
    })
  }, [currentFlow, currentStep, currentStepIndex, totalSteps, progress, saveProgress])

  const previousStep = useCallback(async () => {
    const newIndex = Math.max(currentStepIndex - 1, 0)
    setCurrentStepIndex(newIndex)
    
    await saveProgress({
      currentStepIndex: newIndex
    })
  }, [currentStepIndex, saveProgress])

  const skipStep = useCallback(async () => {
    if (!currentStep) return
    
    await saveProgress({
      skippedSteps: [...(progress?.skippedSteps || []), currentStep.id]
    })
    
    await nextStep()
  }, [currentStep, progress, saveProgress, nextStep])

  const completeFlow = useCallback(async () => {
    if (!currentFlow || !currentStep) return
    
    await saveProgress({
      completedSteps: [...(progress?.completedSteps || []), currentStep.id],
      completedAt: new Date()
    })
    
    setCurrentFlow(null)
    setCurrentStepIndex(0)
    setProgress(null)
  }, [currentFlow, currentStep, progress, saveProgress])

  const dismissFlow = useCallback(async () => {
    if (!currentFlow) return
    
    await saveProgress({
      dismissed: true
    })
    
    setCurrentFlow(null)
    setCurrentStepIndex(0)
    setProgress(null)
  }, [currentFlow, saveProgress])

  const handleAction = useCallback(async (action: OnboardingAction) => {
    switch (action.action) {
      case 'next':
        await nextStep()
        break
      case 'skip':
        await skipStep()
        break
      case 'complete':
        await completeFlow()
        break
      default:
        if (action.onClick) {
          await action.onClick()
        }
        if (action.href) {
          window.location.href = action.href
        }
    }
  }, [nextStep, skipStep, completeFlow])

  // Auto-start flows based on trigger
  useEffect(() => {
    if (trigger && user && !currentFlow) {
      const flows = getFlowsByTrigger(trigger)
      if (flows.length > 0) {
        // Start highest priority flow
        const flow = flows.sort((a, b) => (b.priority || 0) - (a.priority || 0))[0]
        startFlow(flow.id)
      }
    }
  }, [trigger, user, currentFlow, startFlow])

  return (
    <OnboardingContext.Provider
      value={{
        currentFlow,
        currentStep,
        currentStepIndex,
        totalSteps,
        progress,
        startFlow,
        nextStep,
        previousStep,
        skipStep,
        completeFlow,
        dismissFlow,
        handleAction,
        isLoading
      }}
    >
      {children}
    </OnboardingContext.Provider>
  )
}

export function useOnboarding() {
  const context = useContext(OnboardingContext)
  if (!context) {
    throw new Error('useOnboarding must be used within OnboardingProvider')
  }
  return context
}