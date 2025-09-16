"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSupabaseAuth } from '@/hooks/use-supabase-auth';

interface CachedData {
  resumeText: string | null;
  savedCoverLetters: any[];
  savedInterviewPreps: any[];
  careerAdviceHistory: any[];
  savedResumeAnalyses: any[];
  applications: any[];
  lastFetched: {
    resume: number | null;
    coverLetters: number | null;
    interviewPreps: number | null;
    careerAdvice: number | null;
    resumeAnalyses: number | null;
    applications: number | null;
  };
}

interface AICoachDataContextType {
  data: CachedData;
  loading: {
    resume: boolean;
    coverLetters: boolean;
    interviewPreps: boolean;
    careerAdvice: boolean;
    resumeAnalyses: boolean;
    applications: boolean;
  };
  fetchResume: (force?: boolean) => Promise<string | null>;
  fetchCoverLetters: (force?: boolean) => Promise<any[]>;
  fetchInterviewPreps: (force?: boolean) => Promise<any[]>;
  fetchCareerAdvice: (force?: boolean) => Promise<any[]>;
  fetchResumeAnalyses: (force?: boolean) => Promise<any[]>;
  fetchApplications: (force?: boolean) => Promise<any[]>;
  invalidateCache: (type?: keyof CachedData['lastFetched']) => void;
  preloadAll: () => Promise<void>;
}

const AICoachDataContext = createContext<AICoachDataContextType | undefined>(undefined);

const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes cache

export const AICoachDataProvider: React.FC<{ children: React.ReactNode; initialTab?: string }> = ({ 
  children, 
  initialTab 
}) => {
  const { user } = useSupabaseAuth();
  const fetchingRef = useRef<Record<string, boolean>>({});
  const dataRef = useRef<CachedData>();
  
  const [data, setData] = useState<CachedData>({
    resumeText: null,
    savedCoverLetters: [],
    savedInterviewPreps: [],
    careerAdviceHistory: [],
    savedResumeAnalyses: [],
    applications: [],
    lastFetched: {
      resume: null,
      coverLetters: null,
      interviewPreps: null,
      careerAdvice: null,
      resumeAnalyses: null,
      applications: null,
    },
  });

  const [loading, setLoading] = useState({
    resume: false,
    coverLetters: false,
    interviewPreps: false,
    careerAdvice: false,
    resumeAnalyses: false,
    applications: false,
  });

  // Keep ref in sync with state for use in callbacks
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const isCacheValid = (lastFetched: number | null) => {
    if (!lastFetched) return false;
    return Date.now() - lastFetched < CACHE_DURATION;
  };

  const fetchResume = useCallback(async (force = false): Promise<string | null> => {
    if (!user?.id) return null;
    
    const currentData = dataRef.current || data;
    
    // Return cached data if valid
    if (!force && isCacheValid(currentData.lastFetched.resume) && currentData.resumeText) {
      return currentData.resumeText;
    }

    // Prevent duplicate fetches
    if (fetchingRef.current.resume) {
      return currentData.resumeText;
    }

    fetchingRef.current.resume = true;
    setLoading(prev => ({ ...prev, resume: true }));

    try {
      const response = await fetch('/api/resumes/current');
      if (response.ok) {
        const result = await response.json();
        // Check for both parsed_text and extracted_text (different field names in the database)
        const resumeText = result.resume?.parsed_text || result.resume?.extracted_text || null;
        
        setData(prev => ({
          ...prev,
          resumeText,
          lastFetched: { ...prev.lastFetched, resume: Date.now() },
        }));
        
        return resumeText;
      }
    } catch (error) {
      console.error('Error fetching resume:', error);
    } finally {
      setLoading(prev => ({ ...prev, resume: false }));
      fetchingRef.current.resume = false;
    }
    
    return null;
  }, [user?.id]);

  const fetchCoverLetters = useCallback(async (force = false): Promise<any[]> => {
    if (!user?.id) return [];
    
    const currentData = dataRef.current || data;
    
    if (!force && isCacheValid(currentData.lastFetched.coverLetters)) {
      return currentData.savedCoverLetters;
    }

    if (fetchingRef.current.coverLetters) {
      return currentData.savedCoverLetters;
    }

    fetchingRef.current.coverLetters = true;
    setLoading(prev => ({ ...prev, coverLetters: true }));

    try {
      const response = await fetch('/api/ai-coach/cover-letters');
      if (response.ok) {
        const result = await response.json();
        const coverLetters = result.coverLetters || [];
        
        setData(prev => ({
          ...prev,
          savedCoverLetters: coverLetters,
          lastFetched: { ...prev.lastFetched, coverLetters: Date.now() },
        }));
        
        return coverLetters;
      }
    } catch (error) {
      console.error('Error fetching cover letters:', error);
    } finally {
      setLoading(prev => ({ ...prev, coverLetters: false }));
      fetchingRef.current.coverLetters = false;
    }
    
    return [];
  }, [user?.id]);

  const fetchInterviewPreps = useCallback(async (force = false): Promise<any[]> => {
    if (!user?.id) return [];
    
    const currentData = dataRef.current || data;
    
    if (!force && isCacheValid(currentData.lastFetched.interviewPreps)) {
      return currentData.savedInterviewPreps;
    }

    if (fetchingRef.current.interviewPreps) {
      return currentData.savedInterviewPreps;
    }

    fetchingRef.current.interviewPreps = true;
    setLoading(prev => ({ ...prev, interviewPreps: true }));

    try {
      const response = await fetch('/api/ai-coach/interview-prep/history');
      if (response.ok) {
        const result = await response.json();
        const preps = result.preps || [];
        
        setData(prev => ({
          ...prev,
          savedInterviewPreps: preps,
          lastFetched: { ...prev.lastFetched, interviewPreps: Date.now() },
        }));
        
        return preps;
      }
    } catch (error) {
      console.error('Error fetching interview preps:', error);
    } finally {
      setLoading(prev => ({ ...prev, interviewPreps: false }));
      fetchingRef.current.interviewPreps = false;
    }
    
    return [];
  }, [user?.id]);

  const fetchCareerAdvice = useCallback(async (force = false): Promise<any[]> => {
    if (!user?.id) return [];
    
    const currentData = dataRef.current || data;
    
    if (!force && isCacheValid(currentData.lastFetched.careerAdvice)) {
      return currentData.careerAdviceHistory;
    }

    if (fetchingRef.current.careerAdvice) {
      return currentData.careerAdviceHistory;
    }

    fetchingRef.current.careerAdvice = true;
    setLoading(prev => ({ ...prev, careerAdvice: true }));

    try {
      const response = await fetch('/api/ai-coach/career-advice/history');
      if (response.ok) {
        const result = await response.json();
        const messages = result.messages || [];
        
        setData(prev => ({
          ...prev,
          careerAdviceHistory: messages,
          lastFetched: { ...prev.lastFetched, careerAdvice: Date.now() },
        }));
        
        return messages;
      }
    } catch (error) {
      console.error('Error fetching career advice:', error);
    } finally {
      setLoading(prev => ({ ...prev, careerAdvice: false }));
      fetchingRef.current.careerAdvice = false;
    }
    
    return [];
  }, [user?.id]);

  const fetchResumeAnalyses = useCallback(async (force = false): Promise<any[]> => {
    if (!user?.id) return [];
    
    const currentData = dataRef.current || data;
    
    if (!force && isCacheValid(currentData.lastFetched.resumeAnalyses)) {
      return currentData.savedResumeAnalyses;
    }

    if (fetchingRef.current.resumeAnalyses) {
      return currentData.savedResumeAnalyses;
    }

    fetchingRef.current.resumeAnalyses = true;
    setLoading(prev => ({ ...prev, resumeAnalyses: true }));

    try {
      const response = await fetch('/api/ai-coach/resume-analysis/history');
      if (response.ok) {
        const result = await response.json();
        const analyses = result.analyses || [];
        
        setData(prev => ({
          ...prev,
          savedResumeAnalyses: analyses,
          lastFetched: { ...prev.lastFetched, resumeAnalyses: Date.now() },
        }));
        
        return analyses;
      }
    } catch (error) {
      console.error('Error fetching resume analyses:', error);
    } finally {
      setLoading(prev => ({ ...prev, resumeAnalyses: false }));
      fetchingRef.current.resumeAnalyses = false;
    }
    
    return [];
  }, [user?.id]);

  const fetchApplications = useCallback(async (force = false): Promise<any[]> => {
    if (!user?.id) return [];
    
    const currentData = dataRef.current || data;
    
    if (!force && isCacheValid(currentData.lastFetched.applications)) {
      return currentData.applications;
    }

    if (fetchingRef.current.applications) {
      return currentData.applications;
    }

    fetchingRef.current.applications = true;
    setLoading(prev => ({ ...prev, applications: true }));

    try {
      const response = await fetch('/api/applications');
      if (response.ok) {
        const apps = await response.json();
        
        setData(prev => ({
          ...prev,
          applications: apps || [],
          lastFetched: { ...prev.lastFetched, applications: Date.now() },
        }));
        
        return apps || [];
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
    } finally {
      setLoading(prev => ({ ...prev, applications: false }));
      fetchingRef.current.applications = false;
    }
    
    return [];
  }, [user?.id]);

  const invalidateCache = useCallback((type?: keyof CachedData['lastFetched']) => {
    if (type) {
      setData(prev => ({
        ...prev,
        lastFetched: { ...prev.lastFetched, [type]: null },
      }));
    } else {
      // Invalidate all
      setData(prev => ({
        ...prev,
        lastFetched: {
          resume: null,
          coverLetters: null,
          interviewPreps: null,
          careerAdvice: null,
          resumeAnalyses: null,
          applications: null,
        },
      }));
    }
  }, []);

  const preloadAll = useCallback(async () => {
    if (!user?.id) return;

    // Fetch all data in parallel but don't await
    const promises = [
      fetchResume(),
      fetchApplications(),
      fetchCoverLetters(),
      fetchInterviewPreps(),
      fetchCareerAdvice(),
      fetchResumeAnalyses(),
    ];

    // Fire and forget - let them complete in background
    Promise.all(promises).catch(error => {
      console.error('Error preloading data:', error);
    });
  }, [user?.id]);

  // Initial load based on tab
  useEffect(() => {
    if (!user?.id) return;

    const loadInitialData = async () => {
      // Always fetch resume and applications as they're commonly used
      const [resumeText] = await Promise.all([
        fetchResume(),
        fetchApplications()
      ]);

      // Fetch specific tab data
      switch (initialTab) {
        case 'cover-letter':
          await fetchCoverLetters();
          break;
        case 'interview':
          await fetchInterviewPreps();
          break;
        case 'advice':
          await fetchCareerAdvice();
          break;
        case 'resume':
          await fetchResumeAnalyses();
          break;
      }

      // Preload other data after initial tab loads
      setTimeout(() => {
        preloadAll();
      }, 1000);
    };

    loadInitialData();
  }, [user?.id, initialTab]);

  const value = {
    data,
    loading,
    fetchResume,
    fetchCoverLetters,
    fetchInterviewPreps,
    fetchCareerAdvice,
    fetchResumeAnalyses,
    fetchApplications,
    invalidateCache,
    preloadAll,
  };

  return (
    <AICoachDataContext.Provider value={value}>
      {children}
    </AICoachDataContext.Provider>
  );
};

export const useAICoachData = () => {
  const context = useContext(AICoachDataContext);
  if (context === undefined) {
    throw new Error('useAICoachData must be used within an AICoachDataProvider');
  }
  return context;
};