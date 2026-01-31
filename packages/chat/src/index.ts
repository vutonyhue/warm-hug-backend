// ============================================
// @fun-ecosystem1/chat
// Chat module for Fun Ecosystem
// ============================================

// Constants
export { CHAT_SDK_VERSION, CHAT_SDK_NAME } from './constants';

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

// Voice Message Components
export { VoiceRecordButton } from './components/VoiceRecordButton';
export { VoicePreview } from './components/VoicePreview';
export { VoicePlayer } from './components/VoicePlayer';

// Video Call Components
export { VideoCallModal } from './components/VideoCallModal';
export { IncomingCallDialog } from './components/IncomingCallDialog';
export { CallButton } from './components/CallButton';
export { VideoCallProvider, useVideoCallContext } from './components/VideoCallProvider';

// Hooks
export { useChatNotifications } from './hooks/useChatNotifications';
export { useChatSettings, canSendMessage } from './hooks/useChatSettings';
export { useConversations, useConversation } from './hooks/useConversations';
export { useGroupConversations } from './hooks/useGroupConversations';
export { useMessages } from './hooks/useMessages';
export { useTypingIndicator } from './hooks/useTypingIndicator';
export { useDebounce } from './hooks/useDebounce';
export { useVoiceRecorder, formatVoiceDuration } from './hooks/useVoiceRecorder';
export { useVideoCall } from './hooks/useVideoCall';
export { useAgoraClient } from './hooks/useAgoraClient';

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
  VideoCall,
  VideoCallParticipant,
} from './types';
