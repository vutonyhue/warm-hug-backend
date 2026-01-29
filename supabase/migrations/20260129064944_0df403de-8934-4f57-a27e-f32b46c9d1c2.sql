-- =====================================================
-- PHASE 1: CRITICAL SECURITY FIXES
-- =====================================================

-- 1. Fix OAuth Client Secrets Exposure
-- Create a safe public view that hides the secret field
DROP VIEW IF EXISTS public.oauth_clients_public;
CREATE VIEW public.oauth_clients_public 
WITH (security_invoker = on) AS
SELECT id, name, redirect_uris, allowed_scopes, is_active, created_at
FROM public.oauth_clients
WHERE is_active = true;

-- Remove the dangerous policy that exposes secrets
DROP POLICY IF EXISTS "Anyone can view active oauth clients" ON public.oauth_clients;

-- Only service role and admins can access the main table
CREATE POLICY "Only admins can manage oauth_clients" ON public.oauth_clients
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 2. Fix Custodial Wallets - Hide encrypted private keys
-- The view user_custodial_wallets already exists and excludes encrypted_private_key
-- Just need to restrict the main table

DROP POLICY IF EXISTS "Users can view own wallet" ON public.custodial_wallets;
DROP POLICY IF EXISTS "Service role manages wallets" ON public.custodial_wallets;

-- Only service role can access main table (for wallet operations)
CREATE POLICY "Service role only access custodial_wallets" ON public.custodial_wallets
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 3. Create a safe public profiles view (hides financial data)
DROP VIEW IF EXISTS public.safe_public_profiles;
CREATE VIEW public.safe_public_profiles 
WITH (security_invoker = on) AS
SELECT 
  id, 
  username, 
  full_name, 
  avatar_url, 
  cover_url, 
  bio, 
  fun_id,
  soul_level,
  pinned_post_id,
  created_at
FROM public.profiles;

-- 4. Fix OAuth codes - restrict to service role only
DROP POLICY IF EXISTS "Service role manages oauth codes" ON public.oauth_codes;
CREATE POLICY "Service role only for oauth_codes" ON public.oauth_codes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 5. Fix OTP codes - restrict to service role only  
DROP POLICY IF EXISTS "Service role manages otp codes" ON public.otp_codes;
CREATE POLICY "Service role only for otp_codes" ON public.otp_codes
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 6. Secure pending_provisions
DROP POLICY IF EXISTS "Service role manages provisions" ON public.pending_provisions;
CREATE POLICY "Service role only for pending_provisions" ON public.pending_provisions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- 7. Secure cross_platform_tokens
DROP POLICY IF EXISTS "Service role manages tokens" ON public.cross_platform_tokens;
CREATE POLICY "Service role only for cross_platform_tokens" ON public.cross_platform_tokens
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can still view their own tokens
CREATE POLICY "Users view own tokens" ON public.cross_platform_tokens
  FOR SELECT USING (auth.uid() = user_id);

-- 8. Restrict notifications INSERT to prevent spam
DROP POLICY IF EXISTS "Authenticated users can create notifications" ON public.notifications;
CREATE POLICY "Service role can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Users can still create notifications for valid interactions (reactions, comments, friend requests)
CREATE POLICY "Users can create valid notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() = actor_id AND
    type IN ('reaction', 'comment', 'comment_reply', 'friend_request', 'friend_accept', 'mention', 'tag')
  );