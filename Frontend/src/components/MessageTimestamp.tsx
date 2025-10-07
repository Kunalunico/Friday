
import { useState, useEffect } from 'react';

interface MessageTimestampProps {
  timestamp: Date;
  className?: string;
}

export const MessageTimestamp = ({ timestamp, className = "" }: MessageTimestampProps) => {
  const [timeString, setTimeString] = useState('');

  useEffect(() => {
    const updateTimeString = () => {
      const now = new Date();
      const diff = now.getTime() - timestamp.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(minutes / 60);
      const days = Math.floor(hours / 24);

      if (minutes < 1) {
        setTimeString('Just now');
      } else if (minutes < 60) {
        setTimeString(`${minutes}m ago`);
      } else if (hours < 24) {
        setTimeString(`${hours}h ago`);
      } else if (days < 7) {
        setTimeString(`${days}d ago`);
      } else {
        setTimeString(timestamp.toLocaleDateString());
      }
    };

    updateTimeString();
    const interval = setInterval(updateTimeString, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [timestamp]);

  return (
    <span 
      className={`text-xs text-muted-foreground ${className}`}
      title={timestamp.toLocaleString()}
    >
      {timeString}
    </span>
  );
};
