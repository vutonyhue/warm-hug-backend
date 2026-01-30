import { useRef, useState, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '../utils/cn';
import { formatVoiceDuration } from '../hooks/useVoiceRecorder';

interface VoicePlayerProps {
  /** Audio URL */
  url: string;
  /** Duration in seconds (optional, will be detected from audio) */
  duration?: number;
  /** Whether this is the current user's message */
  isOwn: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Voice message player component for message bubbles
 */
export function VoicePlayer({
  url,
  duration: initialDuration,
  isOwn,
  className,
}: VoicePlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(initialDuration || 0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleLoadedMetadata = () => {
      if (audio.duration && isFinite(audio.duration)) {
        setDuration(Math.floor(audio.duration));
      }
    };

    const handleTimeUpdate = () => {
      setCurrentTime(Math.floor(audio.currentTime));
    };

    const handleEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
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
    <div
      className={cn(
        'flex items-center gap-2 min-w-[180px] py-1',
        className
      )}
    >
      {/* Play/Pause button */}
      <button
        onClick={togglePlay}
        className={cn(
          'flex-shrink-0 p-1.5 rounded-full transition-colors',
          isOwn
            ? 'bg-primary-foreground/20 hover:bg-primary-foreground/30'
            : 'bg-foreground/10 hover:bg-foreground/20'
        )}
      >
        {isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </button>

      {/* Progress bar */}
      <div className="flex-1 h-1 bg-current/30 rounded">
        <div
          className="h-full bg-current rounded transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time */}
      <span className="text-xs opacity-70 tabular-nums min-w-[32px]">
        {formatVoiceDuration(isPlaying ? currentTime : duration)}
      </span>

      <audio ref={audioRef} src={url} preload="metadata" />
    </div>
  );
}
