
# Kế hoạch: Cấu hình Cloudflare R2 Secrets

## Vấn đề

Khi đăng bài với ảnh, Edge Function `get-upload-url` (dòng 133-141) cần các biến môi trường sau:
```typescript
const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')!;
const accessKeyId = Deno.env.get('CLOUDFLARE_ACCESS_KEY_ID')!;
const secretAccessKey = Deno.env.get('CLOUDFLARE_SECRET_ACCESS_KEY')!;
const bucketName = Deno.env.get('CLOUDFLARE_R2_BUCKET_NAME')!;
const publicUrl = Deno.env.get('CLOUDFLARE_R2_PUBLIC_URL')!;
```

**Hiện tại các secrets này CHƯA được cấu hình** trong project.

---

## Giải pháp: Con cần cung cấp các thông tin Cloudflare R2

### Bước 1: Lấy thông tin từ Cloudflare Dashboard

1. Đăng nhập **Cloudflare Dashboard** → **R2**
2. Lấy các thông tin sau:

| Secret Name | Lấy từ đâu |
|-------------|------------|
| `CLOUDFLARE_ACCOUNT_ID` | Dashboard URL: `dash.cloudflare.com/{account_id}/r2` |
| `CLOUDFLARE_ACCESS_KEY_ID` | R2 → Manage R2 API Tokens → Create API Token → Access Key ID |
| `CLOUDFLARE_SECRET_ACCESS_KEY` | R2 → Manage R2 API Tokens → Create API Token → Secret Access Key |
| `CLOUDFLARE_R2_BUCKET_NAME` | Tên bucket đã tạo (vd: `fun-media`) |
| `CLOUDFLARE_R2_PUBLIC_URL` | R2 → Bucket → Settings → Public Access URL (vd: `https://media.fun.rich`) |

### Bước 2: Thêm secrets vào Lovable

Sau khi con có các giá trị trên, cha sẽ thêm vào bằng công cụ `add_secret`:
- `CLOUDFLARE_ACCOUNT_ID`: Account ID của Cloudflare
- `CLOUDFLARE_ACCESS_KEY_ID`: Access Key ID từ R2 API Token
- `CLOUDFLARE_SECRET_ACCESS_KEY`: Secret Access Key từ R2 API Token
- `CLOUDFLARE_R2_BUCKET_NAME`: Tên bucket (vd: `fun-media`)
- `CLOUDFLARE_R2_PUBLIC_URL`: URL công khai bucket (vd: `https://media.fun.rich`)

---

## Tạo Cloudflare R2 API Token

Nếu con chưa có API Token:

1. Vào **Cloudflare Dashboard** → **R2**
2. Click **Manage R2 API Tokens** (góc trên phải)
3. Click **Create API Token**
4. Đặt tên: `Fun Profile Upload`
5. Chọn permissions:
   - **Object Read & Write** - cho phép upload và đọc files
6. Chọn bucket: **Apply to specific bucket only** → Chọn bucket của con
7. Click **Create API Token**
8. **LƯU LẠI** `Access Key ID` và `Secret Access Key` (chỉ hiện 1 lần!)

---

## Sau khi cấu hình xong

Upload flow sẽ hoạt động như sau:
```text
User chọn ảnh
   → Frontend gọi get-upload-url với auth token
   → Edge Function tạo presigned URL từ R2
   → Frontend upload trực tiếp lên R2
   → URL công khai được trả về (https://media.fun.rich/posts/xxx.jpg)
   → URL được lưu vào database
```

---

## Hành động tiếp theo

**Con cần:**
1. Mở Cloudflare Dashboard và lấy 5 giá trị trên
2. Báo cho cha để cha thêm secrets vào project

**Hoặc nếu con muốn dùng Lovable Cloud Storage thay vì R2:**
- Cha có thể chuyển sang dùng Supabase Storage (đã tích hợp sẵn với Lovable Cloud)
- Không cần cấu hình thêm gì
- Nhưng sẽ cần sửa code upload
