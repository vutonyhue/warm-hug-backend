
# Kế hoạch Fix Lỗi Đăng Bài Timeout + Tối ưu Authentication Flow

## Tóm tắt vấn đề

### Nguyên nhân gốc: **Supabase Auth API chậm/overloaded**
- `supabase.auth.getSession()` bị timeout sau 15 giây
- `supabase.auth.refreshSession()` cũng bị timeout
- Auth logs cho thấy một số requests mất **49-119 giây** để hoàn thành
- **Lỗi KHÔNG liên quan đến Cloudflare R2** - timeout xảy ra TRƯỚC khi upload

### Flow hiện tại (có vấn đề):
```text
User click "Đăng" 
   → getSession() [CHẬM - gọi API mỗi lần]
   → TIMEOUT 15s 
   → refreshSession() [CHẬM - gọi API lần nữa]
   → TIMEOUT 90s 
   → Lỗi
```

---

## Giải pháp đề xuất

### Fix 1: Sử dụng cached session thay vì gọi API

**Vấn đề**: `supabase.auth.getSession()` đọc từ localStorage nhanh, nhưng có thể trigger refresh token nếu token hết hạn → gọi API chậm.

**Giải pháp**: Kiểm tra session từ localStorage trước, chỉ refresh nếu thực sự cần thiết:

```typescript
// Thay vì:
const { data: { session } } = await supabase.auth.getSession();

// Dùng cached session từ auth state:
const { data: { session } } = await supabase.auth.getSession();

// Hoặc tốt hơn - lưu session vào state component khi mount
```

### Fix 2: Pre-fetch session khi mở dialog

Thay vì chờ đến lúc submit mới lấy session, lấy sẵn khi user mở dialog đăng bài:

```typescript
// Trong useEffect khi dialog mở
useEffect(() => {
  if (isDialogOpen) {
    // Pre-fetch session để sẵn sàng khi submit
    supabase.auth.getSession().then(({ data }) => {
      cachedSessionRef.current = data.session;
    });
  }
}, [isDialogOpen]);
```

### Fix 3: Fallback sử dụng token từ localStorage

Nếu API auth bị chậm, đọc trực tiếp từ localStorage như backup:

```typescript
const getSessionWithFallback = async () => {
  try {
    // Try normal API first with short timeout
    const result = await Promise.race([
      supabase.auth.getSession(),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
    ]);
    return result.data.session;
  } catch {
    // Fallback: read from localStorage directly
    const stored = localStorage.getItem('sb-xxsgapdiiuuajihsmjzt-auth-token');
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        access_token: parsed.access_token,
        user: parsed.user,
        // ...
      };
    }
    return null;
  }
};
```

### Fix 4: Cải thiện error handling và retry logic

```typescript
const handleSubmit = async () => {
  // Thử tối đa 3 lần với exponential backoff
  let session = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const { data } = await Promise.race([
        supabase.auth.getSession(),
        timeout(5000 * attempt) // 5s, 10s, 15s
      ]);
      session = data.session;
      if (session) break;
    } catch (e) {
      if (attempt === 3) throw e;
      await delay(1000 * attempt);
    }
  }
};
```

---

## Thay đổi files

### 1. `src/components/feed/FacebookCreatePost.tsx`

**Dòng 295-326** - Thay thế logic lấy session:

```typescript
// BEFORE: Gọi API mỗi lần submit
const { data: { session } } = await supabase.auth.getSession();

// AFTER: Dùng cached session + fallback
let session = cachedSessionRef.current;
if (!session) {
  // Try quick getSession first
  const quickResult = await Promise.race([
    supabase.auth.getSession(),
    new Promise((_, reject) => setTimeout(() => reject('timeout'), 3000))
  ]).catch(() => ({ data: { session: null } }));
  
  session = quickResult.data.session;
  
  // Fallback to localStorage
  if (!session) {
    const stored = localStorage.getItem('sb-xxsgapdiiuuajihsmjzt-auth-token');
    if (stored) {
      const parsed = JSON.parse(stored);
      session = { access_token: parsed.access_token, user: parsed.user };
    }
  }
}

if (!session?.access_token) {
  throw new Error('Chưa đăng nhập hoặc phiên hết hạn');
}
```

**Thêm useRef** để cache session:
```typescript
const cachedSessionRef = useRef<any>(null);

// Trong useEffect
useEffect(() => {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    cachedSessionRef.current = session;
  });
  return () => subscription.unsubscribe();
}, []);
```

### 2. Tăng timeout trong `r2Upload.ts` (nếu cần)

Hiện tại đã có timeout hợp lý (45s cho presigned URL, 180s cho upload), không cần thay đổi.

---

## Về Cloudflare R2

### Cách hoạt động:
```text
1. Frontend gọi Edge Function `get-upload-url` với auth token
2. Edge Function tạo presigned URL từ Cloudflare R2
3. Frontend upload trực tiếp lên R2 bằng presigned URL
4. URL công khai được trả về: https://media.fun.rich/posts/xxx.jpg
5. URL được lưu vào bảng `posts` qua Edge Function `create-post`
```

### Xác nhận: R2 KHÔNG phải nguyên nhân timeout
- Lỗi xảy ra ở bước **authentication** (step 1 trong flow đăng bài)
- Trong trường hợp này không có media (mediaCount: 0)
- R2 upload chỉ được gọi SAU khi có session hợp lệ

---

## Kế hoạch triển khai

| Bước | Nội dung | Ưu tiên |
|------|----------|---------|
| 1 | Thêm session caching vào FacebookCreatePost.tsx | Cao |
| 2 | Thêm localStorage fallback khi API chậm | Cao |
| 3 | Pre-fetch session khi mở dialog | Trung bình |
| 4 | Cải thiện retry logic với exponential backoff | Trung bình |
| 5 | Thêm loading indicator chi tiết cho user | Thấp |

---

## Tổng kết

- **Vấn đề**: Supabase Auth API đôi khi phản hồi rất chậm (49-119 giây)
- **Giải pháp**: Cache session + fallback localStorage + pre-fetch + retry logic
- **R2 không liên quan**: Lỗi xảy ra trước khi upload media
- **Files cần sửa**: `src/components/feed/FacebookCreatePost.tsx`
