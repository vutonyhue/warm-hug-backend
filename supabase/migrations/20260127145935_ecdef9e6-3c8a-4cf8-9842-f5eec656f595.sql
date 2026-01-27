-- =============================================
-- PHASE 7: SECURITY DEFINER FUNCTIONS
-- =============================================

-- Function to check user role (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to check if user is conversation participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conversation_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants
    WHERE conversation_id = _conversation_id
      AND user_id = _user_id
      AND left_at IS NULL
  )
$$;

-- =============================================
-- PHASE 8: RLS POLICIES - PROFILES
-- =============================================

-- Profiles: Anyone can read
CREATE POLICY "Profiles are viewable by everyone"
ON public.profiles FOR SELECT
USING (true);

-- Profiles: Users can insert their own
CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Profiles: Users can update their own
CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = id);

-- =============================================
-- USER ROLES POLICIES
-- =============================================
CREATE POLICY "Users can view own roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- =============================================
-- POSTS POLICIES
-- =============================================
CREATE POLICY "Posts are viewable by everyone"
ON public.posts FOR SELECT
USING (privacy = 'public' OR auth.uid() = user_id);

CREATE POLICY "Users can create own posts"
ON public.posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts"
ON public.posts FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own posts"
ON public.posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- COMMENTS POLICIES
-- =============================================
CREATE POLICY "Comments are viewable by everyone"
ON public.comments FOR SELECT
USING (true);

CREATE POLICY "Users can create comments"
ON public.comments FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comments"
ON public.comments FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments"
ON public.comments FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- REACTIONS POLICIES
-- =============================================
CREATE POLICY "Reactions are viewable by everyone"
ON public.reactions FOR SELECT
USING (true);

CREATE POLICY "Users can create reactions"
ON public.reactions FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reactions"
ON public.reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- SHARED POSTS POLICIES
-- =============================================
CREATE POLICY "Shared posts are viewable by everyone"
ON public.shared_posts FOR SELECT
USING (true);

CREATE POLICY "Users can share posts"
ON public.shared_posts FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own shares"
ON public.shared_posts FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- POST TAGS POLICIES
-- =============================================
CREATE POLICY "Post tags are viewable by everyone"
ON public.post_tags FOR SELECT
USING (true);

CREATE POLICY "Post authors can manage tags"
ON public.post_tags FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.posts 
    WHERE id = post_tags.post_id AND user_id = auth.uid()
  )
);

-- =============================================
-- FRIENDSHIPS POLICIES
-- =============================================
CREATE POLICY "Users can view own friendships"
ON public.friendships FOR SELECT
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can send friend requests"
ON public.friendships FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Users can update own friendships"
ON public.friendships FOR UPDATE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

CREATE POLICY "Users can delete own friendships"
ON public.friendships FOR DELETE
TO authenticated
USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- =============================================
-- NOTIFICATIONS POLICIES
-- =============================================
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "System can create notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- =============================================
-- CHAT POLICIES
-- =============================================

-- Conversations
CREATE POLICY "Participants can view conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(id, auth.uid())
);

CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can update conversations"
ON public.conversations FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = id 
    AND user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- Conversation participants
CREATE POLICY "Participants can view members"
ON public.conversation_participants FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can join conversations"
ON public.conversation_participants FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave conversations"
ON public.conversation_participants FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Messages
CREATE POLICY "Participants can view messages"
ON public.messages FOR SELECT
TO authenticated
USING (
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Participants can send messages"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id AND
  public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Users can update own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
TO authenticated
USING (auth.uid() = sender_id);

-- Message reads
CREATE POLICY "Participants can view reads"
ON public.message_reads FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
    AND public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can mark as read"
ON public.message_reads FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Message reactions
CREATE POLICY "Participants can view reactions"
ON public.message_reactions FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
    AND public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "Participants can add reactions"
ON public.message_reactions FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM public.messages m
    WHERE m.id = message_id
    AND public.is_conversation_participant(m.conversation_id, auth.uid())
  )
);

CREATE POLICY "Users can remove own reactions"
ON public.message_reactions FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Chat settings
CREATE POLICY "Users can view own chat settings"
ON public.chat_settings FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own chat settings"
ON public.chat_settings FOR ALL
TO authenticated
USING (auth.uid() = user_id);