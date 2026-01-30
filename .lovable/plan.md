

# Kế hoạch: Sửa lỗi ảnh không hiển thị sau khi đăng bài

## Nguyên nhân gốc

**Database lưu URL đúng:**
```
https://pub-5609558cd8fc4ca39dab5b2b919f43b1.r2.dev/posts/1769741647732-u730t3oxy8d.webp
```

**Nhưng code transform URL sai:**
- File `src/lib/imageTransform.ts` có hardcode bucket ID **cũ/khác**:
  ```typescript
  const R2_PUBLIC_URL = 'https://pub-e83e74b0726742fbb6a60bc08f95624b.r2.dev';  // ← SAI
  ```
- Bucket thực tế là: `pub-5609558cd8fc4ca39dab5b2b919f43b1` (từ secret)

**Khi transform URL:**
1. Code kiểm tra `hostname.endsWith('r2.dev')` → TRUE
2. Chuyển URL thành `https://media.fun.rich/posts/...`
3. Nhưng `media.fun.rich` có thể không được cấu hình hoặc trỏ sai bucket
4. Ảnh không load được → `hideOnError` → ảnh biến mất

## Giải pháp

### Cách 1: Cập nhật hardcode URL (Khuyến nghị ngay)

Sửa `src/lib/imageTransform.ts` để dùng đúng bucket URL mới:

```typescript
// TRƯỚC (sai)
const R2_PUBLIC_URL = 'https://pub-e83e74b0726742fbb6a60bc08f95624b.r2.dev';

// SAU (đúng - dùng bucket thực tế từ database)
const R2_PUBLIC_URL = 'https://pub-5609558cd8fc4ca39dab5b2b919f43b1.r2.dev';
```

### Cách 2: Bỏ transform tạm thời

Nếu custom domain `media.fun.rich` chưa được cấu hình đúng, tạm thời bỏ transform để ảnh hiển thị:

```typescript
// Trong LazyImage component, thêm skipTransform mặc định
<LazyImage src={url} skipTransform={true} />
```

### Cách 3: Kiểm tra custom domain (Lâu dài)

Đảm bảo `media.fun.rich` được cấu hình trong Cloudflare R2 bucket settings trỏ đúng bucket.

## Thay đổi cụ thể

### File: `src/lib/imageTransform.ts`

**Line 17** - Cập nhật R2_PUBLIC_URL:
```typescript
// TRƯỚC
const R2_PUBLIC_URL = 'https://pub-e83e74b0726742fbb6a60bc08f95624b.r2.dev';

// SAU
const R2_PUBLIC_URL = 'https://pub-5609558cd8fc4ca39dab5b2b919f43b1.r2.dev';
```

## Kiểm tra sau fix

1. Refresh trang Feed
2. Ảnh và video trong các bài post phải hiển thị được
3. Nếu vẫn lỗi → cần kiểm tra cấu hình custom domain `media.fun.rich`

## Tóm tắt

| Vấn đề | Giải pháp |
|--------|-----------|
| Hardcode bucket URL sai | Cập nhật `R2_PUBLIC_URL` trong `imageTransform.ts` |
| Custom domain có thể chưa cấu hình | Dùng trực tiếp URL gốc từ R2 nếu cần |

