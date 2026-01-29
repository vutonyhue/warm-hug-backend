
# Kế hoạch: Sửa CORS Headers cho tất cả Edge Functions

## Vấn đề gốc

Supabase JavaScript client (v2.93.1) tự động gửi các headers mới:
- `x-supabase-client-platform` (ví dụ: "Windows")
- `x-supabase-client-platform-version`
- `x-supabase-client-runtime`
- `x-supabase-client-runtime-version`

Nhưng tất cả Edge Functions chỉ cho phép:
```
authorization, x-client-info, apikey, content-type
```

**Kết quả**: Browser chặn request do CORS policy violation khi preflight check thất bại.

## Giải pháp

Cập nhật CORS headers trong **tất cả Edge Functions** để bao gồm các headers mới từ Supabase client.

## Danh sách files cần sửa

| # | File | CORS cần sửa |
|---|------|--------------|
| 1 | `supabase/functions/sso-authorize/index.ts` | Line 4-6 |
| 2 | `supabase/functions/sso-token/index.ts` | Line 4-6 |
| 3 | `supabase/functions/sso-verify/index.ts` | Line 4-6 |
| 4 | `supabase/functions/sso-refresh/index.ts` | Line 4-6 |
| 5 | `supabase/functions/sso-revoke/index.ts` | Line 4-6 |
| 6 | `supabase/functions/sso-otp-request/index.ts` | Line 4-6 |
| 7 | `supabase/functions/sso-otp-verify/index.ts` | Line 4-6 |
| 8 | `supabase/functions/sso-register/index.ts` | Line 4-6 |
| 9 | `supabase/functions/sso-web3-auth/index.ts` | Line 4-6 |
| 10 | `supabase/functions/sso-set-password/index.ts` | Line 4-6 |
| 11 | `supabase/functions/sso-sync-data/index.ts` | Line 4-6 |
| 12 | `supabase/functions/sso-sync-financial/index.ts` | Line 4-6 |
| 13 | `supabase/functions/sso-merge-request/index.ts` | Line 4-6 |
| 14 | `supabase/functions/sso-merge-approve/index.ts` | Line 4-6 |
| 15 | `supabase/functions/sso-resend-webhook/index.ts` | Line 4-6 |
| 16 | `supabase/functions/stream-video/index.ts` | Line 4-8 |
| 17 | `supabase/functions/get-upload-url/index.ts` | Line 12-14 |
| 18 | `supabase/functions/upload-to-r2/index.ts` | Line 3-6 |
| 19 | `supabase/functions/delete-from-r2/index.ts` | Line cần tìm |
| 20 | `supabase/functions/api-feed/index.ts` | Line cần tìm |
| 21 | `supabase/functions/api-leaderboard/index.ts` | Line cần tìm |
| 22 | `supabase/functions/create-post/index.ts` | Line cần tìm |
| 23 | `supabase/functions/admin-list-merge-requests/index.ts` | Line cần tìm |
| 24 | `supabase/functions/admin-update-media-url/index.ts` | Line cần tìm |
| 25 | `supabase/functions/connect-external-wallet/index.ts` | Line cần tìm |
| 26 | `supabase/functions/create-custodial-wallet/index.ts` | Line cần tìm |
| 27 | `supabase/functions/delete-user-account/index.ts` | Line cần tìm |
| 28 | `supabase/functions/generate-presigned-url/index.ts` | Line cần tìm |
| 29 | `supabase/functions/image-transform/index.ts` | Line cần tìm |
| 30 | `supabase/functions/mint-soul-nft/index.ts` | Line cần tìm |
| Các functions còn lại | Các edge functions khác trong thư mục | Tương tự |

## Thay đổi cụ thể

**TRƯỚC (sai):**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

**SAU (đúng):**
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};
```

## Kế hoạch triển khai

### Bước 1: Cập nhật tất cả SSO functions (ưu tiên cao)
- sso-authorize, sso-token, sso-verify, sso-refresh, sso-revoke
- sso-otp-request, sso-otp-verify, sso-register
- sso-web3-auth, sso-set-password
- sso-sync-data, sso-sync-financial
- sso-merge-request, sso-merge-approve, sso-resend-webhook

### Bước 2: Cập nhật Media upload functions
- stream-video, get-upload-url, upload-to-r2, delete-from-r2
- generate-presigned-url, image-transform

### Bước 3: Cập nhật API functions
- api-feed, api-leaderboard, create-post

### Bước 4: Cập nhật Admin & User functions
- admin-list-merge-requests, admin-update-media-url
- connect-external-wallet, create-custodial-wallet
- delete-user-account, mint-soul-nft

### Bước 5: Cập nhật các functions còn lại
- cleanup functions, migrate functions, etc.

## Kết quả sau khi triển khai

- Không còn lỗi CORS trong browser console
- Frontend requests thành công
- Video upload qua Cloudflare Stream vẫn hoạt động bình thường
- Authentication flows vẫn hoạt động

## Lưu ý

- Cloudflare R2 CORS là vấn đề riêng (đã được xử lý trước đó bằng cách chuyển sang backend upload)
- Thay đổi này chỉ ảnh hưởng đến Edge Functions, không ảnh hưởng đến Cloudflare CDN
- Các Edge Functions sẽ được auto-deploy sau khi cập nhật code
