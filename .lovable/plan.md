

# Kế hoạch: Sửa lỗi Video 404 + Hiển thị Video trong Feed

## Phân tích vấn đề

### Kiến trúc hiện tại

Ứng dụng có **2 hệ thống lưu trữ video khác nhau**:

| Hệ thống | Mô tả | URL Format |
|----------|-------|------------|
| **Cloudflare Stream** | Video lớn upload qua TUS protocol | `https://iframe.videodelivery.net/{uid}` |
| **Cloudflare R2** | Ảnh + video nhỏ upload trực tiếp | `posts/timestamp-random.mp4` |

### Vấn đề đã xác định

**Issue 1: Lưu video key sai**

Trong `FacebookCreatePost.tsx` dòng 405-408:
```typescript
if (uppyVideoResult) {
  // Extract key từ URL - LOGIC SAI!
  const videoKey = uppyVideoResult.url.replace(/^https?:\/\/[^/]+\//, '');
  // Kết quả: "d4f3a2b1c5e6..." (chỉ UID, không có extension)
}
```

Video từ Cloudflare Stream có URL là `https://iframe.videodelivery.net/{uid}` (không có `.mp4`), nên khi extract key chỉ còn lại UID trần.

**Issue 2: getMediaUrl() xử lý sai Stream URLs**

Khi render, `getMediaUrl("d4f3a2b1c5e6...")` trả về:
```
https://media-funprofile.funecosystem.org/d4f3a2b1c5e6...
```

URL này 404 vì file không tồn tại trên R2 - nó nằm trên Cloudflare Stream.

**Issue 3: isStreamUrl() không được gọi đúng thời điểm**

`LazyVideo` có logic phát hiện Stream URL (`isStreamUrl`), nhưng URL đã bị transform sai trước khi đến component này.

### Giải pháp

Phân biệt rõ 2 loại video:
- **Cloudflare Stream**: Lưu full URL (không transform)
- **Cloudflare R2**: Lưu key (transform bằng `getMediaUrl`)

---

## Các thay đổi chi tiết

### 1. Sửa `src/config/media.ts`

Thêm helper functions để detect và xử lý Stream URLs:

```typescript
// Thêm export mới
export function isCloudflareStreamUrl(url: string): boolean {
  return url.includes('videodelivery.net') || url.includes('cloudflarestream.com');
}

// Sửa getMediaUrl để KHÔNG transform Stream URLs
export function getMediaUrl(key: string | null | undefined): string {
  if (!key) return '/placeholder.svg';
  
  // Nếu là Cloudflare Stream URL, trả về nguyên vẹn
  if (key.includes('videodelivery.net') || key.includes('cloudflarestream.com')) {
    return key;
  }
  
  // Nếu đã là full URL, trả về nguyên vẹn
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  
  // Build full URL từ key
  return `${MEDIA_BASE_URL}/${key}`;
}
```

### 2. Sửa `src/components/feed/FacebookCreatePost.tsx`

**Dòng 401-428**: Sửa logic lưu video key

```typescript
// Trước
if (uppyVideoResult) {
  const videoKey = uppyVideoResult.url.replace(/^https?:\/\/[^/]+\//, '');
  mediaUrls.push({
    url: videoKey,
    type: 'video',
  });
}

// Sau: Lưu nguyên full URL cho Stream videos
if (uppyVideoResult) {
  // Stream videos: lưu full URL (không extract key)
  mediaUrls.push({
    url: uppyVideoResult.url, // Giữ nguyên: https://iframe.videodelivery.net/{uid}
    type: 'video',
  });
  console.log('[CreatePost] Added Stream video URL:', uppyVideoResult.url);
}
```

### 3. Sửa `src/components/feed/MediaGrid.tsx`

**Dòng 30-47**: Thêm logging chi tiết và xử lý riêng cho video

```typescript
const media = useMemo(() => {
  console.log('[MediaGrid] initialMedia:', initialMedia);
  
  const result = initialMedia
    .filter(item => !brokenUrls.has(item.url))
    .map(item => {
      // Với video, kiểm tra xem có phải Stream URL không
      const isStreamVideo = item.type === 'video' && 
        (item.url.includes('videodelivery.net') || item.url.includes('cloudflarestream.com'));
      
      // Stream videos: giữ nguyên URL
      // R2 media: build URL từ key
      const builtUrl = isStreamVideo ? item.url : getMediaUrl(item.url);
      
      console.log('[MediaGrid] item:', item.url, 
        '→ type:', item.type, 
        '→ isStream:', isStreamVideo,
        '→ builtUrl:', builtUrl);
        
      return {
        ...item,
        url: builtUrl,
      };
    });
  
  console.log('[MediaGrid] final media:', result);
  return result;
}, [initialMedia, brokenUrls]);
```

### 4. Sửa `src/hooks/useFeedPosts.ts`

**Dòng 68-78**: Thêm logic tương tự khi parse response

```typescript
// Import thêm
import { getMediaUrl } from '@/config/media';

// Helper function
const isStreamVideoUrl = (url: string) => 
  url?.includes('videodelivery.net') || url?.includes('cloudflarestream.com');

// Trong map function
media_urls: post.media_urls ? (post.media_urls as any[]).map((m: any) => ({
  url: m.type === 'video' && isStreamVideoUrl(m.url) 
    ? m.url  // Stream video: giữ nguyên
    : getMediaUrl(m.url),  // R2 media: build URL
  type: m.type,
})) : null,
```

### 5. Sửa `src/components/feed/FacebookPostCard.tsx`

**Dòng 302-316**: Cập nhật useMemo tương tự

```typescript
const mediaItems = useMemo(() => {
  const isStreamVideoUrl = (url: string) => 
    url?.includes('videodelivery.net') || url?.includes('cloudflarestream.com');
    
  const items: Array<{ url: string; type: 'image' | 'video' }> = [];
  
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return post.media_urls.map(item => ({
      ...item,
      url: item.type === 'video' && isStreamVideoUrl(item.url)
        ? item.url  // Stream video: giữ nguyên
        : getMediaUrl(item.url),  // R2 media: build URL
    }));
  }
  
  // Fallback cho legacy fields
  if (post.image_url) {
    items.push({ url: getMediaUrl(post.image_url), type: 'image' as const });
  }
  if (post.video_url) {
    const videoUrl = isStreamVideoUrl(post.video_url) 
      ? post.video_url 
      : getMediaUrl(post.video_url);
    items.push({ url: videoUrl, type: 'video' as const });
  }
  return items;
}, [post.media_urls, post.image_url, post.video_url]);
```

---

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/config/media.ts` | Thêm `isCloudflareStreamUrl()`, sửa `getMediaUrl()` để không transform Stream URLs |
| `src/components/feed/FacebookCreatePost.tsx` | Lưu full URL cho Stream videos thay vì extract key |
| `src/components/feed/MediaGrid.tsx` | Phân biệt Stream vs R2 khi build URL |
| `src/hooks/useFeedPosts.ts` | Tương tự MediaGrid |
| `src/components/feed/FacebookPostCard.tsx` | Tương tự MediaGrid |

---

## Flow mới

### Upload Video (Cloudflare Stream)
```text
1. User chọn video file
2. VideoUploaderUppy upload lên Cloudflare Stream
3. Nhận url: "https://iframe.videodelivery.net/{uid}"
4. Lưu vào DB: media_urls = [{ url: "https://iframe.videodelivery.net/{uid}", type: "video" }]
```

### Render Video trong Feed
```text
1. api-feed trả về: media_urls = [{ url: "https://iframe.videodelivery.net/{uid}", type: "video" }]
2. MediaGrid detect isStreamVideo = true
3. Giữ nguyên URL, không gọi getMediaUrl()
4. LazyVideo detect isStreamUrl() → Render bằng StreamPlayer (HLS)
```

---

## Backward Compatibility

- **Video cũ với Stream URL đầy đủ**: Hoạt động (detect bằng `isStreamVideoUrl`)
- **Video cũ với UID trần trong DB**: Cần migration script để fix (tùy chọn)
- **Ảnh R2 với key**: Hoạt động bình thường
- **Ảnh R2 với full URL cũ**: Hoạt động (backward compatible)

---

## Kết quả mong đợi

1. Đăng video mới → Feed hiển thị video ngay (không 404)
2. StreamPlayer load HLS từ Cloudflare Stream
3. Network không còn request tới `media-funprofile.funecosystem.org/{uid}`
4. Ảnh R2 vẫn hoạt động bình thường

