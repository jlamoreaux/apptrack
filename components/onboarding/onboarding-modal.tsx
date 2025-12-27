"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import type { OnboardingStep, OnboardingAction } from '@/lib/onboarding/types'
import Image from 'next/image'

interface OnboardingModalProps {
  step: OnboardingStep
  onAction: (action: OnboardingAction) => void
  onDismiss?: () => void
  onPrevious?: () => void
  currentStepIndex?: number
  totalSteps?: number
}

export function OnboardingModal({ 
  step, 
  onAction, 
  onDismiss,
  onPrevious,
  currentStepIndex,
  totalSteps 
}: OnboardingModalProps) {
  return (
    <Dialog open={true} onOpenChange={(open) => !open && step.skippable && onDismiss?.()}>
      <DialogContent 
        className="sm:max-w-[500px]" 
        onCloseAutoFocus={(e) => e.preventDefault()}
        onInteractOutside={(e) => !step.skippable && e.preventDefault()}
        onEscapeKeyDown={(e) => !step.skippable && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{step.title}</DialogTitle>
        </DialogHeader>
        
        {step.image && (
          <div className="relative h-48 w-full mb-4">
            <Image
              src={step.image}
              alt={step.title}
              fill
              className="object-contain"
            />
          </div>
        )}
        
        <DialogDescription className="text-base">
          {step.content}
        </DialogDescription>
        
        {/* Progress dots */}
        {totalSteps && totalSteps > 1 && (
          <div className="flex justify-center gap-1 my-4">
            {Array.from({ length: totalSteps }).map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-colors ${
                  index === currentStepIndex 
                    ? 'bg-primary' 
                    : index < (currentStepIndex || 0)
                    ? 'bg-primary/50'
                    : 'bg-muted'
                }`}
              />
            ))}
          </div>
        )}
        
        {(step.actions || onPrevious) && (
          <div className="flex gap-2 justify-between mt-6">
            <div>
              {onPrevious && (
                <Button
                  variant="ghost"
                  onClick={onPrevious}
                >
                  Back
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {step.actions?.map((action, index) => (
                <Button
                  key={index}
                  variant={index === 0 && step.actions!.length > 1 ? 'outline' : 'default'}
                  onClick={() => onAction(action)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}