
# Kế hoạch: Sửa lỗi "Unauthorized" khi đăng bài

## Nguyên nhân

Token JWT đã hết hạn nhưng frontend vẫn sử dụng token cũ từ cache. Logs xác nhận:
- Lỗi: `token has invalid claims: token is expired`
- Request thất bại lúc 02:34:53Z  
- Token được refresh thành công lúc 02:37:07Z (sau khi đã lỗi)

## Giải pháp

### Bước 1: Tạo utility function kiểm tra token expiry

Tạo helper function để kiểm tra session còn hạn hay không trước khi sử dụng.

**File**: `src/utils/authHelpers.ts` (tạo mới)

```typescript
// Kiểm tra token có hết hạn hay không (buffer 60s)
export function isSessionExpired(session: any, bufferSeconds = 60): boolean

// Lấy fresh session, tự động refresh nếu cần
export async function getValidSession(): Promise<Session | null>
```

### Bước 2: Cập nhật FacebookCreatePost.tsx

Thay đổi logic lấy session trong `handleSubmit()`:

**Trước (có bug)**:
- Dùng cached session không kiểm tra expiry
- Fallback không đủ mạnh

**Sau (đã fix)**:
- Kiểm tra `expires_at` của cached session
- Nếu sắp hết hạn (< 60s), force refresh ngay
- Cập nhật cache sau khi refresh thành công

### Bước 3: Cập nhật r2Upload.ts với retry logic

Thêm retry mechanism cho trường hợp token bị expired giữa chừng:

```typescript
// Nếu gặp 401 Unauthorized, thử refresh token và retry 1 lần
if (response.status === 401) {
  const newSession = await supabase.auth.refreshSession();
  // Retry với token mới
}
```

### Bước 4: Cải thiện cachedSessionRef listener

Trong `useEffect` subscribe auth state, thêm logic invalidate cache khi token sắp hết hạn.

## Chi tiết kỹ thuật

### File 1: `src/utils/authHelpers.ts` (tạo mới)

```typescript
import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Kiểm tra session có hết hạn hoặc sắp hết hạn không
 * @param session - Supabase session object
 * @param bufferSeconds - Số giây buffer trước khi coi là "sắp hết hạn" (mặc định 60s)
 */
export function isSessionExpired(session: Session | null, bufferSeconds = 60): boolean {
  if (!session?.expires_at) return true;
  
  const expiresAt = session.expires_at * 1000; // Convert to milliseconds
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;
  
  return now >= (expiresAt - bufferMs);
}

/**
 * Lấy valid session, tự động refresh nếu expired hoặc sắp expired
 * @returns Fresh session hoặc null nếu không thể lấy
 */
export async function getValidSession(): Promise<Session | null> {
  // Lấy session hiện tại
  const { data: { session } } = await supabase.auth.getSession();
  
  // Nếu không có session
  if (!session) return null;
  
  // Nếu session còn hạn (> 60s), trả về luôn
  if (!isSessionExpired(session, 60)) {
    return session;
  }
  
  // Session sắp hết hạn hoặc đã hết, refresh
  console.log('[Auth] Session expired or expiring soon, refreshing...');
  const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('[Auth] Failed to refresh session:', error.message);
    return null;
  }
  
  return newSession;
}
```

### File 2: `src/components/feed/FacebookCreatePost.tsx`

Cập nhật phần lấy session (khoảng lines 309-378):

```typescript
// === OPTIMIZED SESSION RETRIEVAL WITH EXPIRY CHECK ===
import { isSessionExpired, getValidSession } from '@/utils/authHelpers';

// Trong handleSubmit():
let session = cachedSessionRef.current;

// CHECK EXPIRY trước khi dùng cached session
if (session && isSessionExpired(session, 60)) {
  console.log('[CreatePost] Cached session expired, invalidating...');
  session = null;
  cachedSessionRef.current = null;
}

if (session) {
  console.log('[CreatePost] Using valid cached session');
} else {
  // Get fresh valid session (auto-refresh if needed)
  session = await getValidSession();
  if (session) {
    cachedSessionRef.current = session;
  }
}
```

### File 3: `src/utils/r2Upload.ts`

Thêm retry logic khi gặp 401:

```typescript
async function getPresignedUrl(
  key: string,
  contentType: string,
  fileSize: number,
  accessToken?: string,
  timeoutMs: number = 30000,
  retryCount = 0 // Thêm retry counter
): Promise<{ uploadUrl: string; publicUrl: string }> {
  // ... existing code ...
  
  if (!response.ok) {
    // Nếu 401 và chưa retry, thử refresh và retry
    if (response.status === 401 && retryCount === 0) {
      console.log('[R2Upload] Token expired, refreshing and retrying...');
      const { data: { session } } = await supabase.auth.refreshSession();
      if (session) {
        return getPresignedUrl(key, contentType, fileSize, session.access_token, timeoutMs, 1);
      }
    }
    // ... existing error handling ...
  }
}
```

## Tóm tắt thay đổi

| File | Thay đổi |
|------|----------|
| `src/utils/authHelpers.ts` | Tạo mới - utilities kiểm tra và refresh session |
| `src/components/feed/FacebookCreatePost.tsx` | Thêm kiểm tra expiry cho cached session |
| `src/utils/r2Upload.ts` | Thêm retry logic khi gặp 401 |

## Kết quả mong đợi

- Không còn lỗi "Unauthorized" khi đăng bài
- Token được refresh tự động trước khi hết hạn
- Nếu vẫn gặp 401, tự động retry sau khi refresh
- Video và ảnh upload hoạt động bình thường
