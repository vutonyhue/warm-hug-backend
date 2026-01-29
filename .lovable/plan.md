

# Kế hoạch: Cấu hình CORS cho Cloudflare R2 Bucket

## Vấn đề

Frontend đang upload trực tiếp lên R2 bằng presigned URL nhưng R2 bucket chưa cấu hình **CORS policy** để cho phép các request từ domain Lovable.

## Giải pháp: Cấu hình CORS trong Cloudflare Dashboard

### Bước 1: Truy cập Cloudflare R2

1. Đăng nhập **Cloudflare Dashboard**: https://dash.cloudflare.com
2. Chọn account của con
3. Vào **R2 Object Storage** (menu bên trái)
4. Click vào bucket **fun-media**

### Bước 2: Mở CORS Settings

1. Trong bucket, chọn tab **Settings**
2. Tìm mục **CORS Policy** (hoặc **CORS configuration**)
3. Click **Edit** hoặc **Add CORS rule**

### Bước 3: Thêm CORS Rule

Thêm CORS policy sau đây (JSON format):

```json
[
  {
    "AllowedOrigins": [
      "https://id-preview--ad0a5c4b-26ce-4e7c-acae-c271bc53e283.lovable.app",
      "https://trienkhaifunprofile.lovable.app",
      "https://*.lovableproject.com",
      "https://*.lovable.app",
      "http://localhost:*"
    ],
    "AllowedMethods": [
      "GET",
      "PUT",
      "POST",
      "DELETE",
      "HEAD"
    ],
    "AllowedHeaders": [
      "*"
    ],
    "ExposeHeaders": [
      "ETag",
      "Content-Length",
      "Content-Type"
    ],
    "MaxAgeSeconds": 3600
  }
]
```

### Bước 4: Lưu và test

1. Click **Save** để lưu CORS configuration
2. Quay lại ứng dụng và thử đăng bài với ảnh

## Giải thích cấu hình

| Field | Ý nghĩa |
|-------|---------|
| `AllowedOrigins` | Các domain được phép gọi đến R2 (bao gồm preview, published, localhost) |
| `AllowedMethods` | PUT (upload), GET (download), DELETE (xóa) |
| `AllowedHeaders` | Cho phép mọi header (như `Content-Type`) |
| `ExposeHeaders` | Headers trả về cho client |
| `MaxAgeSeconds` | Cache preflight response 1 giờ |

## Sau khi cấu hình xong

Upload flow sẽ hoạt động như sau:

```text
1. Frontend chọn ảnh
2. Gọi get-upload-url để lấy presigned URL ✅ (đang OK)
3. Browser gửi preflight OPTIONS request đến R2
4. R2 trả về CORS headers ✅ (sau khi cấu hình)
5. Browser cho phép PUT request
6. File được upload thành công ✅
```

## Nếu không tìm thấy CORS Settings

Một số R2 bucket cũ có thể cần:
1. Vào **R2 Overview** → **Manage R2 API Tokens**
2. Hoặc dùng **wrangler CLI** để set CORS

## Files không cần thay đổi

Không cần sửa code vì:
- `get-upload-url` Edge Function đã hoạt động tốt (trả về presigned URL)
- `r2Upload.ts` frontend đã cấu hình đúng
- Vấn đề hoàn toàn nằm ở cấu hình CORS của R2 bucket

