"use client";

import { useState, useCallback, useMemo } from "react";
import { ApplicationCardPresentation } from "./application-card-presentation";
import { ApplicationErrorBoundary } from "@/components/application-error-boundary";
import { usePerformanceMonitor } from "@/components/performance-monitor";
import { useAnalyticsWithFallback } from "@/components/analytics-provider";
import { sanitizeApplicationData, clickRateLimiter } from "@/lib/security/data-sanitizer";
import type { Application, PermissionLevel } from "@/types";
import type { LocationContext } from "@/lib/types/analytics";

/**
 * Props for the ApplicationCard container component
 */
interface ApplicationCardContainerProps {
  /** The application data to display */
  application: Application;
  /** Position of the card in a list (0-indexed) for analytics */
  index?: number;
  /** Location context for analytics tracking */
  location?: LocationContext;
  /** User's subscription plan for analytics */
  userPlan?: PermissionLevel;
  /** User ID for analytics tracking */
  userId?: string;
  /** Additional CSS classes to apply */
  className?: string;
  /** Callback function when edit button is clicked */
  onEdit?: (application: Application) => void;
}

/**
 * Container component for ApplicationCard
 * Handles all business logic, state, and analytics
 */
export function ApplicationCardContainer({
  application,
  index = 0,
  location = 'dashboard',
  userPlan = 'free' as PermissionLevel,
  userId,
  className = '',
  onEdit,
}: ApplicationCardContainerProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Get analytics service from context
  const analytics = useAnalyticsWithFallback();

  // Performance monitoring
  const { measureAsyncOperation } = usePerformanceMonitor('ApplicationCard', process.env.NODE_ENV === 'development');

  // Sanitize application data for security
  const sanitizedApplication = useMemo(() => {
    return sanitizeApplicationData(application);
  }, [application]);

  // Format application date for screen readers
  const formattedDate = application.date_applied 
    ? new Date(application.date_applied).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long', 
        day: 'numeric'
      })
    : 'Not specified';

  const daysSinceApplied = analytics?.calculateDaysSinceApplied(application.date_applied) ?? 0;

  /**
   * Handle card click analytics with rate limiting
   */
  const handleCardClick = useCallback((interactionMethod: 'click' | 'keyboard' = 'click') => {
    const stopMeasure = measureAsyncOperation('handleCardClick');
    
    // Rate limit clicks to prevent abuse
    const rateLimitKey = `${userId || 'anonymous'}-${sanitizedApplication.id}`;
    if (!clickRateLimiter.isAllowed(rateLimitKey)) {
      stopMeasure();
      return;
    }

    if (analytics) {
      try {
        analytics.trackCardClick({
          application_id: sanitizedApplication.id,
          company_name: sanitizedApplication.company,
          application_status: sanitizedApplication.status,
          days_since_applied: analytics.calculateDaysSinceApplied(sanitizedApplication.date_applied),
          interaction_method: interactionMethod,
          location,
          card_position: index,
          subscription_plan: userPlan,
          user_id: userId,
        });
      } catch (error) {
      }
    }
    
    stopMeasure();
  }, [analytics, sanitizedApplication, location, index, userPlan, userId, measureAsyncOperation]);

  /**
   * Handle external link click analytics with security checks
   */
  const handleExternalLinkClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    
    const stopMeasure = measureAsyncOperation('handleExternalLinkClick');
    
    // Verify the link is safe before tracking
    if (!sanitizedApplication.role_link) {
      e.preventDefault();
      stopMeasure();
      return;
    }
    
    if (analytics) {
      try {
        analytics.trackExternalLinkClick({
          application_id: sanitizedApplication.id,
          company_name: sanitizedApplication.company,
          application_status: sanitizedApplication.status,
          days_since_applied: analytics.calculateDaysSinceApplied(sanitizedApplication.date_applied),
          subscription_plan: userPlan,
          user_id: userId,
        });
      } catch (error) {
      }
    }
    
    stopMeasure();
  }, [analytics, sanitizedApplication, userPlan, userId, measureAsyncOperation]);

  /**
   * Handle edit button click
   */
  const handleEditClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (onEdit) {
      onEdit(application);
    }
  }, [onEdit, application]);

  /**
   * Handle keyboard navigation
   */
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick('keyboard');
      // Navigate programmatically since we're preventing default
      window.location.href = `/dashboard/application/${application.id}`;
    }
  }, [handleCardClick, application.id]);

  return (
    <ApplicationErrorBoundary>
      <ApplicationCardPresentation
        application={sanitizedApplication}
        formattedDate={formattedDate}
        daysSinceApplied={daysSinceApplied}
        isHovered={isHovered}
        className={className}
        showEdit={!!onEdit}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={() => handleCardClick('click')}
        onKeyDown={handleKeyDown}
        onExternalLinkClick={handleExternalLinkClick}
        onEditClick={handleEditClick}
      />
    </ApplicationErrorBoundary>
  );
}