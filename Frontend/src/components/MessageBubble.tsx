import { User, Bot, AlertCircle, RefreshCw } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { MessageActions } from './MessageActions';
import { MessageTimestamp } from './MessageTimestamp';
import EnhancedMarkdown from './EnhancedMarkdown';

type MessageBubbleProps = {
  message: {
    role: 'user' | 'assistant';
    content: string;
    isNew?: boolean;
    isThinking?: boolean;
    isError?: boolean;
    timestamp: Date;
    id: string;
  };
  onRetry?: () => void;
};

const ThinkingAnimation = () => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-sm">Thinking</span>
      <div className="flex gap-1">
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-[bounce_1.4s_ease-in-out_infinite]"></div>
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-[bounce_1.4s_ease-in-out_0.2s_infinite]"></div>
        <div className="w-1 h-1 bg-muted-foreground rounded-full animate-[bounce_1.4s_ease-in-out_0.4s_infinite]"></div>
      </div>
    </div>
  );
};

const ErrorState = ({ content, onRetry }: { content: string; onRetry?: () => void }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2 text-destructive">
      <AlertCircle className="h-4 w-4" />
      <span className="text-sm font-medium">Error occurred</span>
    </div>
    <p className="text-muted-foreground text-sm">{content}</p>
    {onRetry && (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={onRetry}
        className="gap-2 h-8 text-xs"
      >
        <RefreshCw className="h-3 w-3" />
        Retry
      </Button>
    )}
  </div>
);

const formatMessage = (content: string) => {
  if (content.includes('sources-container') || content.includes('page-images-container')) {
    return (
      <div 
        className="prose prose-invert prose-headings:text-primary prose-a:text-primary max-w-full message-response"
        dangerouslySetInnerHTML={{ __html: content }} 
      />
    );
  }
  return <EnhancedMarkdown content={content} />;
};

export const MessageBubble = ({ message, onRetry }: MessageBubbleProps) => {
  const isUser = message.role === 'user';
  
  return (
    <div
      className={`group flex items-start gap-3 w-full ${
        message.isNew && isUser ? 'animate-fade-in' : ''
      } ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`flex items-start gap-3 max-w-[75%] ${isUser ? 'flex-row-reverse' : ''}`}>
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0 ring-2 ring-border/20">
          <AvatarFallback className={
            isUser 
              ? "bg-primary text-primary-foreground shadow-lg" 
              : "bg-muted text-muted-foreground"
          }>
            {isUser ? <User size={16} /> : <Bot size={16} />}
          </AvatarFallback>
        </Avatar>

        {/* Message Bubble */}
        <div
          className={`
            relative p-4 rounded-2xl shadow-lg transition-all duration-200 group-hover:shadow-xl
            ${isUser 
              ? 'bg-gradient-to-br from-primary via-primary/90 to-primary/80 text-primary-foreground rounded-br-md'
              : message.isError
                ? 'bg-gradient-to-br from-destructive/10 to-destructive/5 border border-destructive/20 text-foreground rounded-bl-md'
                : 'bg-gradient-to-br from-muted/80 to-muted/60 border border-border/50 text-foreground rounded-bl-md'
            }
            
          `}
        >
          {/* Message Content */}
          <div className="break-words">
            {message.isThinking ? (
              <ThinkingAnimation />
            ) : message.isError ? (
              <ErrorState content={message.content} onRetry={onRetry} />
            ) : (
              formatMessage(message.content)
            )}
          </div>
          
          {/* Message Footer */}
          <div className={`mt-3 flex items-center justify-between ${isUser ? 'flex-row-reverse' : ''}`}>
            <MessageTimestamp 
              timestamp={message.timestamp} 
              className="opacity-0 group-hover:opacity-70 transition-opacity text-xs"
            />
            
            {!message.isThinking && !isUser && !message.isError && (
              <div className={isUser ? 'mr-auto' : 'ml-auto'}>
                <MessageActions content={message.content} />
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};