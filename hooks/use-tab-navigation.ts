/**
 * Custom hook for tab navigation functionality
 * Handles tab state, keyboard navigation, and accessibility
 */

import { useState, useCallback, useMemo, useEffect } from "react"
import { AIAnalysisTab, UseTabNavigationReturn, AIFeatureConfig } from "@/types/ai-analysis"
import { AI_FEATURES_MAP } from "@/lib/constants/ai-analysis"

interface UseTabNavigationOptions {
  defaultTab?: AIAnalysisTab
  availableTabs?: AIAnalysisTab[]
  onTabChange?: (tab: AIAnalysisTab) => void
}

export function useTabNavigation({
  defaultTab = 'job-fit',
  availableTabs,
  onTabChange,
}: UseTabNavigationOptions = {}): UseTabNavigationReturn {
  const [activeTab, setActiveTabState] = useState<AIAnalysisTab>(defaultTab)

  // Filter available tabs if specified
  const tabs = useMemo(() => {
    const allTabs = Array.from(AI_FEATURES_MAP.values())
    if (availableTabs) {
      return allTabs.filter(tab => availableTabs.includes(tab.id))
    }
    return allTabs
  }, [availableTabs])

  const currentTabConfig = useMemo(() => {
    return AI_FEATURES_MAP.get(activeTab)
  }, [activeTab])

  const setActiveTab = useCallback((tab: AIAnalysisTab) => {
    // Validate that the tab is available
    if (!tabs.some(t => t.id === tab)) {
      console.warn(`Attempted to set unavailable tab: ${tab}`)
      return
    }

    setActiveTabState(tab)
    onTabChange?.(tab)
  }, [tabs, onTabChange])

  // Keyboard navigation support
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    
    switch (event.key) {
      case 'ArrowLeft':
      case 'ArrowUp':
        event.preventDefault()
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
        setActiveTab(tabs[prevIndex].id)
        break
        
      case 'ArrowRight':
      case 'ArrowDown':
        event.preventDefault()
        const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
        setActiveTab(tabs[nextIndex].id)
        break
        
      case 'Home':
        event.preventDefault()
        setActiveTab(tabs[0].id)
        break
        
      case 'End':
        event.preventDefault()
        setActiveTab(tabs[tabs.length - 1].id)
        break
    }
  }, [activeTab, tabs, setActiveTab])

  // Navigation utilities
  const goToNextTab = useCallback(() => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    const nextIndex = currentIndex < tabs.length - 1 ? currentIndex + 1 : 0
    setActiveTab(tabs[nextIndex].id)
  }, [activeTab, tabs, setActiveTab])

  const goToPreviousTab = useCallback(() => {
    const currentIndex = tabs.findIndex(tab => tab.id === activeTab)
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : tabs.length - 1
    setActiveTab(tabs[prevIndex].id)
  }, [activeTab, tabs, setActiveTab])

  const isFirstTab = useMemo(() => {
    return tabs.findIndex(tab => tab.id === activeTab) === 0
  }, [activeTab, tabs])

  const isLastTab = useMemo(() => {
    return tabs.findIndex(tab => tab.id === activeTab) === tabs.length - 1
  }, [activeTab, tabs])

  // Validate current tab is still available when tabs change
  useEffect(() => {
    if (!tabs.some(tab => tab.id === activeTab)) {
      // Current tab is no longer available, switch to first available
      if (tabs.length > 0) {
        setActiveTab(tabs[0].id)
      }
    }
  }, [tabs, activeTab, setActiveTab])

  return {
    activeTab,
    setActiveTab,
    currentTabConfig,
    // Additional utilities
    tabs,
    handleKeyDown,
    goToNextTab,
    goToPreviousTab,
    isFirstTab,
    isLastTab,
  }
}