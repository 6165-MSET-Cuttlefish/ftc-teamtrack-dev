import { Component, ErrorInfo, ReactNode } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  RotateCcw,
  RefreshCw,
  Home,
  WifiOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isChunkLoadError } from '@/lib/lazyWithRetry';

const STEP_NUMBER =
  'w-4 shrink-0 text-right tabular-nums text-team-blue font-medium mt-px';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  /**
   * Clears the error when this value changes. The route boundary passes the
   * pathname, so navigating away from a broken page shows the next one.
   */
  resetKey?: string;
  /** Fill the page area under the header instead of the whole screen. */
  inline?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
  retryCount: number;
  resetKey?: string;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, retryCount: 0, resetKey: props.resetKey };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  static getDerivedStateFromProps(
    props: ErrorBoundaryProps,
    state: ErrorBoundaryState
  ): Partial<ErrorBoundaryState> | null {
    if (props.resetKey === state.resetKey) return null;
    return {
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      resetKey: props.resetKey,
    };
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

      // Inline, it fills the page area under the header (main is a flex
      // column); on its own, the whole screen.
      const frame = `${this.props.inline ? 'flex-1' : 'min-h-screen'} flex items-center justify-center p-4 bg-background`;

      // A page whose code could not be downloaded (offline, or the app was
      // updated while this tab was open). React.lazy never retries a failed
      // import, so "Try Again" cannot help here — only a reload can.
      if (isChunkLoadError(this.state.error)) {
        return (
          <div className={frame} role="alert">
            <div className="max-w-md w-full text-center">
              <div className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center bg-team-blue/10 mb-6">
                <WifiOff className="h-8 w-8 text-team-blue" />
              </div>

              <h1 className="text-2xl font-bold text-foreground mb-2">
                This page couldn't load
              </h1>
              <p className="text-sm text-muted-foreground mb-6">
                The connection dropped or the app was updated while this
                tab was open. Check your connection, then reload. Going back
                keeps you on the page you were using.
              </p>

              <div className="flex gap-3 justify-center">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="gap-2"
                >
                  <RefreshCw className="h-4 w-4" />
                  Reload
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.history.back()}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Go back
                </Button>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className={frame}>
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

            {/* Numbers in a fixed, right-aligned column, so every step's
                text starts at the same edge */}
            <ul className="text-sm text-left text-muted-foreground mb-6 space-y-2 max-w-xs mx-auto">
              <li className="flex items-start gap-2">
                <span className={STEP_NUMBER}>1.</span>
                Click "Try again" to re-render the page
              </li>
              <li className="flex items-start gap-2">
                <span className={STEP_NUMBER}>2.</span>
                Refresh the page to start fresh
              </li>
              <li className="flex items-start gap-2">
                <span className={STEP_NUMBER}>3.</span>
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
                  Try again
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
