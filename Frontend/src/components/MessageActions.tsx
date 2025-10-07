import { useState } from 'react';
import { Copy, Volume2 } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from '@/hooks/use-toast';
import { textToSpeech } from '@/services/api';

interface MessageActionsProps {
  content: string;
}

export const MessageActions = ({ content }: MessageActionsProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      // Remove HTML tags and clean the text for copying
      const cleanText = content.replace(/<[^>]*>/g, '').replace(/\n\s*\n/g, '\n').trim();
      await navigator.clipboard.writeText(cleanText);
      toast({
        description: "Message copied to clipboard",
      });
    } catch (error) {
      console.error('Failed to copy text:', error);
      toast({
        description: "Failed to copy message",
        variant: "destructive",
      });
    }
  };

  const handleSpeak = async () => {
    if (isPlaying) return;

    try {
      setIsPlaying(true);
      
      // Enhanced text cleaning for better speech synthesis
      let cleanText = content
        // Remove HTML tags completely
        .replace(/<[^>]*>/g, ' ')
        // Remove markdown formatting
        .replace(/\*\*(.*?)\*\*/g, '$1')
        .replace(/__(.*?)__/g, '$1')
        .replace(/\*(.*?)\*/g, '$1')
        .replace(/_(.*?)_/g, '$1')
        // Remove code blocks
        .replace(/```[\s\S]*?```/g, '')
        .replace(/`[^`]*`/g, '')
        // Remove links but keep text
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        // Remove URLs
        .replace(/https?:\/\/[^\s]+/g, '')
        // Clean up extra whitespace and newlines
        .replace(/\n\s*\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      // If the text is still empty or too short after cleaning, provide a fallback
      if (!cleanText || cleanText.length < 3) {
        cleanText = "The response content could not be processed for speech synthesis.";
      }

      console.log('Sending text for speech synthesis:', cleanText);
      
      // Get audio blob from API
      const audioBlob = await textToSpeech(cleanText);
      
      // Create audio URL and play
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      
      audio.onended = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      };
      
      audio.onerror = () => {
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        toast({
          description: "Failed to play audio",
          variant: "destructive",
        });
      };
      
      await audio.play();
      
      toast({
        description: "Playing audio",
      });
      
    } catch (error) {
      console.error('Text-to-speech error:', error);
      setIsPlaying(false);
      
      // Enhanced error handling
      let errorMessage = "Failed to generate speech";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = "Speech generation timed out. Please try with shorter text.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }
      
      toast({
        description: errorMessage,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="flex items-center gap-2 mt-2">
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSpeak}
        disabled={isPlaying}
        className="h-8 w-8 p-0 hover:bg-gray-700"
        title="Read message aloud"
      >
        <Volume2 className={`h-4 w-4 ${isPlaying ? 'animate-pulse text-primary' : 'text-gray-400'}`} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleCopy}
        className="h-8 w-8 p-0 hover:bg-gray-700"
        title="Copy message"
      >
        <Copy className="h-4 w-4 text-gray-400" />
      </Button>
    </div>
  );
};
