import { Component, ErrorInfo, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '../ui/alert';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging (removed console statements for production)
    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="max-w-md w-full">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Something went wrong</AlertTitle>
              <AlertDescription className="mt-2">
                An unexpected error occurred. Try one of these steps:
              </AlertDescription>
              <ul className="mt-2 text-sm list-disc pl-5 space-y-1 text-muted-foreground">
                <li>Click "Try Again" to re-render the page</li>
                <li>Refresh the page to start fresh</li>
                <li>Clear your browser cache if the issue persists</li>
              </ul>
              {import.meta.env.DEV && this.state.error && (
                <details className="mt-4 p-2 bg-gray-100 rounded text-xs">
                  <summary className="cursor-pointer">Error Details</summary>
                  <pre className="mt-2 overflow-auto">
                    {this.state.error.toString()}
                    {this.state.errorInfo?.componentStack}
                  </pre>
                </details>
              )}
              <div className="mt-4 flex gap-2">
                <Button variant="outline" size="sm" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                >
                  Refresh Page
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => (window.location.href = '/sessions')}
                >
                  Go Home
                </Button>
              </div>
            </Alert>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
