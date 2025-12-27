"use client";

import { useMemo, useEffect, useCallback, useState } from "react";
import { ApplicationCard } from "@/components/application-card";
import { useAnalyticsWithFallback } from "@/components/analytics-provider";
import type { Application, PermissionLevel } from "@/types";
import type { LocationContext } from "@/lib/types/analytics";

/**
 * Props for VirtualizedApplicationList
 */
interface VirtualizedApplicationListProps {
  /** Array of applications to display */
  applications: Application[];
  /** User's subscription plan for analytics */
  userPlan: PermissionLevel;
  /** User ID for analytics tracking */
  userId: string;
  /** Location context for analytics tracking */
  location?: LocationContext;
  /** Height of each item in pixels */
  itemHeight?: number;
  /** Height of the container in pixels */
  containerHeight?: number;
  /** Number of items to render outside visible area */
  overscan?: number;
}

/**
 * VirtualizedApplicationList - Performance optimized list for large datasets
 * 
 * Uses virtual scrolling to render only visible items for better performance
 * with large application lists.
 */
export function VirtualizedApplicationList({
  applications,
  userPlan,
  userId,
  location = 'dashboard',
  itemHeight = 120,
  containerHeight = 600,
  overscan = 5,
}: VirtualizedApplicationListProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);

  // Get analytics service from context
  const analytics = useAnalyticsWithFallback();

  // Calculate visible range
  const visibleRange = useMemo(() => {
    const start = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = start + visibleCount;
    
    return {
      start: Math.max(0, start - overscan),
      end: Math.min(applications.length, end + overscan),
    };
  }, [scrollTop, itemHeight, containerHeight, overscan, applications.length]);

  // Get visible items
  const visibleItems = useMemo(() => {
    return applications.slice(visibleRange.start, visibleRange.end).map((app, index) => ({
      ...app,
      virtualIndex: visibleRange.start + index,
    }));
  }, [applications, visibleRange]);

  // Handle scroll events
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    setIsScrolling(true);
  }, []);

  // Debounce scroll end detection
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setIsScrolling(false);
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [scrollTop]);

  // Track list view analytics
  const analyticsParams = useMemo(() => ({
    total_applications: applications.length,
    displayed_applications: visibleItems.length,
    has_filters_applied: false,
    view_type: location,
    subscription_plan: userPlan,
    user_id: userId,
    is_virtualized: true,
  }), [applications.length, visibleItems.length, location, userPlan, userId]);

  useEffect(() => {
    if (analytics) {
      analytics.trackListView(analyticsParams);
    }
  }, [analytics, analyticsParams]);

  const totalHeight = applications.length * itemHeight;
  const offsetY = visibleRange.start * itemHeight;

  return (
    <div className="space-y-4">
      <div
        className="overflow-auto"
        style={{ height: containerHeight }}
        onScroll={handleScroll}
      >
        <div style={{ height: totalHeight, position: 'relative' }}>
          <div
            style={{
              transform: `translateY(${offsetY}px)`,
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
            }}
          >
            {visibleItems.map((app) => (
              <div
                key={app.id}
                style={{ 
                  height: itemHeight,
                  padding: '8px 0',
                }}
              >
                <ApplicationCard
                  application={app}
                  index={app.virtualIndex}
                  location={location}
                  userPlan={userPlan}
                  userId={userId}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {applications.length > visibleItems.length && (
        <div className="text-center pt-4">
          <p className="text-sm text-muted-foreground">
            Showing {visibleItems.length} of {applications.length} applications
            {isScrolling && " (scrolling...)"}
          </p>
        </div>
      )}
    </div>
  );
}