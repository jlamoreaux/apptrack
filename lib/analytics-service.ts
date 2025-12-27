import type { PermissionLevel } from "@/types";
import type { LocationContext } from "@/lib/types/analytics";

// Analytics service interface for dependency injection
export interface AnalyticsService {
  trackCardClick: (params: CardClickParams) => void;
  trackExternalLinkClick: (params: ExternalLinkParams) => void;
  trackListView: (params: ListViewParams) => void;
  calculateDaysSinceApplied: (dateApplied: string) => number;
}

export interface CardClickParams {
  application_id: string;
  company_name: string;
  application_status: string;
  days_since_applied: number;
  interaction_method: 'click' | 'keyboard';
  location: LocationContext;
  card_position: number;
  subscription_plan: PermissionLevel;
  user_id?: string;
}

export interface ExternalLinkParams {
  application_id: string;
  company_name: string;
  application_status: string;
  days_since_applied: number;
  subscription_plan: PermissionLevel;
  user_id?: string;
}

export interface ListViewParams {
  total_applications: number;
  displayed_applications: number;
  has_filters_applied: boolean;
  view_type: LocationContext;
  subscription_plan: PermissionLevel;
  user_id: string;
}

// Default no-op analytics service for testing/disabled scenarios
export const noOpAnalyticsService: AnalyticsService = {
  trackCardClick: () => {},
  trackExternalLinkClick: () => {},
  trackListView: () => {},
  calculateDaysSinceApplied: (dateApplied: string) => {
    const appliedDate = new Date(dateApplied);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - appliedDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  },
};

// Vercel Analytics implementation
export class VercelAnalyticsService implements AnalyticsService {
  constructor(private trackingFunction: (eventName: string, properties: Record<string, any>) => void) {}

  trackCardClick(params: CardClickParams): void {
    this.trackingFunction('application_card_clicked', {
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  trackExternalLinkClick(params: ExternalLinkParams): void {
    this.trackingFunction('application_external_link_clicked', {
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  trackListView(params: ListViewParams): void {
    this.trackingFunction('application_list_viewed', {
      ...params,
      timestamp: new Date().toISOString(),
    });
  }

  calculateDaysSinceApplied(dateApplied: string): number {
    const appliedDate = new Date(dateApplied);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - appliedDate.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}