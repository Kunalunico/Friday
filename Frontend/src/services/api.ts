import axios from 'axios';

const API_BASE_URL = 'https://floatstream-ai-agent-842560214476.asia-south1.run.app'; // Updated to use 127.0.0.1

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // Increase timeout to 30 seconds to allow for slower search responses
});

export const sendMessageStream = async (message: string, onChunk: (chunk: string) => void) => {
  try {
    const formData = new FormData();
    formData.append('message', message);
    
    const response = await fetch(`${API_BASE_URL}/chat/stream`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    let accumulatedText = '';
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            if (data.text) {
              accumulatedText += data.text;
              // Call onChunk with the accumulated text for real-time display
              onChunk(accumulatedText);
              // Add a small delay to make streaming more visible
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          } catch (e) {
            console.warn('Failed to parse streaming data:', line);
          }
        }
      }
    }
    
    return accumulatedText;
    
  } catch (error) {
    console.error('Chat streaming API Error:', error);
    throw error;
  }
};

export const sendMessage = async (message: string) => {
  try {
    const formData = new FormData();
    formData.append('message', message);
    
    const response = await apiClient.post('/chat', formData, {
      headers: {
        'Content-Type': 'multipart/form-data', // Set correct content type for FormData
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error; // Re-throw to be handled by the component
  }
};

export const performDeepSearch = async (query: string) => {
  try {
    console.log('Sending search request with query:', query);
    
    // Send as JSON payload with 'q' parameter
    const response = await apiClient.post('/search', { q: query }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    console.log('Search response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Search API Error:', error);
    throw error;
  }
};

export const sendAudio = async (audioFile: File) => {
  const formData = new FormData();
  formData.append('file', audioFile);
  
  const response = await apiClient.post('/audio/transcribe', formData);
  return response.data;
};

export const checkAuthStatus = async () => {
  const response = await apiClient.get('/auth/status');
  return response.data;
};

export const textToSpeech = async (text: string) => {
  try {
    console.log('Sending text-to-speech request:', { text });
    
    const response = await apiClient.post('/text-to-speech/', null, {
      params: {
        text: text
      },
      responseType: 'blob' // Expecting audio file as response
    });
    
    console.log('Text-to-speech response received');
    return response.data;
  } catch (error) {
    console.error('Text-to-speech API Error:', error);
    throw error;
  }
};

export const transcribeAudioFile = async (audioFile: File, languageCode: string) => {
  try {
    console.log('Sending transcription request:', { languageCode, fileName: audioFile.name });
    
    const formData = new FormData();
    formData.append('file', audioFile);
    formData.append('language_code', languageCode); // Changed from 'language' to 'language_code'
    
    const response = await apiClient.post('/transcribe', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      }
    });
    
    console.log('Transcription response received:', response.data);
    return response.data;
  } catch (error) {
    console.error('Transcription API Error:', error);
    throw error;
  }
};

export const uploadPdf = async (pdfFile: File) => {
  try {
    console.log('Uploading PDF file:', { fileName: pdfFile.name, size: pdfFile.size, type: pdfFile.type });
    
    const formData = new FormData();
    formData.append('file', pdfFile);
    
    console.log('Sending request to:', `${API_BASE_URL}/upload_pdf/`);
    
    const response = await apiClient.post('/upload_pdf/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes timeout for PDF processing
    });
    
    console.log('PDF upload response received:', response.status, response.data);
    return response.data;
  } catch (error: any) {
    console.error('PDF upload API Error - Full error:', error);
    console.error('Error response:', error.response?.data);
    console.error('Error status:', error.response?.status);
    console.error('Error message:', error.message);
    throw error;
  }
};

export const ragQueryStream = async (question: string, file: File, onChunk: (chunk: string) => void, onAssistantId?: (id: string) => void, onThreadId?: (id: string) => void) => {
  try {
    console.log('Starting RAG streaming query:', { question, fileName: file.name });
    
    const formData = new FormData();
    formData.append('question', question);
    formData.append('file', file);
    
    const response = await fetch(`${API_BASE_URL}/rag/chat/stream`, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('RAG streaming HTTP error:', { status: response.status, statusText: response.statusText, body: errorText });
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }
    
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Response body is not readable');
    }
    
    const decoder = new TextDecoder();
    let accumulatedText = '';
    let receivedData = false;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      console.log('Received chunk:', chunk.substring(0, 200) + (chunk.length > 200 ? '...' : ''));
      
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('data: ')) {
          try {
            const jsonData = line.slice(6).trim();
            if (jsonData === '[DONE]') {
              console.log('Received [DONE] signal');
              break;
            }
            
            const data = JSON.parse(jsonData);
            console.log('Parsed streaming data:', data);
            
            // Handle different response formats
            if (data.text || data.content || data.response) {
              const textContent = data.text || data.content || data.response;
              accumulatedText += textContent;
              receivedData = true;
              
              console.log('Accumulated text length:', accumulatedText.length);
              // Call the chunk callback with accumulated text
              onChunk(accumulatedText);
              // Add a small delay to make streaming more visible
              await new Promise(resolve => setTimeout(resolve, 30));
            }
            
            // Handle additional metadata
            if (data.assistant_id && onAssistantId) {
              console.log('Received assistant_id:', data.assistant_id);
              onAssistantId(data.assistant_id);
            }
            
            if (data.thread_id && onThreadId) {
              console.log('Received thread_id:', data.thread_id);
              onThreadId(data.thread_id);
            }
          } catch (e) {
            console.warn('Failed to parse streaming data:', line.substring(0, 100), 'Error:', e);
            // Try to handle raw text response
            const rawText = line.slice(6).trim();
            if (rawText && rawText !== '[DONE]') {
              accumulatedText += rawText;
              receivedData = true;
              onChunk(accumulatedText);
            }
          }
        } else if (line.trim()) {
          // Handle non-SSE formatted responses
          console.log('Non-SSE formatted line:', line.substring(0, 100));
          try {
            const data = JSON.parse(line);
            if (data.text || data.content || data.response) {
              const textContent = data.text || data.content || data.response;
              accumulatedText += textContent;
              receivedData = true;
              onChunk(accumulatedText);
            }
          } catch (e) {
            // Treat as raw text
            accumulatedText += line;
            receivedData = true;
            onChunk(accumulatedText);
          }
        }
      }
    }
    
    if (!receivedData) {
      console.warn('No data received from RAG streaming');
      throw new Error('No response data received from server');
    }
    
    console.log('RAG streaming completed, total text length:', accumulatedText.length);
    return accumulatedText;
    
  } catch (error) {
    console.error('RAG streaming API Error:', error);
    throw error;
  }
};

export const ragQuery = async (question: string, file: File) => {
  try {
    console.log('Sending RAG query:', { question, fileName: file.name });
    
    const formData = new FormData();
    formData.append('file', file);
    formData.append('question', question);
    
    const response = await apiClient.post('/rag/chat', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 120000, // 2 minutes timeout for RAG processing
    });
    
    console.log('RAG response received:', response.data);
    return response.data;
  } catch (error: any) {
    console.error('RAG API Error:', error);
    throw error;
  }
};

// Language detection function
export const detectLanguage = (text: string): string => {
  // Remove HTML tags for better detection
  const cleanText = text.replace(/<[^>]*>/g, '').trim();
  
  // Simple language detection based on character patterns
  const hindiPattern = /[\u0900-\u097F]/;
  const marathiPattern = /[\u0900-\u097F]/; // Marathi uses same script as Hindi
  const gujaratiPattern = /[\u0A80-\u0AFF]/;
  const tamilPattern = /[\u0B80-\u0BFF]/;
  const teluguPattern = /[\u0C00-\u0C7F]/;
  const kannadaPattern = /[\u0C80-\u0CFF]/;
  const malayalamPattern = /[\u0D00-\u0D7F]/;
  const bengaliPattern = /[\u0980-\u09FF]/;
  const punjabiPattern = /[\u0A00-\u0A7F]/;
  
  // Check for Indian languages first
  if (hindiPattern.test(cleanText)) return 'hi-IN';
  if (gujaratiPattern.test(cleanText)) return 'gu-IN';
  if (tamilPattern.test(cleanText)) return 'ta-IN';
  if (teluguPattern.test(cleanText)) return 'te-IN';
  if (kannadaPattern.test(cleanText)) return 'kn-IN';
  if (malayalamPattern.test(cleanText)) return 'ml-IN';
  if (bengaliPattern.test(cleanText)) return 'bn-IN';
  if (punjabiPattern.test(cleanText)) return 'pa-IN';
  
  // Default to English for other cases
  return 'en-US';
};
