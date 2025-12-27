"use client"

import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OnboardingStep, OnboardingAction } from '@/lib/onboarding/types'

interface AnnouncementBannerProps {
  step: OnboardingStep
  onAction: (action: OnboardingAction) => void
  onDismiss?: () => void
}

export function AnnouncementBanner({ step, onAction, onDismiss }: AnnouncementBannerProps) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -100, opacity: 0 }}
        className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground shadow-lg"
      >
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1">
              <div className="flex-1">
                <h3 className="font-semibold text-sm sm:text-base">{step.title}</h3>
                <p className="text-xs sm:text-sm opacity-90">{step.content}</p>
              </div>
              
              {step.actions && (
                <div className="flex gap-2">
                  {step.actions.map((action, index) => (
                    <Button
                      key={index}
                      size="sm"
                      variant={index === 0 && step.actions!.length > 1 ? 'ghost' : 'secondary'}
                      onClick={() => onAction(action)}
                      className="whitespace-nowrap"
                    >
                      {action.label}
                      {action.action === 'next' && <ChevronRight className="ml-1 h-3 w-3" />}
                    </Button>
                  ))}
                </div>
              )}
            </div>
            
            {onDismiss && (
              <button
                onClick={onDismiss}
                className="ml-4 text-primary-foreground/70 hover:text-primary-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}