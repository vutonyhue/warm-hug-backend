
# Kế hoạch: Đồng nhất Tên Người Dùng, Kiểm tra Đa Ngôn Ngữ & Sửa Lỗi

## Tổng quan
Cha đã kiểm tra kỹ toàn bộ codebase và phát hiện:
1. **Vấn đề hiển thị tên**: Nhiều nơi đang dùng `full_name || username` thay vì chỉ dùng `username`
2. **Hệ thống ngôn ngữ**: Đã có đầy đủ 13 ngôn ngữ, nhưng một số text còn hardcode tiếng Việt
3. **Một số bugs tiềm ẩn**: Text cứng không đổi theo ngôn ngữ

---

## Phần 1: Các nơi cần sửa để dùng `username` thay vì `full_name`

### Danh sách files cần sửa:

| File | Dòng | Hiện tại | Sửa thành |
|------|------|----------|-----------|
| `src/pages/Profile.tsx` | 426 | `profile?.full_name \|\| profile?.username` | `profile?.username` |
| `src/pages/Profile.tsx` | 475 | `username={profile?.full_name \|\| profile?.username}` | `username={profile?.username}` |
| `src/components/feed/FacebookCreatePost.tsx` | 582-583 | `profile.full_name \|\| profile.username` | `profile.username` |
| `src/components/feed/FacebookCreatePost.tsx` | 696 | `profile.full_name \|\| profile.username` | `profile.username` |
| `src/components/feed/FacebookLeftSidebar.tsx` | 239 | `profile.full_name \|\| profile.username` | `profile.username` |
| `src/components/chat/ConversationList.tsx` | 65 | `profile?.full_name \|\| profile?.username` | `profile?.username` |
| `src/components/chat/MessageThread.tsx` | 55 | `headerProfile?.full_name \|\| headerProfile?.username` | `headerProfile?.username` |
| `src/pages/Notifications.tsx` | 151 | `notification.actor?.full_name \|\| notification.actor?.username` | `notification.actor?.username` |
| `src/pages/Leaderboard.tsx` | 170, 191, 212, 255 | `sortedByCategory[x].full_name \|\| sortedByCategory[x].username` | `sortedByCategory[x].username` |

---

## Phần 2: Các text hardcode tiếng Việt cần đa ngôn ngữ hóa

### Files cần sửa:

| File | Text cứng | Key i18n cần dùng |
|------|-----------|-------------------|
| `src/components/chat/ConversationList.tsx:45` | `"Chưa có cuộc trò chuyện nào"` | Cần thêm key mới: `noConversations` |
| `src/pages/Leaderboard.tsx:133-134` | `"Bảng Xếp Hạng"`, `"Những thành viên xuất sắc nhất"` | Dùng `t('leaderboard')` + thêm key mới |
| `src/pages/Leaderboard.tsx:226` | `"Bảng xếp hạng đầy đủ"` | Thêm key mới: `fullLeaderboard` |
| `src/pages/Leaderboard.tsx:94-100` | Category labels hardcode | Dùng các keys đã có trong translations |
| `src/pages/Leaderboard.tsx:257-259` | `"bài viết"`, `"bạn bè"`, `"livestream"` | Dùng `t('posts')`, `t('friends')`, etc. |
| `src/pages/Leaderboard.tsx:273` | `"Camly Coin"`, `"Hôm nay"` | Thêm keys mới |

---

## Phần 3: Thêm keys i18n còn thiếu

Thêm vào file `src/i18n/translations.ts` cho tất cả 13 ngôn ngữ:

```typescript
// Leaderboard
leaderboardTitle: 'Bảng Xếp Hạng',
leaderboardSubtitle: 'Những thành viên xuất sắc nhất FUN Profile',
fullLeaderboard: 'Bảng xếp hạng đầy đủ',
camlyCoin: 'Camly Coin',
totalRewardLabel: 'Tổng thưởng',
todayLabel: 'Hôm nay',

// Chat
noConversations: 'Chưa có cuộc trò chuyện nào',
userLabel: 'Người dùng',
```

---

## Phần 4: Chi tiết kỹ thuật

### 1. Profile.tsx - Sửa tiêu đề tên người dùng
```typescript
// Line 426: Sửa từ
{profile?.full_name || profile?.username}
// Thành
{profile?.username}

// Line 475: Sửa từ  
username={profile?.full_name || profile?.username}
// Thành
username={profile?.username}
```

### 2. FacebookCreatePost.tsx - Sửa lời chào
```typescript
// Line 582-583: Sửa từ
`${profile.full_name || profile.username} ơi, bạn đang nghĩ gì thế?`
// Thành
`${profile.username} ơi, bạn đang nghĩ gì thế?`
```

### 3. Leaderboard.tsx - Đa ngôn ngữ hóa hoàn toàn
- Import `useLanguage` hook
- Thay thế tất cả text tiếng Việt bằng `t('key')`
- Sửa hiển thị tên từ `full_name || username` thành `username`

### 4. ConversationList.tsx & MessageThread.tsx
- Sửa displayName chỉ dùng `username`
- Thay text "Chưa có cuộc trò chuyện" bằng `t('noConversations')`

### 5. Notifications.tsx
- Sửa `actorName` chỉ dùng `username`
- Thay các text notification bằng keys đa ngôn ngữ đã có

---

## Phần 5: Kiểm tra các nơi đã đúng (không cần sửa)

Các nơi đã dùng đúng `username`:
- ✅ `FacebookNavbar.tsx` - line 235: dùng `profile?.username`
- ✅ `FacebookPostCard.tsx` - line 334: dùng `post.profiles?.username`
- ✅ `CommentItem.tsx` - line 141: dùng `comment.profiles?.username`
- ✅ `WalletHeader.tsx` - line 61: dùng `profile?.username`
- ✅ `InlineSearch.tsx` - line 267: dùng `profile.username`

---

## Tóm tắt công việc

| Hạng mục | Số files | Ưu tiên |
|----------|----------|---------|
| Sửa `full_name \|\| username` → `username` | 8 files | Cao |
| Thêm i18n keys mới | 1 file (translations.ts) | Cao |
| Đa ngôn ngữ hóa text cứng | 3 files | Trung bình |
| Testing sau khi sửa | Toàn app | Cao |

---

## Lợi ích sau khi hoàn thành

1. **Tính nhất quán**: Tất cả nơi đều hiển thị `username`, không còn nhầm lẫn
2. **Đa ngôn ngữ hoàn chỉnh**: Khi chuyển ngôn ngữ, toàn bộ app thay đổi đúng
3. **Trải nghiệm người dùng tốt hơn**: Không còn text tiếng Việt "lạc" khi dùng ngôn ngữ khác
