import { useState } from 'react';
import { toast } from 'sonner';
import { 
  Settings, 
  UserMinus, 
  UserPlus, 
  LogOut, 
  Crown, 
  Loader2,
  ImagePlus,
} from 'lucide-react';
import { cn } from '../utils/cn';
import { useChatSupabase, useChatUser } from './ChatProvider';
import type { Conversation, ConversationParticipant } from '../types';

interface GroupSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversation: Conversation;
  onUpdate: () => void;
  onLeave: () => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Dialog for managing group settings and members
 */
export function GroupSettingsDialog({
  open,
  onOpenChange,
  conversation,
  onUpdate,
  onLeave,
  className,
}: GroupSettingsDialogProps) {
  const supabase = useChatSupabase();
  const { userId } = useChatUser();
  const [groupName, setGroupName] = useState(conversation.name || '');
  const [isUpdating, setIsUpdating] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const participants = conversation.participants?.filter((p) => !p.left_at) || [];
  const currentParticipant = participants.find((p) => p.user_id === userId);
  const isAdmin = currentParticipant?.role === 'admin';

  const handleUpdateName = async () => {
    if (!groupName.trim() || groupName === conversation.name) return;

    setIsUpdating(true);
    try {
      const { error } = await supabase
        .from('conversations')
        .update({ name: groupName.trim() })
        .eq('id', conversation.id);

      if (error) throw error;
      toast.success('Đã cập nhật tên nhóm');
      onUpdate();
    } catch (error) {
      console.error('Error updating group name:', error);
      toast.error('Không thể cập nhật tên nhóm');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('user_id', memberId);

      if (error) throw error;
      toast.success('Đã xóa thành viên');
      onUpdate();
    } catch (error) {
      console.error('Error removing member:', error);
      toast.error('Không thể xóa thành viên');
    }
  };

  const handleLeaveGroup = async () => {
    setIsLeaving(true);
    try {
      const { error } = await supabase
        .from('conversation_participants')
        .update({ left_at: new Date().toISOString() })
        .eq('conversation_id', conversation.id)
        .eq('user_id', userId);

      if (error) throw error;
      toast.success('Đã rời nhóm');
      onLeave();
      onOpenChange(false);
    } catch (error) {
      console.error('Error leaving group:', error);
      toast.error('Không thể rời nhóm');
    } finally {
      setIsLeaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/50" 
        onClick={() => onOpenChange(false)}
      />
      
      {/* Dialog */}
      <div className={cn("relative bg-card rounded-lg shadow-lg w-full max-w-md mx-4 p-6", className)}>
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5" />
          <h2 className="text-lg font-semibold">Cài đặt nhóm</h2>
        </div>

        <div className="space-y-6">
          {/* Group avatar */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {conversation.avatar_url ? (
                  <img src={conversation.avatar_url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-2xl font-medium">
                    {(conversation.name || 'G')[0].toUpperCase()}
                  </span>
                )}
              </div>
              {isAdmin && (
                <button className="absolute bottom-0 right-0 p-1 bg-primary rounded-full text-primary-foreground hover:bg-primary/90">
                  <ImagePlus className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Group name */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Tên nhóm</label>
            <div className="flex gap-2">
              <input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                disabled={!isAdmin}
                className="flex-1 px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
              />
              {isAdmin && (
                <button
                  onClick={handleUpdateName}
                  disabled={isUpdating || !groupName.trim() || groupName === conversation.name}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                  {isUpdating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Lưu'}
                </button>
              )}
            </div>
          </div>

          <hr className="border-border" />

          {/* Members */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Thành viên ({participants.length})</span>
              {isAdmin && (
                <button className="flex items-center gap-1 px-2 py-1 text-sm hover:bg-accent rounded-md">
                  <UserPlus className="h-4 w-4" />
                  Thêm
                </button>
              )}
            </div>

            <div className="h-[200px] overflow-y-auto space-y-2">
              {participants.map((participant) => {
                const profile = participant.profile;
                const isCurrentUser = participant.user_id === userId;
                const isMemberAdmin = participant.role === 'admin';

                return (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent/50"
                  >
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                      {profile?.avatar_url ? (
                        <img src={profile.avatar_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-sm font-medium">
                          {(profile?.username || 'U')[0].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium truncate">
                          {profile?.full_name || profile?.username || 'Người dùng'}
                        </span>
                        {isCurrentUser && (
                          <span className="text-xs px-1.5 py-0.5 border rounded-full">Bạn</span>
                        )}
                        {isMemberAdmin && (
                          <Crown className="h-4 w-4 text-yellow-500" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        @{profile?.username}
                      </p>
                    </div>

                    {isAdmin && !isCurrentUser && (
                      <button
                        className="p-2 hover:bg-destructive/10 rounded-full text-destructive"
                        onClick={() => handleRemoveMember(participant.user_id)}
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <hr className="border-border" />

          {/* Leave group */}
          {showLeaveConfirm ? (
            <div className="p-4 bg-destructive/10 rounded-lg space-y-3">
              <p className="text-sm font-medium">Rời khỏi nhóm?</p>
              <p className="text-sm text-muted-foreground">
                Bạn sẽ không thể xem tin nhắn mới trong nhóm này sau khi rời đi.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaveConfirm(false)}
                  className="flex-1 px-3 py-2 border border-input rounded-md text-sm hover:bg-accent"
                >
                  Hủy
                </button>
                <button
                  onClick={handleLeaveGroup}
                  disabled={isLeaving}
                  className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 disabled:opacity-50"
                >
                  {isLeaving ? 'Đang rời...' : 'Rời nhóm'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLeaveConfirm(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90"
            >
              <LogOut className="h-4 w-4" />
              Rời nhóm
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
