import { createContext, useContext, ReactNode, useMemo } from 'react';
import type { ChatConfig, ChatTranslations } from '../types';
import { defaultTranslations } from '../utils/translations';

interface ChatContextValue extends ChatConfig {
  t: (key: keyof ChatTranslations) => string;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  config: ChatConfig;
}

/**
 * ChatProvider - Wraps chat components and provides configuration via context
 * 
 * @example
 * ```tsx
 * <ChatProvider
 *   config={{
 *     supabase: supabaseClient,
 *     queryClient: queryClient,
 *     currentUserId: user.id,
 *     currentUsername: user.username,
 *     uploadMedia: async (file) => ({ url: await uploadToStorage(file) }),
 *   }}
 * >
 *   <ConversationList />
 *   <MessageThread conversationId={selectedId} />
 * </ChatProvider>
 * ```
 */
export function ChatProvider({ children, config }: ChatProviderProps) {
  const value = useMemo<ChatContextValue>(() => ({
    ...config,
    t: (key: keyof ChatTranslations) => 
      config.translations?.[key] ?? defaultTranslations[key],
  }), [config]);

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

/**
 * Hook to access chat configuration
 * Must be used within a ChatProvider
 */
export function useChatConfig(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatConfig must be used within a ChatProvider');
  }
  return context;
}

/**
 * Hook to access only the Supabase client
 */
export function useChatSupabase() {
  const { supabase } = useChatConfig();
  return supabase;
}

/**
 * Hook to access the current user info
 */
export function useChatUser() {
  const { currentUserId, currentUsername } = useChatConfig();
  return { userId: currentUserId, username: currentUsername };
}

/**
 * Hook to access the query client
 */
export function useChatQueryClient() {
  const { queryClient } = useChatConfig();
  return queryClient;
}

/**
 * Hook to access media upload function
 */
export function useChatUpload() {
  const { uploadMedia } = useChatConfig();
  return uploadMedia;
}
