/**
 * Common type definitions for analytics across the application
 */

export type LocationContext = 
  | 'dashboard' 
  | 'applications_page' 
  | 'search_results' 
  | 'full_list' 
  | 'archived';

export type ViewType = LocationContext;