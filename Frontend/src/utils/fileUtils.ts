
export const SUPPORTED_FILE_TYPES = {
  'application/pdf': { extension: '.pdf', name: 'PDF Document', icon: '📄' },
  'text/plain': { extension: '.txt', name: 'Text File', icon: '📝' },
  'application/msword': { extension: '.doc', name: 'Word Document', icon: '📄' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { 
    extension: '.docx', 
    name: 'Word Document', 
    icon: '📄' 
  },
  'text/markdown': { extension: '.md', name: 'Markdown File', icon: '📝' },
  'application/rtf': { extension: '.rtf', name: 'Rich Text Format', icon: '📄' },
  'text/csv': { extension: '.csv', name: 'CSV File', icon: '📊' },
  'application/json': { extension: '.json', name: 'JSON File', icon: '🔧' }
} as const;

export type SupportedFileType = keyof typeof SUPPORTED_FILE_TYPES;

export const validateFileType = (file: File): { isValid: boolean; error?: string } => {
  const fileType = file.type as SupportedFileType;
  
  if (!SUPPORTED_FILE_TYPES[fileType]) {
    const supportedExtensions = Object.values(SUPPORTED_FILE_TYPES)
      .map(type => type.extension)
      .join(', ');
    
    return {
      isValid: false,
      error: `Unsupported file type. Supported formats: ${supportedExtensions}`
    };
  }
  
  // Check file size (max 50MB)
  const maxSize = 50 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      isValid: false,
      error: 'File size too large. Maximum size is 50MB.'
    };
  }
  
  return { isValid: true };
};

export const getFileTypeInfo = (file: File) => {
  const fileType = file.type as SupportedFileType;
  return SUPPORTED_FILE_TYPES[fileType] || { 
    extension: '', 
    name: 'Unknown File', 
    icon: '📁' 
  };
};

export const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};
