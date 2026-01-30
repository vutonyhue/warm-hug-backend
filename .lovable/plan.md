
# Kế hoạch Refactor: Sửa lỗi Feed không hiển thị ảnh (Cloudflare R2)

## Phân tích hiện trạng

Sau khi đọc toàn bộ codebase, tôi xác định được flow hiện tại và vấn đề:

### Flow Upload hiện tại

```text
1. FacebookCreatePost → uploadToR2() 
2. uploadToR2() → get-upload-url (lấy presigned URL)
3. uploadToR2() → PUT trực tiếp lên R2
4. uploadToR2() trả về { url, key }
   - url = publicUrl từ edge function (CLOUDFLARE_R2_PUBLIC_URL/key)
   - key = "posts/timestamp-random.jpg"
5. FacebookCreatePost → create-post với media_urls: [{ url, type }]
6. Database lưu media_urls = [{ url: "https://...", type: "image" }]
```

### Vấn đề đã xác định

| Vấn đề | Chi tiết |
|--------|----------|
| Database lưu full URL | `media_urls` lưu `[{ url: "https://pub-xxx.r2.dev/posts/...", type: "image" }]` |
| Edge function `get-upload-url` trả `publicUrl` | Dùng `CLOUDFLARE_R2_PUBLIC_URL` (có thể khác domain mới) |
| URL không nhất quán | Có thể lưu `pub-xxx.r2.dev` nhưng render qua `media-funprofile.funecosystem.org` |
| Cloudflare Image Resizing lỗi 404 | `/cdn-cgi/image/...` yêu cầu file phải tồn tại trên cùng origin |

### Kiến trúc chuẩn theo yêu cầu

```text
R2 object key → DB lưu key → Frontend build URL → <img src> render
```

## Các thay đổi chi tiết

### 1. Constants tập trung (File mới)

**File:** `src/config/media.ts`

Tạo file constants để quản lý media URLs tập trung, tránh hardcode:

```typescript
// Media Configuration Constants
// Tập trung quản lý URLs để dễ thay đổi

export const MEDIA_BASE_URL = 'https://media-funprofile.funecosystem.org';

// Các bucket paths
export const MEDIA_PATHS = {
  posts: 'posts',
  avatars: 'avatars', 
  covers: 'covers',
  videos: 'videos',
  commentMedia: 'comment-media',
} as const;

// Helper: Build full URL từ media key
export function getMediaUrl(key: string): string {
  if (!key) return '/placeholder.svg';
  // Nếu đã là full URL, trả về nguyên vẹn (backward compatible)
  if (key.startsWith('http://') || key.startsWith('https://')) {
    return key;
  }
  return `${MEDIA_BASE_URL}/${key}`;
}

// Helper: Extract key từ URL (nếu cần migrate)
export function extractMediaKey(url: string): string {
  if (!url) return '';
  try {
    const u = new URL(url);
    // Loại bỏ leading slash
    return u.pathname.startsWith('/') ? u.pathname.slice(1) : u.pathname;
  } catch {
    return url; // Nếu không parse được, giả sử đã là key
  }
}
```

### 2. Sửa `src/utils/r2Upload.ts`

**Thay đổi:** Chỉ trả về `key`, không trả về `url` (publicUrl)

```typescript
// Dòng 3-6: Thay đổi interface
export interface R2UploadResult {
  key: string;
  // url field removed - frontend will build URL from key
}

// Dòng 137-140: Thay đổi return statement
return {
  key: key,
  // Không trả về url nữa
};
```

### 3. Sửa `src/utils/mediaUpload.ts`

**Thay đổi:** Chỉ trả về `key` thay vì URL

```typescript
// Dòng 14-15: Xóa constant không cần thiết
// R2_CUSTOM_DOMAIN không cần nữa - frontend dùng config tập trung

// Dòng 17-21: Thay đổi interface
export interface MediaUploadResult {
  key: string;
  // url và transformedUrl removed
}

// Dòng 125-132: Thay đổi return
return {
  key, // Chỉ trả về key
};
```

### 4. Sửa `src/components/feed/FacebookCreatePost.tsx`

**Thay đổi:** Gửi `media_keys` thay vì `media_urls` với full URL

```typescript
// Thêm import ở đầu file
import { MEDIA_BASE_URL, getMediaUrl } from '@/config/media';

// Dòng 398-423: Thay đổi logic upload và build payload
// Upload all media items
const mediaKeys: string[] = [];

// Add Uppy-uploaded video first if exists
if (uppyVideoResult) {
  // Extract key from Uppy video URL
  const videoKey = uppyVideoResult.url.replace(/^https?:\/\/[^/]+\//, '');
  mediaKeys.push(videoKey);
}

for (const item of mediaItems) {
  if (item.type === 'video') continue;
  
  const result = await uploadToR2(item.file, 'posts', undefined, session.access_token);
  mediaKeys.push(result.key); // Chỉ lưu key
}

// Dòng 438-452: Thay đổi payload gửi lên edge function
body: JSON.stringify({
  content: content.trim() || '',
  media_keys: mediaKeys, // Gửi keys thay vì urls
  // Để backward compatible, vẫn gửi media_urls với full URL
  media_urls: mediaKeys.map(key => ({
    url: getMediaUrl(key), 
    type: key.includes('videos') ? 'video' : 'image'
  })),
  location: location,
  tagged_user_ids: taggedFriends.map(f => f.id),
}),
```

### 5. Sửa Edge Function `supabase/functions/create-post/index.ts`

**Thay đổi:** Nhận và xử lý `media_keys`

```typescript
// Dòng 15-22: Cập nhật interface
interface CreatePostRequest {
  content: string;
  media_keys?: string[]; // NEW: Array of media keys
  media_urls?: MediaUrl[]; // Keep for backward compatibility  
  location?: string | null;
  tagged_user_ids?: string[];
}

// Dòng 93-108: Cập nhật insert logic
// Build media_urls from media_keys if provided
let finalMediaUrls: MediaUrl[] = [];
if (body.media_keys && body.media_keys.length > 0) {
  finalMediaUrls = body.media_keys.map(key => ({
    url: key, // Lưu key thay vì full URL
    type: key.includes('videos') ? 'video' as const : 'image' as const,
  }));
} else if (body.media_urls) {
  finalMediaUrls = body.media_urls;
}

const { data: post, error: insertError } = await supabase
  .from("posts")
  .insert({
    user_id: userId,
    content: body.content?.trim() || "",
    media_urls: finalMediaUrls, // Có thể là key hoặc full URL (backward compatible)
    location: body.location || null,
  })
  .select("id")
  .single();
```

### 6. Sửa Edge Function `supabase/functions/api-feed/index.ts`

**Không cần thay đổi** - đã trả về `media_urls` đầy đủ. Frontend sẽ xử lý việc build URL.

### 7. Sửa `src/components/feed/MediaGrid.tsx`

**Thay đổi:** Build URL từ key khi render

```typescript
// Thêm import
import { getMediaUrl } from '@/config/media';

// Dòng 29: Cập nhật filter và transform media
const media = initialMedia
  .filter(item => !brokenUrls.has(item.url))
  .map(item => ({
    ...item,
    // Build full URL từ key (hoặc giữ nguyên nếu đã là full URL)
    url: getMediaUrl(item.url),
  }));
```

### 8. Sửa `src/components/feed/FacebookPostCard.tsx`

**Thay đổi:** Transform media URLs khi render

```typescript
// Thêm import
import { getMediaUrl } from '@/config/media';

// Dòng 302-316: Cập nhật useMemo cho mediaItems
const mediaItems = useMemo(() => {
  const items: Array<{ url: string; type: 'image' | 'video' }> = [];
  
  if (post.media_urls && Array.isArray(post.media_urls) && post.media_urls.length > 0) {
    return post.media_urls.map(item => ({
      ...item,
      url: getMediaUrl(item.url), // Build full URL từ key
    }));
  }
  
  if (post.image_url) {
    items.push({ url: getMediaUrl(post.image_url), type: 'image' as const });
  }
  if (post.video_url) {
    items.push({ url: getMediaUrl(post.video_url), type: 'video' as const });
  }
  return items;
}, [post.media_urls, post.image_url, post.video_url]);
```

### 9. Sửa `src/lib/imageTransform.ts`

**Thay đổi:** Import từ config tập trung

```typescript
// Dòng 14-20: Thay thế constants bằng import
import { MEDIA_BASE_URL } from '@/config/media';

const CF_ZONE_DOMAIN = MEDIA_BASE_URL;
const R2_CUSTOM_DOMAIN = MEDIA_BASE_URL;
// Giữ R2_PUBLIC_URL để nhận dạng URL cũ
const R2_PUBLIC_URL = 'https://pub-5609558cd8fc4ca39dab5b2b919f43b1.r2.dev';
```

### 10. Cập nhật `src/hooks/useFeedPosts.ts`

**Thay đổi:** Transform URLs khi nhận data từ API

```typescript
// Thêm import
import { getMediaUrl } from '@/config/media';

// Dòng 68-78: Transform posts khi parse response
const posts: FeedPost[] = (apiResponse.data || []).map((post) => ({
  id: post.id,
  content: post.content || '',
  image_url: post.image_url ? getMediaUrl(post.image_url) : null,
  video_url: post.video_url ? getMediaUrl(post.video_url) : null,
  media_urls: post.media_urls ? (post.media_urls as any[]).map((m: any) => ({
    url: getMediaUrl(m.url),
    type: m.type,
  })) : null,
  created_at: post.created_at || new Date().toISOString(),
  user_id: post.user_id,
  profiles: post.profiles,
}));
```

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/config/media.ts` | **MỚI** - Constants và helpers tập trung |
| `src/utils/r2Upload.ts` | Chỉ trả về `key` |
| `src/utils/mediaUpload.ts` | Chỉ trả về `key` |
| `src/components/feed/FacebookCreatePost.tsx` | Gửi `media_keys` và build URL từ key |
| `supabase/functions/create-post/index.ts` | Nhận `media_keys`, lưu key vào DB |
| `src/components/feed/MediaGrid.tsx` | Build URL từ key |
| `src/components/feed/FacebookPostCard.tsx` | Build URL từ key |
| `src/lib/imageTransform.ts` | Import từ config tập trung |
| `src/hooks/useFeedPosts.ts` | Transform URLs khi parse response |

## Tính năng Backward Compatible

- Nếu `url` đã là full URL (bắt đầu bằng `http`), `getMediaUrl()` trả về nguyên vẹn
- Bài viết cũ với full URL trong database vẫn hoạt động
- Bài viết mới sẽ lưu key → hiển thị đúng

## Kết quả mong đợi

1. Database lưu: `media_urls: [{ url: "posts/abc.jpg", type: "image" }]`
2. Frontend build: `https://media-funprofile.funecosystem.org/posts/abc.jpg`
3. Ảnh hiển thị đúng trên Feed
4. Cloudflare Image Resizing hoạt động: `.../cdn-cgi/image/.../posts/abc.jpg`
5. Không lỗi 404, không lỗi CORS
