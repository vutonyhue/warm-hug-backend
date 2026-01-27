import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { InlineSearch } from './InlineSearch';
import { NotificationDropdown } from './NotificationDropdown';
import { useLanguage } from '@/i18n/LanguageContext';
import { useIsMobileOrTablet } from '@/hooks/use-mobile';
import {
  Home,
  Users,
  MessageCircle,
  Menu,
  Wallet,
  User,
  LogOut,
  Globe,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from '@/components/ui/sheet';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { FacebookLeftSidebar } from '@/components/feed/FacebookLeftSidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
// Use direct paths for logos to ensure consistency across all environments

export const FacebookNavbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { t, language, setLanguage } = useLanguage();
  const isMobileOrTablet = useIsMobileOrTablet();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [profile, setProfile] = useState<{ avatar_url: string | null; username: string } | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsLoggedIn(true);
        setCurrentUserId(session.user.id);
        // Fetch profile
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setIsLoggedIn(!!session);
      if (session) {
        setCurrentUserId(session.user.id);
        const { data } = await supabase
          .from('profiles')
          .select('avatar_url, username')
          .eq('id', session.user.id)
          .single();
        if (data) setProfile(data);
      } else {
        setProfile(null);
        setCurrentUserId(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const isActive = (path: string) => location.pathname === path;

  // Language options with country flag images (using flagcdn.com for consistent display)
  const languageOptions = [
    { code: 'vi' as const, name: 'Tiếng Việt', flagUrl: 'https://flagcdn.com/w40/vn.png' },
    { code: 'en' as const, name: 'English', flagUrl: 'https://flagcdn.com/w40/us.png' },
    { code: 'zh' as const, name: '中文', flagUrl: 'https://flagcdn.com/w40/cn.png' },
    { code: 'ja' as const, name: '日本語', flagUrl: 'https://flagcdn.com/w40/jp.png' },
    { code: 'ko' as const, name: '한국어', flagUrl: 'https://flagcdn.com/w40/kr.png' },
    { code: 'th' as const, name: 'ไทย', flagUrl: 'https://flagcdn.com/w40/th.png' },
    { code: 'id' as const, name: 'Indonesia', flagUrl: 'https://flagcdn.com/w40/id.png' },
    { code: 'fr' as const, name: 'Français', flagUrl: 'https://flagcdn.com/w40/fr.png' },
    { code: 'es' as const, name: 'Español', flagUrl: 'https://flagcdn.com/w40/es.png' },
    { code: 'de' as const, name: 'Deutsch', flagUrl: 'https://flagcdn.com/w40/de.png' },
    { code: 'pt' as const, name: 'Português', flagUrl: 'https://flagcdn.com/w40/br.png' },
    { code: 'ru' as const, name: 'Русский', flagUrl: 'https://flagcdn.com/w40/ru.png' },
    { code: 'ar' as const, name: 'العربية', flagUrl: 'https://flagcdn.com/w40/sa.png' },
  ];

  // Navigation items for center nav (Desktop only)
  const iconNavItems = [
    { icon: Home, path: '/', label: t('home') },
    { icon: Users, path: '/friends', label: t('friends') },
    { icon: MessageCircle, path: '/chat', label: 'Chat' },
    // Bell (Notification) is handled separately with NotificationDropdown component
    { icon: Wallet, path: '/wallet', label: 'Wallet' },
  ];

  return (
    <header className="fixed top-0 left-0 right-0 z-50 fb-header h-12 md:h-14 safe-area-top">
      <div className="h-full max-w-screen-2xl mx-auto px-2 sm:px-4 flex items-center justify-between">
        {/* Left Section - Menu Button & Logo & Search */}
        <div className="flex items-center gap-2 flex-shrink-0 md:w-[280px]">
          {/* Menu Button - Left of Logo (Mobile/Tablet only) */}
          {isMobileOrTablet && (
            <Sheet open={isSidebarOpen} onOpenChange={setIsSidebarOpen}>
              <SheetTrigger asChild>
                <button 
                  className="fun-icon-btn flex-shrink-0"
                  aria-label="Menu"
                >
                  <Menu className="w-5 h-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[300px] p-4 overflow-y-auto">
                <FacebookLeftSidebar onItemClick={() => setIsSidebarOpen(false)} />
              </SheetContent>
            </Sheet>
          )}

          {/* Logo - use direct path for consistency across all environments */}
          <img
            src="/fun-profile-logo-40.webp"
            alt="FUN Profile"
            width={36}
            height={36}
            className="w-9 h-9 md:w-10 md:h-10 rounded-full cursor-pointer flex-shrink-0"
            onClick={() => navigate('/')}
            loading="eager"
          />
          <div className="hidden sm:block">
            <InlineSearch />
          </div>
        </div>

        {/* Center Section - Navigation (Desktop only, hidden on tablet) */}
        <nav className="hidden lg:flex items-center justify-center flex-1 max-w-[600px] h-full gap-1">
          {/* Icon Navigation Items (Home, Friends, Chat, Wallet) */}
          <TooltipProvider delayDuration={200}>
            {iconNavItems.map((item) => (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate(item.path)}
                    aria-label={item.label}
                    className={`flex-1 h-full max-w-[100px] flex items-center justify-center relative transition-all duration-300 rounded-full border-[0.5px] group ${
                      isActive(item.path)
                        ? 'text-primary-foreground bg-primary border-[#C9A84C]'
                        : 'text-foreground hover:text-primary hover:bg-primary/10 border-transparent hover:border-[#C9A84C]/50'
                    }`}
                  >
                    <item.icon className={`w-6 h-6 transition-all duration-300 ${
                      isActive(item.path) 
                        ? '' 
                        : 'group-hover:drop-shadow-[0_0_6px_hsl(142_76%_36%/0.5)]'
                    }`} />
                    {isActive(item.path) && (
                      <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary via-gold to-primary rounded-t-full" />
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="bg-card text-card-foreground border border-border">
                  <p>{item.label}</p>
                </TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </nav>

        {/* Right Section - Actions */}
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0 md:w-[280px] justify-end">
          {/* Search button for mobile */}
          <div className="sm:hidden">
            <InlineSearch />
          </div>

          {/* Mobile/Tablet: Wallet icon */}
          {isMobileOrTablet && (
            <button 
              className="fun-icon-btn-gold group" 
              aria-label="Wallet"
              onClick={() => navigate('/wallet')}
            >
              <Wallet className="w-5 h-5 text-gold drop-shadow-[0_0_6px_hsl(48_96%_53%/0.5)] group-hover:drop-shadow-[0_0_12px_hsl(48_96%_53%/0.8)] transition-all duration-300" />
            </button>
          )}

          {/* Notification for mobile/tablet */}
          {isMobileOrTablet && <NotificationDropdown />}

          {/* Desktop only: Notification Bell + Avatar with Dropdown */}
          {!isMobileOrTablet && isLoggedIn && (
            <div className="flex items-center gap-3">
              <NotificationDropdown />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex-shrink-0" aria-label="Profile Menu">
                    <Avatar className="w-9 h-9 border-2 border-gold/30 hover:border-gold transition-colors cursor-pointer">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64 bg-card border border-border shadow-lg z-50">
                  {/* Go to Profile - with user avatar and name */}
                  <DropdownMenuItem 
                    onClick={() => navigate(`/profile/${currentUserId}`)}
                    className="cursor-pointer gap-3 p-3"
                  >
                    <Avatar className="w-10 h-10 border-2 border-gold/30">
                      <AvatarImage src={profile?.avatar_url || ''} />
                      <AvatarFallback className="bg-primary/20 text-primary text-sm">
                        {profile?.username?.[0]?.toUpperCase() || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-semibold text-foreground">{profile?.username || 'User'}</span>
                  </DropdownMenuItem>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Language Switcher - Collapsible */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="flex items-center justify-between w-full px-2 py-2 text-sm hover:bg-accent rounded-md transition-colors">
                        <div className="flex items-center gap-2">
                          <Globe className="w-4 h-4" />
                          <span>{t('language')}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <img 
                            src={languageOptions.find(l => l.code === language)?.flagUrl} 
                            alt={language}
                            className="w-5 h-4 object-cover rounded-sm"
                          />
                          <span className="text-xs text-muted-foreground">{language.toUpperCase()}</span>
                        </div>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="left" align="start" className="min-w-[200px]">
                      <div className="grid grid-cols-2 gap-1 p-2">
                        {languageOptions.map((lang) => (
                          <button
                            key={lang.code}
                            onClick={() => setLanguage(lang.code)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                              language === lang.code
                                ? 'bg-primary/10 text-primary font-medium'
                                : 'hover:bg-accent text-foreground'
                            }`}
                          >
                            <img 
                              src={lang.flagUrl} 
                              alt={lang.name}
                              className="w-5 h-4 object-cover rounded-sm"
                            />
                            <span>{lang.name}</span>
                          </button>
                        ))}
                      </div>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  
                  <DropdownMenuSeparator />
                  
                  {/* Logout */}
                  <DropdownMenuItem 
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate('/auth');
                    }}
                    className="cursor-pointer gap-2 text-destructive focus:text-destructive"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('signOut')}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Sign In Button - Only show when not logged in */}
          {!isLoggedIn && (
            <Button
              onClick={() => navigate('/auth')}
              className="bg-primary text-primary-foreground hover:bg-primary-hover"
            >
              {t('signIn')}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
