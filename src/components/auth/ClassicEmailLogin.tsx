import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { z } from 'zod';
import { Eye, EyeOff, Loader2, KeyRound } from 'lucide-react';
import { useLanguage } from '@/i18n/LanguageContext';
import { supabase } from '@/integrations/supabase/client';
interface ClassicEmailLoginProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}
export const ClassicEmailLogin = ({
  onSuccess
}: ClassicEmailLoginProps) => {
  const {
    t
  } = useLanguage();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const getAuthSchema = () => z.object({
    email: z.string().email(t('authErrorInvalidEmail')),
    password: z.string().min(6, t('authErrorPasswordShort')),
    username: z.string().min(3, t('authErrorUsernameShort')).max(30, t('authErrorUsernameLong')).refine(val => !['admin', 'administrator', 'system', 'root', 'moderator', 'mod', 'support', 'help'].includes(val.toLowerCase()), {
      message: t('authErrorUsernameReserved')
    }).optional()
  });
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const authSchema = getAuthSchema();
      const validation = authSchema.safeParse({
        email,
        password,
        username: isLogin ? undefined : username
      });
      if (!validation.success) {
        toast.error(validation.error.errors[0].message);
        setLoading(false);
        return;
      }
      if (isLogin) {
        const {
          data,
          error
        } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        if (data.user) {
          // Update last_login_platform
          await supabase.from('profiles').update({
            last_login_platform: 'FUN Profile'
          }).eq('id', data.user.id);
          toast.success(t('welcomeBack'));
          onSuccess(data.user.id, false);
        }
      } else {
        const {
          data,
          error
        } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              username
            },
            emailRedirectTo: `${window.location.origin}/`
          }
        });
        if (error) throw error;
        if (data.user) {
          // Update last_login_platform for new user
          setTimeout(async () => {
            await supabase.from('profiles').update({
              last_login_platform: 'FUN Profile'
            }).eq('id', data.user!.id);
          }, 1000);
          toast.success(t('authSuccessSignUp'));
          onSuccess(data.user.id, true);
        }
      }
    } catch (error: any) {
      toast.error(error.message || t('authErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };
  const handleForgotPassword = async () => {
    if (!email) {
      toast.error(t('authErrorInvalidEmail'));
      return;
    }
    setLoading(true);
    try {
      const {
        error
      } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth`
      });
      if (error) throw error;
      toast.success(t('authSuccessPasswordReset'));
      setShowForgotPassword(false);
    } catch (error: any) {
      toast.error(error.message || t('authErrorGeneric'));
    } finally {
      setLoading(false);
    }
  };
  return <div className="space-y-5">
      <div className="text-center space-y-2">
        
        <h3 className="text-lg font-bold text-slate-800">
          {isLogin ? t('authWelcomeBack') : t('authCreateAccount')}
        </h3>
        <p className="text-sm text-slate-500">
          {isLogin ? t('authSignInTitle') : t('authJoinUs')}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {!isLogin && <div className="space-y-2">
            <Label htmlFor="classic-username" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
              {t('authUsername')}
            </Label>
            <Input id="classic-username" type="text" value={username} onChange={e => setUsername(e.target.value)} required={!isLogin} placeholder={t('authUsernamePlaceholder')} className="h-12 rounded-full border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all" />
          </div>}
        
        <div className="space-y-2">
          <Label htmlFor="classic-email" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
            {t('authEmail')}
          </Label>
          <Input id="classic-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder={t('authEmailPlaceholder')} className="h-12 rounded-full border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all" />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="classic-password" className="text-slate-700 font-semibold text-sm uppercase tracking-wide">
            {t('authPassword')}
          </Label>
          <div className="relative">
            <Input id="classic-password" type={showPassword ? "text" : "password"} value={password} onChange={e => setPassword(e.target.value)} required placeholder={t('authPasswordPlaceholder')} className="h-12 rounded-full pr-10 border-2 border-slate-300 bg-gradient-to-br from-white to-slate-50 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-400/30 transition-all" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-emerald-500 transition-colors">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        
        <Button type="submit" className="w-full h-14 text-lg font-bold rounded-full relative overflow-hidden text-white" disabled={loading} style={{
        background: 'linear-gradient(135deg, #166534 0%, #15803d 50%, #166534 100%)',
        boxShadow: '0 4px 20px rgba(22, 101, 52, 0.4)'
      }}>
          <span className="relative z-10 flex items-center justify-center gap-2">
            {loading ? <>
                <Loader2 className="animate-spin" size={20} />
                {t('authInitializing')}
              </> : isLogin ? t('authSignIn') : t('authSignUp')}
          </span>
        </Button>
      </form>
      
      <div className="space-y-3">
        {isLogin && <div className="text-center text-sm">
            <button type="button" onClick={() => setShowForgotPassword(!showForgotPassword)} className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors">
              {t('authForgotPassword')}
            </button>
          </div>}
        
        {showForgotPassword && <div className="space-y-2">
            <Input type="email" placeholder={t('authEmailPlaceholder')} value={email} onChange={e => setEmail(e.target.value)} className="border-2 border-slate-400 bg-white/80 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-400/50" />
            <Button onClick={handleForgotPassword} className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700" disabled={loading}>
              {t('authSendResetEmail')}
            </Button>
          </div>}
        
        <div className="text-center text-sm">
          <button type="button" onClick={() => {
          setIsLogin(!isLogin);
          setShowForgotPassword(false);
        }} className="text-emerald-600 hover:text-emerald-700 font-semibold hover:underline transition-colors">
            {isLogin ? t('authNoAccount') : t('authHaveAccount')}{' '}
            <span className="font-bold">{isLogin ? t('authSignUpLink') : t('authSignInLink')}</span>
          </button>
        </div>
      </div>
    </div>;
};