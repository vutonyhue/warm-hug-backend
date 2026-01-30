

# Kế hoạch: Sửa lỗi OTP Login (500 Internal Server Error)

## Nguyên nhân gốc

Có **2 lỗi** trong edge function `sso-otp-request`:

### 1. Gọi `check_rate_limit` với tham số sai tên
```typescript
// ❌ Hiện tại (SAI)
await supabase.rpc('check_rate_limit', {
  p_key: rateLimitKey,
  p_limit: OTP_RATE_LIMIT,
  p_window_ms: OTP_RATE_WINDOW_MS
});

// ✅ Cần sửa (ĐÚNG với DB function)
await supabase.rpc('check_rate_limit', {
  rate_key: rateLimitKey,
  max_count: OTP_RATE_LIMIT,
  window_ms: OTP_RATE_WINDOW_MS
});
```

### 2. Insert vào `otp_codes` với cột không tồn tại

| Edge function dùng | Database thực tế có | Cần sửa |
|-------------------|---------------------|---------|
| `identifier` | `email` | ✅ Đổi thành `email` |
| `is_used` | `used` | ✅ Đổi thành `used` |
| `attempts` | ❌ Không có | ✅ Bỏ đi |
| `max_attempts` | ❌ Không có | ✅ Bỏ đi |
| `type` | ❌ Không có | ✅ Bỏ đi |

---

## Chi tiết thay đổi

### File: `supabase/functions/sso-otp-request/index.ts`

**Thay đổi 1: Sửa tên tham số `check_rate_limit`**

Dòng 18-22, đổi từ:
```typescript
const { data, error } = await supabase.rpc('check_rate_limit', {
  p_key: rateLimitKey,
  p_limit: OTP_RATE_LIMIT,
  p_window_ms: OTP_RATE_WINDOW_MS
});
```

Thành:
```typescript
const { data, error } = await supabase.rpc('check_rate_limit', {
  rate_key: rateLimitKey,
  max_count: OTP_RATE_LIMIT,
  window_ms: OTP_RATE_WINDOW_MS
});
```

**Thay đổi 2: Sửa cột khi delete OTP cũ**

Dòng 102-106, đổi từ:
```typescript
await supabase
  .from('otp_codes')
  .delete()
  .eq('identifier', identifier.toLowerCase())
  .eq('is_used', false);
```

Thành:
```typescript
await supabase
  .from('otp_codes')
  .delete()
  .eq('email', identifier.toLowerCase())
  .eq('used', false);
```

**Thay đổi 3: Sửa cột khi insert OTP mới**

Dòng 109-119, đổi từ:
```typescript
const { error: insertError } = await supabase
  .from('otp_codes')
  .insert({
    identifier: identifier.toLowerCase(),
    code: otp,
    type: type,
    expires_at: expiresAt,
    is_used: false,
    attempts: 0,
    max_attempts: 5
  });
```

Thành:
```typescript
const { error: insertError } = await supabase
  .from('otp_codes')
  .insert({
    email: identifier.toLowerCase(),
    code: otp,
    expires_at: expiresAt,
    used: false
  });
```

---

## Kết quả sau khi sửa

1. ✅ Rate limiting sẽ hoạt động đúng
2. ✅ OTP sẽ được lưu vào database thành công
3. ✅ Email chứa mã OTP sẽ được gửi (nếu RESEND_API_KEY đã cấu hình)
4. ✅ User có thể đăng nhập bằng OTP

---

## Lưu ý về `sso-otp-verify`

Sau khi sửa `sso-otp-request`, cũng cần kiểm tra `sso-otp-verify` để đảm bảo nó cũng dùng đúng tên cột (`email` thay vì `identifier`, `used` thay vì `is_used`).

