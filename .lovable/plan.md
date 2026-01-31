

# Kế hoạch: Triển khai Video Call với Agora SDK và các tính năng Chat nâng cao

## Tổng quan

Thêm tính năng gọi điện video/audio sử dụng Agora RTC SDK vào package `@fun-ecosystem1/chat`, cùng với một số tính năng bổ sung để nâng cao trải nghiệm chat.

---

## Phần 1: Video/Audio Call với Agora SDK

### A) Cài đặt Dependencies

Thêm các package cần thiết vào `packages/chat/package.json`:

```json
{
  "peerDependencies": {
    "agora-rtc-sdk-ng": "^4.20.0",
    "agora-rtc-react": "^2.2.0"
  }
}
```

Và cài đặt vào ứng dụng chính:
- `agora-rtc-sdk-ng` - Core SDK
- `agora-rtc-react` - React hooks và components

### B) Backend: Edge Function tạo Token Agora

Tạo Edge Function `agora-token` để sinh token an toàn phía server:

```
supabase/functions/agora-token/index.ts
```

Chức năng:
- Nhận `channelName` và `uid` từ request
- Verify JWT của user
- Sinh RTC token bằng Agora App Certificate
- Trả về token với thời hạn (vd: 24 giờ)

Cần thêm secrets:
- `AGORA_APP_ID` - App ID từ Agora Console
- `AGORA_APP_CERTIFICATE` - App Certificate từ Agora Console

### C) Database: Bảng lưu trữ cuộc gọi

Tạo bảng `video_calls` để lưu lịch sử cuộc gọi:

```sql
CREATE TABLE video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  caller_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'video', -- 'video' | 'audio'
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending' | 'ringing' | 'active' | 'ended' | 'missed' | 'rejected'
  channel_name TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Bảng participants cho group call
CREATE TABLE video_call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES video_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' -- 'pending' | 'joined' | 'left' | 'rejected'
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE video_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE video_call_participants;
```

### D) Chat Package: Hooks và Components

**Tạo các file mới trong `packages/chat/src`:**

1. **`hooks/useVideoCall.ts`**
   - Hook quản lý trạng thái cuộc gọi
   - Tạo/tham gia/kết thúc cuộc gọi
   - Lấy token từ Edge Function
   - Realtime subscription cho incoming calls

2. **`hooks/useAgoraClient.ts`**
   - Hook wrapper cho Agora RTC client
   - Quản lý local/remote tracks
   - Publish/unpublish audio/video
   - Toggle camera/microphone

3. **`components/VideoCallProvider.tsx`**
   - Context provider cho video call state
   - Wrap AgoraRTCProvider

4. **`components/VideoCallModal.tsx`**
   - Giao diện cuộc gọi video toàn màn hình
   - Hiển thị local video + remote videos
   - Điều khiển: toggle camera, mic, end call
   - Screen share button (optional)

5. **`components/IncomingCallDialog.tsx`**
   - Dialog thông báo có cuộc gọi đến
   - Hiển thị avatar + tên người gọi
   - Nút Accept / Reject
   - Ringtone notification

6. **`components/CallButton.tsx`**
   - Nút gọi video/audio trong MessageThread header
   - Icon Phone + Video

### E) Cấu trúc file mới

```
packages/chat/src/
├── components/
│   ├── ... (existing)
│   ├── CallButton.tsx
│   ├── IncomingCallDialog.tsx
│   ├── VideoCallModal.tsx
│   └── VideoCallProvider.tsx
├── hooks/
│   ├── ... (existing)
│   ├── useVideoCall.ts
│   └── useAgoraClient.ts
└── types.ts (thêm VideoCall types)
```

### F) Tích hợp vào MessageThread

Thêm nút gọi video/audio vào header của `MessageThread.tsx`:

```tsx
<div className="flex items-center gap-1">
  <CallButton 
    conversationId={conversationId}
    callType="audio"
  />
  <CallButton 
    conversationId={conversationId} 
    callType="video"
  />
  {/* existing search/settings buttons */}
</div>
```

---

## Phần 2: Các tính năng bổ sung (Bonus Features)

### 1. Đọc tin nhắn / Read Receipts cải tiến

- Thêm indicator "Đã xem" (double tick) dưới mỗi tin nhắn
- Hover để xem danh sách ai đã đọc (cho group chat)
- Cập nhật `MessageBubble.tsx`

### 2. Reactions mở rộng

- Thêm emoji picker đầy đủ (thay vì chỉ vài emoji cố định)
- Hiển thị reaction count + chi tiết ai đã react
- Animation khi thêm reaction

### 3. Message Forwarding (Chuyển tiếp tin nhắn)

- Thêm action "Forward" trong context menu của tin nhắn
- Dialog chọn conversation để forward đến
- Hỗ trợ forward cả media

### 4. Pin Messages (Ghim tin nhắn)

- Cho phép ghim tin nhắn quan trọng trong conversation
- Hiển thị pinned messages ở đầu thread
- Giới hạn số lượng pin (vd: 5)

### 5. Message Scheduling (Hẹn giờ gửi tin)

- Cho phép lên lịch gửi tin nhắn
- Icon clock trong ChatInput
- Background job để gửi đúng giờ

### 6. Tìm kiếm trong cuộc trò chuyện

- Tích hợp `MessageSearch` component đã có
- Highlight kết quả tìm kiếm
- Jump to message khi click

---

## Phần 3: Luồng hoạt động Video Call

```
┌─────────────────────────────────────────────────────────────────┐
│                     LUỒNG GỌI VIDEO                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Người gọi (Caller)              Người nhận (Receiver)          │
│                                                                  │
│  1. Click nút Video Call                                        │
│         │                                                       │
│  2. Tạo record video_calls ──────────────────────────────────→  │
│     (status: pending)                                           │
│         │                                                       │
│  3. Lấy Agora token                                             │
│         │                                                       │
│  4. Join Agora channel         ← Realtime subscription          │
│         │                            detects new call           │
│         │                                  │                    │
│         │                      5. Hiển thị IncomingCallDialog   │
│         │                                  │                    │
│         │                      6. User accepts/rejects          │
│         │                                  │                    │
│         │                      ┌───────────┴───────────┐        │
│         │                      │                       │        │
│         │                   Accept                  Reject      │
│         │                      │                       │        │
│         │                 Join channel            Update status │
│         │                      │                  → rejected    │
│         │                      │                                │
│  ←───── RTC Connection ───────→│                                │
│         │                      │                                │
│  7. Video/Audio streaming      │                                │
│         │                      │                                │
│  8. End call → Update status: ended                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phần 4: ChatConfig mở rộng

Cập nhật `ChatConfig` trong `types.ts` để hỗ trợ cấu hình Agora:

```typescript
export interface ChatConfig {
  // ... existing fields
  
  /** Agora App ID - required for video calls */
  agoraAppId?: string;
  
  /** Function to get Agora token from backend */
  getAgoraToken?: (channelName: string, uid: number) => Promise<string>;
  
  /** Enable video call feature */
  enableVideoCalls?: boolean;
}
```

---

## Tóm tắt các file cần tạo/sửa

| File | Hành động | Mô tả |
|------|-----------|-------|
| `packages/chat/package.json` | Sửa | Thêm peer dependencies Agora |
| `supabase/functions/agora-token/index.ts` | Tạo mới | Edge function sinh token |
| Database migration | Tạo mới | Bảng video_calls, video_call_participants |
| `packages/chat/src/types.ts` | Sửa | Thêm VideoCall types |
| `packages/chat/src/hooks/useVideoCall.ts` | Tạo mới | Hook quản lý cuộc gọi |
| `packages/chat/src/hooks/useAgoraClient.ts` | Tạo mới | Hook wrapper Agora SDK |
| `packages/chat/src/components/VideoCallProvider.tsx` | Tạo mới | Context provider |
| `packages/chat/src/components/VideoCallModal.tsx` | Tạo mới | UI cuộc gọi |
| `packages/chat/src/components/IncomingCallDialog.tsx` | Tạo mới | Dialog cuộc gọi đến |
| `packages/chat/src/components/CallButton.tsx` | Tạo mới | Nút gọi |
| `packages/chat/src/components/MessageThread.tsx` | Sửa | Thêm call buttons |
| `packages/chat/src/components/MessageBubble.tsx` | Sửa | Read receipts indicator |
| `packages/chat/src/index.ts` | Sửa | Export các components mới |
| `src/pages/Chat.tsx` | Sửa | Tích hợp VideoCallProvider |

---

## Yêu cầu trước khi triển khai

1. **Tạo Agora Account và App**:
   - Đăng ký tại https://console.agora.io
   - Tạo Project mới
   - Lấy App ID và App Certificate

2. **Thêm Secrets**:
   - `AGORA_APP_ID`
   - `AGORA_APP_CERTIFICATE`

---

## Ưu tiên triển khai

1. **Giai đoạn 1** (Core): Video/Audio Call cơ bản
   - Database tables
   - Edge function token
   - useVideoCall hook
   - VideoCallModal component
   - IncomingCallDialog

2. **Giai đoạn 2** (UX): Cải thiện trải nghiệm
   - Read receipts indicator
   - Screen sharing
   - Call quality indicators

3. **Giai đoạn 3** (Bonus): Tính năng bổ sung
   - Message forwarding
   - Pin messages
   - Enhanced reactions

