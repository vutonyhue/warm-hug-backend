import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Video } from 'lucide-react';
import { cn } from '../utils/cn';
import type { VideoCall, UserProfile } from '../types';

interface IncomingCallDialogProps {
  call: VideoCall;
  callerProfile?: UserProfile | null;
  onAccept: () => void;
  onReject: () => void;
  isAccepting?: boolean;
}

export function IncomingCallDialog({
  call,
  callerProfile,
  onAccept,
  onReject,
  isAccepting = false,
}: IncomingCallDialogProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Play ringtone
  useEffect(() => {
    // Create a simple ringtone using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    let oscillator: OscillatorNode | null = null;
    let gainNode: GainNode | null = null;

    const playRing = () => {
      oscillator = audioContext.createOscillator();
      gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 440;
      oscillator.type = 'sine';
      gainNode.gain.value = 0.1;
      
      oscillator.start();
      
      // Ring pattern: on 1s, off 2s
      setTimeout(() => {
        if (oscillator) oscillator.stop();
      }, 1000);
    };

    // Ring every 3 seconds
    playRing();
    const interval = setInterval(playRing, 3000);

    return () => {
      clearInterval(interval);
      if (oscillator) {
        try { oscillator.stop(); } catch {}
      }
      audioContext.close();
    };
  }, []);

  const isVideoCall = call.call_type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl">
        <div className="text-center">
          {/* Caller avatar with ring animation */}
          <div className="relative inline-block mb-6">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden ring-4 ring-primary/50">
              {callerProfile?.avatar_url ? (
                <img 
                  src={callerProfile.avatar_url} 
                  alt="" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-3xl font-medium">
                  {(callerProfile?.username || 'U')[0].toUpperCase()}
                </span>
              )}
            </div>
          </div>

          {/* Caller info */}
          <h2 className="text-xl font-semibold mb-1">
            {callerProfile?.username || 'Người dùng'}
          </h2>
          <p className="text-muted-foreground mb-8 flex items-center justify-center gap-2">
            {isVideoCall ? (
              <>
                <Video className="h-4 w-4" />
                Cuộc gọi video đến...
              </>
            ) : (
              <>
                <Phone className="h-4 w-4" />
                Cuộc gọi thoại đến...
              </>
            )}
          </p>

          {/* Action buttons */}
          <div className="flex items-center justify-center gap-8">
            {/* Reject */}
            <button
              onClick={onReject}
              disabled={isAccepting}
              className={cn(
                "flex flex-col items-center gap-2",
                isAccepting && "opacity-50 cursor-not-allowed"
              )}
            >
              <div className="p-5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors">
                <PhoneOff className="h-7 w-7" />
              </div>
              <span className="text-sm text-muted-foreground">Từ chối</span>
            </button>

            {/* Accept */}
            <button
              onClick={onAccept}
              disabled={isAccepting}
              className={cn(
                "flex flex-col items-center gap-2",
                isAccepting && "opacity-50"
              )}
            >
              <div className={cn(
                "p-5 bg-green-500 text-white rounded-full transition-colors",
                isAccepting ? "animate-pulse" : "hover:bg-green-600"
              )}>
                {isVideoCall ? (
                  <Video className="h-7 w-7" />
                ) : (
                  <Phone className="h-7 w-7" />
                )}
              </div>
              <span className="text-sm text-muted-foreground">
                {isAccepting ? 'Đang kết nối...' : 'Trả lời'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
