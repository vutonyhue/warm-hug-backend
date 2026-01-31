

# Kế hoạch: Sửa lỗi Video Call không hoạt động

## Phân tích nguyên nhân

Sau khi debug, tôi đã xác định được các vấn đề:

### 1. URL Edge Function không đúng
Trong `packages/chat/src/hooks/useVideoCall.ts`, dòng 104:
```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/agora-token`,
  ...
);
```

**Vấn đề**: Khi package chat được sử dụng như một library, `import.meta.env.VITE_SUPABASE_URL` có thể trả về `undefined` hoặc empty string. Điều này khiến request được gửi đến sai URL.

### 2. Không có error handling hiển thị cho người dùng
Khi lấy token thất bại, cuộc gọi bị "treo" ở trạng thái `pending` mà người dùng không biết lỗi gì.

### 3. Database records xác nhận issue
Query database cho thấy nhiều cuộc gọi được tạo với status `pending` nhưng không bao giờ chuyển sang `ringing` vì bước lấy token thất bại.

---

## Giải pháp

### Thay đổi 1: Lấy Supabase URL từ client thay vì env

**File**: `packages/chat/src/hooks/useVideoCall.ts`

Thay vì:
```typescript
const response = await fetch(
  `${import.meta.env.VITE_SUPABASE_URL || ''}/functions/v1/agora-token`,
  ...
);
```

Đổi thành lấy URL từ supabase client:
```typescript
// Lấy URL từ supabase client
const supabaseUrl = (supabase as any).supabaseUrl 
  || (supabase as any).restUrl?.replace('/rest/v1', '') 
  || import.meta.env.VITE_SUPABASE_URL;

const response = await fetch(
  `${supabaseUrl}/functions/v1/agora-token`,
  ...
);
```

### Thay đổi 2: Thêm error handling và toast thông báo

Khi gọi video thất bại, hiển thị thông báo lỗi cho người dùng thay vì fail silently.

### Thay đổi 3: Rollback cuộc gọi khi lấy token thất bại

Nếu không lấy được Agora token, cập nhật cuộc gọi về trạng thái `missed` thay vì để ở `pending`.

---

## Chi tiết kỹ thuật

### File cần sửa

| File | Thay đổi |
|------|----------|
| `packages/chat/src/hooks/useVideoCall.ts` | Sửa logic lấy URL và thêm error handling |
| `packages/chat/src/components/MessageThread.tsx` | Thêm toast notification khi gọi thất bại |

### Thay đổi trong useVideoCall.ts

```typescript
// Fetch Agora token - CẬP NHẬT
const fetchAgoraToken = useCallback(async (channelName: string) => {
  if (config.getAgoraToken) {
    // Use custom function from config
    const uid = Math.floor(Math.random() * 100000);
    const token = await config.getAgoraToken(channelName, uid);
    return { token, uid, appId: config.agoraAppId };
  }

  // Use default edge function
  const { data: session } = await supabase.auth.getSession();
  if (!session?.session?.access_token) throw new Error('Not authenticated');

  // Lấy URL từ supabase client thay vì env
  const supabaseUrl = 
    (supabase as any).supabaseUrl || 
    (supabase as any).restUrl?.replace('/rest/v1', '') ||
    import.meta.env.VITE_SUPABASE_URL ||
    '';
    
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/agora-token`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.session.access_token}`,
      },
      body: JSON.stringify({ channelName }),
    }
  );

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.error || `Failed to get Agora token: ${response.status}`);
  }

  const data = await response.json();
  return { token: data.token, uid: data.uid, appId: data.appId };
}, [config, supabase]);

// startCall mutation - THÊM ERROR HANDLING
const startCall = useMutation({
  mutationFn: async ({ callType, participantIds }: StartCallParams) => {
    // ... existing code tạo record ...
    
    try {
      const tokenData = await fetchAgoraToken(channelName);
      // ... rest of success flow
    } catch (tokenError) {
      // Rollback: đánh dấu cuộc gọi là missed vì không kết nối được
      await supabase
        .from('video_calls')
        .update({ 
          status: 'missed',
          ended_at: new Date().toISOString(),
        })
        .eq('id', call.id);
      
      throw tokenError; // Re-throw để mutation.onError bắt được
    }
  },
  onError: (error) => {
    console.error('[useVideoCall] Start call failed:', error);
    // Error sẽ được propagate lên component để hiển thị toast
  },
});
```

### Thay đổi trong MessageThread.tsx

```typescript
// Video call handlers - THÊM ERROR HANDLING
const handleStartVideoCall = async () => {
  if (participantIds.length > 0) {
    try {
      await startCall.mutateAsync({ callType: 'video', participantIds });
    } catch (error) {
      console.error('[MessageThread] Video call failed:', error);
      // Toast sẽ được hiển thị bởi ChatProvider hoặc local toast
    }
  }
};
```

---

## Kiểm tra sau khi sửa

1. Mở console log khi bấm nút gọi video
2. Xác nhận request được gửi đến đúng URL: `https://xxsgapdiiuuajihsmjzt.supabase.co/functions/v1/agora-token`
3. Xác nhận Edge Function trả về token và appId
4. Xác nhận VideoCallModal hiển thị

---

## Luồng hoạt động sau khi sửa

```
1. User click nút Video Call
2. Tạo record video_calls (status: pending)
3. Lấy Supabase URL từ client
4. Gọi Edge Function agora-token
5. Nếu thành công:
   ├── Set agoraToken, agoraUid, agoraAppId
   ├── Set activeCall
   ├── Update status -> ringing
   └── Hiển thị VideoCallModal
6. Nếu thất bại:
   ├── Update status -> missed
   ├── Hiển thị toast lỗi
   └── Clear state
```

