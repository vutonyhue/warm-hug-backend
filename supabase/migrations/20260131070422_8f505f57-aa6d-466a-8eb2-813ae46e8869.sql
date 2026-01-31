-- Create video_calls table for call history
CREATE TABLE public.video_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  caller_id UUID NOT NULL,
  call_type TEXT NOT NULL DEFAULT 'video' CHECK (call_type IN ('video', 'audio')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'ringing', 'active', 'ended', 'missed', 'rejected')),
  channel_name TEXT NOT NULL,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create video_call_participants table for group calls
CREATE TABLE public.video_call_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id UUID REFERENCES public.video_calls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ,
  left_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'joined', 'left', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_calls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_call_participants ENABLE ROW LEVEL SECURITY;

-- RLS policies for video_calls
CREATE POLICY "Participants can view calls in their conversations"
ON public.video_calls FOR SELECT
USING (is_conversation_participant(conversation_id, auth.uid()));

CREATE POLICY "Users can create calls in their conversations"
ON public.video_calls FOR INSERT
WITH CHECK (
  auth.uid() = caller_id 
  AND is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Caller can update their calls"
ON public.video_calls FOR UPDATE
USING (auth.uid() = caller_id);

CREATE POLICY "Participants can update call status"
ON public.video_calls FOR UPDATE
USING (is_conversation_participant(conversation_id, auth.uid()));

-- RLS policies for video_call_participants
CREATE POLICY "Participants can view call participants"
ON public.video_call_participants FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.video_calls vc
    WHERE vc.id = call_id
    AND is_conversation_participant(vc.conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can join calls they are invited to"
ON public.video_call_participants FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own participant status"
ON public.video_call_participants FOR UPDATE
USING (auth.uid() = user_id);

-- Enable realtime for video calls
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_calls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_call_participants;

-- Create indexes for performance
CREATE INDEX idx_video_calls_conversation ON public.video_calls(conversation_id);
CREATE INDEX idx_video_calls_caller ON public.video_calls(caller_id);
CREATE INDEX idx_video_calls_status ON public.video_calls(status);
CREATE INDEX idx_video_call_participants_call ON public.video_call_participants(call_id);
CREATE INDEX idx_video_call_participants_user ON public.video_call_participants(user_id);