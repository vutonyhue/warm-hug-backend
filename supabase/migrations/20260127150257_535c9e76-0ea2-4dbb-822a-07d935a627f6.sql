-- =============================================
-- PHASE 9: TRIGGERS & FUNCTIONS
-- =============================================

-- Function: Handle new user (create profile + role)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'username', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Create default user role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');
  
  RETURN NEW;
END;
$$;

-- Trigger: Create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Function: Generate FUN-ID
CREATE OR REPLACE FUNCTION public.generate_fun_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_id TEXT;
  random_suffix TEXT;
  new_fun_id TEXT;
BEGIN
  IF NEW.username IS NOT NULL AND NEW.fun_id IS NULL THEN
    base_id := UPPER(LEFT(NEW.username, 6));
    random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
    new_fun_id := 'FUN-' || base_id || '-' || random_suffix;
    
    -- Ensure uniqueness
    WHILE EXISTS (SELECT 1 FROM public.profiles WHERE fun_id = new_fun_id) LOOP
      random_suffix := LPAD(FLOOR(RANDOM() * 10000)::TEXT, 4, '0');
      new_fun_id := 'FUN-' || base_id || '-' || random_suffix;
    END LOOP;
    
    NEW.fun_id := new_fun_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger: Generate FUN-ID
CREATE TRIGGER trigger_generate_fun_id
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.generate_fun_id();

-- Function: Update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Apply updated_at triggers
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_posts_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_messages_updated_at
  BEFORE UPDATE ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_friendships_updated_at
  BEFORE UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Function: Update conversation last message
CREATE OR REPLACE FUNCTION public.update_conversation_last_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    last_message_at = NEW.created_at,
    last_message_preview = LEFT(NEW.content, 100)
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Trigger: Update last message on new message
CREATE TRIGGER on_message_insert
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_conversation_last_message();

-- Function: Get app stats
CREATE OR REPLACE FUNCTION public.get_app_stats()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'pending_rewards', (SELECT COUNT(*) FROM public.profiles WHERE reward_status = 'pending' AND pending_reward > 0),
    'approved_rewards', (SELECT COUNT(*) FROM public.profiles WHERE reward_status = 'approved'),
    'on_chain_claims', (SELECT COUNT(*) FROM public.reward_claims WHERE status = 'completed'),
    'banned_users', (SELECT COUNT(*) FROM public.profiles WHERE is_banned = true),
    'suspicious_users', (SELECT COUNT(*) FROM public.profiles WHERE is_restricted = true)
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Function: Get user rewards with calculations
CREATE OR REPLACE FUNCTION public.get_user_rewards_v2(limit_count INTEGER DEFAULT 100)
RETURNS TABLE (
  id UUID,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  is_banned BOOLEAN,
  is_restricted BOOLEAN,
  claimable BIGINT,
  status TEXT,
  admin_notes TEXT,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.username,
    p.full_name,
    p.avatar_url,
    p.is_banned,
    p.is_restricted,
    COALESCE(p.pending_reward, 0) AS claimable,
    COALESCE(p.reward_status, 'pending') AS status,
    (SELECT notes FROM public.reward_approvals WHERE user_id = p.id ORDER BY created_at DESC LIMIT 1) AS admin_notes,
    p.created_at
  FROM public.profiles p
  WHERE p.pending_reward > 0 OR p.reward_status != 'pending'
  ORDER BY p.pending_reward DESC NULLS LAST
  LIMIT limit_count;
END;
$$;

-- Function: Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  rate_key TEXT,
  max_count INTEGER,
  window_ms BIGINT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_state RECORD;
  window_start TIMESTAMPTZ;
BEGIN
  window_start := now() - (window_ms || ' milliseconds')::INTERVAL;
  
  SELECT * INTO current_state
  FROM public.rate_limit_state
  WHERE key = rate_key;
  
  IF NOT FOUND THEN
    INSERT INTO public.rate_limit_state (key, count, window_start)
    VALUES (rate_key, 1, now());
    RETURN TRUE;
  END IF;
  
  IF current_state.window_start < window_start THEN
    UPDATE public.rate_limit_state
    SET count = 1, window_start = now()
    WHERE key = rate_key;
    RETURN TRUE;
  END IF;
  
  IF current_state.count >= max_count THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.rate_limit_state
  SET count = count + 1
  WHERE key = rate_key;
  
  RETURN TRUE;
END;
$$;

-- Function: Ban user permanently
CREATE OR REPLACE FUNCTION public.ban_user_permanently(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.profiles
  SET is_banned = TRUE, is_restricted = TRUE
  WHERE id = target_user_id;
  
  RETURN TRUE;
END;
$$;

-- Function: Recalculate user financial totals
CREATE OR REPLACE FUNCTION public.recalculate_user_financial(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  totals RECORD;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE 0 END), 0) AS total_deposit,
    COALESCE(SUM(CASE WHEN type = 'withdraw' THEN amount ELSE 0 END), 0) AS total_withdraw,
    COALESCE(SUM(CASE WHEN type = 'bet' THEN amount ELSE 0 END), 0) AS total_bet,
    COALESCE(SUM(CASE WHEN type = 'win' THEN amount ELSE 0 END), 0) AS total_win,
    COALESCE(SUM(CASE WHEN type = 'loss' THEN amount ELSE 0 END), 0) AS total_loss
  INTO totals
  FROM public.financial_transactions
  WHERE user_id = target_user_id;
  
  UPDATE public.profiles
  SET
    grand_total_deposit = totals.total_deposit,
    grand_total_withdraw = totals.total_withdraw,
    grand_total_bet = totals.total_bet,
    grand_total_win = totals.total_win,
    grand_total_loss = totals.total_loss,
    grand_total_profit = totals.total_win - totals.total_loss
  WHERE id = target_user_id;
END;
$$;

-- Function: Run financial reconciliation
CREATE OR REPLACE FUNCTION public.run_financial_reconciliation()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result JSON;
  discrepancy_count INTEGER := 0;
BEGIN
  -- This is a placeholder - actual reconciliation logic would be more complex
  SELECT json_build_object(
    'status', 'completed',
    'checked_at', now(),
    'discrepancies_found', discrepancy_count
  ) INTO result;
  
  -- Log the reconciliation
  INSERT INTO public.reconciliation_logs (type, status, discrepancy)
  VALUES ('scheduled', 'completed', result);
  
  RETURN result;
END;
$$;

-- =============================================
-- PHASE 10: STORAGE BUCKETS
-- =============================================

-- Create storage buckets
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('posts', 'posts', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('avatars', 'avatars', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']),
  ('videos', 'videos', true, 104857600, ARRAY['video/mp4', 'video/webm', 'video/quicktime']),
  ('comment-media', 'comment-media', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4']);

-- Storage policies for posts bucket
CREATE POLICY "Anyone can view post images"
ON storage.objects FOR SELECT
USING (bucket_id = 'posts');

CREATE POLICY "Authenticated users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own post images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own post images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'posts' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for avatars bucket
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own avatars"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own avatars"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for videos bucket
CREATE POLICY "Anyone can view videos"
ON storage.objects FOR SELECT
USING (bucket_id = 'videos');

CREATE POLICY "Authenticated users can upload videos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own videos"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own videos"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Storage policies for comment-media bucket
CREATE POLICY "Anyone can view comment media"
ON storage.objects FOR SELECT
USING (bucket_id = 'comment-media');

CREATE POLICY "Authenticated users can upload comment media"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'comment-media' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete own comment media"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'comment-media' AND auth.uid()::text = (storage.foldername(name))[1]);

-- =============================================
-- PHASE 11: REALTIME
-- =============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.comments;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reads;
ALTER PUBLICATION supabase_realtime ADD TABLE public.message_reactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;