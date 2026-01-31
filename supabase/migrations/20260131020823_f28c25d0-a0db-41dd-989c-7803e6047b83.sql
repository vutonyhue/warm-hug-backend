-- 1) Thêm policy SELECT cho creator (cho phép insert + return representation hoạt động)
CREATE POLICY "Creators can view conversations"
ON public.conversations
FOR SELECT
TO authenticated
USING (created_by = auth.uid());

-- 2) Fix policy UPDATE admin đang có điều kiện join sai
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

-- 3) Set default + NOT NULL cho created_by để tăng độ bền
ALTER TABLE public.conversations
  ALTER COLUMN created_by SET DEFAULT auth.uid();

ALTER TABLE public.conversations
  ALTER COLUMN created_by SET NOT NULL;