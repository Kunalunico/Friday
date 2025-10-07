import React, { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Button } from "./ui/button";
import { Mic, MicOff } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { transcribeAudioFile } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

interface VoiceRecordingDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRecordingComplete: (text: string) => void;
}

// Updated language codes to match BCP-47 format used by the API
const languages = [
  { code: 'en-IN', name: 'English' },
  { code: 'hi-IN', name: 'Hindi' },
  { code: 'bn-IN', name: 'Bengali' },
  { code: 'gu-IN', name: 'Gujarati' },
  { code: 'kn-IN', name: 'Kannada' },
  { code: 'ml-IN', name: 'Malayalam' },
  { code: 'mr-IN', name: 'Marathi' },
  { code: 'od-IN', name: 'Odia' },
  { code: 'pa-IN', name: 'Punjabi' },
  { code: 'ta-IN', name: 'Tamil' },
  { code: 'te-IN', name: 'Telugu' },
];

export const VoiceRecordingDialog = ({
  isOpen,
  onClose,
  onRecordingComplete,
}: VoiceRecordingDialogProps) => {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState('en-IN'); // Changed default to BCP-47 format
  const [isProcessing, setIsProcessing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const { toast } = useToast();

  const startRecording = async () => {
    try {
      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Create MediaRecorder with WAV format for better compatibility
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        await processRecording();
      };

      mediaRecorder.start();
      setIsRecording(true);

    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        description: "Failed to start recording. Please check microphone permissions.",
        variant: "destructive",
      });
    }
  };

  const processRecording = async () => {
    if (audioChunksRef.current.length === 0) return;

    setIsProcessing(true);
    try {
      // Create audio blob from chunks - using WAV format for better API compatibility
      const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
      
      // Convert blob to File object with .wav extension
      const audioFile = new File([audioBlob], 'recording.wav', { type: 'audio/wav' });
      
      // Send to transcription API with language_code parameter
      const response = await transcribeAudioFile(audioFile, selectedLanguage);
      
      // Updated to use 'transcript' field from API response
      if (response && response.transcript) {
        setTranscript(response.transcript);
        toast({
          description: `Audio transcribed successfully (${response.language_code || selectedLanguage})`,
        });
      } else {
        toast({
          description: "No text could be transcribed from the audio",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Error processing recording:', error);
      setIsProcessing(false);
      
      // Enhanced error handling
      let errorMessage = "Failed to transcribe audio";
      
      if (error instanceof Error) {
        if (error.message.includes('timeout')) {
          errorMessage = "Transcription timed out. Please try with shorter audio.";
        } else if (error.message.includes('network')) {
          errorMessage = "Network error. Please check your connection and try again.";
        }
      }
      
      toast({
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }

    setIsRecording(false);
  };

  const toggleRecording = () => {
    if (!isRecording) {
      setTranscript("");
      startRecording();
    } else {
      stopRecording();
    }
  };

  const handleComplete = () => {
    if (transcript.trim()) {
      onRecordingComplete(transcript.trim());
    }
    onClose();
    setIsRecording(false);
    setTranscript("");
  };

  const handleClose = () => {
    if (isRecording) {
      stopRecording();
    }
    onClose();
    setTranscript("");
  };

  // Cleanup on component unmount
  useEffect(() => {
    return () => {
      if (isRecording) {
        stopRecording();
      }
    };
  }, []);

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
            Voice Recording
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col items-center justify-center p-6 space-y-6">
          <div className="w-full">
            <label className="text-sm font-medium mb-2 block">Language</label>
            <Select value={selectedLanguage} onValueChange={setSelectedLanguage} disabled={isRecording || isProcessing}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select language" />
              </SelectTrigger>
              <SelectContent>
                {languages.map((lang) => (
                  <SelectItem key={lang.code} value={lang.code}>
                    {lang.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={toggleRecording}
            disabled={isProcessing}
            className={`w-24 h-24 rounded-full transition-all duration-300 ${
              isRecording 
                ? 'bg-destructive hover:bg-destructive/90 animate-pulse' 
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {isRecording ? (
              <MicOff className="h-12 w-12" />
            ) : (
              <Mic className="h-12 w-12" />
            )}
          </Button>
          <p className="text-sm text-muted-foreground text-center">
            {isProcessing 
              ? "Processing audio..." 
              : isRecording 
                ? "Recording... Click to stop" 
                : "Click to start recording"}
          </p>
          {transcript && (
            <div className="w-full">
              <p className="text-sm font-medium mb-2">Transcript:</p>
              <div className="bg-background border border-border p-4 rounded-md max-h-32 overflow-y-auto">
                {transcript}
              </div>
            </div>
          )}
          <div className="flex space-x-2 w-full justify-end">
            <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
              Cancel
            </Button>
            <Button 
              disabled={!transcript.trim() || isProcessing}
              onClick={handleComplete}
            >
              Use Text
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
