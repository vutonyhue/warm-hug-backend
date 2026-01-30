
# Kế hoạch: Cập nhật R2 Custom Domain mới

## Domain mới
`media-funprofile.funecosystem.org` (thay thế `media.fun.rich`)

---

## Các file cần cập nhật

### 1. `src/lib/imageTransform.ts`

Cập nhật 2 constants ở đầu file:

| Dòng | Hiện tại | Thay đổi |
|------|----------|----------|
| 14 | `CF_ZONE_DOMAIN = 'https://media.fun.rich'` | `CF_ZONE_DOMAIN = 'https://media-funprofile.funecosystem.org'` |
| 20 | `R2_CUSTOM_DOMAIN = 'https://media.fun.rich'` | `R2_CUSTOM_DOMAIN = 'https://media-funprofile.funecosystem.org'` |

Cập nhật comment ở dòng 214:

```typescript
// Same-origin path mode:
// https://media-funprofile.funecosystem.org/cdn-cgi/image/{options}/posts/...
```

---

### 2. `src/utils/mediaUpload.ts`

Cập nhật constant ở dòng 15:

| Dòng | Hiện tại | Thay đổi |
|------|----------|----------|
| 15 | `R2_CUSTOM_DOMAIN = 'https://media.fun.rich'` | `R2_CUSTOM_DOMAIN = 'https://media-funprofile.funecosystem.org'` |

---

## Tóm tắt thay đổi

| File | Số lượng thay đổi |
|------|-------------------|
| `src/lib/imageTransform.ts` | 3 vị trí (2 constants + 1 comment) |
| `src/utils/mediaUpload.ts` | 1 vị trí (1 constant) |

---

## Kết quả sau khi sửa

1. Ảnh mới upload sẽ sử dụng domain `media-funprofile.funecosystem.org`
2. Cloudflare Image Resizing hoạt động qua path: `media-funprofile.funecosystem.org/cdn-cgi/image/...`
3. Ảnh hiển thị đúng trên Feed với lazy loading và optimization

---

## Lưu ý quan trọng

Đảm bảo trong Cloudflare Dashboard:
- R2 bucket đã được liên kết với custom domain `media-funprofile.funecosystem.org`
- SSL/TLS đã được bật cho domain này
- CORS đã được cấu hình cho các origin cần thiết (lovable.app, funecosystem.org, localhost ports)
