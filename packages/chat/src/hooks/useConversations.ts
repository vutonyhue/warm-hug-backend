import { useQuery, useMutation } from '@tanstack/react-query';
import { useEffect } from 'react';
import { useChatSupabase, useChatUser, useChatQueryClient } from '../components/ChatProvider';
import type { Conversation, ConversationParticipant, UserProfile } from '../types';

/**
 * Hook for managing conversation list
 */
export function useConversations() {
  const supabase = useChatSupabase();
  const queryClient = useChatQueryClient();
  const { userId } = useChatUser();

  const conversationsQuery = useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return [];

      // Get conversations where user is a participant
      const { data: participantData, error: participantError } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (participantError) throw participantError;
      if (!participantData?.length) return [];

      const conversationIds = participantData.map(p => p.conversation_id);

      // Get full conversation data with participants
      const { data: conversations, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            id,
            user_id,
            role,
            nickname,
            joined_at,
            left_at
          )
        `)
        .in('id', conversationIds)
        .order('last_message_at', { ascending: false, nullsFirst: false });

      if (error) throw error;

      // Fetch profiles for participants
      const allUserIds = new Set<string>();
      conversations?.forEach(conv => {
        conv.conversation_participants?.forEach((p: any) => {
          if (p.user_id && !p.left_at) allUserIds.add(p.user_id);
        });
      });

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .in('id', Array.from(allUserIds));

      const profileMap = new Map<string, UserProfile>(
        profiles?.map(p => [p.id, p as UserProfile]) || []
      );

      // Map profiles to participants
      return conversations?.map(conv => ({
        ...conv,
        participants: conv.conversation_participants?.map((p: any) => ({
          ...p,
          profile: profileMap.get(p.user_id)
        })) as ConversationParticipant[]
      })) as Conversation[] || [];
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  });

  // Realtime subscription for conversation updates
  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversations',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'conversation_participants',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, queryClient, supabase]);

  // Create direct conversation
  const createDirectConversation = useMutation({
    mutationFn: async (otherUserId: string) => {
      if (!userId) throw new Error('User not authenticated');

      // Check if conversation already exists
      const { data: existingParticipants } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', userId)
        .is('left_at', null);

      if (existingParticipants?.length) {
        const { data: otherParticipants } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', otherUserId)
          .in('conversation_id', existingParticipants.map(p => p.conversation_id))
          .is('left_at', null);

        if (otherParticipants?.length) {
          // Check if it's a direct (2-person) conversation
          for (const op of otherParticipants) {
            const { data: allParticipants } = await supabase
              .from('conversation_participants')
              .select('user_id')
              .eq('conversation_id', op.conversation_id)
              .is('left_at', null);

            if (allParticipants?.length === 2) {
              // Found existing direct conversation
              const { data: conv } = await supabase
                .from('conversations')
                .select('*')
                .eq('id', op.conversation_id)
                .eq('type', 'direct')
                .single();

              if (conv) return conv as Conversation;
            }
          }
        }
      }

      // Create new conversation
      const { data: conversation, error: convError } = await supabase
        .from('conversations')
        .insert({
          type: 'direct',
          created_by: userId,
        })
        .select()
        .single();

      if (convError) throw convError;

      // Add both participants
      const { error: partError } = await supabase
        .from('conversation_participants')
        .insert([
          { conversation_id: conversation.id, user_id: userId, role: 'member' },
          { conversation_id: conversation.id, user_id: otherUserId, role: 'member' },
        ]);

      if (partError) throw partError;

      return conversation as Conversation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations', userId] });
    },
  });

  return {
    conversations: conversationsQuery.data || [],
    isLoading: conversationsQuery.isLoading,
    error: conversationsQuery.error,
    createDirectConversation,
  };
}

/**
 * Hook for fetching a single conversation
 */
export function useConversation(conversationId: string | null) {
  const supabase = useChatSupabase();

  return useQuery({
    queryKey: ['conversation', conversationId],
    queryFn: async () => {
      if (!conversationId) return null;

      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          conversation_participants (
            id,
            user_id,
            role,
            nickname,
            joined_at,
            left_at
          )
        `)
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      // Fetch profiles for participants
      const userIds = data.conversation_participants
        ?.filter((p: any) => !p.left_at)
        .map((p: any) => p.user_id) || [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, full_name')
        .in('id', userIds);

      const profileMap = new Map<string, UserProfile>(
        profiles?.map(p => [p.id, p as UserProfile]) || []
      );

      return {
        ...data,
        participants: data.conversation_participants?.map((p: any) => ({
          ...p,
          profile: profileMap.get(p.user_id)
        })) as ConversationParticipant[]
      } as Conversation;
    },
    enabled: !!conversationId,
  });
}
