
## Mục tiêu
Sửa lỗi “Không thể tạo cuộc trò chuyện mới” (403 / `new row violates row-level security policy for table "conversations"`) để:
- Tạo chat direct từ NewConversationDialog và từ luồng `/chat?user=...` hoạt động
- Tạo group chat cũng hoạt động (vì đang dùng cùng pattern `.insert(...).select().single()`)

---

## Chẩn đoán (vì sao vẫn lỗi dù INSERT policy đúng)
Hiện tại request tạo conversation đang gọi:
- `POST /rest/v1/conversations?select=*` + `Prefer: return=representation`
- Tức là **sau khi INSERT**, hệ thống sẽ cố **trả về row vừa tạo** (representation)

Nhưng RLS SELECT trên `public.conversations` hiện là:
- “Participants can view conversations” → `USING is_conversation_participant(id, auth.uid())`

Tại thời điểm vừa INSERT conversation:
- **Chưa có bản ghi nào trong `conversation_participants`** (vì step add participants chạy sau đó)
- Nên **SELECT bị chặn**, và PostgREST có thể trả về 403/42501 trong luồng “insert + return representation”
=> Dẫn tới frontend thấy lỗi ngay ở bước tạo conversation, dù `WITH CHECK (auth.uid() = created_by)` là đúng.

Điểm quan trọng: chính `?select=*` và `return=representation` khiến việc “không được SELECT row mới tạo” trở thành lỗi chặn.

---

## Giải pháp đề xuất (ưu tiên đơn giản, an toàn, ít sửa code)
### A) Backend (database): Cho phép creator được SELECT conversation của chính mình
Thêm **một SELECT policy** mới trên `public.conversations`:
- Cho phép `created_by = auth.uid()` đọc conversation
- Như vậy “insert + return representation” sẽ trả được row vừa tạo, không còn 403

Đồng thời (khuyến nghị) sửa luôn policy update admin đang sai join để tránh lỗi về sau.

#### Migration SQL (sẽ chạy bằng “Modify database”)
1) **Thêm policy SELECT cho creator**
```sql
CREATE POLICY "Creators can view conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());
```

2) **(Khuyến nghị) Fix policy UPDATE admin đang sai**
Policy hiện tại đang có điều kiện sai:
`conversation_participants.conversation_id = conversation_participants.id` (join nhầm cột)

Sửa thành:
```sql
DROP POLICY IF EXISTS "Admins can update conversations" ON public.conversations;

CREATE POLICY "Admins can update conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
      AND cp.role = 'admin'
      AND cp.left_at IS NULL
  )
);
```

3) **(Tuỳ chọn – tăng độ bền) Set default + NOT NULL cho created_by**
Vì hiện `created_by` đang nullable. Để giảm rủi ro client quên set:
- Hiện DB chưa có dữ liệu conversation (total=0), nên có thể đặt NOT NULL an toàn ở môi trường test.
```sql
ALTER TABLE public.conversations
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.conversations
  ALTER COLUMN created_by SET NOT NULL;
```
Nếu muốn cực kỳ thận trọng cho production (live) về sau, khi publish sẽ kiểm tra xem có rows `created_by IS NULL` không (hiện đang 0 ở test).

---

## B) Frontend: Không bắt buộc, nhưng có “phương án dự phòng” nếu muốn khóa chặt quyền SELECT
Nếu bạn muốn giữ nguyên nguyên tắc “chỉ participant mới thấy conversation” (không thêm policy creator SELECT), ta có thể đổi code:
- Khi tạo conversation: **không gọi `.select().single()`** (tránh cần SELECT ngay lúc insert)
- Tự tạo `id` ở client (`crypto.randomUUID()`), insert với `id` đó
- Sau khi insert participants xong thì navigate theo `id` (không cần row trả về)

Nhược điểm: sửa code nhiều hơn (cả direct + group). Ưu điểm: không cần mở thêm SELECT policy cho creator.

Trong lần fix này, ưu tiên A (database) vì nhanh, ít đụng code, và phù hợp logic “creator luôn được xem conversation mình tạo”.

---

## Kế hoạch triển khai (thứ tự)
1) Chạy migration DB:
   - Add policy “Creators can view conversations”
   - Fix policy “Admins can update conversations” (khuyến nghị)
   - Tuỳ chọn: set default + NOT NULL cho `created_by`
2) Test end-to-end:
   - Tạo direct chat từ NewConversationDialog
   - Tạo direct chat từ `/chat?user=<id>`
   - Tạo group chat
3) Nếu vẫn lỗi:
   - Bật “phương án dự phòng” ở frontend (client-generated id, bỏ `.select().single()` khi insert conversation)

---

## Tiêu chí hoàn thành
- Không còn 403/42501 khi tạo conversation
- Sau khi tạo: tự navigate vào `/chat/:conversationId`
- Conversation hiển thị trong list sau khi participants insert xong
- Group chat tạo được và mở được thread bình thường
