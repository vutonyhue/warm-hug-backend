import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { useVideoCall } from '../hooks/useVideoCall';
import { useChatSupabase, useChatUser, useChatConfig } from './ChatProvider';
import { VideoCallModal } from './VideoCallModal';
import { IncomingCallDialog } from './IncomingCallDialog';
import type { VideoCall, UserProfile } from '../types';

interface VideoCallContextValue {
  startCall: (conversationId: string, callType: 'video' | 'audio', participantIds: string[]) => Promise<void>;
  isCallActive: boolean;
  isCallEnabled: boolean;
}

const VideoCallContext = createContext<VideoCallContextValue | null>(null);

interface VideoCallProviderProps {
  children: ReactNode;
  conversationId?: string;
}

export function VideoCallProvider({ children, conversationId }: VideoCallProviderProps) {
  const config = useChatConfig();
  const supabase = useChatSupabase();
  const { userId } = useChatUser();
  
  const [activeConversationId, setActiveConversationId] = useState<string | null>(conversationId || null);
  const [callerProfile, setCallerProfile] = useState<UserProfile | null>(null);
  const [isOutgoing, setIsOutgoing] = useState(false);

  // Update active conversation when prop changes
  useEffect(() => {
    if (conversationId) {
      setActiveConversationId(conversationId);
    }
  }, [conversationId]);

  const {
    activeCall,
    incomingCall,
    agoraToken,
    agoraUid,
    agoraAppId,
    startCall: startCallMutation,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    isStartingCall,
    isJoiningCall,
  } = useVideoCall({ conversationId: activeConversationId || '' });

  // Check if video calls are enabled
  const isCallEnabled = Boolean(config.agoraAppId) || Boolean(config.getAgoraToken) || Boolean(agoraAppId);

  // Fetch caller profile when incoming call arrives
  useEffect(() => {
    if (incomingCall?.caller_id) {
      supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', incomingCall.caller_id)
        .single()
        .then(({ data }) => {
          if (data) setCallerProfile(data);
        });
    }
  }, [incomingCall?.caller_id, supabase]);

  // Start a call
  const startCall = useCallback(async (
    convId: string,
    callType: 'video' | 'audio',
    participantIds: string[]
  ) => {
    if (!isCallEnabled) {
      console.warn('[VideoCallProvider] Video calls not enabled');
      return;
    }

    setActiveConversationId(convId);
    setIsOutgoing(true);
    
    // Fetch first participant's profile for display
    if (participantIds.length > 0) {
      const { data } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', participantIds[0])
        .single();
      if (data) setCallerProfile(data);
    }

    await startCallMutation.mutateAsync({ callType, participantIds });
  }, [isCallEnabled, startCallMutation, supabase]);

  // Handle accept incoming call
  const handleAccept = useCallback(async () => {
    if (incomingCall) {
      await acceptCall.mutateAsync({ callId: incomingCall.id });
      setIsOutgoing(false);
    }
  }, [incomingCall, acceptCall]);

  // Handle reject incoming call
  const handleReject = useCallback(async () => {
    if (incomingCall) {
      await rejectCall.mutateAsync({ callId: incomingCall.id });
      setCallerProfile(null);
    }
  }, [incomingCall, rejectCall]);

  // Handle end call
  const handleEndCall = useCallback(async () => {
    if (activeCall) {
      if (activeCall.status === 'ringing' && isOutgoing) {
        // Cancel outgoing call
        await cancelCall.mutateAsync(activeCall.id);
      } else {
        await endCall.mutateAsync(activeCall.id);
      }
      setCallerProfile(null);
      setIsOutgoing(false);
    }
  }, [activeCall, isOutgoing, cancelCall, endCall]);

  return (
    <VideoCallContext.Provider value={{ startCall, isCallActive: Boolean(activeCall), isCallEnabled }}>
      {children}

      {/* Incoming call dialog */}
      {incomingCall && !activeCall && (
        <IncomingCallDialog
          call={incomingCall}
          callerProfile={callerProfile}
          onAccept={handleAccept}
          onReject={handleReject}
          isAccepting={isJoiningCall}
        />
      )}

      {/* Active call modal */}
      {activeCall && agoraToken && agoraUid && (agoraAppId || config.agoraAppId) && (
        <VideoCallModal
          call={activeCall}
          agoraAppId={agoraAppId || config.agoraAppId!}
          agoraToken={agoraToken}
          agoraUid={agoraUid}
          callerProfile={callerProfile}
          onEndCall={handleEndCall}
          isOutgoing={isOutgoing}
        />
      )}
    </VideoCallContext.Provider>
  );
}

export function useVideoCallContext() {
  const context = useContext(VideoCallContext);
  if (!context) {
    throw new Error('useVideoCallContext must be used within VideoCallProvider');
  }
  return context;
}
