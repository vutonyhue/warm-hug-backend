import { Settings, Eye, Keyboard, Users } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '../utils/cn';
import { useChatSettings } from '../hooks/useChatSettings';
import type { ChatSettings } from '../types';

interface ChatSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Custom CSS classes */
  className?: string;
}

/**
 * Dialog for user's chat privacy and notification settings
 */
export function ChatSettingsDialog({
  open,
  onOpenChange,
  className,
}: ChatSettingsDialogProps) {
  const { settings, updateSettings, isLoading } = useChatSettings();

  const handleUpdate = async (updates: Partial<ChatSettings>) => {
    try {
      await updateSettings.mutateAsync(updates);
      toast.success('Đã cập nhật cài đặt');
    } catch (error) {
      console.error('Error updating settings:', error);
      toast.error('Không thể cập nhật cài đặt');
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
          <h2 className="text-lg font-semibold">Cài đặt tin nhắn</h2>
        </div>

        <div className="space-y-6">
          {/* Who can message */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Ai có thể nhắn tin cho bạn</label>
            </div>
            <select
              value={settings?.who_can_message || 'friends'}
              onChange={(e) => handleUpdate({ who_can_message: e.target.value })}
              disabled={isLoading || updateSettings.isPending}
              className="w-full px-3 py-2 border border-input bg-background rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
            >
              <option value="everyone">Mọi người</option>
              <option value="friends">Chỉ bạn bè</option>
              <option value="nobody">Không ai</option>
            </select>
            <p className="text-xs text-muted-foreground">
              Người ngoài danh sách sẽ không thể gửi tin nhắn mới cho bạn
            </p>
          </div>

          <hr className="border-border" />

          {/* Read receipts */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Xác nhận đã đọc</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Hiển thị khi bạn đã xem tin nhắn
              </p>
            </div>
            <button
              onClick={() => handleUpdate({ read_receipts: !(settings?.read_receipts ?? true) })}
              disabled={isLoading || updateSettings.isPending}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors disabled:opacity-50",
                settings?.read_receipts !== false ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  settings?.read_receipts !== false ? "left-5" : "left-0.5"
                )}
              />
            </button>
          </div>

          <hr className="border-border" />

          {/* Typing indicator */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-muted-foreground" />
                <label className="text-sm font-medium">Trạng thái đang nhập</label>
              </div>
              <p className="text-xs text-muted-foreground">
                Cho người khác biết khi bạn đang nhập
              </p>
            </div>
            <button
              onClick={() => handleUpdate({ typing_indicators: !(settings?.typing_indicators ?? true) })}
              disabled={isLoading || updateSettings.isPending}
              className={cn(
                "relative w-11 h-6 rounded-full transition-colors disabled:opacity-50",
                settings?.typing_indicators !== false ? "bg-primary" : "bg-muted"
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform",
                  settings?.typing_indicators !== false ? "left-5" : "left-0.5"
                )}
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
