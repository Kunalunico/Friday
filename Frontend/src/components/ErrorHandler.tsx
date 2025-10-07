import { AlertCircle, RefreshCw, Home, Bug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type ErrorType = 'network' | 'timeout' | 'server' | 'client' | 'unknown';

type ErrorHandlerProps = {
  error?: Error;
  errorType?: ErrorType;
  title?: string;
  description?: string;
  onRetry?: () => void;
  onReset?: () => void;
  showDetails?: boolean;
};

const getErrorInfo = (errorType: ErrorType, error?: Error) => {
  switch (errorType) {
    case 'network':
      return {
        icon: <AlertCircle className="h-6 w-6 text-destructive" />,
        title: 'Connection Error',
        description: 'Unable to connect to the server. Please check your internet connection.',
        suggestion: 'Check your network connection and try again.'
      };
    case 'timeout':
      return {
        icon: <AlertCircle className="h-6 w-6 text-yellow-500" />,
        title: 'Request Timeout',
        description: 'The request took too long to complete.',
        suggestion: 'The server might be busy. Please try again in a moment.'
      };
    case 'server':
      return {
        icon: <AlertCircle className="h-6 w-6 text-destructive" />,
        title: 'Server Error',
        description: 'Something went wrong on our end.',
        suggestion: 'Our team has been notified. Please try again later.'
      };
    case 'client':
      return {
        icon: <Bug className="h-6 w-6 text-orange-500" />,
        title: 'Application Error',
        description: 'Something went wrong in the application.',
        suggestion: 'Try refreshing the page or contact support if the issue persists.'
      };
    default:
      return {
        icon: <AlertCircle className="h-6 w-6 text-destructive" />,
        title: 'Unknown Error',
        description: error?.message || 'An unexpected error occurred.',
        suggestion: 'Please try again or contact support if the issue persists.'
      };
  }
};

export const ErrorHandler = ({ 
  error, 
  errorType = 'unknown', 
  title,
  description,
  onRetry, 
  onReset,
  showDetails = false 
}: ErrorHandlerProps) => {
  const errorInfo = getErrorInfo(errorType, error);

  return (
    <Card className="max-w-md mx-auto bg-destructive/5 border-destructive/20">
      <CardHeader className="text-center">
        <div className="flex justify-center mb-2">
          {errorInfo.icon}
        </div>
        <CardTitle className="text-destructive">
          {title || errorInfo.title}
        </CardTitle>
        <CardDescription>
          {description || errorInfo.description}
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground text-center">
          {errorInfo.suggestion}
        </p>

        {showDetails && error && (
          <details className="text-xs">
            <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
              Error Details
            </summary>
            <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
              {error.stack || error.message}
            </pre>
          </details>
        )}

        <div className="flex gap-2 justify-center">
          {onRetry && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onRetry}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Try Again
            </Button>
          )}
          
          {onReset && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onReset}
              className="gap-2"
            >
              <Home className="h-4 w-4" />
              Start Over
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

// Simple inline error display
export const InlineError = ({ 
  message, 
  onRetry 
}: { 
  message: string; 
  onRetry?: () => void; 
}) => (
  <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-2 rounded border border-destructive/20">
    <AlertCircle className="h-4 w-4 flex-shrink-0" />
    <span className="flex-1">{message}</span>
    {onRetry && (
      <Button 
        variant="ghost" 
        size="sm" 
        onClick={onRetry}
        className="h-6 w-6 p-0 hover:bg-destructive/20"
      >
        <RefreshCw className="h-3 w-3" />
      </Button>
    )}
  </div>
);