# @fun-ecosystem/chat

Chat module for Fun Ecosystem - provides messaging, group chats, and realtime features.

## Installation

```bash
npm install @fun-ecosystem/chat
# or
pnpm add @fun-ecosystem/chat
```

## Peer Dependencies

This package requires the following peer dependencies:
- `react` >= 18.0.0
- `react-dom` >= 18.0.0
- `@supabase/supabase-js` >= 2.90.0
- `@tanstack/react-query` >= 5.0.0
- `date-fns` >= 4.0.0
- `lucide-react` >= 0.400.0
- `sonner` >= 1.0.0

## Quick Start

```tsx
import { 
  ChatProvider, 
  ConversationList, 
  MessageThread 
} from '@fun-ecosystem/chat';
import { createClient } from '@supabase/supabase-js';
import { QueryClient } from '@tanstack/react-query';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const queryClient = new QueryClient();

function ChatPage() {
  const [selectedConversation, setSelectedConversation] = useState(null);

  return (
    <ChatProvider
      config={{
        supabase,
        queryClient,
        currentUserId: 'user-id',
        currentUsername: 'username',
        uploadMedia: async (file) => {
          // Your upload logic
          return { url: 'https://...' };
        },
      }}
    >
      <div className="flex h-screen">
        <ConversationList onSelect={setSelectedConversation} />
        {selectedConversation && (
          <MessageThread conversationId={selectedConversation} />
        )}
      </div>
    </ChatProvider>
  );
}
```

## Components

### ChatProvider
Wraps your chat components and provides configuration via context.

### ConversationList
Displays a list of conversations with search and realtime updates.

### MessageThread
Shows messages in a conversation with reactions, replies, and typing indicators.

### ChatInput
Message input with media upload, emoji picker, and reply functionality.

### MessageBubble
Individual message display with reactions and read receipts.

### TypingIndicator
Shows who is currently typing.

### CreateGroupDialog
Dialog for creating new group conversations.

### GroupSettingsDialog
Dialog for managing group settings and members.

### NewConversationDialog
Dialog for starting a new direct conversation.

### MessageSearch
Search messages within a conversation.

### ChatSettingsDialog
User's chat privacy and notification settings.

## Hooks

### useConversations
Fetch and manage conversation list.

### useMessages
Fetch messages with pagination and realtime updates.

### useTypingIndicator
Send and receive typing indicators.

### useChatSettings
Manage user's chat settings.

### useGroupConversations
Create and manage group conversations.

### useChatNotifications
Handle chat notifications.

## Database Schema

This module requires the following tables:
- `conversations`
- `conversation_participants`
- `messages`
- `message_reactions`
- `message_reads`
- `chat_settings`

See the main repository for migration scripts.

## License

MIT
