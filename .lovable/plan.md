
# Kế hoạch: Loại bỏ Cloudflare Stream, chỉ sử dụng Cloudflare R2

## Tổng quan

Hiện tại dự án đang sử dụng **2 dịch vụ lưu trữ media**:
1. **Cloudflare R2**: Cho images và files nhỏ
2. **Cloudflare Stream**: Cho video (sử dụng HLS streaming, TUS upload)

Bé muốn **chỉ sử dụng R2** để lưu cả video và image. Điều này sẽ:
- ✅ Đơn giản hóa kiến trúc (1 dịch vụ thay vì 2)
- ✅ Giảm chi phí (R2 rẻ hơn Stream)
- ✅ Giảm code complexity
- ⚠️ Mất tính năng HLS adaptive streaming (video sẽ phát trực tiếp file MP4)

---

## Phân tích hiện trạng

### Các file liên quan đến Cloudflare Stream

| File | Mô tả | Hành động |
|------|-------|-----------|
| `src/utils/streamUpload.ts` | Upload video lên Stream (TUS, direct) | **XÓA** |
| `src/utils/streamHelpers.ts` | Xóa video từ Stream, extract UID | **SỬA** để dùng R2 |
| `src/components/ui/StreamPlayer.tsx` | HLS player với Stream iframe | **XÓA** |
| `src/components/ui/LazyVideo.tsx` | Lazy load video, detect Stream URL | **SỬA** bỏ Stream logic |
| `src/components/feed/VideoUploaderUppy.tsx` | Upload video qua TUS protocol | **SỬA** để dùng R2 |
| `src/config/media.ts` | Check Stream URL, getMediaUrl | **SỬA** bỏ Stream logic |
| `supabase/functions/stream-video/` | Edge function cho Stream API | **XÓA** |
| `supabase/functions/cleanup-stream-videos/` | Cleanup Stream videos | **XÓA** |
| `supabase/functions/cleanup-orphan-videos/` | Cleanup orphan Stream | **XÓA** |
| `supabase/functions/cloudflare-migrate/` | Migrate R2 → Stream | **SỬA** bỏ Stream logic |

### Secrets không còn cần

- `CLOUDFLARE_STREAM_API_TOKEN` - có thể xóa sau khi hoàn tất

---

## Kế hoạch thực hiện

### Bước 1: Tạo VideoUploader mới dùng R2

Sửa `VideoUploaderUppy.tsx` để upload video trực tiếp lên R2 thay vì Stream:

```text
Flow mới:
1. User chọn video
2. Gọi get-upload-url để lấy presigned URL cho R2
3. Upload trực tiếp lên R2 (giống như upload ảnh)
4. Trả về R2 key (videos/timestamp-random.mp4)
5. Frontend build URL qua getMediaUrl()
```

### Bước 2: Xóa StreamPlayer, cập nhật LazyVideo

`LazyVideo.tsx` sẽ không cần lazy load `StreamPlayer` nữa:
- Xóa import StreamPlayer
- Xóa logic `isStreamUrl()` detection
- Tất cả video đều dùng native `<video>` element

### Bước 3: Cập nhật config/media.ts

- Xóa function `isCloudflareStreamUrl()`
- Giữ nguyên `getMediaUrl()` (đã hỗ trợ full URL backward compatible)

### Bước 4: Cập nhật streamHelpers → r2Helpers

Đổi tên và cập nhật logic:
- Xóa video từ R2 thay vì Stream
- Gọi `delete-from-r2` edge function thay vì `stream-video`

### Bước 5: Xóa edge functions không dùng

Xóa các thư mục:
- `supabase/functions/stream-video/`
- `supabase/functions/cleanup-stream-videos/`
- `supabase/functions/cleanup-orphan-videos/`

### Bước 6: Cập nhật streamUpload.ts → Xóa hoàn toàn

File này chỉ dùng cho Stream, có thể xóa vì `r2Upload.ts` đã có sẵn.

### Bước 7: Xóa dependency không cần

Có thể xóa `tus-js-client` và `hls.js` khỏi package.json (nếu không dùng nơi khác).

---

## Chi tiết kỹ thuật từng file

### 1. `src/components/feed/VideoUploaderUppy.tsx`

**Trước:** Gọi `stream-video` edge function để lấy TUS URL, upload qua tus-js-client

**Sau:** Gọi `get-upload-url` để lấy presigned R2 URL, upload trực tiếp qua fetch PUT

```typescript
// Thay đổi chính:
// 1. Bỏ import tus-js-client
// 2. Đổi edge function call từ 'stream-video' → 'get-upload-url'
// 3. Upload bằng fetch PUT thay vì TUS
// 4. Trả về R2 key thay vì Stream UID
```

### 2. `src/components/ui/LazyVideo.tsx`

**Trước:**
```typescript
import { isStreamUrl } from '@/utils/streamUpload';
const StreamPlayer = lazy(() => import('./StreamPlayer'));

// Check if Stream → use StreamPlayer
// Else → use native <video>
```

**Sau:**
```typescript
// Xóa import isStreamUrl và StreamPlayer
// Luôn dùng native <video> element
```

### 3. `src/config/media.ts`

**Xóa:**
```typescript
export function isCloudflareStreamUrl(url) { ... }
```

**Giữ nguyên:**
```typescript
export function getMediaUrl(key) {
  // Đã hỗ trợ backward compatible cho full URLs cũ
}
```

### 4. `src/utils/streamHelpers.ts` → `r2Helpers.ts`

**Thay đổi:**
```typescript
// Đổi tên file: streamHelpers.ts → r2Helpers.ts (hoặc videoHelpers.ts)

// Hàm deleteStreamVideoByUrl → deleteR2VideoByUrl
// Gọi delete-from-r2 edge function thay vì stream-video

export async function deleteVideoByUrl(videoUrl: string): Promise<boolean> {
  const key = extractMediaKey(videoUrl);
  if (!key) return false;
  
  const { error } = await supabase.functions.invoke('delete-from-r2', {
    body: { key },
  });
  return !error;
}
```

### 5. `src/components/ui/StreamPlayer.tsx`

**Xóa hoàn toàn file này** (533 dòng code)

### 6. `src/utils/streamUpload.ts`

**Xóa hoàn toàn file này** (493 dòng code)

---

## Migration cho dữ liệu cũ

### Video đã upload lên Stream

Các video cũ có URL dạng:
- `https://iframe.videodelivery.net/{uid}`
- `https://customer-xxx.cloudflarestream.com/{uid}/manifest/video.m3u8`

**Giải pháp:** Giữ nguyên backward compatible trong `getMediaUrl()`:
- Nếu URL là full URL (http://...) → trả về nguyên vẹn
- Video Stream cũ vẫn hoạt động cho đến khi bị xóa

**Lưu ý:** Cần thông báo cho bé biết video Stream cũ sẽ tiếp tục hoạt động, nhưng video mới sẽ lưu trên R2.

---

## Tổng kết file thay đổi

| Hành động | File |
|-----------|------|
| **XÓA** | `src/utils/streamUpload.ts` |
| **XÓA** | `src/components/ui/StreamPlayer.tsx` |
| **XÓA** | `supabase/functions/stream-video/` |
| **XÓA** | `supabase/functions/cleanup-stream-videos/` |
| **XÓA** | `supabase/functions/cleanup-orphan-videos/` |
| **SỬA** | `src/components/feed/VideoUploaderUppy.tsx` |
| **SỬA** | `src/components/ui/LazyVideo.tsx` |
| **SỬA** | `src/config/media.ts` |
| **SỬA** | `src/utils/streamHelpers.ts` → rename/refactor |
| **SỬA** | `src/components/feed/FacebookCreatePost.tsx` |
| **SỬA** | `src/components/feed/FacebookPostCard.tsx` |
| **SỬA** | `src/components/feed/MediaGrid.tsx` |
| **SỬA** | `supabase/functions/cloudflare-migrate/index.ts` |
| **SỬA** | `package.json` (xóa tus-js-client, hls.js) |

---

## Ước tính công việc

- **Xóa code:** ~1,500 dòng (StreamPlayer, streamUpload, edge functions)
- **Sửa code:** ~300 dòng
- **Files bị ảnh hưởng:** ~15 files
- **Edge functions xóa:** 3 functions
- **Dependencies xóa:** 2 packages (tus-js-client, hls.js)

---

## Rủi ro và lưu ý

1. **Video cũ trên Stream**: Vẫn hoạt động nhờ backward compatible, nhưng nếu Cloudflare xóa thì sẽ mất
2. **Không có HLS streaming**: Video R2 sẽ phát trực tiếp (progressive download), có thể chậm hơn với video lớn
3. **File size limit**: R2 presigned URL có thể gặp vấn đề với video rất lớn (>1GB), cần test kỹ
4. **Thumbnails**: Stream tự generate thumbnail, R2 thì không → cần tạo thumbnail client-side (đã có sẵn trong VideoUploaderUppy)

---

## Câu hỏi xác nhận

Trước khi thực hiện, Angel cần xác nhận:

1. **Video cũ trên Stream**: Bé có muốn migrate video cũ sang R2 không? Hay để nguyên?
2. **HLS streaming**: Bé có cần adaptive bitrate streaming không? (Stream hỗ trợ, R2 không)
3. **Video lớn**: Bé có upload video >1GB không? Cần test kỹ với R2 presigned URL
