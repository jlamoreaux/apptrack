"use client"

import { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { OnboardingStep, OnboardingAction } from '@/lib/onboarding/types'

// Z-index constants for proper layering
const Z_INDEX = {
  HIGHLIGHT_ELEMENT: 9997,
  OVERLAY: 9998, 
  TOOLTIP: 9999
} as const

// Timing constants (in ms)
const TIMING = {
  SCROLL_ANIMATION: 500,
  FALLBACK_DELAY: 2500,
  RETRY_INTERVAL: 200
} as const

// Layout constants
const LAYOUT = {
  MAX_RETRY_ATTEMPTS: 10,
  INITIAL_DELAY: 100,
  TOOLTIP_PADDING: 20,
  SCREEN_EDGE_PADDING: 40,
  TOOLTIP_WIDTH: 384,
  TOOLTIP_HEIGHT: 200,
  HIGHLIGHT_BORDER_OFFSET: 4
} as const

interface SpotlightProps {
  step: OnboardingStep
  onAction: (action: OnboardingAction) => void
  onDismiss?: () => void
  onPrevious?: () => void
  currentStepIndex?: number
  totalSteps?: number
}

export function Spotlight({ step, onAction, onDismiss, onPrevious, currentStepIndex, totalSteps }: SpotlightProps) {
  const [targetElement, setTargetElement] = useState<HTMLElement | null>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!step.target) return

    // Try multiple times to find the element
    let attempts = 0;
    const maxAttempts = LAYOUT.MAX_RETRY_ATTEMPTS;
    let timer: NodeJS.Timeout;
    let intervalTimer: NodeJS.Timeout;
    let resizeObserver: ResizeObserver | null = null;
    let resizeHandler: (() => void) | null = null;
    
    const findAndHighlight = () => {
      const element = document.querySelector(step.target!) as HTMLElement
      
      if (element) {
        setTargetElement(element)
        
        // Function to update rect
        const updateRect = () => {
          if (!element) return
          const rect = element.getBoundingClientRect()
          setTargetRect(rect)
        }
        
        // Check if element is already in viewport
        const initialRect = element.getBoundingClientRect()
        const isInViewport = (
          initialRect.top >= 0 &&
          initialRect.bottom <= window.innerHeight &&
          initialRect.left >= 0 &&
          initialRect.right <= window.innerWidth
        )
        
        // Only scroll if element is not already visible
        if (!isInViewport) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' })
        }
        
        // Wait for scroll to complete, then lock and set up positioning
        setTimeout(() => {
          // NOW lock scrolling after we've scrolled into view
          document.body.style.overflow = 'hidden'
          
          // Initial position update after scroll
          updateRect()
          
          // Add highlight class
          element.classList.add('onboarding-highlight')
          
          // Make sure focus is on the main element, not children
          if (element instanceof HTMLElement) {
            // Add tabindex if needed to make it focusable
            if (!element.hasAttribute('tabindex')) {
              element.setAttribute('tabindex', '-1')
            }
            // Focus with scroll prevention
            element.focus({ preventScroll: true })
            
            // Blur any child elements that might have focus
            const focusedChild = element.querySelector(':focus')
            if (focusedChild instanceof HTMLElement) {
              focusedChild.blur()
            }
          }
          
          // Watch for element size/position changes
          resizeObserver = new ResizeObserver(() => {
            updateRect()
          })
          resizeObserver.observe(element)
          
          // Watch parent elements too for layout changes
          let parent = element.parentElement
          while (parent && parent !== document.body) {
            resizeObserver.observe(parent)
            parent = parent.parentElement
          }
          
          // Also watch for window resize
          resizeHandler = () => updateRect()
          window.addEventListener('resize', resizeHandler)
          
          // Update position periodically in case of animations
          intervalTimer = setInterval(updateRect, 100)
          setTimeout(() => {
            if (intervalTimer) clearInterval(intervalTimer)
          }, 2000) // Stop after 2 seconds
        }, isInViewport ? 0 : TIMING.SCROLL_ANIMATION) // Only wait if we actually scrolled
      } else if (attempts < maxAttempts) {
        attempts++;
        timer = setTimeout(findAndHighlight, TIMING.RETRY_INTERVAL);
      }
    }
    
    timer = setTimeout(findAndHighlight, LAYOUT.INITIAL_DELAY)

    return () => {
      clearTimeout(timer)
      if (intervalTimer) {
        clearInterval(intervalTimer)
      }
      if (resizeObserver) {
        resizeObserver.disconnect()
      }
      if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler)
      }
      const element = document.querySelector(step.target) as HTMLElement
      if (element) {
        element.classList.remove('onboarding-highlight')
      }
      // Restore scrolling
      document.body.style.overflow = ''
    }
  }, [step.target])
  
  // Also restore scrolling when component unmounts
  useEffect(() => {
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  // If target element not found after max attempts, show as modal instead
  const [showFallback, setShowFallback] = useState(false)
  
  // Reset fallback state when step changes
  useEffect(() => {
    setShowFallback(false)
  }, [step.target])
  
  useEffect(() => {
    // Only show fallback after we've tried to find the element
    const fallbackTimer = setTimeout(() => {
      if (!targetElement && step.target) {
        setShowFallback(true)
      }
    }, TIMING.FALLBACK_DELAY) // Wait longer before showing fallback (after all retry attempts)
    
    return () => clearTimeout(fallbackTimer)
  }, [targetElement, step.target])
  
  if (!targetElement || !targetRect) {
    if (!step.target) return null
    
    // Don't show anything initially - wait for element search
    if (!showFallback) return null
    
    return createPortal(
      <AnimatePresence>
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center" style={{ zIndex: Z_INDEX.OVERLAY }}>
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            className="bg-background border-2 border-primary rounded-lg shadow-xl p-6 max-w-md mx-4"
            role="dialog"
            aria-labelledby="onboarding-fallback-title"
            aria-describedby="onboarding-fallback-content"
          >
            {step.skippable && onDismiss && (
              <button
                onClick={onDismiss}
                className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
                aria-label="Skip onboarding"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            
            <h3 id="onboarding-fallback-title" className="font-semibold text-lg mb-2">{step.title}</h3>
            <p id="onboarding-fallback-content" className="text-sm text-muted-foreground mb-4">{step.content}</p>
            <p className="text-xs text-muted-foreground mb-4 italic">
              (The highlighted element could not be found on this page. Navigate to the dashboard to see it.)
            </p>
            
            {/* Progress dots */}
            {totalSteps && totalSteps > 1 && (
              <div className="flex justify-center gap-1 my-3">
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
              <div className="flex gap-2 justify-between">
                <div>
                  {onPrevious && (
                    <Button
                      variant="ghost"
                      size="sm"
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
                      size="sm"
                      onClick={() => onAction(action)}
                    >
                      {action.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      </AnimatePresence>,
      document.body
    )
  }

  // Calculate tooltip position without transforms for better control
  const getTooltipPosition = () => {
    const padding = LAYOUT.TOOLTIP_PADDING
    const screenEdgePadding = LAYOUT.SCREEN_EDGE_PADDING // Minimum distance from screen edges
    const position = step.position || 'bottom'
    const tooltipWidth = LAYOUT.TOOLTIP_WIDTH // max-w-sm
    const tooltipHeight = LAYOUT.TOOLTIP_HEIGHT // Approximate height
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Get scroll position to account for any scrolling
    const scrollX = window.scrollX || window.pageXOffset || 0
    const scrollY = window.scrollY || window.pageYOffset || 0
    
    let top = 0
    let left = 0
    
    switch (position) {
      case 'top':
        // Position above the element
        top = targetRect.top - tooltipHeight - padding
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
        
      case 'bottom':
        // Position below the element
        top = targetRect.bottom + padding
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
        break
        
      case 'left':
        // Position to the left of element
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.left - tooltipWidth - padding
        break
        
      case 'right':
        // Position to the right of element
        top = targetRect.top + targetRect.height / 2 - tooltipHeight / 2
        left = targetRect.right + padding
        break
        
      default:
        // Default to bottom
        top = targetRect.bottom + padding
        left = targetRect.left + targetRect.width / 2 - tooltipWidth / 2
    }
    
    // Ensure tooltip stays within viewport bounds with padding
    // Check right edge
    if (left + tooltipWidth > viewportWidth - screenEdgePadding) {
      left = viewportWidth - tooltipWidth - screenEdgePadding
    }
    
    // Check left edge
    if (left < screenEdgePadding) {
      left = screenEdgePadding
    }
    
    // Check bottom edge
    if (top + tooltipHeight > viewportHeight - screenEdgePadding) {
      top = viewportHeight - tooltipHeight - screenEdgePadding
    }
    
    // Check top edge
    if (top < screenEdgePadding) {
      top = screenEdgePadding
    }
    
    return { top, left }
  }

  const tooltipPosition = getTooltipPosition()

  return createPortal(
    <AnimatePresence>
      <>
        {/* Full viewport overlay with cutout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0"
          style={{ zIndex: Z_INDEX.OVERLAY }}
          onClick={step.skippable ? onDismiss : undefined}
          role="presentation"
          aria-hidden="true"
        >
          <svg
            className="absolute inset-0 w-full h-full"
            style={{ width: '100vw', height: '100vh' }}
          >
            <defs>
              <mask id="spotlight-mask">
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                <rect
                  x={targetRect.left - LAYOUT.HIGHLIGHT_BORDER_OFFSET}
                  y={targetRect.top - LAYOUT.HIGHLIGHT_BORDER_OFFSET}
                  width={targetRect.width + (LAYOUT.HIGHLIGHT_BORDER_OFFSET * 2)}
                  height={targetRect.height + (LAYOUT.HIGHLIGHT_BORDER_OFFSET * 2)}
                  rx="8"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill="rgba(0, 0, 0, 0.7)"
              mask="url(#spotlight-mask)"
            />
          </svg>
        </motion.div>
        
        {/* Highlight border */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="fixed border-2 border-primary rounded-lg pointer-events-none shadow-lg shadow-primary/20"
          style={{
            top: targetRect.top - LAYOUT.HIGHLIGHT_BORDER_OFFSET,
            left: targetRect.left - LAYOUT.HIGHLIGHT_BORDER_OFFSET,
            width: targetRect.width + (LAYOUT.HIGHLIGHT_BORDER_OFFSET * 2),
            height: targetRect.height + (LAYOUT.HIGHLIGHT_BORDER_OFFSET * 2),
            zIndex: Z_INDEX.HIGHLIGHT_ELEMENT
          }}
        />
        
        {/* Tooltip */}
        <motion.div
          ref={tooltipRef}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="fixed bg-background border-2 border-primary rounded-lg shadow-xl p-4"
          style={{
            width: `${LAYOUT.TOOLTIP_WIDTH}px`,
            maxWidth: 'calc(100vw - 80px)',
            top: `${tooltipPosition.top}px`,
            left: `${tooltipPosition.left}px`,
            zIndex: Z_INDEX.TOOLTIP
          }}
          role="dialog"
          aria-labelledby="onboarding-tooltip-title"
          aria-describedby="onboarding-tooltip-content"
        >
          {step.skippable && onDismiss && (
            <button
              onClick={onDismiss}
              className="absolute top-2 right-2 text-muted-foreground hover:text-foreground"
              aria-label="Skip onboarding"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          
          <h3 id="onboarding-tooltip-title" className="font-semibold text-lg mb-2">{step.title}</h3>
          <p id="onboarding-tooltip-content" className="text-sm text-muted-foreground mb-4">{step.content}</p>
          
          {/* Progress dots */}
          {totalSteps && totalSteps > 1 && (
            <div className="flex justify-center gap-1 my-3">
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
            <div className="flex gap-2 justify-between">
              <div>
                {onPrevious && (
                  <Button
                    variant="ghost"
                    size="sm"
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
                    size="sm"
                    onClick={() => onAction(action)}
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </>
    </AnimatePresence>,
    document.body
  )
}