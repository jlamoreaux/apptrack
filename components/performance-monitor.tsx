"use client";

import { useEffect, useRef, useCallback } from "react";

/**
 * Performance monitoring hook for React components
 */
export function usePerformanceMonitor(componentName: string, enabled: boolean = false) {
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);

  // Mark render start
  useEffect(() => {
    if (!enabled) return;
    
    renderStartTime.current = performance.now();
    renderCount.current += 1;
  });

  // Mark render end and log performance
  useEffect(() => {
    if (!enabled) return;
    
    const renderEndTime = performance.now();
    const renderDuration = renderEndTime - renderStartTime.current;
    
    if (renderDuration > 16) { // Flag renders taking longer than 16ms (60fps threshold)
      console.warn(`[Performance] ${componentName} render took ${renderDuration.toFixed(2)}ms (render #${renderCount.current})`);
    }
    
    // Log to analytics if available
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'component_render_time', {
        component_name: componentName,
        render_duration: renderDuration,
        render_count: renderCount.current,
      });
    }
  });

  const measureAsyncOperation = useCallback((operationName: string) => {
    if (!enabled) return () => {};
    
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      console.log(`[Performance] ${componentName}.${operationName} took ${duration.toFixed(2)}ms`);
      
      // Log to analytics if available
      if (typeof window !== 'undefined' && (window as any).gtag) {
        (window as any).gtag('event', 'async_operation_time', {
          component_name: componentName,
          operation_name: operationName,
          duration: duration,
        });
      }
    };
  }, [componentName, enabled]);

  return { measureAsyncOperation };
}

/**
 * Performance monitoring component wrapper
 */
interface PerformanceMonitorProps {
  children: React.ReactNode;
  componentName: string;
  enabled?: boolean;
  threshold?: number; // ms threshold for logging slow renders
}

export function PerformanceMonitor({
  children,
  componentName,
  enabled = process.env.NODE_ENV === 'development',
  threshold = 16,
}: PerformanceMonitorProps) {
  const renderStart = useRef<number>(0);
  const mountTime = useRef<number>(0);

  useEffect(() => {
    if (!enabled) return;
    
    mountTime.current = performance.now();
    
    return () => {
      const unmountTime = performance.now();
      const totalLifetime = unmountTime - mountTime.current;
      console.log(`[Performance] ${componentName} total lifetime: ${totalLifetime.toFixed(2)}ms`);
    };
  }, [componentName, enabled]);

  // Track render performance
  renderStart.current = enabled ? performance.now() : 0;

  useEffect(() => {
    if (!enabled) return;
    
    const renderEnd = performance.now();
    const renderDuration = renderEnd - renderStart.current;
    
    if (renderDuration > threshold) {
      console.warn(`[Performance] ${componentName} slow render: ${renderDuration.toFixed(2)}ms`);
    }
  });

  return <>{children}</>;
}