
# Kế hoạch: Đảm bảo tất cả video được Stream xử lý và xem công khai

## Tóm tắt hiện trạng

Hệ thống hiện tại đã có các thành phần cần thiết:
1. **Edge Function `stream-video`**: Xử lý upload, check status, update settings
2. **VideoUploaderUppy**: Upload video qua TUS protocol với retry logic cho settings
3. **StreamPlayer**: Player hỗ trợ iframe embed, HLS, và auto-polling status
4. **LazyVideo**: Auto-detect Stream URLs và render StreamPlayer

### Vấn đề còn tồn tại

Sau khi phân tích code, tôi nhận thấy **3 điểm yếu** có thể gây lỗi "permission":

1. **TUS Upload không set `requireSignedURLs: false` ngay từ đầu**
   - Trong `get-tus-upload-url` (dòng 164-168), metadata chỉ có `requiresignedurls false` nhưng đây là **TUS metadata**, không phải Cloudflare Stream settings
   - Video được tạo với settings mặc định của Cloudflare (có thể là private)
   - Phải chờ upload xong mới gọi `update-video-settings`

2. **Direct Upload đã set đúng** (dòng 252-260):
   ```javascript
   requireSignedURLs: false,
   allowedOrigins: ['*'],
   ```
   Nhưng TUS upload không có cơ chế tương tự khi tạo URL.

3. **Race condition trong retry logic**
   - Code hiện tại có retry 3 lần cho `update-video-settings`
   - Nhưng nếu cả 3 lần đều fail, video vẫn được tạo với quyền private

---

## Giải pháp

### A) Backend: Cải thiện Edge Function `stream-video`

**Thay đổi 1**: Trong action `get-tus-upload-url`, sau khi tạo upload URL thành công, **tự động gọi update settings** ngay lập tức (vì lúc này đã có UID).

```typescript
// Sau khi lấy được uploadUrl và streamMediaId
// Ngay lập tức update settings để video public
try {
  const settingsResponse = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${streamMediaId}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        requireSignedURLs: false,
        allowedOrigins: ['*'],
      }),
    }
  );
  console.log('[stream-video] Pre-set video public, status:', settingsResponse.status);
} catch (err) {
  console.warn('[stream-video] Pre-set failed, will retry after upload:', err);
}
```

**Lý do**: Ngay khi video UID được tạo (trước khi upload bắt đầu), ta có thể set settings. Cloudflare cho phép update settings của video đang chờ upload.

**Thay đổi 2**: Thêm action `ensure-public` - một shortcut để đảm bảo video public:

```typescript
case 'ensure-public': {
  const { uid } = body;
  // Retry 3 lần với delay
  for (let attempt = 1; attempt <= 3; attempt++) {
    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/stream/${uid}`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CLOUDFLARE_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requireSignedURLs: false,
          allowedOrigins: ['*'],
        }),
      }
    );
    if (response.ok) {
      return Response(JSON.stringify({ success: true, uid }));
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return Response(JSON.stringify({ error: 'Failed after 3 attempts' }));
}
```

---

### B) Frontend: Cải thiện VideoUploaderUppy.tsx

**Thay đổi 1**: Sau khi TUS upload complete, thêm verification step:

```typescript
// Sau retry loop update-video-settings
// Thêm verification để đảm bảo settings đã apply
if (settingsUpdated) {
  // Wait 500ms for Cloudflare to propagate
  await new Promise(r => setTimeout(r, 500));
  
  // Verify settings actually applied
  const { data: statusData } = await supabase.functions.invoke('stream-video', {
    body: { action: 'check-status', uid }
  });
  
  if (statusData?.requireSignedURLs !== false) {
    console.warn('[VideoUploader] Settings verification failed, retrying...');
    // One more attempt
    await supabase.functions.invoke('stream-video', {
      body: { action: 'ensure-public', uid }
    });
  }
}
```

**Thay đổi 2**: Trong `streamUpload.ts`, đảm bảo cả direct upload và TUS đều có verification.

---

### C) Frontend: Cải thiện StreamPlayer.tsx

**Thay đổi 1**: Khi phát hiện lỗi permission, tự động gọi `ensure-public`:

```typescript
// Trong onError của iframe
onError={() => {
  // Thử ensure-public trước khi hiển thị lỗi
  if (uid && !retryEnsurePublic) {
    setRetryEnsurePublic(true);
    supabase.functions.invoke('stream-video', {
      body: { action: 'ensure-public', uid }
    }).then(() => {
      // Reload iframe sau 2 giây
      setTimeout(() => {
        setIframeKey(prev => prev + 1);
      }, 2000);
    });
  } else {
    setIsProcessing(true);
    setHasError(true);
  }
}}
```

---

## Tóm tắt các file cần sửa

| File | Thay đổi |
|------|----------|
| `supabase/functions/stream-video/index.ts` | 1. Thêm auto-set public trong `get-tus-upload-url` |
| | 2. Thêm action `ensure-public` với retry logic |
| `src/components/feed/VideoUploaderUppy.tsx` | 1. Thêm verification step sau update settings |
| | 2. Gọi `ensure-public` nếu verification fail |
| `src/utils/streamUpload.ts` | 1. Thêm verification cho direct upload và TUS |
| `src/components/ui/StreamPlayer.tsx` | 1. Auto-retry ensure-public khi gặp lỗi permission |
| | 2. Reload iframe sau khi ensure-public thành công |

---

## Luồng hoạt động mới

```
1. User chọn video để upload
   │
2. Frontend gọi get-tus-upload-url
   │
3. Backend:
   ├── Tạo upload URL + UID từ Cloudflare
   └── Ngay lập tức gọi update settings (requireSignedURLs: false)
   │
4. Frontend upload video qua TUS
   │
5. Khi upload complete:
   ├── Gọi update-video-settings (retry 3 lần)
   ├── Wait 500ms
   └── Verify settings đã apply
   │
6. Tạo post với video URL
   │
7. Khi hiển thị video (StreamPlayer):
   ├── Nếu ready → play bình thường
   ├── Nếu processing → hiển thị "Đang xử lý"
   └── Nếu permission error → gọi ensure-public → reload
```

---

## Kết quả mong đợi

1. **100% video công khai**: Mọi video upload đều có `requireSignedURLs: false`
2. **Fallback tự động**: Nếu settings fail, StreamPlayer tự retry
3. **Không lỗi permission**: Người xem bất kỳ đều có thể xem video
4. **Backward compatible**: Video cũ bị lỗi sẽ tự sửa khi được xem

---

## Chi tiết kỹ thuật

### Vì sao cần set public ngay khi tạo URL?
- Cloudflare Stream mặc định có thể restrict video mới
- Set public trước khi upload đảm bảo video ready = public ngay
- Giảm race condition giữa upload complete và settings update

### Vì sao cần verification?
- Cloudflare API trả về 200 nhưng có thể chưa propagate
- Verification đảm bảo settings đã thực sự apply
- Nếu fail, có cơ hội retry trước khi user thấy lỗi

### Vì sao StreamPlayer cần auto-retry?
- Video cũ có thể bị private do bug trước đây
- Self-healing: khi user xem → auto-fix → refresh → xem được
- Không cần admin can thiệp thủ công
