// ============================================
// @fun-ecosystem/chat
// Chat module for Fun Ecosystem
// ============================================

// Provider
export { ChatProvider, useChatConfig, useChatSupabase, useChatUser, useChatQueryClient, useChatUpload } from './components/ChatProvider';

// Components
export { ChatInput } from './components/ChatInput';
export { ChatSettingsDialog } from './components/ChatSettingsDialog';
export { ConversationList } from './components/ConversationList';
export { CreateGroupDialog } from './components/CreateGroupDialog';
export { GroupSettingsDialog } from './components/GroupSettingsDialog';
export { MessageBubble } from './components/MessageBubble';
export { MessageSearch } from './components/MessageSearch';
export { MessageThread } from './components/MessageThread';
export { NewConversationDialog } from './components/NewConversationDialog';
export { TypingIndicator } from './components/TypingIndicator';

// Hooks
export { useChatNotifications } from './hooks/useChatNotifications';
export { useChatSettings, canSendMessage } from './hooks/useChatSettings';
export { useConversations, useConversation } from './hooks/useConversations';
export { useGroupConversations } from './hooks/useGroupConversations';
export { useMessages } from './hooks/useMessages';
export { useTypingIndicator } from './hooks/useTypingIndicator';
export { useDebounce } from './hooks/useDebounce';

// Utils
export { cn } from './utils/cn';
export { defaultTranslations, getTranslation } from './utils/translations';

// Types
export type {
  ChatConfig,
  ChatTranslations,
  ChatSettings,
  Conversation,
  ConversationParticipant,
  Message,
  MessageReaction,
  TypingUser,
  UserProfile,
  Locale,
} from './types';
