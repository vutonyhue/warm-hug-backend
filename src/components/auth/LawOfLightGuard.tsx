import { useEffect, useState } from 'react';
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

  useEffect(() => {
    const checkLawOfLightAcceptance = async () => {
      // Skip check for public pages
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
          // Already accepted Law of Light → allow access to /auth
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
        // Not accepted yet → redirect to Law of Light
        navigate('/law-of-light', { replace: true });
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      // Guest mode: Allow unauthenticated users to view feed
      // They can browse but not interact (handled in components)
      if (!session) {
        // For root/feed path, allow guest access
        if (location.pathname === '/' || location.pathname === '/feed') {
          setIsAllowed(true);
          setIsChecking(false);
          return;
        }
        // For other protected routes, redirect to law-of-light
        navigate('/law-of-light', { replace: true });
        return;
      }

      // Check if user has accepted the Law of Light
      const { data: profile } = await supabase
        .from('profiles')
        .select('law_of_light_accepted')
        .eq('id', session.user.id)
        .single();

      if (profile && !profile.law_of_light_accepted) {
        // User hasn't accepted, redirect to Law of Light page
        navigate('/law-of-light', { replace: true });
        return;
      }

      setIsAllowed(true);
      setIsChecking(false);
    };

    checkLawOfLightAcceptance();

    // Also listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Check when user signs in
        setTimeout(() => {
          checkLawOfLightAcceptance();
        }, 0);
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