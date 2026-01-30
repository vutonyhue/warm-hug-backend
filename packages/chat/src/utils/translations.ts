import type { ChatTranslations } from '../types';

/**
 * Default Vietnamese translations
 */
export const defaultTranslations: ChatTranslations = {
  noConversations: 'Chưa có cuộc trò chuyện nào',
  user: 'Người dùng',
  typing: 'đang nhập...',
  andOthersTyping: 'và {count} người khác đang nhập...',
  newMessage: 'Tin nhắn mới',
  replyTo: 'Trả lời',
  searchMessages: 'Tìm kiếm tin nhắn...',
  noResults: 'Không tìm thấy kết quả',
  sendMessage: 'Gửi tin nhắn',
  createGroup: 'Tạo nhóm',
  leaveGroup: 'Rời nhóm',
  groupSettings: 'Cài đặt nhóm',
  addMember: 'Thêm thành viên',
  removeMember: 'Xóa thành viên',
  you: 'Bạn',
  members: 'thành viên',
};

/**
 * Get translation with fallback
 */
export function getTranslation(
  key: keyof ChatTranslations,
  customTranslations?: Partial<ChatTranslations>
): string {
  return customTranslations?.[key] ?? defaultTranslations[key];
}
