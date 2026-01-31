-- Thêm RLS policy cho phép conversation creator thêm participants
-- Điều này cần thiết để tạo direct/group conversation vì creator cần thêm người khác vào

CREATE POLICY "Creators can add participants"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (
  -- Cho phép nếu user là creator của conversation này
  EXISTS (
    SELECT 1 FROM public.conversations 
    WHERE id = conversation_id 
    AND created_by = auth.uid()
  )
);