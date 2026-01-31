
# Kế hoạch: Sửa lỗi "You don't have permission to view this video"

## Nguyên nhân gốc

Sau khi phân tích code và logs, tôi đã xác định **3 vấn đề chính**:

### 1. Race Condition trong Video Settings Update
Trong file `src/components/feed/VideoUploaderUppy.tsx` (dòng 573-585), việc update video settings được gọi như sau:
```typescript
try {
  await supabase.functions.invoke('stream-video', {
    body: {
      action: 'update-video-settings',
      uid,
      requireSignedURLs: false,
      allowedOrigins: ['*'],
    },
  });
  console.log('[VideoUploader] Video settings updated');
} catch (err) {
  console.warn('[VideoUploader] Failed to update settings:', err);
}
```
Vấn đề: Dù có `await`, nhưng nếu call bị fail, hàm `onUploadComplete()` vẫn được gọi ngay sau đó và post được tạo với video không có quyền public.

### 2. Video chưa Ready khi hiển thị
Cloudflare Stream cần thời gian để encode và processing video. Khi post được tạo ngay lập tức sau upload, video có thể chưa `readyToStream`.

### 3. Không chờ đợi Settings Update hoàn thành
Trong `streamUpload.ts` (dòng 176-187 và 283-293), việc update settings được gọi qua `.catch()`:
```typescript
supabase.functions.invoke('stream-video', {
  body: { 
    action: 'update-video-settings',
    uid,
    requireSignedURLs: false,
    allowedOrigins: ['*'],
  }
}).catch((err) => {
  console.warn('[streamUpload] Failed to update video settings:', err);
});
```
Điều này có nghĩa là code **không chờ đợi** kết quả và tiếp tục ngay lập tức.

---

## Giải pháp đề xuất

### A) Sửa Video Settings Update trong VideoUploaderUppy.tsx (ưu tiên cao)
- **Đảm bảo await thành công** trước khi call `onUploadComplete()`
- Nếu update settings thất bại, thử lại tối đa 3 lần
- Chỉ hoàn thành upload khi settings đã được cập nhật

```typescript
// Trong onSuccess callback (dòng 572-610)
onSuccess: async () => {
  console.log('[VideoUploader] Upload complete! UID:', uid);

  // Update video settings với retry logic
  let settingsUpdated = false;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { error } = await supabase.functions.invoke('stream-video', {
        body: {
          action: 'update-video-settings',
          uid,
          requireSignedURLs: false,
          allowedOrigins: ['*'],
        },
      });
      
      if (!error) {
        console.log('[VideoUploader] Video settings updated successfully');
        settingsUpdated = true;
        break;
      }
      console.warn(`[VideoUploader] Settings update attempt ${attempt} failed:`, error);
    } catch (err) {
      console.warn(`[VideoUploader] Settings update attempt ${attempt} error:`, err);
    }
    
    // Wait before retry
    if (attempt < 3) {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  
  if (!settingsUpdated) {
    console.error('[VideoUploader] Failed to update video settings after 3 attempts');
    toast.warning('Video đã tải lên nhưng có thể cần thời gian để hiển thị');
  }

  // Continue with success flow...
}
```

### B) Cải thiện StreamPlayer để xử lý video chưa ready
Trong `src/components/ui/StreamPlayer.tsx`:
- Thêm logic kiểm tra video status trước khi render iframe
- Nếu video chưa ready, hiển thị thông báo "Đang xử lý video"
- Tự động retry sau mỗi vài giây

```typescript
// Thêm useEffect để check video status
useEffect(() => {
  if (!uid) return;
  
  const checkVideoReady = async () => {
    try {
      const { data } = await supabase.functions.invoke('stream-video', {
        body: { action: 'check-status', uid }
      });
      
      if (data?.readyToStream) {
        setIsProcessing(false);
        setHasError(false);
      } else {
        setIsProcessing(true);
        // Retry after 5 seconds
        setTimeout(checkVideoReady, 5000);
      }
    } catch (err) {
      console.error('[StreamPlayer] Status check error:', err);
    }
  };
  
  checkVideoReady();
}, [uid]);
```

### C) Sửa streamUpload.ts để đợi settings update
Trong `src/utils/streamUpload.ts` (dòng 176-187 và 283-293):
- Thay đổi từ fire-and-forget thành await với error handling

```typescript
// Thay thế code hiện tại
try {
  await supabase.functions.invoke('stream-video', {
    body: { 
      action: 'update-video-settings',
      uid,
      requireSignedURLs: false,
      allowedOrigins: ['*'],
    }
  });
  console.log('[streamUpload] Video settings updated');
} catch (err) {
  console.warn('[streamUpload] Failed to update video settings:', err);
  // Non-blocking - video should still work, just might have permission issues
}
```

---

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/components/feed/VideoUploaderUppy.tsx` | 1. Thêm retry logic cho update-video-settings (3 lần) |
| | 2. Đảm bảo await hoàn thành trước khi gọi onUploadComplete |
| | 3. Hiển thị warning nếu settings update thất bại |
| `src/components/ui/StreamPlayer.tsx` | 1. Thêm logic check video readyToStream |
| | 2. Hiển thị "Đang xử lý" nếu video chưa ready |
| | 3. Auto-retry check status mỗi 5 giây |
| `src/utils/streamUpload.ts` | 1. Thay fire-and-forget bằng await |
| | 2. Log warning nếu thất bại (không throw error) |

---

## Kết quả mong đợi

1. Video được upload và settings được cập nhật **trước khi** post được tạo
2. Nếu video chưa sẵn sàng, người dùng thấy thông báo "Đang xử lý video" thay vì lỗi permission
3. Video tự động hiển thị khi đã sẵn sàng (không cần refresh trang)
4. Nếu settings update thất bại, người dùng được thông báo nhưng video vẫn được lưu

---

## Chi tiết kỹ thuật

### Vì sao xảy ra lỗi "You don't have permission"?
Cloudflare Stream mặc định có thể yêu cầu signed URLs hoặc giới hạn `allowedOrigins`. Khi upload qua Direct Creator Upload, video có thể được tạo với settings mặc định (private) và cần được update ngay sau đó.

### Vì sao không thấy trong logs?
Edge function logs cho thấy `update-video-settings` được gọi và trả về status 200. Tuy nhiên, điều này không đảm bảo Cloudflare đã apply settings ngay lập tức. Có thể có độ trễ trong hệ thống Cloudflare.

### Alternative: Sử dụng signed URLs
Nếu vấn đề vẫn tiếp diễn, có thể chuyển sang sử dụng signed URLs cho video playback. Điều này đảm bảo video luôn có thể được truy cập thông qua token được tạo bởi backend.
