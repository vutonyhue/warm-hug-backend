
## Chẩn đoán nhanh (vì sao bấm gọi video vẫn “chưa được”)

Hiện tại nút gọi **có chạy** nhưng bị fail ngay ở bước “thêm người tham gia cuộc gọi” do **quy tắc quyền truy cập database (RLS)**.

Bằng chứng từ console/network:
- Lỗi: `new row violates row-level security policy for table "video_call_participants"`
- Request `POST .../video_call_participants` trả về **403**

Nguyên nhân gốc:
- Policy hiện tại của `video_call_participants` chỉ cho phép **INSERT khi `auth.uid() = user_id`**.
- Nhưng khi tạo cuộc gọi, client đang **insert 2 dòng**: 1 dòng cho caller (đúng), 1 dòng cho callee (sai vì user_id != auth.uid()) → cả batch insert bị từ chối.

Về domain `media.fun.rich` trong console:
- Đây là do `index.html` đang có `preconnect` và `preload` trỏ vào `https://media.fun.rich/...` nên browser vẫn cố tải resource từ domain cũ và log cảnh báo.

---

## Mục tiêu cần làm
1) Cho phép **caller** tạo danh sách participants cho cuộc gọi (insert được row của người khác) nhưng vẫn an toàn: chỉ được thêm **những user thật sự thuộc conversation**.  
2) UI hiển thị lỗi rõ ràng (toast) thay vì “bấm không được”.  
3) Xóa hoàn toàn các tham chiếu runtime tới `media.fun.rich` (ít nhất ở `index.html`) để console không còn log domain cũ.  
4) Đảm bảo mọi thay đổi nằm trong `packages/chat` (như cha dặn) + cập nhật phần app host (index.html) nếu cần.

---

## Các thay đổi dự kiến

### A) Sửa quyền truy cập (RLS) cho `video_call_participants` (BẮT BUỘC)
**Cần một database migration** để thay policy INSERT hiện tại bằng 2 policy rõ ràng:

1. **Caller có quyền tạo participants** cho call mà họ vừa tạo  
   Điều kiện:
   - caller phải là người tạo call (`video_calls.caller_id = auth.uid()`)
   - caller là participant của conversation
   - user_id được thêm vào cũng phải là participant của conversation

2. (Tùy chọn) Giữ policy cho phép user tự insert “row của chính mình” (an toàn, không ảnh hưởng)

**SQL dự kiến (sẽ chạy qua tool migration):**
```sql
-- 1) Drop policy cũ gây lỗi
DROP POLICY IF EXISTS "Users can join calls they are invited to"
ON public.video_call_participants;

-- 2) Cho phép caller thêm participants (bao gồm cả người khác)
CREATE POLICY "Caller can add participants to their calls"
ON public.video_call_participants
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.video_calls vc
    WHERE vc.id = video_call_participants.call_id
      AND vc.caller_id = auth.uid()
      AND public.is_conversation_participant(vc.conversation_id, auth.uid())
      AND public.is_conversation_participant(vc.conversation_id, video_call_participants.user_id)
  )
);

-- 3) (Optional) user vẫn có thể insert row của chính mình nếu cần
CREATE POLICY "Users can insert own participant row"
ON public.video_call_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
```

Kỳ vọng sau bước này:
- `POST video_call_participants` sẽ trả 201 thay vì 403
- Cuộc gọi chuyển sang `ringing` và UI call modal/Incoming dialog hoạt động bình thường

---

### B) Cập nhật `packages/chat` để UX rõ ràng + rollback sạch
Hiện `startCall` nếu fail ở bước insert participants thì sẽ throw, nhưng **call record đã tạo** → có thể tạo nhiều call “pending” rác.

Sẽ cập nhật trong `packages/chat/src/hooks/useVideoCall.ts`:
1) Bọc đoạn insert participants trong `try/catch`.
2) Nếu insert participants fail:
   - update `video_calls` → `status = 'missed'`, set `ended_at`
   - (tùy chọn) hiển thị toast lỗi

Sẽ cập nhật trong `packages/chat/src/components/MessageThread.tsx`:
- Khi `handleStartVideoCall/handleStartAudioCall` catch error → `toast.error(...)` để user thấy “không tạo cuộc gọi được” (thay vì im lặng).

Lưu ý: package chat đã dùng `sonner` trong các chỗ khác nên dùng lại cùng pattern.

---

### C) Xóa domain `media.fun.rich` khỏi runtime (để console sạch)
Trong `index.html` hiện có:
- `<link rel="preconnect" href="https://media.fun.rich" ...>`
- `<link rel="preload" as="image" href="https://media.fun.rich/cdn-cgi/image/.../fun-profile-logo-40.webp" ...>`

Sẽ sửa:
1) **Xóa** preconnect/dns-prefetch tới `media.fun.rich`
2) Đổi preload LCP image sang **local asset** (đang có sẵn trong `public/`):
   - `href="/fun-profile-logo-40.webp"`  
   (hoặc nếu muốn preload bản tối ưu hóa qua domain mới thì chuyển sang domain mới; nhưng local là sạch nhất và đúng “logo standards” trong docs dự án)

Kết quả: browser không còn request tới `media.fun.rich`, console hết cảnh báo liên quan domain cũ.

---

## Trình tự triển khai
1) **Chạy database migration** để sửa RLS policy của `video_call_participants` (đây là blocker chính).
2) Update code trong **`packages/chat`**:
   - `useVideoCall.ts`: rollback nếu insert participants fail + log/toast phù hợp
   - `MessageThread.tsx`: toast khi gọi thất bại
3) Update `index.html` để remove `media.fun.rich` và preload bằng local logo.
4) Test end-to-end:
   - User A mở chat direct → bấm Video
   - Network phải thấy:
     - `POST video_calls` = 201
     - `POST video_call_participants` = 201 (không còn 403)
     - Call status update → `ringing`
     - `POST /functions/v1/agora-token` = 200
   - User B nhận Incoming dialog và Accept → call vào modal, có audio/video track

---

## Các file/tầng sẽ đụng tới
- Database migration (RLS policies) cho:
  - `public.video_call_participants`
- Code (package):
  - `packages/chat/src/hooks/useVideoCall.ts`
  - `packages/chat/src/components/MessageThread.tsx`
- App host:
  - `index.html` (xóa `media.fun.rich`)

---

## Rủi ro & lưu ý
- Đây là thay đổi về quyền (security). Policy mới vẫn chặt vì:
  - chỉ caller của call được thêm participants
  - chỉ thêm user nằm trong conversation
- Nếu sau khi sửa RLS vẫn không call được, bước tiếp theo sẽ là kiểm tra:
  - trạng thái `video_calls` có update được sang `ringing/active` không
  - backend function `agora-token` có trả token/appId ổn định không
  - quyền camera/mic và HTTPS

