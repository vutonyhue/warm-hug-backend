import { useRef, useEffect, useState } from 'react';
import { useMessages } from '../hooks/useMessages';
import { useTypingIndicator } from '../hooks/useTypingIndicator';
import { useConversation } from '../hooks/useConversations';
import { useVideoCall } from '../hooks/useVideoCall';
import { MessageBubble } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { CallButton } from './CallButton';
import { VideoCallModal } from './VideoCallModal';
import { IncomingCallDialog } from './IncomingCallDialog';
import { useChatUser, useChatQueryClient, useChatConfig, useChatSupabase } from './ChatProvider';
import { Search, Settings, Users, Loader2 } from 'lucide-react';
import { cn } from '../utils/cn';
import { toast } from 'sonner';
import type { Message, ConversationParticipant, UserProfile } from '../types';

interface MessageThreadProps {
  conversationId: string;
  /** Called when user clicks search button */
  onSearchClick?: () => void;
  /** Called when user clicks settings button (for group) */
  onSettingsClick?: () => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Main message thread component showing messages, typing indicators, and input
 */
export function MessageThread({ 
  conversationId, 
  onSearchClick,
  onSettingsClick,
  className,
}: MessageThreadProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const queryClient = useChatQueryClient();
  const config = useChatConfig();
  const supabase = useChatSupabase();
  const { userId, username } = useChatUser();
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [callerProfile, setCallerProfile] = useState<UserProfile | null>(null);

  const { data: conversation } = useConversation(conversationId);
  const {
    messages,
    isLoading,
    sendMessage,
    markAsRead,
    addReaction,
    removeReaction,
  } = useMessages(conversationId);

  const { typingUsers, sendTyping } = useTypingIndicator(conversationId);

  // Video call hook
  const {
    activeCall,
    incomingCall,
    agoraToken,
    agoraUid,
    agoraAppId,
    startCall,
    acceptCall,
    rejectCall,
    endCall,
    cancelCall,
    isStartingCall,
    isJoiningCall,
  } = useVideoCall({ conversationId });

  // Check if video calls are enabled
  const isCallEnabled = 
    config.enableVideoCalls || 
    Boolean(config.agoraAppId) || 
    Boolean(config.getAgoraToken) || 
    Boolean(agoraAppId);

  // Get other participant for header
  const otherParticipant = conversation?.participants?.find(
    (p: ConversationParticipant) => p.user_id !== userId && !p.left_at
  );
  const headerProfile = otherParticipant?.profile;
  const isGroup = conversation?.type === 'group';
  const participantCount = conversation?.participants?.filter((p: ConversationParticipant) => !p.left_at).length || 0;
  
  // Get participant IDs for calls
  const participantIds = conversation?.participants
    ?.filter((p: ConversationParticipant) => p.user_id !== userId && !p.left_at)
    .map((p: ConversationParticipant) => p.user_id) || [];

  const headerName = isGroup
    ? conversation?.name
    : headerProfile?.username || 'User';
  const headerAvatar = isGroup
    ? conversation?.avatar_url
    : headerProfile?.avatar_url;

  // Fetch caller profile for incoming calls
  useEffect(() => {
    if (incomingCall?.caller_id) {
      supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', incomingCall.caller_id)
        .single()
        .then(({ data }) => {
          if (data) setCallerProfile(data as UserProfile);
        });
    } else if (activeCall && participantIds.length > 0) {
      // For outgoing calls, show the other participant
      supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .eq('id', participantIds[0])
        .single()
        .then(({ data }) => {
          if (data) setCallerProfile(data as UserProfile);
        });
    }
  }, [incomingCall?.caller_id, activeCall?.id, participantIds, supabase]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Mark messages as read
  useEffect(() => {
    if (!userId || messages.length === 0) return;

    const unreadMessages = messages.filter(
      (m) => m.sender_id !== userId && !m.read_by?.includes(userId)
    );

    unreadMessages.forEach((m) => {
      markAsRead(m.id);
    });
  }, [messages, userId, markAsRead]);

  const handleSend = async (content: string, mediaUrls?: string[]) => {
    await sendMessage.mutateAsync({
      content,
      mediaUrls,
      replyToId: replyTo?.id,
    });
    setReplyTo(null);
  };

  const handleReaction = (messageId: string, emoji: string, hasReacted: boolean) => {
    if (hasReacted) {
      removeReaction.mutate({ messageId, emoji });
    } else {
      addReaction.mutate({ messageId, emoji });
    }
  };

  // Video call handlers
  const handleStartVideoCall = async () => {
    if (participantIds.length > 0) {
      try {
        await startCall.mutateAsync({ callType: 'video', participantIds });
      } catch (error) {
        console.error('[MessageThread] Video call failed:', error);
        toast.error('Không thể bắt đầu cuộc gọi video. Vui lòng thử lại.');
      }
    }
  };

  const handleStartAudioCall = async () => {
    if (participantIds.length > 0) {
      try {
        await startCall.mutateAsync({ callType: 'audio', participantIds });
      } catch (error) {
        console.error('[MessageThread] Audio call failed:', error);
        toast.error('Không thể bắt đầu cuộc gọi thoại. Vui lòng thử lại.');
      }
    }
  };

  const handleAcceptCall = async () => {
    if (incomingCall) {
      await acceptCall.mutateAsync({ callId: incomingCall.id });
    }
  };

  const handleRejectCall = async () => {
    if (incomingCall) {
      await rejectCall.mutateAsync({ callId: incomingCall.id });
      setCallerProfile(null);
    }
  };

  const handleEndCall = async () => {
    if (activeCall) {
      if (activeCall.status === 'ringing') {
        await cancelCall.mutateAsync(activeCall.id);
      } else {
        await endCall.mutateAsync(activeCall.id);
      }
      setCallerProfile(null);
    }
  };

  if (isLoading) {
    return (
      <div className={cn("flex-1 flex flex-col", className)}>
        <div className="p-4 border-b flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="h-5 w-32 bg-muted rounded animate-pulse" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex-1 flex flex-col", className)}>
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
            {headerAvatar ? (
              <img src={headerAvatar} alt={headerName || ''} className="h-full w-full object-cover" />
            ) : (
              <span className="text-lg font-medium">{(headerName || 'U')[0].toUpperCase()}</span>
            )}
          </div>
          <div>
            <p className="font-medium">{headerName}</p>
            {isGroup ? (
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                {participantCount} thành viên
              </p>
            ) : typingUsers.length > 0 ? (
              <p className="text-xs text-muted-foreground">Đang nhập...</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Call buttons - only show if enabled and not in a group (for now) */}
          {isCallEnabled && !isGroup && participantIds.length > 0 && (
            <>
              <CallButton
                callType="audio"
                onClick={handleStartAudioCall}
                disabled={Boolean(activeCall)}
                isLoading={isStartingCall && startCall.variables?.callType === 'audio'}
              />
              <CallButton
                callType="video"
                onClick={handleStartVideoCall}
                disabled={Boolean(activeCall)}
                isLoading={isStartingCall && startCall.variables?.callType === 'video'}
              />
            </>
          )}
          
          {onSearchClick && (
            <button 
              className="p-2 hover:bg-accent rounded-full"
              onClick={onSearchClick}
            >
              <Search className="h-5 w-5" />
            </button>
          )}
          {isGroup && onSettingsClick && (
            <button 
              className="p-2 hover:bg-accent rounded-full"
              onClick={onSettingsClick}
            >
              <Settings className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message, index) => {
            const isOwn = message.sender_id === userId;
            const showAvatar = !isOwn && (
              index === 0 || messages[index - 1]?.sender_id !== message.sender_id
            );

            return (
              <MessageBubble
                key={message.id}
                message={message}
                isOwn={isOwn}
                showAvatar={showAvatar}
                onReply={() => setReplyTo(message)}
                onReaction={(emoji, hasReacted) => handleReaction(message.id, emoji, hasReacted)}
              />
            );
          })}

          {typingUsers.length > 0 && (
            <TypingIndicator users={typingUsers} />
          )}
        </div>
      </div>

      {/* Input */}
      <ChatInput
        onSend={handleSend}
        onTyping={sendTyping}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        isSending={sendMessage.isPending}
      />

      {/* Incoming call dialog */}
      {incomingCall && !activeCall && (
        <IncomingCallDialog
          call={incomingCall}
          callerProfile={callerProfile}
          onAccept={handleAcceptCall}
          onReject={handleRejectCall}
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
          isOutgoing={activeCall.caller_id === userId}
        />
      )}
    </div>
  );
}
