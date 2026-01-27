import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface ChatSettings {
  id: string;
  user_id: string;
  who_can_message: string | null;
  read_receipts: boolean | null;
  typing_indicators: boolean | null;
  notification_sound: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

const DEFAULT_SETTINGS: Omit<ChatSettings, 'id' | 'user_id' | 'created_at' | 'updated_at'> = {
  who_can_message: 'friends',
  read_receipts: true,
  typing_indicators: true,
  notification_sound: true,
};

export function useChatSettings(userId: string | null) {
  const queryClient = useQueryClient();

  const settingsQuery = useQuery({
    queryKey: ['chat-settings', userId],
    queryFn: async () => {
      if (!userId) return null;

      const { data, error } = await supabase
        .from('chat_settings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // Return settings with defaults
      if (!data) {
        return {
          user_id: userId,
          ...DEFAULT_SETTINGS,
        } as ChatSettings;
      }

      return data;
    },
    enabled: !!userId,
  });

  const updateSettings = useMutation({
    mutationFn: async (updates: Partial<ChatSettings>) => {
      if (!userId) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('chat_settings')
        .upsert(
          {
            user_id: userId,
            ...updates,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'user_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['chat-settings', userId] });
    },
  });

  return {
    settings: settingsQuery.data,
    isLoading: settingsQuery.isLoading,
    error: settingsQuery.error,
    updateSettings,
  };
}

// Check if a user can message another user
export async function canSendMessage(senderId: string, receiverId: string): Promise<boolean> {
  // Get receiver's chat settings
  const { data: settings } = await supabase
    .from('chat_settings')
    .select('who_can_message')
    .eq('user_id', receiverId)
    .maybeSingle();

  const whoCanMessage = settings?.who_can_message || 'friends';

  switch (whoCanMessage) {
    case 'everyone':
      return true;
    case 'nobody':
      return false;
    case 'friends':
    default:
      // Check if they are friends
      const { data: friendship } = await supabase
        .from('friendships')
        .select('id')
        .or(`and(requester_id.eq.${senderId},addressee_id.eq.${receiverId}),and(requester_id.eq.${receiverId},addressee_id.eq.${senderId})`)
        .eq('status', 'accepted')
        .limit(1);

      return (friendship?.length || 0) > 0;
  }
}
