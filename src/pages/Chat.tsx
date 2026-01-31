import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { vi } from 'date-fns/locale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { uploadCommentMedia } from '@/utils/mediaUpload';
import { getMediaUrl } from '@/config/media';
import { FacebookNavbar } from '@/components/layout/FacebookNavbar';
import { MobileBottomNav } from '@/components/layout/MobileBottomNav';
import { useIsMobile, useIsMobileOrTablet } from '@/hooks/use-mobile';
import { ArrowLeft, MessageSquarePlus, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

// Import từ package chat SDK
import {
  ChatProvider,
  ConversationList,
  MessageThread,
  NewConversationDialog,
  CreateGroupDialog,
  ChatSettingsDialog,
  useConversations,
  useGroupConversations,
  useChatNotifications,
} from '../../packages/chat/src';

export default function Chat() {
  const { conversationId } = useParams<{ conversationId?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const isMobileOrTablet = useIsMobileOrTablet();
  const queryClient = useQueryClient();
  
  // Get target user from query param ?user=xxx
  const targetUserId = searchParams.get('user');
  const clearTargetUser = () => setSearchParams({});
  
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [showNewConversation, setShowNewConversation] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);

      const { data: profile } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .single();
      
      setUsername(profile?.username || null);
    };

    checkAuth();
  }, [navigate]);

  // Upload adapter cho package chat
  const uploadChatMedia = useMemo(() => {
    return async (file: File) => {
      const result = await uploadCommentMedia(file);
      return { 
        url: getMediaUrl(result.key), 
        type: file.type.startsWith('audio/') ? 'voice' : undefined 
      };
    };
  }, []);

  // Chat config cho ChatProvider
  const chatConfig = useMemo(() => ({
    supabase,
    queryClient,
    currentUserId: userId,
    currentUsername: username,
    uploadMedia: uploadChatMedia,
    dateLocale: vi,
    // Enable video calls - token will be fetched from edge function automatically
    enableVideoCalls: true,
  }), [userId, username, queryClient, uploadChatMedia]);

  // Chờ auth hoàn tất
  if (!userId) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FacebookNavbar />
        <div className="flex-1 flex items-center justify-center pt-14">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </div>
    );
  }

  return (
    <ChatProvider config={chatConfig}>
      <ChatContent 
        conversationId={conversationId}
        targetUserId={targetUserId}
        clearTargetUser={clearTargetUser}
        isMobileOrTablet={isMobileOrTablet}
        showNewConversation={showNewConversation}
        setShowNewConversation={setShowNewConversation}
        showCreateGroup={showCreateGroup}
        setShowCreateGroup={setShowCreateGroup}
        showSettings={showSettings}
        setShowSettings={setShowSettings}
      />
    </ChatProvider>
  );
}

// Tách ChatContent để sử dụng hooks từ ChatProvider
interface ChatContentProps {
  conversationId?: string;
  targetUserId?: string | null;
  clearTargetUser: () => void;
  isMobileOrTablet: boolean;
  showNewConversation: boolean;
  setShowNewConversation: (show: boolean) => void;
  showCreateGroup: boolean;
  setShowCreateGroup: (show: boolean) => void;
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

function ChatContent({
  conversationId,
  targetUserId,
  clearTargetUser,
  isMobileOrTablet,
  showNewConversation,
  setShowNewConversation,
  showCreateGroup,
  setShowCreateGroup,
  showSettings,
  setShowSettings,
}: ChatContentProps) {
  const navigate = useNavigate();
  const isCreatingRef = useRef(false);
  
  // Sử dụng hooks từ package chat - lấy userId từ context
  const { conversations, isLoading, createDirectConversation } = useConversations();
  const { createGroupConversation } = useGroupConversations();
  
  // Enable chat notifications
  useChatNotifications(conversationId || null);

  // Auto-create conversation when targetUserId is provided from ?user=xxx
  useEffect(() => {
    if (!targetUserId || isLoading || isCreatingRef.current) return;
    
    console.log('[Chat] Processing targetUserId:', targetUserId);
    
    // Check if conversation already exists with this user
    const existingConv = conversations.find(conv => 
      conv.type === 'direct' && 
      conv.participants?.some(p => p.user_id === targetUserId)
    );
    
    if (existingConv) {
      console.log('[Chat] Found existing conversation:', existingConv.id);
      navigate(`/chat/${existingConv.id}`, { replace: true });
      clearTargetUser();
      return;
    }
    
    // Create new conversation
    const createChat = async () => {
      isCreatingRef.current = true;
      try {
        console.log('[Chat] Creating new conversation with:', targetUserId);
        const result = await createDirectConversation.mutateAsync(targetUserId);
        if (result) {
          console.log('[Chat] Created conversation:', result.id);
          navigate(`/chat/${result.id}`, { replace: true });
        }
      } catch (error) {
        console.error('[Chat] Error creating conversation:', error);
        toast.error('Không thể tạo cuộc trò chuyện');
      } finally {
        clearTargetUser();
        isCreatingRef.current = false;
      }
    };
    
    createChat();
  }, [targetUserId, isLoading, conversations, createDirectConversation, navigate, clearTargetUser]);

  const handleSelectConversation = (id: string) => {
    navigate(`/chat/${id}`);
  };

  const handleBack = () => {
    navigate('/chat');
  };

  const handleNewConversation = async (otherUserId: string) => {
    try {
      const result = await createDirectConversation.mutateAsync(otherUserId);
      if (result) {
        navigate(`/chat/${result.id}`);
      }
    } catch (error) {
      console.error('[Chat] Error creating conversation:', error);
      toast.error('Không thể tạo cuộc trò chuyện');
    }
    setShowNewConversation(false);
  };

  const handleCreateGroup = async (name: string, memberIds: string[]) => {
    try {
      const result = await createGroupConversation.mutateAsync({ name, memberIds });
      if (result) {
        navigate(`/chat/${result.id}`);
      }
    } catch (error) {
      console.error('[Chat] Error creating group:', error);
      toast.error('Không thể tạo nhóm');
    }
    setShowCreateGroup(false);
  };

  // Mobile/Tablet: Show only list or thread
  if (isMobileOrTablet) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <FacebookNavbar />
        
        <main className="flex-1 pt-14 pb-16">
          {conversationId ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-2 p-3 border-b bg-card">
                <Button variant="ghost" size="icon" onClick={handleBack}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <span className="font-medium">Tin nhắn</span>
              </div>
              <MessageThread conversationId={conversationId} />
            </div>
          ) : (
            <div className="h-full">
              <div className="flex items-center justify-between p-4 border-b">
                <h1 className="text-xl font-bold">Tin nhắn</h1>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowSettings(true)}
                    className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
                  >
                    <Settings className="h-5 w-5" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="border border-transparent hover:border-[#C9A84C]/40 rounded-full">
                        <MessageSquarePlus className="h-5 w-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                        <MessageSquarePlus className="h-4 w-4 mr-2" />
                        Tin nhắn mới
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                        <Users className="h-4 w-4 mr-2" />
                        Tạo nhóm
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
              <ConversationList
                conversations={conversations}
                selectedId={null}
                onSelect={handleSelectConversation}
                isLoading={isLoading}
              />
            </div>
          )}
        </main>

        <MobileBottomNav />

        <NewConversationDialog
          open={showNewConversation}
          onOpenChange={setShowNewConversation}
          onSelectUser={handleNewConversation}
        />

        <CreateGroupDialog
          open={showCreateGroup}
          onOpenChange={setShowCreateGroup}
          onCreateGroup={handleCreateGroup}
          isCreating={createGroupConversation.isPending}
        />

        <ChatSettingsDialog
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      </div>
    );
  }

  // Desktop: Two-column layout
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <FacebookNavbar />
      
      <main className="flex-1 pt-14 flex">
        {/* Left sidebar - Conversation list */}
        <div className="w-80 border-r bg-card flex flex-col h-[calc(100vh-3.5rem)]">
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold">Tin nhắn</h1>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(true)}
                className="border border-transparent hover:border-[#C9A84C]/40 rounded-full"
              >
                <Settings className="h-5 w-5" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="border border-transparent hover:border-[#C9A84C]/40 rounded-full">
                    <MessageSquarePlus className="h-5 w-5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setShowNewConversation(true)}>
                    <MessageSquarePlus className="h-4 w-4 mr-2" />
                    Tin nhắn mới
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowCreateGroup(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Tạo nhóm
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <ConversationList
            conversations={conversations}
            selectedId={conversationId || null}
            onSelect={handleSelectConversation}
            isLoading={isLoading}
          />
        </div>

        {/* Main content - Message thread */}
        <div className="flex-1 flex flex-col h-[calc(100vh-3.5rem)]">
          {conversationId ? (
            <MessageThread conversationId={conversationId} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquarePlus className="h-16 w-16 mx-auto mb-4 opacity-50" />
                <p className="text-lg">Chọn cuộc trò chuyện để bắt đầu</p>
              </div>
            </div>
          )}
        </div>
      </main>

      <NewConversationDialog
        open={showNewConversation}
        onOpenChange={setShowNewConversation}
        onSelectUser={handleNewConversation}
      />

      <CreateGroupDialog
        open={showCreateGroup}
        onOpenChange={setShowCreateGroup}
        onCreateGroup={handleCreateGroup}
        isCreating={createGroupConversation.isPending}
      />

      <ChatSettingsDialog
        open={showSettings}
        onOpenChange={setShowSettings}
      />
    </div>
  );
}
