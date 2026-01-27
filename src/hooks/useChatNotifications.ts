import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationOptions {
  enabled?: boolean;
  showToast?: boolean;
  playSound?: boolean;
}

export function useChatNotifications(
  userId: string | null,
  currentConversationId: string | null,
  options: NotificationOptions = {}
) {
  const { enabled = true, showToast = true, playSound = true } = options;

  const playNotificationSound = useCallback(() => {
    if (!playSound) return;
    
    try {
      // Create a simple notification sound using Web Audio API
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.3);
    } catch (error) {
      // Silently fail if audio context is not available
      console.debug('Audio notification not available');
    }
  }, [playSound]);

  useEffect(() => {
    if (!userId || !enabled) return;

    const channel = supabase
      .channel('chat-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        async (payload) => {
          const message = payload.new as any;

          // Don't notify for own messages
          if (message.sender_id === userId) return;

          // Don't notify for current conversation if user is viewing it
          if (message.conversation_id === currentConversationId) return;

          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('username, avatar_url')
            .eq('id', message.sender_id)
            .single();

          // Check if user is participant in this conversation
          const { data: participant } = await supabase
            .from('conversation_participants')
            .select('id')
            .eq('conversation_id', message.conversation_id)
            .eq('user_id', userId)
            .is('left_at', null)
            .single();

          if (!participant) return;

          // Play sound
          playNotificationSound();

          // Show toast notification
          if (showToast) {
            toast.info(`${sender?.username || 'Ai đó'} đã gửi tin nhắn`, {
              description: message.content?.substring(0, 50) || '📷 Hình ảnh',
              duration: 4000,
            });
          }

          // Request browser notification permission
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification(`Tin nhắn từ ${sender?.username || 'Ai đó'}`, {
              body: message.content?.substring(0, 100) || 'Đã gửi một hình ảnh',
              icon: sender?.avatar_url || '/fun-profile-logo-128.webp',
              tag: message.conversation_id,
            });
          }
        }
      )
      .subscribe();

    // Request notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentConversationId, enabled, showToast, playNotificationSound]);

  return null;
}
