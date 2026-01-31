import { useState, useEffect, useCallback, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useChatSupabase, useChatUser, useChatConfig } from '../components/ChatProvider';
import type { VideoCall, VideoCallParticipant } from '../types';

interface UseVideoCallOptions {
  conversationId: string;
}

interface StartCallParams {
  callType: 'video' | 'audio';
  participantIds: string[];
}

interface JoinCallParams {
  callId: string;
}

export function useVideoCall({ conversationId }: UseVideoCallOptions) {
  const supabase = useChatSupabase();
  const { userId } = useChatUser();
  const config = useChatConfig();
  const queryClient = useQueryClient();
  
  const [activeCall, setActiveCall] = useState<VideoCall | null>(null);
  const [incomingCall, setIncomingCall] = useState<VideoCall | null>(null);
  const [agoraToken, setAgoraToken] = useState<string | null>(null);
  const [agoraUid, setAgoraUid] = useState<number | null>(null);
  const [agoraAppId, setAgoraAppId] = useState<string | null>(null);
  
  const channelRef = useRef<any>(null);

  // Subscribe to incoming calls
  useEffect(() => {
    if (!userId || !conversationId) return;

    const channel = supabase
      .channel(`video_calls:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'video_calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const newCall = payload.new as VideoCall;
          // Don't show incoming call if we're the caller
          if (newCall.caller_id !== userId && newCall.status === 'pending') {
            console.log('[useVideoCall] Incoming call:', newCall);
            setIncomingCall(newCall);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'video_calls',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updatedCall = payload.new as VideoCall;
          
          // Update active call if it's the same
          if (activeCall?.id === updatedCall.id) {
            setActiveCall(updatedCall);
            
            // If call ended, clear states
            if (['ended', 'missed', 'rejected'].includes(updatedCall.status)) {
              setActiveCall(null);
              setAgoraToken(null);
              setAgoraUid(null);
            }
          }
          
          // Update incoming call status
          if (incomingCall?.id === updatedCall.id) {
            if (['ended', 'missed', 'rejected'].includes(updatedCall.status)) {
              setIncomingCall(null);
            }
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, conversationId, supabase, activeCall?.id, incomingCall?.id]);

  // Fetch Agora token
  const fetchAgoraToken = useCallback(async (channelName: string) => {
    if (config.getAgoraToken) {
      // Use custom function from config
      const uid = Math.floor(Math.random() * 100000);
      const token = await config.getAgoraToken(channelName, uid);
      return { token, uid, appId: config.agoraAppId };
    }

    // Use default edge function
    const { data: session } = await supabase.auth.getSession();
    if (!session?.session?.access_token) throw new Error('Not authenticated');

    // Get URL from supabase client instead of env
    const supabaseUrl = 
      (supabase as any).supabaseUrl || 
      (supabase as any).restUrl?.replace('/rest/v1', '') ||
      import.meta.env.VITE_SUPABASE_URL ||
      '';
    
    if (!supabaseUrl) {
      throw new Error('Supabase URL not configured');
    }

    console.log('[useVideoCall] Fetching Agora token from:', `${supabaseUrl}/functions/v1/agora-token`);

    const response = await fetch(
      `${supabaseUrl}/functions/v1/agora-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.session.access_token}`,
        },
        body: JSON.stringify({ channelName }),
      }
    );

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `Failed to get Agora token: ${response.status}`);
    }

    const data = await response.json();
    console.log('[useVideoCall] Got Agora token successfully, appId:', data.appId);
    return { token: data.token, uid: data.uid, appId: data.appId };
  }, [config, supabase]);

  // Start a call
  const startCall = useMutation({
    mutationFn: async ({ callType, participantIds }: StartCallParams) => {
      if (!userId) throw new Error('Not authenticated');
      
      const channelName = `call_${conversationId}_${Date.now()}`;
      
      console.log('[useVideoCall] Starting call:', { callType, channelName, participantIds });
      
      // Create call record
      const { data: call, error } = await supabase
        .from('video_calls')
        .insert({
          conversation_id: conversationId,
          caller_id: userId,
          call_type: callType,
          status: 'pending',
          channel_name: channelName,
        })
        .select()
        .single();

      if (error) {
        console.error('[useVideoCall] Failed to create call record:', error);
        throw error;
      }

      console.log('[useVideoCall] Call record created:', call.id);

      // Add participants (including caller)
      const allParticipants = [...new Set([userId, ...participantIds])];
      const { error: participantError } = await supabase
        .from('video_call_participants')
        .insert(
          allParticipants.map(uid => ({
            call_id: call.id,
            user_id: uid,
            status: uid === userId ? 'joined' : 'pending',
            joined_at: uid === userId ? new Date().toISOString() : null,
          }))
        );

      if (participantError) {
        console.error('[useVideoCall] Failed to add participants:', participantError);
        throw participantError;
      }

      // Get Agora token - with rollback on failure
      try {
        const tokenData = await fetchAgoraToken(channelName);
        setAgoraToken(tokenData.token);
        setAgoraUid(tokenData.uid);
        if (tokenData.appId) setAgoraAppId(tokenData.appId);
        setActiveCall(call);

        // Update call status to ringing
        await supabase
          .from('video_calls')
          .update({ status: 'ringing' })
          .eq('id', call.id);

        console.log('[useVideoCall] Call started successfully');
        return { call, ...tokenData };
      } catch (tokenError) {
        console.error('[useVideoCall] Failed to get Agora token, rolling back:', tokenError);
        
        // Rollback: mark call as missed
        await supabase
          .from('video_calls')
          .update({ 
            status: 'missed',
            ended_at: new Date().toISOString(),
          })
          .eq('id', call.id);
        
        throw tokenError;
      }
    },
  });

  // Accept a call
  const acceptCall = useMutation({
    mutationFn: async ({ callId }: JoinCallParams) => {
      if (!userId) throw new Error('Not authenticated');

      // Get call info
      const { data: call, error } = await supabase
        .from('video_calls')
        .select('*')
        .eq('id', callId)
        .single();

      if (error) throw error;

      // Get Agora token
      const tokenData = await fetchAgoraToken(call.channel_name);
      setAgoraToken(tokenData.token);
      setAgoraUid(tokenData.uid);
      if (tokenData.appId) setAgoraAppId(tokenData.appId);
      setActiveCall(call);
      setIncomingCall(null);

      // Update call status to active
      await supabase
        .from('video_calls')
        .update({ 
          status: 'active',
          started_at: new Date().toISOString(),
        })
        .eq('id', callId);

      // Update participant status
      await supabase
        .from('video_call_participants')
        .update({ 
          status: 'joined',
          joined_at: new Date().toISOString(),
        })
        .eq('call_id', callId)
        .eq('user_id', userId);

      return { call, ...tokenData };
    },
  });

  // Reject a call
  const rejectCall = useMutation({
    mutationFn: async ({ callId }: JoinCallParams) => {
      if (!userId) throw new Error('Not authenticated');

      // Update participant status
      await supabase
        .from('video_call_participants')
        .update({ 
          status: 'rejected',
          left_at: new Date().toISOString(),
        })
        .eq('call_id', callId)
        .eq('user_id', userId);

      // If this was the only other participant, end the call
      const { data: participants } = await supabase
        .from('video_call_participants')
        .select('*')
        .eq('call_id', callId)
        .neq('user_id', userId)
        .eq('status', 'pending');

      if (!participants?.length) {
        await supabase
          .from('video_calls')
          .update({ 
            status: 'rejected',
            ended_at: new Date().toISOString(),
          })
          .eq('id', callId);
      }

      setIncomingCall(null);
    },
  });

  // End a call
  const endCall = useMutation({
    mutationFn: async (callId: string) => {
      if (!userId) throw new Error('Not authenticated');

      const { data: call } = await supabase
        .from('video_calls')
        .select('started_at')
        .eq('id', callId)
        .single();

      let duration = null;
      if (call?.started_at) {
        duration = Math.floor(
          (Date.now() - new Date(call.started_at).getTime()) / 1000
        );
      }

      // Update call status
      await supabase
        .from('video_calls')
        .update({ 
          status: 'ended',
          ended_at: new Date().toISOString(),
          duration_seconds: duration,
        })
        .eq('id', callId);

      // Update participant status
      await supabase
        .from('video_call_participants')
        .update({ 
          status: 'left',
          left_at: new Date().toISOString(),
        })
        .eq('call_id', callId)
        .eq('user_id', userId);

      setActiveCall(null);
      setAgoraToken(null);
      setAgoraUid(null);
    },
  });

  // Cancel outgoing call (caller cancels before anyone answers)
  const cancelCall = useMutation({
    mutationFn: async (callId: string) => {
      await supabase
        .from('video_calls')
        .update({ 
          status: 'missed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', callId);

      setActiveCall(null);
      setAgoraToken(null);
      setAgoraUid(null);
    },
  });

  return {
    activeCall,
    incomingCall,
    agoraToken,
    agoraUid,
    agoraAppId: agoraAppId || config.agoraAppId || null,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    isStartingCall: startCall.isPending,
    isJoiningCall: acceptCall.isPending,
  };
}
