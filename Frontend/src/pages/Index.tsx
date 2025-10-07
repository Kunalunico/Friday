import { useState, useEffect, useRef } from 'react';
import { Globe, Mail, Calendar, Cloud, Send, ExternalLink } from 'lucide-react';
import { Sidebar } from '../components/Sidebar';
import { ServiceCard } from '../components/ServiceCard';
import { ChatInput } from '../components/ChatInput';
import { MessageBubble } from '../components/MessageBubble';
import { LoadingState, MessageSkeleton } from '../components/LoadingStates';
import { ErrorHandler } from '../components/ErrorHandler';
import { ErrorBoundary } from '../components/ErrorBoundary';

import { usePersistentStorage } from '../hooks/usePersistentStorage';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  isNew?: boolean;
  isThinking?: boolean;
  isError?: boolean;
  errorType?: 'network' | 'timeout' | 'server' | 'client' | 'unknown';
  timestamp: Date;
  id: string;
};

type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  document?: File | null;
};

const Index = () => {
  const { conversations, setConversations, clearStorage, isLoaded } = usePersistentStorage();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isSourcesDialogOpen, setIsSourcesDialogOpen] = useState(false);
  const [dialogContent, setDialogContent] = useState<string>('');
  const [dialogTitle, setDialogTitle] = useState<string>('Sources');
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const [messageCount, setMessageCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingType, setLoadingType] = useState<'uploading' | 'processing' | 'thinking' | 'searching'>('thinking');
  const [lastError, setLastError] = useState<Error | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const services = [
    {
      title: 'Explore',
      description: 'Learn how to use agent capabilities for your needs',
      icon: Globe,
    },
    {
      title: 'Slack',
      description: 'Send messages and updates to your Slack channels',
      icon: Send,
    },
    {
      title: 'Gmail',
      description: 'Compose and send emails through your Gmail account',
      icon: Mail,
    },
    {
      title: 'Calendar',
      description: 'Schedule events and meetings in your Google Calendar',
      icon: Calendar,
    },
    {
      title: 'Weather',
      description: 'Get current weather and forecasts for any location',
      icon: Cloud,
    },
  ];

  const getCurrentConversation = (): Conversation | undefined => {
    return conversations.find(conv => conv.id === currentConversationId);
  };

  const handleMessageSent = (userMessage: string, aiResponse: string, isUpdate = false) => {
    console.log('handleMessageSent called:', { userMessage, aiResponse, isUpdate, currentConversationId });

    // Clear any previous errors
    setLastError(null);

    if (isUpdate) {
      console.log('Updating existing conversation');
      setConversations(prevConvs => {
        const updatedConversations = prevConvs.map(conv => {
          const isTargetConversation = conv.id === currentConversationId ||
            (currentConversationId === null && prevConvs.length === 1);

          if (isTargetConversation) {
            console.log('Found conversation to update:', conv.id);
            const updatedMessages = conv.messages.map((msg, index) => {
              const isLastAssistantMessage = msg.role === 'assistant' &&
                (index === conv.messages.length - 1 ||
                  !conv.messages.slice(index + 1).some(m => m.role === 'assistant'));

              if (isLastAssistantMessage) {
                console.log('Updating assistant message at index:', index, 'with thinking state:', msg.isThinking);

                // Check if response indicates an error
                const isErrorResponse = aiResponse.toLowerCase().includes('sorry, i encountered an error') ||
                  aiResponse.toLowerCase().includes('failed to') ||
                  aiResponse.toLowerCase().includes('error occurred');

                return {
                  ...msg,
                  content: aiResponse,
                  isThinking: false,
                  isNew: false,
                  isError: isErrorResponse,
                  errorType: isErrorResponse ? 'server' as const : undefined
                } as Message;
              }
              return msg;
            });

            if (currentConversationId === null) {
              console.log('Setting currentConversationId to:', conv.id);
              setCurrentConversationId(conv.id);
            }

            return { ...conv, messages: updatedMessages };
          }
          return conv;
        });

        console.log('Updated conversations after message update');
        setIsLoading(false);
        return updatedConversations;
      });
      console.log('Message updated with response:', aiResponse.substring(0, 50) + '...');
    } else if (!isUpdate) {
      console.log('Creating new conversation or adding to existing');
      const isThinkingResponse = aiResponse === "Unico AI is thinking...";

      if (isThinkingResponse) {
        setIsLoading(true);
        setLoadingType('thinking');
      }

      const timestamp = new Date();
      const newMessages: Message[] = [
        {
          role: 'user',
          content: userMessage,
          isNew: true,
          timestamp,
          id: `user-${Date.now()}`
        },
        {
          role: 'assistant',
          content: aiResponse,
          isThinking: isThinkingResponse,
          timestamp: new Date(timestamp.getTime() + 1),
          id: `assistant-${Date.now()}`
        }
      ];

      if (currentConversationId) {
        console.log('Adding to existing conversation:', currentConversationId);
        setConversations(prevConvs =>
          prevConvs.map(conv =>
            conv.id === currentConversationId
              ? { ...conv, messages: [...conv.messages, ...newMessages] }
              : conv
          )
        );
      } else {
        console.log('Creating brand new conversation');
        const newConversationId = Date.now().toString();
        const newConversation: Conversation = {
          id: newConversationId,
          title: userMessage.slice(0, 20) + (userMessage.length > 20 ? '...' : ''),
          messages: newMessages,
          document: null
        };
        setConversations(prev => [newConversation, ...prev]);
        setCurrentConversationId(newConversationId);
      }

      setShowWelcome(false);
      setShouldAutoScroll(true);
      setMessageCount(prev => prev + 2);
    }
  };

  const handleDocumentUploaded = (file: File | null) => {
    if (currentConversationId) {
      setConversations(prevConvs =>
        prevConvs.map(conv =>
          conv.id === currentConversationId
            ? { ...conv, document: file }
            : conv
        )
      );
    }
  };

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldAutoScroll(isNearBottom);
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      if (currentConversationId) {
        setConversations(prevConvs =>
          prevConvs.map(conv =>
            conv.id === currentConversationId
              ? {
                ...conv,
                messages: conv.messages.map(msg => ({ ...msg, isNew: false }))
              }
              : conv
          )
        );
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [conversations, currentConversationId]);

  useEffect(() => {
    const setupSourcesButtons = () => {
      document.querySelectorAll('.sources-button').forEach(button => {
        if (!button.hasAttribute('data-listener')) {
          button.setAttribute('data-listener', 'true');
          button.addEventListener('click', (e) => {
            e.preventDefault();
            const container = (button as HTMLElement).closest('.sources-container');
            if (container) {
              const content = container.parentElement?.querySelector('.sources-content');
              if (content) {
                setDialogTitle('Sources & References');
                setDialogContent((content as HTMLElement).innerHTML);
                setIsSourcesDialogOpen(true);
              }
            }
          });
        }
      });
    };

    setTimeout(setupSourcesButtons, 100);
  }, [conversations]);

  useEffect(() => {
    if (shouldAutoScroll && messageCount > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messageCount, shouldAutoScroll]);

  const handleClearAll = () => {
    console.log('Clearing all conversations');
    clearStorage();
    setCurrentConversationId(null);
    setShowWelcome(true);
    setShouldAutoScroll(true);
    setMessageCount(0);
  };

  const handleSelectConversation = (id: string) => {
    console.log('Selecting conversation:', id);
    setCurrentConversationId(id);
    setShouldAutoScroll(true);
    if (id === null) {
      setShowWelcome(true);
    } else {
      const conversation = conversations.find(conv => conv.id === id);
      setShowWelcome(!conversation?.messages.length);
    }
  };

  const handleRetryMessage = (messageId: string) => {
    // Find the message and resend it
    const currentConv = getCurrentConversation();
    if (!currentConv) return;

    const messageIndex = currentConv.messages.findIndex(msg => msg.id === messageId);
    if (messageIndex === -1) return;

    const message = currentConv.messages[messageIndex];
    if (message.role === 'assistant') {
      // Find the user message that triggered this response
      const userMessage = currentConv.messages[messageIndex - 1];
      if (userMessage && userMessage.role === 'user') {
        handleMessageSent(userMessage.content, "Unico AI is thinking...", false);
      }
    }
  };

  const handleResetChat = () => {
    clearStorage();
    setCurrentConversationId(null);
    setShowWelcome(true);
    setLastError(null);
    setIsLoading(false);
  };

  const currentMessages = getCurrentConversation()?.messages || [];
  const currentDocument = getCurrentConversation()?.document || null;


  // Don't render until storage is loaded
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your conversations...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-background text-foreground">
        <Sidebar
          onClearAll={handleClearAll}
          conversations={conversations}
          setConversations={setConversations}
          onSelectConversation={handleSelectConversation}
          currentConversationId={currentConversationId}
        />

        <div className="flex-1 flex flex-col h-screen">
          <main className="flex-1 flex flex-col min-h-0">
            {(showWelcome || !currentMessages.length) ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8">
                <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
                  Friday
                </h1>
                <p className="text-xl text-secondary mb-12">Good day! How may I assist you today?</p>

                <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                  {services.map((service, index) => (
                    <ServiceCard key={index} {...service} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-hidden">
                <ScrollArea
                  className="h-full px-4 py-4"
                  ref={scrollAreaRef}
                  onScroll={handleScroll}
                >
                  <div className="w-full max-w-none space-y-4">
                    {currentMessages.map((msg) => (
                      <MessageBubble
                        key={msg.id}
                        message={msg}
                        onRetry={msg.isError ? () => handleRetryMessage(msg.id) : undefined}
                      />
                    ))}

                    {isLoading && (
                      <div className="flex justify-start">
                        <MessageSkeleton />
                      </div>
                    )}

                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>
              </div>
            )}
          </main>

          <ErrorBoundary fallback={
            <div className="p-4">
              <ErrorHandler
                errorType="client"
                title="Chat input error"
                description="The chat input encountered an error"
                onRetry={() => window.location.reload()}
                onReset={handleResetChat}
              />
            </div>
          }>
            <ChatInput
              onMessageSent={handleMessageSent}
              conversationDocument={currentDocument}
              onDocumentUploaded={handleDocumentUploaded}
            />
          </ErrorBoundary>
        </div>

        <Dialog open={isSourcesDialogOpen} onOpenChange={setIsSourcesDialogOpen}>
          <DialogContent className="max-w-5xl max-h-[85vh] bg-gradient-to-br from-gray-900/95 to-gray-800/95 border border-gray-600/50 rounded-2xl backdrop-blur-sm shadow-2xl">
            <DialogHeader className="border-b border-gray-600/30 pb-4">
              <DialogTitle className="flex items-center gap-3 text-xl font-semibold">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <ExternalLink className="h-5 w-5 text-primary" />
                </div>
                <span className="bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {dialogTitle}
                </span>
              </DialogTitle>
              <DialogDescription className="text-gray-400 mt-2">
                Web references and content sources used to generate this response
              </DialogDescription>
            </DialogHeader>
            <div className="overflow-y-auto max-h-[60vh] mt-6">
              <div
                className="prose prose-invert prose-headings:text-primary prose-a:text-primary max-w-full sources-dialog-content
                          [&_.sources-container]:bg-gray-800/50 [&_.sources-container]:border-gray-600/30 [&_.sources-container]:rounded-xl [&_.sources-container]:p-4
                          [&_.sources-button]:bg-primary/10 [&_.sources-button]:text-primary [&_.sources-button]:border-primary/30 [&_.sources-button]:hover:bg-primary/20
                          [&_a]:text-primary [&_a]:hover:text-primary/80 [&_a]:transition-colors [&_a]:underline-offset-4"
                dangerouslySetInnerHTML={{ __html: dialogContent }}
              />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
};

export default Index;
