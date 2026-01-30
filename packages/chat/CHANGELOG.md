# Changelog

All notable changes to `@fun-ecosystem/chat` will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2025-01-30

### Added
- Initial release of @fun-ecosystem/chat
- **ChatProvider** - Dependency Injection pattern for Supabase, QueryClient, and upload functions
- **ConversationList** - Display conversations with search and realtime updates
- **MessageThread** - Full message view with reactions, replies, and read receipts
- **ChatInput** - Message input with media upload and emoji support
- **MessageBubble** - Individual message display with reactions
- **TypingIndicator** - Show who is currently typing
- **Voice Message Support**:
  - VoiceRecordButton - Hold-to-record button
  - VoicePreview - Preview recorded audio before sending
  - VoicePlayer - Playback voice messages
  - useVoiceRecorder hook for audio recording
- **Group Conversations**:
  - CreateGroupDialog - Create new group chats
  - GroupSettingsDialog - Manage group members and settings
- **NewConversationDialog** - Start direct conversations
- **MessageSearch** - Search messages within conversations
- **ChatSettingsDialog** - User privacy and notification settings
- **Hooks**:
  - useConversations - Fetch and manage conversations
  - useMessages - Fetch messages with pagination and realtime
  - useTypingIndicator - Send/receive typing status
  - useChatSettings - Manage chat privacy settings
  - useGroupConversations - Group management
  - useChatNotifications - Handle notifications
  - useDebounce - Debounce utility
- **Utilities**:
  - cn() - Tailwind class merging
  - getTranslation() - i18n support with defaultTranslations
- Full TypeScript support with exported types
