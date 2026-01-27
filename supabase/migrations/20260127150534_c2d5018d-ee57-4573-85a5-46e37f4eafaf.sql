-- =============================================
-- PHASE 12: SEED DATA - OAUTH CLIENTS
-- =============================================

-- Insert OAuth clients for Fun Ecosystem
INSERT INTO public.oauth_clients (id, name, secret, redirect_uris, allowed_scopes, is_active)
VALUES 
  (
    'fun_farm_client',
    'Fun Farm',
    'fun_farm_secret_key_2024',
    ARRAY['https://farm.fun.rich/auth/callback', 'http://localhost:3000/auth/callback'],
    ARRAY['profile', 'email', 'farm_data', 'sync'],
    true
  ),
  (
    'fun_play_client',
    'Fun Play',
    'fun_play_secret_key_2024',
    ARRAY['https://play.fun.rich/auth/callback', 'http://localhost:3001/auth/callback'],
    ARRAY['profile', 'email', 'game_data', 'sync'],
    true
  ),
  (
    'fun_planet_client',
    'Fun Planet',
    'fun_planet_secret_key_2024',
    ARRAY['https://planet.fun.rich/auth/callback', 'http://localhost:3002/auth/callback'],
    ARRAY['profile', 'email', 'planet_data', 'sync'],
    true
  )
ON CONFLICT (id) DO NOTHING;

-- =============================================
-- CREATE VIEWS FOR PUBLIC ACCESS
-- =============================================

-- Public profiles view (excludes sensitive wallet data)
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker=on) AS
SELECT 
  id,
  username,
  full_name,
  avatar_url,
  cover_url,
  bio,
  fun_id,
  soul_level,
  created_at
FROM public.profiles
WHERE is_banned = false;

-- User custodial wallets view (excludes private key)
CREATE OR REPLACE VIEW public.user_custodial_wallets
WITH (security_invoker=on) AS
SELECT 
  id,
  user_id,
  address,
  created_at
FROM public.custodial_wallets;