import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RotateCcw, RefreshCw, Home } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState(prev => ({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: prev.retryCount + 1,
    }));
  };

  render() {
    if (this.state.hasError) {
      // If we've retried too many times, don't offer "Try Again" to avoid infinite loops
      const maxRetries = 3;
      const canRetry = this.state.retryCount < maxRetries;
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-background">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-destructive/10 mb-6">
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>

            <h1 className="text-2xl font-bold text-foreground mb-2">
              Something went wrong
            </h1>
            <p className="text-sm text-muted-foreground mb-6">
              An unexpected error occurred. Try one of these steps to recover:
            </p>

            <ul className="text-sm text-left text-muted-foreground mb-6 space-y-2 max-w-xs mx-auto">
              <li className="flex items-start gap-2">
                <span className="text-team-blue font-medium mt-px">1.</span>
                Click "Try Again" to re-render the page
              </li>
              <li className="flex items-start gap-2">
                <span className="text-team-blue font-medium mt-px">2.</span>
                Refresh the page to start fresh
              </li>
              <li className="flex items-start gap-2">
                <span className="text-team-blue font-medium mt-px">3.</span>
                Clear your browser cache if the issue persists
              </li>
            </ul>

            {import.meta.env.DEV && this.state.error && (
              <details className="mt-4 mb-6 p-3 bg-muted rounded-lg text-xs text-left">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  Error Details (dev only)
                </summary>
                <pre className="mt-2 overflow-auto text-destructive whitespace-pre-wrap">
                  {this.state.error.toString()}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex gap-3 justify-center">
              {canRetry && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={this.handleReset}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Try Again
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  // Navigate to sessions using replace to avoid back-button loops
                  window.location.replace('/sessions');
                }}
                className="gap-2"
              >
                <Home className="h-4 w-4" />
                Home
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
