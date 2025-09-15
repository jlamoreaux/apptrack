import { useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

type AIFeature = 'resume_analysis' | 'interview_prep' | 'cover_letter' | 'career_advice' | 'job_fit_analysis';

export function useRateLimit() {
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkLimit = useCallback(async (feature: AIFeature): Promise<boolean> => {
    setIsChecking(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('User not authenticated');
        return false;
      }

      // Call the rate limit check endpoint
      const response = await fetch('/api/rate-limit/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Rate limit check failed');
        return false;
      }

      return data.allowed;
    } catch (err) {
      setError('Failed to check rate limit');
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  const getUsageStats = useCallback(async (feature: AIFeature) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const response = await fetch(`/api/rate-limit/usage?feature=${feature}`);
      if (!response.ok) return null;

      return await response.json();
    } catch {
      return null;
    }
  }, []);

  return {
    checkLimit,
    getUsageStats,
    isChecking,
    error,
  };
}