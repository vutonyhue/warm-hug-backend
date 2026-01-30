import { supabase } from '@/integrations/supabase/client';
import type { Session } from '@supabase/supabase-js';

/**
 * Kiểm tra session có hết hạn hoặc sắp hết hạn không
 * @param session - Supabase session object
 * @param bufferSeconds - Số giây buffer trước khi coi là "sắp hết hạn" (mặc định 60s)
 */
export function isSessionExpired(session: Session | null, bufferSeconds = 60): boolean {
  if (!session?.expires_at) return true;
  
  const expiresAt = session.expires_at * 1000; // Convert to milliseconds
  const now = Date.now();
  const bufferMs = bufferSeconds * 1000;
  
  return now >= (expiresAt - bufferMs);
}

/**
 * Lấy valid session, tự động refresh nếu expired hoặc sắp expired
 * @returns Fresh session hoặc null nếu không thể lấy
 */
export async function getValidSession(): Promise<Session | null> {
  // Lấy session hiện tại
  const { data: { session } } = await supabase.auth.getSession();
  
  // Nếu không có session
  if (!session) return null;
  
  // Nếu session còn hạn (> 60s), trả về luôn
  if (!isSessionExpired(session, 60)) {
    return session;
  }
  
  // Session sắp hết hạn hoặc đã hết, refresh
  console.log('[Auth] Session expired or expiring soon, refreshing...');
  const { data: { session: newSession }, error } = await supabase.auth.refreshSession();
  
  if (error) {
    console.error('[Auth] Failed to refresh session:', error.message);
    return null;
  }
  
  return newSession;
}
