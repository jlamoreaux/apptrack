/**
 * Utilities for handling traffic source tracking
 */

import { TrafficSource, TrafficSourceTrial } from "@/types/promo-codes";

/**
 * Valid traffic sources
 */
const VALID_SOURCES: TrafficSource[] = ["reddit", "linkedin", "twitter", "facebook", "google", "other"];

/**
 * Validate and parse traffic source from URL parameter
 */
export function parseTrafficSource(source: string | null): TrafficSource | null {
  if (!source) return null;
  
  const normalizedSource = source.toLowerCase().trim();
  
  if (VALID_SOURCES.includes(normalizedSource as TrafficSource)) {
    return normalizedSource as TrafficSource;
  }
  
  // Try to match common variations
  const sourceMap: Record<string, TrafficSource> = {
    'r': 'reddit',
    'l': 'linkedin',
    'li': 'linkedin',
    't': 'twitter',
    'tw': 'twitter',
    'f': 'facebook',
    'fb': 'facebook',
    'g': 'google',
    'goog': 'google',
  };
  
  if (sourceMap[normalizedSource]) {
    return sourceMap[normalizedSource];
  }
  
  // Default to 'other' for unrecognized sources
  return 'other';
}

/**
 * Get trial configuration for a traffic source
 */
export function getTrafficSourceTrial(source: TrafficSource): TrafficSourceTrial | null {
  // Only Reddit and LinkedIn have trials currently
  switch (source) {
    case 'reddit':
    case 'linkedin':
      return {
        days: 7,
        type: 'ai_coach_trial',
        source
      };
    default:
      return null;
  }
}

/**
 * Store traffic source data in session storage
 */
export function storeTrafficSource(source: TrafficSource, trial?: TrafficSourceTrial): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.setItem('traffic_source', source);
    
    if (trial) {
      sessionStorage.setItem('traffic_source_trial', JSON.stringify(trial));
    }
    
    // Store timestamp for analytics
    sessionStorage.setItem('traffic_source_timestamp', new Date().toISOString());
  } catch (error) {
    // Handle storage errors (e.g., private browsing)
    console.warn('Failed to store traffic source:', error);
  }
}

/**
 * Retrieve traffic source data from session storage
 */
export function getStoredTrafficSource(): {
  source: TrafficSource | null;
  trial: TrafficSourceTrial | null;
  timestamp: string | null;
} {
  if (typeof window === 'undefined') {
    return { source: null, trial: null, timestamp: null };
  }
  
  try {
    const source = sessionStorage.getItem('traffic_source') as TrafficSource | null;
    const trialData = sessionStorage.getItem('traffic_source_trial');
    const timestamp = sessionStorage.getItem('traffic_source_timestamp');
    
    let trial: TrafficSourceTrial | null = null;
    if (trialData) {
      try {
        trial = JSON.parse(trialData);
      } catch (e) {
        console.warn('Failed to parse trial data:', e);
      }
    }
    
    return { source, trial, timestamp };
  } catch (error) {
    // Handle storage errors
    console.warn('Failed to retrieve traffic source:', error);
    return { source: null, trial: null, timestamp: null };
  }
}

/**
 * Clear traffic source data from session storage
 */
export function clearTrafficSource(): void {
  if (typeof window === 'undefined') return;
  
  try {
    sessionStorage.removeItem('traffic_source');
    sessionStorage.removeItem('traffic_source_trial');
    sessionStorage.removeItem('traffic_source_timestamp');
  } catch (error) {
    console.warn('Failed to clear traffic source:', error);
  }
}

/**
 * Check if a traffic source has an active trial offer
 */
export function hasTrialOffer(source: TrafficSource | null): boolean {
  if (!source) return false;
  return ['reddit', 'linkedin'].includes(source);
}

/**
 * Format traffic source for display
 */
export function formatTrafficSource(source: TrafficSource): string {
  const displayNames: Record<TrafficSource, string> = {
    reddit: 'Reddit',
    linkedin: 'LinkedIn',
    twitter: 'Twitter',
    facebook: 'Facebook',
    google: 'Google',
    other: 'Other'
  };
  
  return displayNames[source] || source;
}