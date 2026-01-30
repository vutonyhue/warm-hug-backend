import { useRef, useCallback } from 'react';
import { Mic } from 'lucide-react';
import { cn } from '../utils/cn';
import { useVoiceRecorder, formatVoiceDuration } from '../hooks/useVoiceRecorder';

interface VoiceRecordButtonProps {
  /** Callback when recording is complete */
  onRecordingComplete: (blob: Blob, duration: number) => void;
  /** Disable the button */
  disabled?: boolean;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Voice record button - press and hold to record
 */
export function VoiceRecordButton({
  onRecordingComplete,
  disabled,
  className,
}: VoiceRecordButtonProps) {
  const { state, startRecording, stopRecording, cancelRecording } = useVoiceRecorder();
  const isMouseDownRef = useRef(false);

  const handleMouseDown = useCallback(async (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    if (disabled) return;
    
    isMouseDownRef.current = true;
    try {
      await startRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
      isMouseDownRef.current = false;
    }
  }, [disabled, startRecording]);

  const handleMouseUp = useCallback(() => {
    if (!isMouseDownRef.current) return;
    isMouseDownRef.current = false;
    
    if (state.isRecording) {
      stopRecording();
      // Wait a bit for the blob to be available
      setTimeout(() => {
        if (state.audioBlob && state.duration > 0) {
          onRecordingComplete(state.audioBlob, state.duration);
        }
      }, 100);
    }
  }, [state.isRecording, state.audioBlob, state.duration, stopRecording, onRecordingComplete]);

  const handleMouseLeave = useCallback(() => {
    if (isMouseDownRef.current && state.isRecording) {
      // Cancel if mouse leaves while recording
      cancelRecording();
      isMouseDownRef.current = false;
    }
  }, [state.isRecording, cancelRecording]);

  return (
    <button
      type="button"
      className={cn(
        'flex items-center gap-1 p-2 rounded-full transition-all',
        state.isRecording
          ? 'bg-destructive text-destructive-foreground animate-pulse'
          : 'border border-border hover:border-primary/60',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleMouseDown}
      onTouchEnd={handleMouseUp}
      disabled={disabled}
      title="Nhấn giữ để ghi âm"
    >
      <Mic className="h-5 w-5" />
      {state.isRecording && (
        <span className="text-xs font-medium">
          {formatVoiceDuration(state.duration)}
        </span>
      )}
    </button>
  );
}
