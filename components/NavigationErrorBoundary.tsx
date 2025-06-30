"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { UI_CONSTANTS } from "@/lib/constants/ui";
import { APP_ROUTES } from "@/lib/constants/routes";
import { ERROR_MESSAGES } from "@/lib/constants/error-messages";

interface NavigationErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface NavigationErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * Error boundary specifically for navigation components
 * Provides graceful fallback UI when navigation fails
 */
export class NavigationErrorBoundary extends React.Component<
  NavigationErrorBoundaryProps,
  NavigationErrorBoundaryState
> {
  constructor(props: NavigationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): NavigationErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    console.error('Navigation Error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <Card className="border-orange-200 bg-orange-50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-orange-800">
              <AlertTriangle className={UI_CONSTANTS.SIZES.ICON.MD} />
              Navigation Error
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`${UI_CONSTANTS.SIZES.TEXT.SM} text-orange-700 mb-4`}>
              Something went wrong loading the navigation. You can still access other parts of the application.
            </p>
            <Button 
              size="sm" 
              variant="outline" 
              onClick={this.handleRetry}
              className="border-orange-300 text-orange-800 hover:bg-orange-100"
            >
              <RefreshCw className={`${UI_CONSTANTS.SIZES.ICON.SM} mr-2`} />
              Retry
            </Button>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple fallback component for when AI Coach features fail to load
 */
export function AICoachFallback() {
  return (
    <Card className="border-purple-200 bg-purple-50">
      <CardContent className="pt-6">
        <div className="text-center space-y-2">
          <AlertTriangle className={`${UI_CONSTANTS.SIZES.ICON.XL} mx-auto text-purple-600`} />
          <p className={`${UI_CONSTANTS.SIZES.TEXT.SM} text-purple-700`}>
            AI Coach features are temporarily unavailable
          </p>
          <Button size="sm" variant="outline" asChild>
            <a href={APP_ROUTES.DASHBOARD.ROOT} className="text-purple-600 border-purple-300">
              Go to Dashboard
            </a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
