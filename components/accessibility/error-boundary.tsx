/**
 * Accessibility-Focused Error Boundary Component
 * 
 * Provides graceful error handling with accessibility features:
 * - Announces errors to screen readers
 * - Provides keyboard-accessible recovery options
 * - Maintains proper focus management
 * - Includes comprehensive error reporting
 */

import React, { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorId: string;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: 'page' | 'section' | 'component';
  name?: string;
}

export class AccessibleErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private focusRef = React.createRef<HTMLDivElement>();

  constructor(props: ErrorBoundaryProps) {
    super(props);
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Log error for debugging (remove in production or send to error reporting service)

    // Focus the error announcement for screen readers
    setTimeout(() => {
      if (this.focusRef.current) {
        this.focusRef.current.focus();
      }
    }, 100);
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorId: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { level = 'component', name = 'Component' } = this.props;
      const { error, errorId } = this.state;

      return (
        <div 
          ref={this.focusRef}
          className="error-boundary-container rounded-lg border border-red-200 bg-red-50 p-6 m-4"
          role="alert"
          aria-live="assertive"
          aria-labelledby={`${errorId}-title`}
          aria-describedby={`${errorId}-description`}
          tabIndex={-1}
        >
          <div className="flex items-start space-x-3">
            <div 
              className="flex-shrink-0 text-red-400"
              aria-hidden="true"
            >
              <svg 
                className="h-6 w-6" 
                fill="none" 
                viewBox="0 0 24 24" 
                stroke="currentColor"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" 
                />
              </svg>
            </div>

            <div className="flex-1 min-w-0">
              <h2 
                id={`${errorId}-title`}
                className="text-lg font-medium text-red-800 mb-2"
              >
                {level === 'page' ? 'Page Error' : 
                 level === 'section' ? 'Section Error' : 
                 `${name} Error`}
              </h2>

              <div 
                id={`${errorId}-description`}
                className="text-sm text-red-700 mb-4"
              >
                <p className="mb-2">
                  {level === 'page' 
                    ? 'An error occurred while loading this page. This may be a temporary issue.'
                    : level === 'section'
                    ? 'An error occurred in this section. Other parts of the page should still work normally.'
                    : 'An error occurred in this component. You can try refreshing or continue using other features.'
                  }
                </p>

                {error && (
                  <details className="mt-3">
                    <summary className="cursor-pointer font-medium hover:underline focus:underline focus:outline-none">
                      Technical Details
                    </summary>
                    <div className="mt-2 p-3 bg-red-100 rounded text-xs font-mono break-all">
                      <p><strong>Error:</strong> {error.message}</p>
                      {error.stack && (
                        <pre className="mt-2 whitespace-pre-wrap">
                          {error.stack}
                        </pre>
                      )}
                    </div>
                  </details>
                )}
              </div>

              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={this.handleRetry}
                  variant="outline"
                  size="sm"
                  className="text-red-700 border-red-300 hover:bg-red-100 focus:ring-red-500"
                >
                  Try Again
                </Button>

                {level === 'page' && (
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    size="sm"
                    className="text-red-700 border-red-300 hover:bg-red-100 focus:ring-red-500"
                  >
                    Reload Page
                  </Button>
                )}

                <Button
                  onClick={() => window.history.back()}
                  variant="ghost"
                  size="sm"
                  className="text-red-600 hover:bg-red-100 focus:ring-red-500"
                >
                  Go Back
                </Button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Hook version for functional components
 */
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);

  const resetError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((error: Error) => {
    setError(error);
  }, []);

  React.useEffect(() => {
    if (error) {
      throw error;
    }
  }, [error]);

  return { handleError, resetError };
}

/**
 * Higher-order component for wrapping components with error boundaries
 */
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<ErrorBoundaryProps, 'children'>
) {
  const WrappedComponent = (props: P) => (
    <AccessibleErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </AccessibleErrorBoundary>
  );

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`;
  
  return WrappedComponent;
}

/**
 * Specialized error boundaries for different use cases
 */
export const PageErrorBoundary = ({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) => (
  <AccessibleErrorBoundary level="page" {...props}>
    {children}
  </AccessibleErrorBoundary>
);

export const SectionErrorBoundary = ({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) => (
  <AccessibleErrorBoundary level="section" {...props}>
    {children}
  </AccessibleErrorBoundary>
);

export const ComponentErrorBoundary = ({ children, ...props }: Omit<ErrorBoundaryProps, 'level'>) => (
  <AccessibleErrorBoundary level="component" {...props}>
    {children}
  </AccessibleErrorBoundary>
);

export default AccessibleErrorBoundary;