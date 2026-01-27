-- =============================================
-- PHASE 1: ENUMS
-- =============================================
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- =============================================
-- PHASE 2: CORE TABLES
-- =============================================

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  cover_url TEXT,
  bio TEXT,
  fun_id TEXT UNIQUE,
  wallet_address TEXT,
  external_wallet_address TEXT,
  custodial_wallet_address TEXT,
  default_wallet_type TEXT DEFAULT 'custodial',
  is_banned BOOLEAN DEFAULT FALSE,
  is_restricted BOOLEAN DEFAULT FALSE,
  reward_status TEXT DEFAULT 'pending',
  pending_reward BIGINT DEFAULT 0,
  approved_reward BIGINT DEFAULT 0,
  law_of_light_accepted BOOLEAN DEFAULT FALSE,
  pinned_post_id UUID,
  soul_level INTEGER DEFAULT 1,
  total_rewards BIGINT DEFAULT 0,
  registered_from TEXT,
  oauth_provider TEXT,
  grand_total_deposit BIGINT DEFAULT 0,
  grand_total_withdraw BIGINT DEFAULT 0,
  grand_total_bet BIGINT DEFAULT 0,
  grand_total_win BIGINT DEFAULT 0,
  grand_total_loss BIGINT DEFAULT 0,
  grand_total_profit BIGINT DEFAULT 0,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- User roles table (separate from profiles for security)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Posts table
CREATE TABLE public.posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  image_url TEXT,
  video_url TEXT,
  media_urls JSONB DEFAULT '[]'::jsonb,
  location TEXT,
  feeling TEXT,
  activity TEXT,
  privacy TEXT DEFAULT 'public',
  original_post_id UUID,
  share_content TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Comments table (supports nested replies)
CREATE TABLE public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Reactions table
CREATE TABLE public.reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reaction_type TEXT NOT NULL DEFAULT 'like',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, user_id)
);

-- Shared posts table
CREATE TABLE public.shared_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  original_post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  content TEXT,
  privacy TEXT DEFAULT 'public',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Post tags table
CREATE TABLE public.post_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  tagged_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, tagged_user_id)
);

-- =============================================
-- PHASE 3: SOCIAL FEATURES
-- =============================================

-- Friendships table
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  addressee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(requester_id, addressee_id)
);

-- Notifications table
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,
  title TEXT,
  message TEXT,
  data JSONB DEFAULT '{}'::jsonb,
  read BOOLEAN DEFAULT FALSE,
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================
-- Add foreign key for pinned_post_id after posts table exists
-- =============================================
ALTER TABLE public.profiles 
ADD CONSTRAINT fk_pinned_post 
FOREIGN KEY (pinned_post_id) REFERENCES public.posts(id) ON DELETE SET NULL;

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX idx_profiles_username ON public.profiles(username);
CREATE INDEX idx_profiles_fun_id ON public.profiles(fun_id);
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_reactions_post_id ON public.reactions(post_id);
CREATE INDEX idx_reactions_user_id ON public.reactions(user_id);
CREATE INDEX idx_friendships_requester ON public.friendships(requester_id);
CREATE INDEX idx_friendships_addressee ON public.friendships(addressee_id);
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_read ON public.notifications(user_id, read);

-- =============================================
-- ENABLE RLS
-- =============================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;