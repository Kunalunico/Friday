
import { useState, useRef } from 'react';
import { Upload, Mic, Loader, Send, ChevronDown, Paperclip, MessageCircle, Search, FileText, Mail, Calendar, Globe } from 'lucide-react';
import { Button } from './ui/button';
import { useToast } from "@/hooks/use-toast";
import { VoiceRecordingDialog } from './VoiceRecordingDialog';
import { UploadProgress } from './UploadProgress';
import { sendMessage, performDeepSearch, uploadPdf, ragQueryStream } from '@/services/api';
import { validateFileType, getFileTypeInfo } from '@/utils/fileUtils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { Switch } from './ui/switch';

export const ChatInput = ({ 
  onMessageSent, 
  conversationDocument, 
  onDocumentUploaded 
}: { 
  onMessageSent: (message: string, response: string, isUpdate?: boolean) => void;
  conversationDocument: File | null;
  onDocumentUploaded: (file: File | null) => void;
}) => {
  const [message, setMessage] = useState('');
  const [isVoiceDialogOpen, setIsVoiceDialogOpen] = useState(false);
  const [selectedTool, setSelectedTool] = useState<'chat' | 'deepSearch' | 'markdown'>('chat');
  const [toolStates, setToolStates] = useState({
    gmail: false,
    calendar: false
  });
  const [attachedFile, setAttachedFile] = useState<File | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [assistantId, setAssistantId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{
    show: boolean;
    fileName: string;
    progress: number;
    status: 'uploading' | 'processing' | 'success' | 'error';
    error?: string;
  }>({
    show: false,
    fileName: '',
    progress: 0,
    status: 'uploading'
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const simulateProgress = (onProgress: (progress: number) => void, duration: number = 3000) => {
    let progress = 0;
    const interval = setInterval(() => {
      progress += Math.random() * 15;
      if (progress > 95) progress = 95;
      onProgress(Math.floor(progress));
      
      if (progress >= 95) {
        clearInterval(interval);
      }
    }, duration / 20);
    
    return interval;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isStreaming) return;

    const userMessage = message;
    setMessage('');
    
    console.log('ChatInput: Starting message submission for:', userMessage);
    
    onMessageSent(userMessage, "Friday is thinking...", false);

    try {
      let response = '';
      const documentToUse = attachedFile || conversationDocument;
      
      if (documentToUse) {
        console.log('ChatInput: Processing RAG streaming query with document:', documentToUse.name);
        
        setIsStreaming(true);
        
        await ragQueryStream(
          userMessage, 
          documentToUse, 
          (accumulated: string) => {
            onMessageSent(userMessage, accumulated, true);
          },
          (id: string) => {
            setAssistantId(id);
          },
          (id: string) => {
            setThreadId(id);
          }
        );
        
        if (attachedFile) {
          onDocumentUploaded(attachedFile);
        }
        
        setIsStreaming(false);
        console.log('ChatInput: RAG streaming completed');
        return;
      } else if (selectedTool === 'deepSearch') {
        console.log('ChatInput: Processing web search query');
        const searchData = await performDeepSearch(userMessage);
        
        if (!searchData) {
          throw new Error('Invalid response from search server');
        }
        
        console.log('ChatInput: Web Search Results received successfully');
        response = formatSearchResults(searchData);
      } else if (selectedTool === 'markdown') {
        console.log('ChatInput: Processing markdown conversion');
        const markdownPrompt = `Convert the following text to well-formatted markdown: ${userMessage}`;
        const data = await sendMessage(markdownPrompt);
        
        if (!data || !data.response) {
          throw new Error('Invalid response from server');
        }
        
        console.log('ChatInput: Markdown response received successfully');
        response = data.response;
      } else {
        console.log('ChatInput: Processing regular chat message');
        const data = await sendMessage(userMessage);
        
        if (!data || !data.response) {
          throw new Error('Invalid response from server');
        }
        
        console.log('ChatInput: Chat response received successfully');
        response = data.response;
      }
      
      console.log('ChatInput: Updating message with successful response');
      onMessageSent(userMessage, response, true);
      
    } catch (error) {
      console.error('ChatInput: Error processing message:', error);
      setIsStreaming(false);
      const documentToUse = attachedFile || conversationDocument;
      const toolName = documentToUse ? 'RAG query' :
                       selectedTool === 'deepSearch' ? 'web search' : 
                       selectedTool === 'markdown' ? 'markdown conversion' : 'message';
      
      const errorMessage = `Sorry, I encountered an error while processing your ${toolName}. Please try again.`;
      
      console.log('ChatInput: Updating message with error response');
      onMessageSent(userMessage, errorMessage, true);
      
      toast({
        description: `Failed to ${toolName}. Please try again.`,
        variant: "destructive",
      });
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', { name: file.name, type: file.type, size: file.size });

    // Validate file type and size
    const validation = validateFileType(file);
    if (!validation.isValid) {
      toast({
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    // Show progress indicator
    setUploadProgress({
      show: true,
      fileName: file.name,
      progress: 0,
      status: 'uploading'
    });

    // Simulate upload progress
    const progressInterval = simulateProgress((progress) => {
      setUploadProgress(prev => ({ ...prev, progress }));
    });

    try {
      console.log('Starting file upload process...');
      
      // Switch to processing status
      setTimeout(() => {
        setUploadProgress(prev => ({ 
          ...prev, 
          status: 'processing',
          progress: 100
        }));
      }, 2000);

      const response = await uploadPdf(file);
      
      clearInterval(progressInterval);
      
      console.log('Upload response structure:', Object.keys(response || {}));
      
      if (response) {
        const content = response.markdown_content || response.markdown || response.content || response.text || response.message;
        
        if (content) {
          setUploadProgress(prev => ({ ...prev, status: 'success' }));
          
          setTimeout(() => {
            onMessageSent(`Uploaded ${getFileTypeInfo(file).name}: ${file.name}`, content);
            setUploadProgress(prev => ({ ...prev, show: false }));
          }, 1000);
          
          toast({
            description: "File uploaded and processed successfully!",
          });
        } else {
          throw new Error('No content received from server');
        }
      } else {
        throw new Error('Empty response from server');
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      console.error('Error in handleFileUpload:', error);
      
      let errorMessage = "Failed to upload file.";
      
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        errorMessage = "File processing timed out. Your file might be too large or complex.";
      } else if (error.response?.status) {
        errorMessage += ` Server error ${error.response.status}.`;
      } else if (error.message) {
        errorMessage += ` ${error.message}`;
      }
      
      setUploadProgress(prev => ({ 
        ...prev, 
        status: 'error',
        error: errorMessage
      }));
      
      setTimeout(() => {
        setUploadProgress(prev => ({ ...prev, show: false }));
      }, 5000);
      
      toast({
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAttachmentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Attachment file selected:', { name: file.name, type: file.type, size: file.size });
    
    const validation = validateFileType(file);
    if (!validation.isValid) {
      toast({
        description: validation.error,
        variant: "destructive",
      });
      return;
    }

    setAttachedFile(file);
    const fileInfo = getFileTypeInfo(file);
    toast({
      description: `${fileInfo.icon} File "${file.name}" attached for RAG query.`,
    });
  };

  const clearConversationDocument = () => {
    onDocumentUploaded(null);
    setAttachedFile(null);
    toast({
      description: "Document removed from conversation",
    });
  };

  // Format RAG results to show answer and page images with proper HTML rendering
  const formatRagResults = (data: any) => {
    if (!data) {
      return "No RAG results available.";
    }

    let response = '';
    
    // Add answer
    if (data.answer) {
      response += `${data.answer}\n\n`;
    }
    
    // Add page images if available - format as proper HTML for rendering
    if (data.page_images && data.page_images.length > 0) {
      response += `<div class="page-images-container mt-4">
        <h4 class="text-lg font-medium mb-3 text-primary">📄 Reference Pages</h4>
        <div class="grid grid-cols-2 md:grid-cols-3 gap-4">`;
      
      data.page_images.forEach((imageUrl: string, index: number) => {
        // Ensure the image URL is absolute by adding the API base URL
        const fullImageUrl = imageUrl.startsWith('http') ? imageUrl : `http://127.0.0.1:8000${imageUrl}`;
        response += `
          <div class="page-image-item">
            <img 
              src="${fullImageUrl}" 
              alt="Page ${index + 1}" 
              class="w-full h-auto rounded-lg border border-gray-600 hover:border-primary transition-colors cursor-pointer"
              onclick="window.open('${fullImageUrl}', '_blank')"
            />
            <p class="text-sm text-gray-400 mt-1 text-center">Page ${index + 1}</p>
          </div>`;
      });
      
      response += `
        </div>
      </div>`;
    }
    
    return response;
  };

  // Format search results to show overview first followed by a sources button
  const formatSearchResults = (data: any) => {
    if (!data) {
      return "No search results available.";
    }

    let response = '';
    
    if (data.overview) {
      response += `${data.overview}\n\n`;
    }
    
    response += `<div class="sources-container mt-4" data-sources-available="true">
      <button class="sources-button flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A] border border-gray-600 hover:bg-[#252525] hover:border-primary transition-colors duration-200">
        <span class="sources-icon text-primary">📚</span> 
        <span class="font-medium">Sources</span>
        <span class="bg-primary/20 text-primary px-2 py-0.5 rounded-full text-xs font-medium">${data.total || data.items?.length || 0}</span>
      </button>
    </div>\n\n`;
    
    response += `<div class="sources-content" style="display: none;">`;

    if (data.warning) {
      response += `<div class="search-warning bg-yellow-900/30 border border-yellow-600/50 p-3 rounded-md mb-4">⚠️ ${data.warning}</div>\n\n`;
    }
    
    if (data.items && data.items.length > 0) {
      data.items.forEach((item: any, index: number) => {
        const domain = item.link ? new URL(item.link).hostname : '';
        const favicon = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
        
        response += `<div class="search-result-item mb-4 p-4 rounded-md bg-gray-800/50 border border-gray-700">`;
        response += `<h4 class="text-lg font-medium flex items-center gap-2 mb-2">
          <img src="${favicon}" class="w-4 h-4" onerror="this.onerror=null;this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'16\\' height=\\'16\\' fill=\\'%236b7280\\' viewBox=\\'0 0 16 16\\'%3E%3Cpath d=\\'M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12z\\'/%3E%3C/svg%3E';" />
          ${index + 1}. ${item.title || 'Untitled'}
        </h4>\n`;
        response += `<div class="mb-2 flex items-center text-sm">
          <span class="text-primary mr-1">🔗</span>
          <a href="${item.link}" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline truncate">${item.link}</a>
        </div>\n`;
        
        if (item.snippet) {
          response += `<div class="mb-2 bg-gray-900/50 p-3 rounded border border-gray-700 text-gray-300">
            <span class="font-medium text-gray-400 block mb-1">Snippet:</span>
            ${item.snippet}
          </div>\n`;
        }
        
        if (item.status) {
          const statusColor = item.status >= 200 && item.status < 300 ? 'text-green-500' : 'text-yellow-500';
          response += `<div class="text-sm ${statusColor}">📶 Status: ${item.status}</div>\n`;
        }
        
        if (item.success === false) {
          response += `<div class="text-sm text-red-400">❌ Error: ${item.error || 'Unknown error'}</div>\n`;
        }
        
        if (item.markdown) {
          response += `<div class="content-preview mt-2">
            <details class="bg-gray-900/50 rounded border border-gray-700 overflow-hidden">
              <summary class="cursor-pointer p-2 hover:bg-gray-800/50">Content Preview</summary>
              <div class="p-3 text-sm text-gray-300 overflow-auto max-h-60 font-mono">
                ${item.markdown.substring(0, 300)}...
              </div>
            </details>
          </div>\n`;
        }
        
        response += `</div>`;
      });
    } else {
      response += `<div class="p-4 bg-gray-800/30 border border-gray-700 rounded-md">No sources found.</div>\n`;
    }
    
    response += `</div>`;
    
    return response;
  };

  const handleVoiceRecordingComplete = (transcript: string) => {
    setMessage(transcript);
    toast({
      description: "Voice recording converted to text",
    });
  };

  const getPlaceholderText = () => {
    if (attachedFile || conversationDocument) {
      return "Ask a question about your attached document...";
    }
    switch (selectedTool) {
      case 'deepSearch':
        return "Search the web...";
      case 'markdown':
        return "Enter text to convert to markdown...";
      default:
        return "Ask anything";
    }
  };

  const getToolDisplayName = () => {
    switch (selectedTool) {
      case 'deepSearch':
        return "Web Search";
      case 'markdown':
        return "Markdown";
      default:
        return "Tools";
    }
  };

  return (
    <div className="p-4 flex flex-col items-center">
      {uploadProgress.show && (
        <div className="w-full max-w-3xl mb-4">
          <UploadProgress
            fileName={uploadProgress.fileName}
            progress={uploadProgress.progress}
            status={uploadProgress.status}
            error={uploadProgress.error}
          />
        </div>
      )}
      
      <div className="w-full max-w-3xl flex flex-col gap-2">
        {conversationDocument && !attachedFile && (
          <div className="flex items-center gap-2 text-sm text-blue-400 px-4 py-2 bg-blue-900/20 rounded-lg border border-blue-600/30">
            <Paperclip className="h-4 w-4" />
            <span>Document in conversation: {conversationDocument.name}</span>
            <button 
              onClick={clearConversationDocument}
              className="text-red-400 hover:text-red-300 ml-auto"
              title="Remove document from conversation"
            >
              ✕
            </button>
          </div>
        )}
        
        {attachedFile && (
          <div className="flex items-center gap-2 text-sm text-gray-400 px-4 py-2 bg-gray-800/30 rounded-lg border border-gray-700">
            <Paperclip className="h-4 w-4" />
            <span>Attached: {attachedFile.name}</span>
            <button 
              onClick={() => setAttachedFile(null)}
              className="text-red-400 hover:text-red-300 ml-auto"
            >
              ✕
            </button>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex items-center gap-2 w-full relative">
          <div className="flex-1 bg-[#0D0D0D] rounded-full px-4 py-3 shadow-[0_6px_15px_rgba(63,128,255,0.2)] border border-gray-700 flex items-center">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.json"
              style={{ display: 'none' }}
            />
            
            <input
              type="file"
              ref={attachmentInputRef}
              onChange={handleAttachmentUpload}
              accept=".pdf,.doc,.docx,.txt,.md,.rtf,.csv,.json"
              style={{ display: 'none' }}
            />
            
            {/* Only show paperclip icon when NOT in markdown mode */}
            {selectedTool !== 'markdown' && (
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className={`rounded-full hover:bg-transparent p-1 ${attachedFile || conversationDocument ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                onClick={() => attachmentInputRef.current?.click()}
                title="Attach document for RAG query"
              >
                <Paperclip className="h-5 w-5" />
              </Button>
            )}

            {selectedTool === 'markdown' && (
              <Button 
                type="button"
                variant="ghost" 
                size="icon" 
                className="rounded-full text-gray-400 hover:text-primary hover:bg-transparent p-1"
                onClick={() => fileInputRef.current?.click()}
                title="Upload file for markdown conversion"
              >
                <Upload className="h-5 w-5" />
              </Button>
            )}

            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={getPlaceholderText()}
              className="flex-1 bg-transparent px-2 py-1 text-foreground placeholder:text-gray-500 focus:outline-none"
              disabled={isStreaming}
            />

            <div className="flex items-center space-x-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`rounded-full text-sm transition-all duration-300 flex items-center gap-1.5 ${
                      selectedTool !== 'chat'
                        ? 'bg-primary text-white border-primary hover:bg-primary/90 hover:border-primary/90' 
                        : 'bg-[#222222] text-white hover:bg-[#333333] border-2 border-gray-700 hover:border-primary'
                    }`}
                  >
                    <span>{getToolDisplayName()}</span>
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent 
                  align="end" 
                  className="w-56 bg-[#0D0D0D] border-gray-700 z-50"
                >
                  <DropdownMenuItem 
                    onClick={() => setSelectedTool('chat')}
                    className={`cursor-pointer flex items-center gap-2 ${selectedTool === 'chat' ? 'bg-primary/20 text-primary' : 'text-white hover:bg-gray-800'}`}
                  >
                    <MessageCircle className="h-4 w-4 text-blue-400" />
                    Regular Chat
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSelectedTool('deepSearch')}
                    className={`cursor-pointer flex items-center gap-2 ${selectedTool === 'deepSearch' ? 'bg-primary/20 text-primary' : 'text-white hover:bg-gray-800'}`}
                  >
                    <Search className="h-4 w-4 text-green-400" />
                    Web Search
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={() => setSelectedTool('markdown')}
                    className={`cursor-pointer flex items-center gap-2 ${selectedTool === 'markdown' ? 'bg-primary/20 text-primary' : 'text-white hover:bg-gray-800'}`}
                  >
                    <FileText className="h-4 w-4 text-purple-400" />
                    Markdown
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer flex items-center justify-between gap-2 text-white hover:bg-gray-800"
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-red-400" />
                      Gmail
                    </div>
                    <Switch 
                      checked={toolStates.gmail} 
                      onCheckedChange={(checked) => setToolStates(prev => ({ ...prev, gmail: checked }))}
                    />
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    className="cursor-pointer flex items-center justify-between gap-2 text-white hover:bg-gray-800"
                    onClick={(e) => e.preventDefault()}
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-orange-400" />
                      Calendar
                    </div>
                    <Switch 
                      checked={toolStates.calendar} 
                      onCheckedChange={(checked) => setToolStates(prev => ({ ...prev, calendar: checked }))}
                    />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <Button 
                type="button" 
                size="icon" 
                variant="ghost" 
                className="rounded-full text-gray-400 hover:text-primary hover:bg-transparent p-1"
                onClick={() => setIsVoiceDialogOpen(true)}
                disabled={isStreaming}
              >
                <Mic className="h-5 w-5" />
              </Button>

              <Button 
                type="submit" 
                size="icon" 
                className="rounded-full bg-primary hover:bg-primary/90 p-1"
                disabled={!message.trim() || isStreaming}
              >
                {isStreaming ? <Loader className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </div>
          </div>
        </form>
      </div>
      <div className="mt-2 text-xs text-gray-400 text-center w-full">
        Powered by Kunal Pohakar
      </div>
      
      <VoiceRecordingDialog
        isOpen={isVoiceDialogOpen}
        onClose={() => setIsVoiceDialogOpen(false)}
        onRecordingComplete={handleVoiceRecordingComplete}
      />
    </div>
  );
};
