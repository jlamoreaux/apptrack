"use client";

import { createContext, useContext, ReactNode } from 'react';
import { VercelAnalyticsService } from '@/lib/analytics-service';
import { getPlanDisplayName } from '@/lib/utils/plan-helpers';
import { safeTrack } from '@/lib/analytics';
import type { AnalyticsService } from '@/lib/analytics-service';

// Create analytics context
const AnalyticsContext = createContext<AnalyticsService | null>(null);

// Create the analytics service instance on the client side
const createAnalyticsService = (): AnalyticsService => {
  return new VercelAnalyticsService((eventName, properties) => {
    const transformedProperties = {
      ...properties,
      subscription_plan: getPlanDisplayName(properties.subscription_plan),
    };
    
    safeTrack(eventName, transformedProperties);
  });
};

/**
 * Analytics provider component
 */
interface AnalyticsProviderProps {
  children: ReactNode;
}

export function AnalyticsProvider({ children }: AnalyticsProviderProps) {
  // Create analytics service instance on client side only
  const analyticsService = createAnalyticsService();

  return (
    <AnalyticsContext.Provider value={analyticsService}>
      {children}
    </AnalyticsContext.Provider>
  );
}

/**
 * Hook to use analytics service
 */
export function useAnalytics(): AnalyticsService | null {
  return useContext(AnalyticsContext);
}

/**
 * Hook to use analytics service with fallback
 */
export function useAnalyticsWithFallback(): AnalyticsService {
  const analytics = useContext(AnalyticsContext);
  
  if (!analytics) {
    // Return no-op service as fallback
    return {
      trackCardClick: () => {},
      trackExternalLinkClick: () => {},
      trackListView: () => {},
      calculateDaysSinceApplied: (dateApplied: string) => {
        if (!dateApplied) return 0;
        const appliedDate = new Date(dateApplied);
        const now = new Date();
        const diffTime = Math.abs(now.getTime() - appliedDate.getTime());
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      },
    };
  }
  
  return analytics;
}