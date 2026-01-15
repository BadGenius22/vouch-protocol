'use client';

import { Component, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';

/**
 * Props for the WasmErrorBoundary component
 */
interface WasmErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component to render on error */
  fallback?: ReactNode;
  /** Callback when an error is caught */
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  /** Custom title for the error card */
  title?: string;
  /** Custom description for the error card */
  description?: string;
}

/**
 * State for the WasmErrorBoundary component
 */
interface WasmErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorType: 'wasm' | 'network' | 'unknown';
}

/**
 * Error boundary specifically designed for WASM-related failures
 *
 * This handles errors that occur when:
 * - Loading Noir circuits fails
 * - WASM initialization fails (SharedArrayBuffer, COOP/COEP issues)
 * - Proof generation encounters runtime errors
 *
 * Usage:
 * ```tsx
 * <WasmErrorBoundary>
 *   <ProofGeneratorComponent />
 * </WasmErrorBoundary>
 * ```
 */
export class WasmErrorBoundary extends Component<
  WasmErrorBoundaryProps,
  WasmErrorBoundaryState
> {
  constructor(props: WasmErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorType: 'unknown',
    };
  }

  static getDerivedStateFromError(error: Error): WasmErrorBoundaryState {
    // Categorize the error type for better error messages
    const errorMessage = error.message.toLowerCase();
    let errorType: 'wasm' | 'network' | 'unknown' = 'unknown';

    if (
      errorMessage.includes('wasm') ||
      errorMessage.includes('sharedarraybuffer') ||
      errorMessage.includes('cross-origin') ||
      errorMessage.includes('webassembly') ||
      errorMessage.includes('barretenberg') ||
      errorMessage.includes('noir')
    ) {
      errorType = 'wasm';
    } else if (
      errorMessage.includes('fetch') ||
      errorMessage.includes('network') ||
      errorMessage.includes('load')
    ) {
      errorType = 'network';
    }

    return {
      hasError: true,
      error,
      errorType,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    // Log error for debugging
    console.error('[WasmErrorBoundary] Caught error:', error);
    console.error('[WasmErrorBoundary] Error info:', errorInfo);

    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorType: 'unknown',
    });
  };

  handleReload = (): void => {
    window.location.reload();
  };

  getErrorContent(): { title: string; description: string; action: 'retry' | 'reload' } {
    const { errorType, error } = this.state;

    if (errorType === 'wasm') {
      // Check for specific WASM issues
      const errorMessage = error?.message.toLowerCase() || '';

      if (errorMessage.includes('sharedarraybuffer')) {
        return {
          title: 'Browser Security Configuration Required',
          description:
            'Your browser requires specific security headers for ZK proof generation. Please ensure you are accessing this site via HTTPS with proper COOP/COEP headers configured.',
          action: 'reload',
        };
      }

      if (errorMessage.includes('cross-origin')) {
        return {
          title: 'Cross-Origin Restriction',
          description:
            'ZK proof generation requires cross-origin isolation. Please refresh the page or try a different browser.',
          action: 'reload',
        };
      }

      return {
        title: this.props.title || 'ZK Proof Engine Error',
        description:
          this.props.description ||
          'The zero-knowledge proof engine encountered an error. This may be due to browser compatibility or memory constraints. Try refreshing or using a different browser.',
        action: 'reload',
      };
    }

    if (errorType === 'network') {
      return {
        title: 'Network Error',
        description:
          'Failed to load required resources. Please check your internet connection and try again.',
        action: 'retry',
      };
    }

    return {
      title: this.props.title || 'Something Went Wrong',
      description:
        this.props.description ||
        'An unexpected error occurred. Please try again or refresh the page.',
      action: 'retry',
    };
  }

  render(): ReactNode {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { title, description, action } = this.getErrorContent();

      return (
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle
                className="h-5 w-5 text-red-500"
                aria-hidden="true"
              />
              <CardTitle className="text-red-700">{title}</CardTitle>
            </div>
            <CardDescription className="text-red-600">
              {description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3">
              {this.state.error && process.env.NODE_ENV === 'development' && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-red-500 hover:underline">
                    Technical Details
                  </summary>
                  <pre className="mt-2 overflow-auto rounded bg-red-100 p-2 text-xs text-red-700">
                    {this.state.error.message}
                    {this.state.error.stack && (
                      <>
                        {'\n\n'}
                        {this.state.error.stack}
                      </>
                    )}
                  </pre>
                </details>
              )}
              <div className="flex gap-2">
                {action === 'retry' ? (
                  <Button
                    onClick={this.handleRetry}
                    variant="outline"
                    className="gap-2"
                    aria-label="Try again"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Try Again
                  </Button>
                ) : (
                  <Button
                    onClick={this.handleReload}
                    variant="outline"
                    className="gap-2"
                    aria-label="Refresh page"
                  >
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                    Refresh Page
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple error fallback component that can be used standalone
 */
interface ErrorFallbackProps {
  error?: Error;
  resetError?: () => void;
  title?: string;
  description?: string;
}

export function ErrorFallback({
  error,
  resetError,
  title = 'Something went wrong',
  description = 'An error occurred while loading this component.',
}: ErrorFallbackProps): JSX.Element {
  return (
    <Card className="border-red-200 bg-red-50">
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" aria-hidden="true" />
          <CardTitle className="text-red-700">{title}</CardTitle>
        </div>
        <CardDescription className="text-red-600">{description}</CardDescription>
      </CardHeader>
      {(error || resetError) && (
        <CardContent>
          <div className="flex flex-col gap-3">
            {error && process.env.NODE_ENV === 'development' && (
              <pre className="overflow-auto rounded bg-red-100 p-2 text-xs text-red-700">
                {error.message}
              </pre>
            )}
            {resetError && (
              <Button
                onClick={resetError}
                variant="outline"
                className="gap-2 w-fit"
                aria-label="Try again"
              >
                <RefreshCw className="h-4 w-4" aria-hidden="true" />
                Try Again
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
