"use client";

import { useState, useEffect, useCallback } from "react";

// Match the actual UsageStats structure from the service
interface UsageStats {
  feature: string;
  hourlyUsed: number;
  hourlyLimit: number;
  hourlyRemaining: number;
  dailyUsed: number;
  dailyLimit: number;
  dailyRemaining: number;
  resetAt: {
    hourly: Date | string;
    daily: Date | string;
  };
}

type AIFeature = 'resume_analysis' | 'interview_prep' | 'cover_letter' | 'career_advice' | 'job_fit_analysis';

interface RateLimitState {
  loading: boolean;
  error: string | null;
  isLimitReached: boolean;
  hourlyUsed: number;
  hourlyLimit: number;
  dailyUsed: number;
  dailyLimit: number;
  hourlyRemaining: number;
  dailyRemaining: number;
  resetTime: Date | null;
  canUseFeature: boolean;
  limitMessage: string | null;
}

export function useRateLimit(feature: AIFeature) {
  const [state, setState] = useState<RateLimitState>({
    loading: true,
    error: null,
    isLimitReached: false,
    hourlyUsed: 0,
    hourlyLimit: 0,
    dailyUsed: 0,
    dailyLimit: 0,
    hourlyRemaining: 0,
    dailyRemaining: 0,
    resetTime: null,
    canUseFeature: true,
    limitMessage: null,
  });

  const checkUsage = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const response = await fetch(`/api/ai-coach/usage?feature=${feature}`);
      if (!response.ok) {
        // If we can't check, assume feature is available
        setState(prev => ({
          ...prev,
          loading: false,
          error: "Unable to check usage limits",
          canUseFeature: true,
        }));
        return;
      }
      
      const data: UsageStats = await response.json();
      
      // Calculate remaining uses
      const hourlyRemaining = Math.max(0, data.hourlyLimit - data.hourlyUsed);
      const dailyRemaining = Math.max(0, data.dailyLimit - data.dailyUsed);
      
      // Check if limit is reached
      const isHourlyLimitReached = data.hourlyUsed >= data.hourlyLimit && data.hourlyLimit > 0;
      const isDailyLimitReached = data.dailyUsed >= data.dailyLimit && data.dailyLimit > 0;
      const isLimitReached = isHourlyLimitReached || isDailyLimitReached;
      
      // Get reset times from the nested structure
      const hourlyResetTime = data.resetAt?.hourly ? new Date(data.resetAt.hourly) : new Date(Date.now() + 3600000);
      const dailyResetTime = data.resetAt?.daily ? new Date(data.resetAt.daily) : new Date(Date.now() + 86400000);
      
      // Determine which limit was hit and create appropriate message
      let limitMessage = null;
      if (isHourlyLimitReached && isDailyLimitReached) {
        limitMessage = "You've reached both your hourly and daily limits for this feature.";
      } else if (isHourlyLimitReached) {
        const minutesUntilReset = Math.ceil((hourlyResetTime.getTime() - Date.now()) / 60000);
        limitMessage = `Hourly limit reached. Resets in ${minutesUntilReset} minute${minutesUntilReset !== 1 ? 's' : ''}.`;
      } else if (isDailyLimitReached) {
        const hoursUntilReset = Math.ceil((dailyResetTime.getTime() - Date.now()) / 3600000);
        limitMessage = `Daily limit reached. Resets in ${hoursUntilReset} hour${hoursUntilReset !== 1 ? 's' : ''}.`;
      }
      
      // Determine if user can use feature
      const canUseFeature = !isLimitReached;
      
      setState({
        loading: false,
        error: null,
        isLimitReached,
        hourlyUsed: data.hourlyUsed,
        hourlyLimit: data.hourlyLimit,
        dailyUsed: data.dailyUsed,
        dailyLimit: data.dailyLimit,
        hourlyRemaining,
        dailyRemaining,
        resetTime: isHourlyLimitReached ? hourlyResetTime : 
                   isDailyLimitReached ? dailyResetTime : null,
        canUseFeature,
        limitMessage,
      });
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: "Unable to check usage limits",
        canUseFeature: true, // Allow usage if we can't check limits
      }));
    }
  }, [feature]);

  // Check usage on mount
  useEffect(() => {
    checkUsage();
    
    // Refresh every minute to update remaining time
    const interval = setInterval(checkUsage, 60000);
    return () => clearInterval(interval);
  }, [checkUsage]);

  // Function to call after using the feature
  const incrementUsage = useCallback(async () => {
    // Re-check usage after a small delay to ensure backend has updated
    setTimeout(() => {
      checkUsage();
    }, 1000);
  }, [checkUsage]);

  return {
    ...state,
    checkUsage,
    incrementUsage,
  };
}