import { useEffect, useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

interface LawOfLightGuardProps {
  children: React.ReactNode;
}

export const LawOfLightGuard = ({ children }: LawOfLightGuardProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);
  const cachedSession = useRef<{ userId: string; accepted: boolean } | null>(null);

  useEffect(() => {
    const checkLawOfLightAcceptance = async () => {
      // Skip check for public pages - instant allow
      const publicPaths = ['/law-of-light', '/docs'];
      const isPublicPath = publicPaths.some(path => location.pathname.startsWith(path));
      
      if (isPublicPath) {
        setIsAllowed(true);
        setIsChecking(false);
        return;
      }

      // Special handling for /auth - require Law of Light acceptance first
      if (location.pathname.startsWith('/auth')) {
        const pending = localStorage.getItem('law_of_light_accepted_pending');
        if (pending === 'true') {
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      // Use cached result if available (prevents duplicate API calls)
      if (cachedSession.current) {
        if (cachedSession.current.accepted) {
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
      }

      // Try localStorage first for quick check (no network)
      try {
        const storedSession = localStorage.getItem(`sb-xxsgapdiiuuajihsmjzt-auth-token`);
        if (!storedSession) {
          // No session - allow guest access for feed, redirect others
          if (location.pathname === '/' || location.pathname === '/feed') {
            setIsAllowed(true);
            setIsChecking(false);
            return;
          }
          navigate('/law-of-light', { replace: true });
          return;
        }
      } catch {
        // Ignore localStorage errors
      }

      // Get session with timeout for faster response
      const sessionPromise = supabase.auth.getSession();
      const timeoutPromise = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
      
      const result = await Promise.race([sessionPromise, timeoutPromise]);
      
      // Handle timeout - allow guest access for feed
      if (!result) {
        if (location.pathname === '/' || location.pathname === '/feed') {
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      const session = result.data?.session;
      
      // Guest mode: Allow unauthenticated users to view feed
      if (!session) {
        if (location.pathname === '/' || location.pathname === '/feed') {
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
        navigate('/law-of-light', { replace: true });
        return;
      }

      // Check if user has accepted the Law of Light
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_of_light_accepted')
        .eq('id', session.user.id)
        .single();

      // Cache the result
      cachedSession.current = {
        userId: session.user.id,
        accepted: profile?.law_of_light_accepted ?? false
      };

      if (profile && !profile.law_of_light_accepted) {
        navigate('/law-of-light', { replace: true });
        return;
      }

      setIsAllowed(true);
      setIsChecking(false);
    };

    checkLawOfLightAcceptance();

    // Listen for auth state changes - reset cache on sign in/out
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        cachedSession.current = null; // Reset cache on new sign in
        setTimeout(() => {
          checkLawOfLightAcceptance();
        }, 0);
      } else if (event === 'SIGNED_OUT') {
        cachedSession.current = null;
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, location.pathname]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Đang kiểm tra...</p>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    return null;
  }

  return <>{children}</>;
};