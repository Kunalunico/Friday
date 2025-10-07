import { Loader2, Wifi, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type LoadingStateProps = {
  type: 'uploading' | 'processing' | 'thinking' | 'searching' | 'error' | 'offline';
  message?: string;
  onRetry?: () => void;
  progress?: number;
};

export const LoadingState = ({ type, message, onRetry, progress }: LoadingStateProps) => {
  const getLoadingContent = () => {
    switch (type) {
      case 'uploading':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
          title: 'Uploading file...',
          description: message || 'Please wait while we upload your file',
          showProgress: true
        };
      case 'processing':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
          title: 'Processing...',
          description: message || 'Analyzing your document',
          showProgress: true
        };
      case 'thinking':
        return {
          icon: (
            <div className="flex space-x-1">
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]"></div>
              <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
            </div>
          ),
          title: 'AI is thinking...',
          description: message || 'Generating response',
          showProgress: false
        };
      case 'searching':
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-green-400" />,
          title: 'Searching the web...',
          description: message || 'Finding relevant information',
          showProgress: false
        };
      case 'error':
        return {
          icon: <AlertTriangle className="h-5 w-5 text-destructive" />,
          title: 'Something went wrong',
          description: message || 'An error occurred while processing your request',
          showProgress: false
        };
      case 'offline':
        return {
          icon: <Wifi className="h-5 w-5 text-muted-foreground" />,
          title: 'No connection',
          description: message || 'Please check your internet connection',
          showProgress: false
        };
      default:
        return {
          icon: <Loader2 className="h-5 w-5 animate-spin text-primary" />,
          title: 'Loading...',
          description: message || 'Please wait',
          showProgress: false
        };
    }
  };

  const content = getLoadingContent();

  return (
    <div className="flex items-center justify-center p-6">
      <div className="text-center space-y-4 max-w-sm">
        <div className="flex justify-center">
          {content.icon}
        </div>
        
        <div className="space-y-2">
          <h3 className="font-medium text-foreground">{content.title}</h3>
          <p className="text-sm text-muted-foreground">{content.description}</p>
        </div>

        {content.showProgress && typeof progress === 'number' && (
          <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
            <div 
              className="h-2 bg-primary rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
            />
          </div>
        )}

        {type === 'error' && onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="gap-2"
          >
            <Loader2 className="h-4 w-4" />
            Try Again
          </Button>
        )}

        {type === 'offline' && onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="gap-2"
          >
            <Wifi className="h-4 w-4" />
            Retry
          </Button>
        )}
      </div>
    </div>
  );
};

// Mini loading component for inline use
export const MiniLoader = ({ className = "" }: { className?: string }) => (
  <div className={`inline-flex items-center gap-2 ${className}`}>
    <Loader2 className="h-4 w-4 animate-spin text-primary" />
    <span className="text-sm text-muted-foreground">Loading...</span>
  </div>
);

// Skeleton loader for message bubbles
export const MessageSkeleton = () => (
  <div className="flex items-start gap-3 max-w-[85%] animate-pulse">
    <div className="h-8 w-8 bg-muted rounded-full" />
    <div className="flex-1 space-y-2">
      <div className="h-4 bg-muted rounded w-3/4" />
      <div className="h-4 bg-muted rounded w-1/2" />
      <div className="h-4 bg-muted rounded w-2/3" />
    </div>
  </div>
);