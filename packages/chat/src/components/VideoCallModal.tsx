import { useEffect, useRef, useState } from 'react';
import { 
  Phone, 
  PhoneOff, 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Maximize2,
  Minimize2,
  X,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useAgoraClient } from '../hooks/useAgoraClient';
import type { VideoCall, UserProfile } from '../types';

interface VideoCallModalProps {
  call: VideoCall;
  agoraAppId: string;
  agoraToken: string;
  agoraUid: number;
  callerProfile?: UserProfile | null;
  onEndCall: () => void;
  isOutgoing?: boolean;
}

export function VideoCallModal({
  call,
  agoraAppId,
  agoraToken,
  agoraUid,
  callerProfile,
  onEndCall,
  isOutgoing = false,
}: VideoCallModalProps) {
  const localVideoRef = useRef<HTMLDivElement>(null);
  const remoteVideoRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  const isVideoCall = call.call_type === 'video';

  const {
    isConnected,
    isConnecting,
    localVideoTrack,
    remoteUsers,
    isCameraOn,
    isMicOn,
    toggleCamera,
    toggleMic,
    disconnect,
  } = useAgoraClient(
    agoraToken ? {
      appId: agoraAppId,
      channel: call.channel_name,
      token: agoraToken,
      uid: agoraUid,
      enableVideo: isVideoCall,
      enableAudio: true,
    } : null
  );

  // Play local video
  useEffect(() => {
    if (localVideoTrack && localVideoRef.current) {
      localVideoTrack.play(localVideoRef.current);
    }
  }, [localVideoTrack]);

  // Play remote video
  useEffect(() => {
    if (remoteUsers.length > 0 && remoteVideoRef.current) {
      const mainRemote = remoteUsers[0];
      if (mainRemote.videoTrack) {
        mainRemote.videoTrack.play(remoteVideoRef.current);
      }
    }
  }, [remoteUsers]);

  // Call duration timer
  useEffect(() => {
    if (call.status === 'active') {
      const startTime = call.started_at ? new Date(call.started_at).getTime() : Date.now();
      
      const interval = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - startTime) / 1000));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [call.status, call.started_at]);

  const handleEndCall = async () => {
    await disconnect();
    onEndCall();
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {/* Main video area */}
      <div className="flex-1 relative">
        {/* Remote video (or avatar for audio call) */}
        {isVideoCall ? (
          <div 
            ref={remoteVideoRef}
            className="absolute inset-0 bg-gray-900"
          >
            {remoteUsers.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  {isOutgoing && call.status === 'ringing' ? (
                    <>
                      <div className="w-24 h-24 rounded-full bg-gray-700 mx-auto mb-4 flex items-center justify-center overflow-hidden">
                        {callerProfile?.avatar_url ? (
                          <img 
                            src={callerProfile.avatar_url} 
                            alt="" 
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-3xl">
                            {(callerProfile?.username || 'U')[0].toUpperCase()}
                          </span>
                        )}
                      </div>
                      <p className="text-xl font-medium mb-2">
                        {callerProfile?.username || 'Đang gọi...'}
                      </p>
                      <p className="text-gray-400">Đang đổ chuông...</p>
                    </>
                  ) : (
                    <p className="text-gray-400">
                      {isConnecting ? 'Đang kết nối...' : 'Đang chờ người khác...'}
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Audio call - show avatar
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-gray-800 to-gray-900">
            <div className="text-center text-white">
              <div className="w-32 h-32 rounded-full bg-gray-700 mx-auto mb-6 flex items-center justify-center overflow-hidden ring-4 ring-white/20">
                {callerProfile?.avatar_url ? (
                  <img 
                    src={callerProfile.avatar_url} 
                    alt="" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-4xl">
                    {(callerProfile?.username || 'U')[0].toUpperCase()}
                  </span>
                )}
              </div>
              <p className="text-2xl font-medium mb-2">
                {callerProfile?.username || 'Cuộc gọi'}
              </p>
              {call.status === 'active' ? (
                <p className="text-green-400 font-mono">
                  {formatDuration(callDuration)}
                </p>
              ) : call.status === 'ringing' ? (
                <p className="text-gray-400">
                  {isOutgoing ? 'Đang đổ chuông...' : 'Cuộc gọi đến...'}
                </p>
              ) : (
                <p className="text-gray-400">
                  {isConnecting ? 'Đang kết nối...' : 'Đang chờ...'}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Local video (picture-in-picture) */}
        {isVideoCall && localVideoTrack && (
          <div 
            ref={localVideoRef}
            className={cn(
              "absolute bottom-4 right-4 w-32 h-48 bg-gray-800 rounded-lg overflow-hidden",
              "shadow-lg border-2 border-white/20",
              !isCameraOn && "hidden"
            )}
          />
        )}

        {/* Call info overlay */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
          <div className="text-white">
            {call.status === 'active' && (
              <div className="flex items-center gap-2 bg-black/50 px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="font-mono">{formatDuration(callDuration)}</span>
              </div>
            )}
          </div>
          
          <button
            onClick={toggleFullscreen}
            className="p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
          >
            {isFullscreen ? (
              <Minimize2 className="h-5 w-5" />
            ) : (
              <Maximize2 className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-gray-900 px-6 py-8">
        <div className="flex items-center justify-center gap-6">
          {/* Toggle Mic */}
          <button
            onClick={toggleMic}
            className={cn(
              "p-4 rounded-full transition-colors",
              isMicOn 
                ? "bg-gray-700 text-white hover:bg-gray-600"
                : "bg-red-500 text-white hover:bg-red-600"
            )}
          >
            {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
          </button>

          {/* Toggle Camera (video call only) */}
          {isVideoCall && (
            <button
              onClick={toggleCamera}
              className={cn(
                "p-4 rounded-full transition-colors",
                isCameraOn 
                  ? "bg-gray-700 text-white hover:bg-gray-600"
                  : "bg-red-500 text-white hover:bg-red-600"
              )}
            >
              {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
            </button>
          )}

          {/* End Call */}
          <button
            onClick={handleEndCall}
            className="p-4 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
          >
            <PhoneOff className="h-6 w-6" />
          </button>
        </div>
      </div>
    </div>
  );
}
