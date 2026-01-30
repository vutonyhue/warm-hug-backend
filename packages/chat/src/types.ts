import type { SupabaseClient } from '@supabase/supabase-js';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Configuration for the Chat module
 */
export interface ChatConfig {
  /** Supabase client instance */
  supabase: SupabaseClient;
  /** React Query client instance */
  queryClient: QueryClient;
  /** Current authenticated user ID */
  currentUserId: string | null;
  /** Current user's username for typing indicators */
  currentUsername: string | null;
  /** Optional function to upload media files */
  uploadMedia?: (file: File) => Promise<{ url: string; type?: string }>;
  /** Optional translations override */
  translations?: Partial<ChatTranslations>;
  /** Optional custom date locale */
  dateLocale?: Locale;
}

/**
 * Translatable strings for the chat module
 */
export interface ChatTranslations {
  noConversations: string;
  user: string;
  typing: string;
  andOthersTyping: string;
  newMessage: string;
  replyTo: string;
  searchMessages: string;
  noResults: string;
  sendMessage: string;
  createGroup: string;
  leaveGroup: string;
  groupSettings: string;
  addMember: string;
  removeMember: string;
  you: string;
  members: string;
}

/**
 * Conversation data structure
 */
export interface Conversation {
  id: string;
  type: string;
  name: string | null;
  avatar_url: string | null;
  created_by: string | null;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string | null;
  updated_at: string | null;
  participants?: ConversationParticipant[];
  unread_count?: number;
}

/**
 * Conversation participant data
 */
export interface ConversationParticipant {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string | null;
  nickname: string | null;
  joined_at: string | null;
  left_at: string | null;
  muted_until: string | null;
  profile?: UserProfile;
}

/**
 * User profile for display
 */
export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  full_name: string | null;
}

/**
 * Message data structure
 */
export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string | null;
  media_type: string | null;
  media_url: string | null;
  reply_to_id: string | null;
  is_deleted: boolean | null;
  is_edited: boolean | null;
  created_at: string | null;
  updated_at: string | null;
  sender?: UserProfile;
  reply_to?: Message | null;
  reactions?: MessageReaction[];
  read_by?: string[];
}

/**
 * Message reaction data
 */
export interface MessageReaction {
  id: string;
  message_id?: string;
  user_id: string;
  emoji: string;
  created_at: string | null;
}

/**
 * Chat settings for a user
 */
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

/**
 * Typing user indicator
 */
export interface TypingUser {
  userId: string;
  username: string;
  avatar_url?: string;
}

// Re-export Locale type for convenience
import type { Locale } from 'date-fns';
export type { Locale };
