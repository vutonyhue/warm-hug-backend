

# Kế hoạch: Sửa lỗi Feed không hiển thị ảnh từ R2

## Phân tích vấn đề

### Nguyên nhân gốc

| Vấn đề | Chi tiết |
|--------|----------|
| Database lưu full URL cũ | `https://pub-5609558cd8fc4ca39dab5b2b919f43b1.r2.dev/posts/...` |
| LazyImage dùng Image Resizing | Chuyển sang `/cdn-cgi/image/.../posts/...` |
| Image Resizing lỗi 404 | `/cdn-cgi/image/` yêu cầu file tồn tại tại cùng origin |
| Domain mismatch | R2 public URL khác với custom domain mới |

### Flow hiện tại gây lỗi

```text
1. DB lưu: https://pub-xxx.r2.dev/posts/image.webp
2. MediaGrid gọi getMediaUrl() → URL không đổi (đã là full URL)
3. LazyImage gọi getTransformedImageUrl()
4. imageTransform normalize: https://media-funprofile.funecosystem.org/posts/image.webp
5. imageTransform thêm resize: https://media-funprofile.funecosystem.org/cdn-cgi/image/.../posts/image.webp
6. Cloudflare Image Resizing fetch /posts/image.webp từ origin → 404 (vì file ở R2 bucket khác?)
```

---

## Giải pháp: Tạm tắt Image Resizing để xác nhận ảnh hiển thị

### Bước 1: Tắt Image Resizing trong LazyImage

**File:** `src/components/ui/LazyImage.tsx`

Thay đổi default behavior để không áp dụng transformation khi URL đã là full URL từ R2:

```typescript
// Dòng 56-73: Cập nhật logic optimizedSrc
const optimizedSrc = useMemo(() => {
  if (skipTransform || !src) return src;
  
  // TẠM THỜI: Tắt Image Resizing cho R2 URLs để debug
  // Nếu src đã là full URL (http/https), trả về nguyên vẹn
  if (src.startsWith('http://') || src.startsWith('https://')) {
    return src;
  }
  
  // Chỉ transform nếu là relative path/key
  const options: ImageTransformOptions = {
    ...(transformPreset ? { preset: transformPreset } : {}),
    ...transformOptions,
  };
  
  if (!transformPreset && !transformOptions) {
    options.format = 'auto';
    options.quality = 85;
  }
  
  return getTransformedImageUrl(src, options);
}, [src, transformPreset, transformOptions, skipTransform]);
```

### Bước 2: Fix MediaGrid để không double-transform

**File:** `src/components/feed/MediaGrid.tsx`

MediaGrid đang gọi `getMediaUrl()` rồi sau đó LazyImage lại gọi `getTransformedImageUrl()`. Cần đảm bảo không double-transform:

```typescript
// Dòng 80-88: Thêm skipTransform cho LazyImage trong MediaGrid
<LazyImage
  src={item.url}
  alt="Post media"
  className="w-full max-h-[600px] bg-black"
  hideOnError
  onLoadError={() => handleMediaError(item.url)}
  skipTransform={true}  // Thêm dòng này - đã transform trong useMemo
/>
```

Cập nhật tất cả các LazyImage trong MediaGrid với `skipTransform={true}`.

### Bước 3: Thêm logging để debug

**File:** `src/components/feed/MediaGrid.tsx`

```typescript
// Thêm logging trong useMemo (tạm thời để debug)
const media = useMemo(() => {
  console.log('[MediaGrid] initialMedia:', initialMedia);
  
  const result = initialMedia
    .filter(item => !brokenUrls.has(item.url))
    .map(item => {
      const builtUrl = getMediaUrl(item.url);
      console.log('[MediaGrid] item.url:', item.url, '→ builtUrl:', builtUrl);
      return {
        ...item,
        url: builtUrl,
      };
    });
    
  console.log('[MediaGrid] final media:', result);
  return result;
}, [initialMedia, brokenUrls]);
```

### Bước 4: Thêm onError handler để log lỗi

```typescript
const handleMediaError = useCallback((url: string) => {
  console.error('[MediaGrid] Failed to load media:', url);
  setBrokenUrls(prev => new Set(prev).add(url));
}, []);
```

---

## Các file cần thay đổi

| File | Thay đổi |
|------|----------|
| `src/components/ui/LazyImage.tsx` | Tắt Image Resizing cho full URLs |
| `src/components/feed/MediaGrid.tsx` | Thêm `skipTransform={true}`, logging |

---

## Kiểm tra sau khi sửa

1. **Console log** phải hiển thị:
   - `[MediaGrid] item.url: posts/xxx.webp → builtUrl: https://media-funprofile.funecosystem.org/posts/xxx.webp`
   
2. **Network tab** phải thấy request tới:
   - `https://media-funprofile.funecosystem.org/posts/xxx.webp` (KHÔNG có `/cdn-cgi/image/`)
   - Response 200 OK

3. **Feed** phải hiển thị ảnh đúng

---

## Bước tiếp theo (sau khi ảnh hiển thị ổn)

Sau khi xác nhận ảnh hiển thị đúng mà KHÔNG có Image Resizing, có thể bật lại:

1. **Cập nhật secret `CLOUDFLARE_R2_PUBLIC_URL`** sang `https://media-funprofile.funecosystem.org`
2. **Xác nhận R2 custom domain** đã được cấu hình đúng trong Cloudflare Dashboard
3. **Bật lại Image Resizing** trong `LazyImage.tsx`

---

## Lưu ý quan trọng

- Các bài viết **CŨ** trong DB vẫn lưu full URL `https://pub-xxx.r2.dev/...`
- `getMediaUrl()` trong `src/config/media.ts` đã handle backward compatible (trả về nguyên vẹn nếu là full URL)
- **Không cần migrate data** vì `getMediaUrl()` đã xử lý cả 2 trường hợp

