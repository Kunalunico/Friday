import { useState, useEffect } from 'react';

type Conversation = {
  id: string;
  title: string;
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    isNew?: boolean;
    isThinking?: boolean;
    isError?: boolean;
    errorType?: 'network' | 'timeout' | 'server' | 'client' | 'unknown';
    timestamp: Date;
    id: string;
  }>;
  document?: File | null;
};

const STORAGE_KEY = 'unico-chat-conversations';
const MAX_CONVERSATIONS = 50; // Limit to prevent localStorage bloat

export const usePersistentStorage = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load conversations from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as Conversation[];
        // Convert timestamp strings back to Date objects
        const conversationsWithDates = parsed.map(conv => ({
          ...conv,
          messages: conv.messages.map(msg => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }))
        }));
        setConversations(conversationsWithDates);
      }
    } catch (error) {
      console.error('Failed to load conversations from localStorage:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save conversations to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return; // Don't save until initial load is complete
    
    try {
      // Limit the number of conversations to save
      const conversationsToSave = conversations.slice(0, MAX_CONVERSATIONS).map(conv => ({
        ...conv,
        // Remove file references as they can't be serialized
        document: null
      }));
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversationsToSave));
    } catch (error) {
      console.error('Failed to save conversations to localStorage:', error);
      // If storage is full, try to clear some old conversations
      try {
        const reducedConversations = conversations.slice(0, MAX_CONVERSATIONS / 2);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedConversations));
      } catch (secondError) {
        console.error('Failed to save even reduced conversations:', secondError);
      }
    }
  }, [conversations, isLoaded]);

  const clearStorage = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      setConversations([]);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  };

  return {
    conversations,
    setConversations,
    clearStorage,
    isLoaded
  };
};