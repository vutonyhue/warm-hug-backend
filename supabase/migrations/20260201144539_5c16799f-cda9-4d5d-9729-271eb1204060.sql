-- Fix ambiguous column reference 'created_at' in get_user_rewards_v2
-- Add table alias 'ra' to reward_approvals subquery and qualify all column references

CREATE OR REPLACE FUNCTION public.get_user_rewards_v2(limit_count integer DEFAULT 100)
RETURNS TABLE(
  id uuid, 
  username text, 
  full_name text, 
  avatar_url text, 
  is_banned boolean, 
  is_restricted boolean, 
  claimable bigint, 
  status text, 
  admin_notes text, 
  created_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    (SELECT notes FROM public.reward_approvals ra 
     WHERE ra.user_id = p.id 
     ORDER BY ra.created_at DESC 
     LIMIT 1) AS admin_notes,
    p.created_at
  FROM public.profiles p
  WHERE p.pending_reward > 0 OR p.reward_status != 'pending'
  ORDER BY p.pending_reward DESC NULLS LAST
  LIMIT limit_count;
END;
$function$;