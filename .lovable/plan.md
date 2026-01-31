

# Kế hoạch: Sửa lỗi Video Stream 401 "No Permission"

## Nguyên nhân gốc

Sau khi phân tích logs và code, tôi đã xác định được **3 vấn đề chính**:

### 1. Edge Function không trả về `requireSignedURLs`

Trong action `check-status` (dòng 358-366), response chỉ trả về:
```typescript
return new Response(JSON.stringify({
  uid: video.uid,
  status: video.status,
  readyToStream: video.readyToStream,
  duration: video.duration,
  thumbnail: video.thumbnail,
  playback: video.playback,
  preview: video.preview,
  // ❌ THIẾU: requireSignedURLs, allowedOrigins
}));
```

Frontend kiểm tra `statusData?.requireSignedURLs !== false` nhưng vì field này không được trả về nên luôn = `undefined`, khiến điều kiện luôn đúng → gọi `ensure-public` không cần thiết.

### 2. Cloudflare có thể bị delay khi apply settings

Dù backend đã gọi API để set `requireSignedURLs: false`, Cloudflare có thể cần vài giây để propagate. Nếu video được hiển thị ngay, vẫn có thể gặp 401.

### 3. StreamPlayer chưa xử lý triệt để lỗi iframe

Khi iframe báo lỗi (401), logic hiện tại chỉ thử `ensure-public` một lần. Nếu vẫn fail, hiển thị "Đang xử lý" vĩnh viễn.

---

## Giải pháp

### A) Sửa Edge Function `stream-video` - Trả về đầy đủ thông tin

**File**: `supabase/functions/stream-video/index.ts`

**Thay đổi 1**: Action `check-status` trả về `requireSignedURLs` và `allowedOrigins`:

```typescript
case 'check-status': {
  // ... existing code ...
  
  return new Response(JSON.stringify({
    uid: video.uid,
    status: video.status,
    readyToStream: video.readyToStream,
    duration: video.duration,
    thumbnail: video.thumbnail,
    playback: video.playback,
    preview: video.preview,
    // ✅ THÊM MỚI
    requireSignedURLs: video.requireSignedURLs,
    allowedOrigins: video.allowedOrigins,
  }));
}
```

---

### B) Cải thiện StreamPlayer - Retry với delay lớn hơn

**File**: `src/components/ui/StreamPlayer.tsx`

**Thay đổi 1**: Khi gặp permission error, chờ lâu hơn sau `ensure-public` (3 giây thay vì 2 giây):

```typescript
// Trong tryEnsurePublic()
if (data?.success) {
  console.log('[StreamPlayer] Video set to public, reloading iframe...');
  // Wait 3 seconds for Cloudflare to propagate fully
  await new Promise(r => setTimeout(r, 3000));
  setIframeKey(prev => prev + 1);
  setHasError(false);
  setIsProcessing(false);
  return true;
}
```

**Thay đổi 2**: Thêm retry cho `ensure-public` khi iframe error lần đầu:

```typescript
// Cho phép retry ensure-public thêm 1 lần nữa sau khoảng delay
const [ensurePublicRetryCount, setEnsurePublicRetryCount] = useState(0);
const MAX_ENSURE_PUBLIC_RETRIES = 2;
```

---

### C) Cải thiện VideoUploaderUppy - Chờ lâu hơn trước khi verify

**File**: `src/components/feed/VideoUploaderUppy.tsx`

**Thay đổi**: Tăng thời gian chờ từ 500ms lên 1500ms để Cloudflare có thời gian propagate settings:

```typescript
// Wait 1.5s for Cloudflare to propagate (increased from 500ms)
await new Promise(r => setTimeout(r, 1500));
```

---

### D) Cải thiện streamUpload.ts - Chờ lâu hơn

**File**: `src/utils/streamUpload.ts`

Tương tự như VideoUploaderUppy, tăng thời gian chờ.

---

## Tóm tắt các file cần sửa

| File | Thay đổi |
|------|----------|
| `supabase/functions/stream-video/index.ts` | 1. Action `check-status` trả về `requireSignedURLs` và `allowedOrigins` |
| `src/components/ui/StreamPlayer.tsx` | 1. Tăng delay sau `ensure-public` từ 2s → 3s |
| | 2. Thêm retry mechanism cho `ensure-public` (tối đa 2 lần) |
| `src/components/feed/VideoUploaderUppy.tsx` | 1. Tăng verification delay từ 500ms → 1500ms |
| `src/utils/streamUpload.ts` | 1. Tăng verification delay từ 500ms → 1500ms |

---

## Luồng hoạt động mới

```
1. User upload video
2. Backend tạo TUS URL + UID
3. Backend PRE-SET video public (requireSignedURLs: false)
4. Frontend upload qua TUS
5. Upload complete:
   ├── Gọi update-video-settings (retry 3 lần)
   ├── Wait 1.5s (tăng từ 500ms)
   └── Gọi check-status để verify (bây giờ có requireSignedURLs!)
   └── Nếu requireSignedURLs !== false → gọi ensure-public
6. Tạo post
7. Khi hiển thị video:
   ├── Nếu ready + public → play bình thường
   ├── Nếu 401 error → gọi ensure-public (retry 2 lần)
   ├── Wait 3s giữa mỗi retry
   └── Reload iframe sau khi thành công
```

---

## Kết quả mong đợi

1. **check-status** trả về đầy đủ thông tin, frontend verify chính xác
2. **Video public 100%**: Settings được verify trước khi tạo post
3. **Self-healing mạnh hơn**: StreamPlayer retry tối đa 2 lần với delay đủ lâu
4. **Không còn 401**: Mọi video đều playable công khai

---

## Chi tiết kỹ thuật

### Vì sao cần trả về `requireSignedURLs`?
Frontend cần biết chính xác trạng thái của video. Hiện tại field này không được trả về nên verification logic luôn fail (vì undefined !== false = true).

### Vì sao tăng delay?
Cloudflare CDN có thể cần 1-3 giây để propagate settings thay đổi sang toàn bộ edge nodes. Delay ngắn quá sẽ dẫn đến race condition.

### Vì sao retry ensure-public 2 lần?
Video cũ có thể bị private do bug trước đây. Retry 2 lần với delay 3s đảm bảo hầu hết trường hợp được tự sửa.

