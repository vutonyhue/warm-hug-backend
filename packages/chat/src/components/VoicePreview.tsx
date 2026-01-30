import { useRef, useState, useEffect } from 'react';
import { Play, Pause, Trash2, Send } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatVoiceDuration } from '../hooks/useVoiceRecorder';

interface VoicePreviewProps {
  /** Audio URL to preview */
  audioUrl: string;
  /** Duration in seconds */
  duration: number;
  /** Callback when user wants to send */
  onSend: () => void;
  /** Callback when user cancels */
  onCancel: () => void;
  /** Loading state */
  isSending: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Voice message preview before sending
 */
export function VoicePreview({
  audioUrl,
  duration,
  onSend,
  onCancel,
  isSending,
  className,
}: VoicePreviewProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('ended', handleEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={cn('flex items-center gap-3 p-3 bg-muted rounded-lg', className)}>
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className="flex-shrink-0 p-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        disabled={isSending}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-8 bg-background rounded flex items-center px-2">
        <div className="w-full h-1 bg-primary/30 rounded relative">
          <div
            className="absolute h-full bg-primary rounded transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Duration */}
      <span className="text-sm text-muted-foreground tabular-nums min-w-[40px]">
        {formatVoiceDuration(isPlaying ? currentTime : duration)}
      </span>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="flex-shrink-0 p-2 hover:bg-background rounded-full transition-colors"
        disabled={isSending}
        title="Hủy"
      >
        <Trash2 className="h-4 w-4 text-destructive" />
      </button>

      {/* Send button */}
      <button
        onClick={onSend}
        disabled={isSending}
        className={cn(
          'flex-shrink-0 p-2 rounded-full transition-colors',
          'bg-primary text-primary-foreground hover:bg-primary/90',
          isSending && 'opacity-50 cursor-not-allowed'
        )}
        title="Gửi"
      >
        <Send className="h-4 w-4" />
      </button>

      <audio ref={audioRef} src={audioUrl} preload="auto" />
    </div>
  );
}
