-- Fix RLS policies for video_call_participants to allow caller to add all participants

-- 1) Drop old policy that causes the 403 error (if exists)
DROP POLICY IF EXISTS "Users can join calls they are invited to"
ON public.video_call_participants;

-- 2) Allow caller to add participants to their calls (including other users)
-- This is secure because:
-- - Only the caller of the call can add participants
-- - Both caller and added user must be participants of the conversation
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

-- 3) Keep policy for users to insert their own participant row (for accepting calls)
CREATE POLICY "Users can insert own participant row"
ON public.video_call_participants
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);