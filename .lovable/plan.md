
# Kế hoạch: Sửa lỗi gửi OTP Email

## Nguyên nhân lỗi

Email OTP không được gửi vì:
- Code hiện tại gửi từ: `noreply@fun.rich`
- Domain đã verify trên Resend: `profile.funecosystem.org`

Resend từ chối gửi email từ domain chưa được xác minh.

---

## Chi tiết thay đổi

### File: `supabase/functions/sso-otp-request/index.ts`

**Dòng 134**: Thay đổi địa chỉ email gửi

| Hiện tại | Sửa thành |
|----------|-----------|
| `from: "FUN Ecosystem <noreply@fun.rich>"` | `from: "FUN Ecosystem <noreply@profile.funecosystem.org>"` |

---

## Code thay đổi cụ thể

```typescript
// Dòng 133-134, đổi từ:
const { error: emailError } = await resend.emails.send({
  from: "FUN Ecosystem <noreply@fun.rich>",

// Thành:
const { error: emailError } = await resend.emails.send({
  from: "FUN Ecosystem <noreply@profile.funecosystem.org>",
```

---

## Kết quả sau khi sửa

1. Email OTP sẽ được gửi từ `noreply@profile.funecosystem.org`
2. User nhập email → nhận được mã OTP trong inbox
3. Verify OTP → đăng nhập thành công

---

## Lưu ý quan trọng

Đảm bảo domain `profile.funecosystem.org` đã được verify đầy đủ trên Resend:
- Status: **Verified** (màu xanh)
- Đã thêm các DNS records: SPF, DKIM, DMARC

