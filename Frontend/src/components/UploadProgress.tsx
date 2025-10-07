
import { Progress } from '@/components/ui/progress';
import { FileText, Upload, CheckCircle, XCircle } from 'lucide-react';

interface UploadProgressProps {
  fileName: string;
  progress: number;
  status: 'uploading' | 'processing' | 'success' | 'error';
  error?: string;
}

export const UploadProgress = ({ fileName, progress, status, error }: UploadProgressProps) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'uploading':
        return <Upload className="h-4 w-4 text-primary animate-pulse" />;
      case 'processing':
        return <FileText className="h-4 w-4 text-primary animate-spin" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'uploading':
        return 'Uploading...';
      case 'processing':
        return 'Processing document...';
      case 'success':
        return 'Upload complete';
      case 'error':
        return error || 'Upload failed';
    }
  };

  return (
    <div className="w-full max-w-md mx-auto p-4 bg-background border border-border rounded-lg shadow-sm">
      <div className="flex items-center gap-3 mb-3">
        {getStatusIcon()}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground truncate">{fileName}</p>
          <p className="text-xs text-muted-foreground">{getStatusText()}</p>
        </div>
      </div>
      
      {(status === 'uploading' || status === 'processing') && (
        <div className="space-y-2">
          <Progress value={progress} className="h-2" />
          <p className="text-xs text-muted-foreground text-center">{progress}%</p>
        </div>
      )}
      
      {status === 'error' && error && (
        <div className="mt-2 p-2 bg-destructive/10 border border-destructive/20 rounded text-xs text-destructive">
          {error}
        </div>
      )}
    </div>
  );
};
