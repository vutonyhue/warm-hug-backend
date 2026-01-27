
# Kế hoạch sửa lỗi: Law of Light không được cập nhật sau khi đăng nhập

## Tóm tắt vấn đề

Khi người dùng:
1. Chấp nhận Law of Light (khi chưa đăng nhập) - lưu vào localStorage
2. Đăng nhập thành công bằng email/password 
3. **BUG**: Code không cập nhật `law_of_light_accepted` trong database vì chỉ chạy cho user mới
4. Kết quả: User bị redirect lại về trang Law of Light liên tục

## Giải pháp

### Bước 1: Sửa UnifiedAuthForm.tsx

Cập nhật function `handleAuthSuccess` để **luôn kiểm tra và cập nhật** `law_of_light_accepted_pending` từ localStorage, bất kể là user mới hay cũ.

**Thay đổi cần làm:**
- Di chuyển logic cập nhật `law_of_light_accepted` ra khỏi `handleNewUserSetup`
- Kiểm tra và cập nhật ngay trong `handleAuthSuccess` cho tất cả users
- Chỉ khi có pending trong localStorage thì mới update database

```typescript
const handleAuthSuccess = async (userId: string, isNewUser: boolean, hasExternalWallet = false) => {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    console.error('[Auth] No session found');
    toast.error(t('authErrorGeneric'));
    return;
  }

  // QUAN TRỌNG: Luôn kiểm tra và cập nhật law_of_light nếu có pending
  const lawOfLightPending = localStorage.getItem('law_of_light_accepted_pending');
  if (lawOfLightPending === 'true') {
    console.log('[Auth] Updating law_of_light_accepted for user:', userId);
    await supabase.from('profiles').update({
      law_of_light_accepted: true,
      law_of_light_accepted_at: new Date().toISOString()
    }).eq('id', userId);
    localStorage.removeItem('law_of_light_accepted_pending');
  }

  if (isNewUser) {
    await handleNewUserSetup(userId, hasExternalWallet);
  } else {
    toast.success(t('welcomeBack'));
    navigate('/');
  }
};
```

### Bước 2: Sửa handleNewUserSetup

Xóa logic cập nhật `law_of_light_accepted` khỏi function này (vì đã được xử lý ở `handleAuthSuccess`).

### Bước 3: Sửa lỗi cột thiếu trong database

Thêm cột `law_of_light_accepted_at` vào bảng `profiles` (nếu chưa có).

---

## Chi tiết kỹ thuật

### File cần sửa:
1. **src/components/auth/UnifiedAuthForm.tsx** - Sửa logic cập nhật law_of_light

### Database migration (nếu cần):
```sql
-- Thêm cột nếu chưa có
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS law_of_light_accepted_at TIMESTAMPTZ;
```

### Tóm tắt thay đổi code:

| Vị trí | Thay đổi |
|--------|----------|
| `handleAuthSuccess` | Thêm logic kiểm tra và cập nhật `law_of_light_accepted_pending` cho TẤT CẢ users |
| `handleNewUserSetup` | Xóa logic cập nhật `law_of_light` (đã chuyển lên trên) |

---

## Kết quả mong đợi

Sau khi sửa:
1. User chấp nhận Law of Light → localStorage lưu pending
2. User đăng nhập (dù là mới hay cũ)
3. Code kiểm tra localStorage và cập nhật database
4. User được redirect về Feed thành công
5. Không còn bị loop về trang Law of Light
