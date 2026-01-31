import { useState, useEffect, useCallback, useRef } from 'react';

// Dynamic import for Agora SDK to handle SSR and missing deps
let AgoraRTC: any = null;

interface UseAgoraClientOptions {
  appId: string;
  channel: string;
  token: string;
  uid: number;
  enableVideo?: boolean;
  enableAudio?: boolean;
  onUserJoined?: (uid: number) => void;
  onUserLeft?: (uid: number) => void;
  onError?: (error: Error) => void;
}

interface RemoteUser {
  uid: number;
  videoTrack?: any;
  audioTrack?: any;
  hasVideo: boolean;
  hasAudio: boolean;
}

export function useAgoraClient(options: UseAgoraClientOptions | null) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [localAudioTrack, setLocalAudioTrack] = useState<any>(null);
  const [remoteUsers, setRemoteUsers] = useState<RemoteUser[]>([]);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const clientRef = useRef<any>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Initialize Agora SDK
  useEffect(() => {
    const loadAgora = async () => {
      try {
        const module = await import('agora-rtc-sdk-ng');
        AgoraRTC = module.default || module;
        AgoraRTC.setLogLevel(3); // Only errors
      } catch (err) {
        console.error('[useAgoraClient] Failed to load Agora SDK:', err);
        setError(new Error('Video calling requires agora-rtc-sdk-ng package'));
      }
    };
    loadAgora();
  }, []);

  // Connect to channel
  const connect = useCallback(async () => {
    if (!options || !AgoraRTC || isConnecting || isConnected) return;
    
    const { appId, channel, token, uid, enableVideo = true, enableAudio = true } = options;
    
    setIsConnecting(true);
    setError(null);

    try {
      // Create client
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;

      // Set up event handlers
      client.on('user-published', async (user: any, mediaType: string) => {
        await client.subscribe(user, mediaType);
        console.log('[useAgoraClient] Subscribed to user:', user.uid, mediaType);

        setRemoteUsers(prev => {
          const existing = prev.find(u => u.uid === user.uid);
          if (existing) {
            return prev.map(u => 
              u.uid === user.uid 
                ? { 
                    ...u, 
                    [mediaType === 'video' ? 'videoTrack' : 'audioTrack']: 
                      mediaType === 'video' ? user.videoTrack : user.audioTrack,
                    [mediaType === 'video' ? 'hasVideo' : 'hasAudio']: true,
                  }
                : u
            );
          }
          return [...prev, { 
            uid: user.uid, 
            videoTrack: mediaType === 'video' ? user.videoTrack : undefined,
            audioTrack: mediaType === 'audio' ? user.audioTrack : undefined,
            hasVideo: mediaType === 'video',
            hasAudio: mediaType === 'audio',
          }];
        });

        // Play audio immediately
        if (mediaType === 'audio' && user.audioTrack) {
          user.audioTrack.play();
        }

        optionsRef.current?.onUserJoined?.(user.uid);
      });

      client.on('user-unpublished', (user: any, mediaType: string) => {
        console.log('[useAgoraClient] User unpublished:', user.uid, mediaType);
        
        setRemoteUsers(prev => 
          prev.map(u => 
            u.uid === user.uid 
              ? { 
                  ...u, 
                  [mediaType === 'video' ? 'videoTrack' : 'audioTrack']: undefined,
                  [mediaType === 'video' ? 'hasVideo' : 'hasAudio']: false,
                }
              : u
          ).filter(u => u.hasVideo || u.hasAudio)
        );
      });

      client.on('user-left', (user: any) => {
        console.log('[useAgoraClient] User left:', user.uid);
        setRemoteUsers(prev => prev.filter(u => u.uid !== user.uid));
        optionsRef.current?.onUserLeft?.(user.uid);
      });

      // Join channel
      await client.join(appId, channel, token, uid);
      console.log('[useAgoraClient] Joined channel:', channel);

      // Create and publish local tracks
      const tracks: any[] = [];
      
      if (enableAudio) {
        const audioTrack = await AgoraRTC.createMicrophoneAudioTrack();
        setLocalAudioTrack(audioTrack);
        tracks.push(audioTrack);
      }

      if (enableVideo) {
        const videoTrack = await AgoraRTC.createCameraVideoTrack();
        setLocalVideoTrack(videoTrack);
        tracks.push(videoTrack);
      }

      if (tracks.length > 0) {
        await client.publish(tracks);
        console.log('[useAgoraClient] Published local tracks');
      }

      setIsConnected(true);
      setIsConnecting(false);

    } catch (err) {
      console.error('[useAgoraClient] Connection error:', err);
      setError(err as Error);
      setIsConnecting(false);
      optionsRef.current?.onError?.(err as Error);
    }
  }, [options, isConnecting, isConnected]);

  // Disconnect from channel
  const disconnect = useCallback(async () => {
    const client = clientRef.current;
    
    // Stop and close local tracks
    if (localVideoTrack) {
      localVideoTrack.stop();
      localVideoTrack.close();
      setLocalVideoTrack(null);
    }
    
    if (localAudioTrack) {
      localAudioTrack.stop();
      localAudioTrack.close();
      setLocalAudioTrack(null);
    }

    // Leave channel
    if (client) {
      await client.leave();
      clientRef.current = null;
    }

    setRemoteUsers([]);
    setIsConnected(false);
    setIsCameraOn(true);
    setIsMicOn(true);
    console.log('[useAgoraClient] Disconnected');
  }, [localVideoTrack, localAudioTrack]);

  // Toggle camera
  const toggleCamera = useCallback(async () => {
    if (!localVideoTrack) return;
    
    await localVideoTrack.setEnabled(!isCameraOn);
    setIsCameraOn(!isCameraOn);
  }, [localVideoTrack, isCameraOn]);

  // Toggle microphone
  const toggleMic = useCallback(async () => {
    if (!localAudioTrack) return;
    
    await localAudioTrack.setEnabled(!isMicOn);
    setIsMicOn(!isMicOn);
  }, [localAudioTrack, isMicOn]);

  // Auto-connect when options change
  useEffect(() => {
    if (options && !isConnected && !isConnecting) {
      connect();
    }
    
    return () => {
      if (isConnected) {
        disconnect();
      }
    };
  }, [options?.channel, options?.token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    isConnected,
    isConnecting,
    localVideoTrack,
    localAudioTrack,
    remoteUsers,
    isCameraOn,
    isMicOn,
    error,
    connect,
    disconnect,
    toggleCamera,
    toggleMic,
  };
}
