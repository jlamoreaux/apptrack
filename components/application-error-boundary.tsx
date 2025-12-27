"use client";

import React from "react";
import { AlertTriangle, RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
}

interface ApplicationErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error; retry: () => void }>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

/**
 * Error boundary specifically designed for ApplicationCard components
 * Provides graceful error handling and recovery options
 */
export class ApplicationErrorBoundary extends React.Component<
  ApplicationErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ApplicationErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Log error to analytics or monitoring service
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: Fallback } = this.props;
      
      if (Fallback) {
        return <Fallback error={this.state.error} retry={this.handleRetry} />;
      }

      return <ApplicationCardErrorFallback error={this.state.error} retry={this.handleRetry} />;
    }

    return this.props.children;
  }
}

/**
 * Default fallback component for application card errors
 */
function ApplicationCardErrorFallback({ 
  error, 
  retry 
}: { 
  error?: Error; 
  retry: () => void 
}) {
  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-destructive">
              Failed to load application
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {error?.message || 'An unexpected error occurred'}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={retry}
            className="flex-shrink-0"
            aria-label="Retry loading application"
          >
            <RefreshCcw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/**
 * HOC for wrapping individual application cards with error boundaries
 */
export function withApplicationErrorBoundary<P extends object>(
  Component: React.ComponentType<P>
) {
  const WrappedComponent = (props: P) => (
    <ApplicationErrorBoundary>
      <Component {...props} />
    </ApplicationErrorBoundary>
  );

  WrappedComponent.displayName = `withApplicationErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}