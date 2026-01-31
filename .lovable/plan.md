
# Kế hoạch: Sửa lỗi không hiển thị nút gọi Video

## Nguyên nhân

Nút gọi video/audio không hiển thị vì điều kiện `isCallEnabled` trong `MessageThread.tsx` chưa kiểm tra cờ `enableVideoCalls`.

Hiện tại điều kiện là:
```typescript
const isCallEnabled = Boolean(config.agoraAppId) || Boolean(config.getAgoraToken) || Boolean(agoraAppId);
```

Trong `src/pages/Chat.tsx`, config được truyền là:
```typescript
{
  enableVideoCalls: true,  // ✅ Có cờ này
  // ❌ Không có agoraAppId - vì sẽ lấy từ Edge Function
}
```

Do đó `isCallEnabled` luôn = `false` vì cả 3 điều kiện đều không thỏa mãn.

---

## Giải pháp

Sửa điều kiện `isCallEnabled` để bao gồm cả `config.enableVideoCalls`:

```typescript
const isCallEnabled = 
  config.enableVideoCalls || 
  Boolean(config.agoraAppId) || 
  Boolean(config.getAgoraToken) || 
  Boolean(agoraAppId);
```

---

## File cần sửa

| File | Thay đổi |
|------|----------|
| `packages/chat/src/components/MessageThread.tsx` | Sửa điều kiện `isCallEnabled` để bao gồm `config.enableVideoCalls` |

---

## Chi tiết kỹ thuật

Dòng 73 trong `MessageThread.tsx`:

**Trước:**
```typescript
const isCallEnabled = Boolean(config.agoraAppId) || Boolean(config.getAgoraToken) || Boolean(agoraAppId);
```

**Sau:**
```typescript
const isCallEnabled = 
  config.enableVideoCalls || 
  Boolean(config.agoraAppId) || 
  Boolean(config.getAgoraToken) || 
  Boolean(agoraAppId);
```

---

## Kết quả mong đợi

Sau khi sửa:
1. Nút gọi audio (📞) và video (📹) sẽ xuất hiện ở header của MessageThread
2. Khi bấm nút, hệ thống sẽ gọi Edge Function `agora-token` để lấy token và App ID
3. Cuộc gọi được khởi tạo với Agora SDK

---

## Luồng hoạt động sau khi sửa

```
1. User mở conversation
2. MessageThread render
3. isCallEnabled = config.enableVideoCalls = true
4. Hiển thị nút gọi Audio và Video
5. User click nút Video
6. startCall() được gọi:
   ├── Tạo record video_calls
   ├── Gọi Edge Function agora-token
   ├── Nhận token + uid + appId
   └── Mở VideoCallModal
```
