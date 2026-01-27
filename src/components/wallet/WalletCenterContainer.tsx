import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowDown, ArrowUp, RefreshCw, ShoppingCart, Copy, Check, Gift, ArrowUpRight, ArrowDownLeft, Repeat, Wallet, LogOut, UserRoundCog, Info, AlertTriangle, Shield } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { toast } from 'sonner';
import { ReceiveTab } from './ReceiveTab';
import { SendTab } from './SendTab';
import { useTokenBalances } from '@/hooks/useTokenBalances';
import { formatRelativeTime } from '@/lib/formatters';
import metamaskLogo from '@/assets/metamask-logo.png';
import bnbLogo from '@/assets/tokens/bnb-logo.webp';

interface Profile {
  username: string;
  avatar_url: string | null;
  full_name: string | null;
  reward_status?: string;
  admin_notes?: string | null;
}

interface WalletProfile {
  external_wallet_address: string | null;
  custodial_wallet_address: string | null;
  default_wallet_type: 'custodial' | 'external' | null;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  amount: string;
  token_symbol: string;
  created_at: string;
}

// Key to track if user explicitly disconnected - stored in localStorage for persistence
const WALLET_DISCONNECTED_KEY = 'fun_profile_wallet_disconnected';

const WalletCenterContainer = () => {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [walletProfile, setWalletProfile] = useState<WalletProfile | null>(null);
  const [activeWalletType, setActiveWalletType] = useState<'external' | 'custodial'>('custodial');
  const [copied, setCopied] = useState(false);
  const [claimableReward, setClaimableReward] = useState(0);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [showReceive, setShowReceive] = useState(false);
  const [showSend, setShowSend] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  
  // Track if we should show disconnected UI (user explicitly disconnected)
  const [showDisconnectedUI, setShowDisconnectedUI] = useState(() => {
    return localStorage.getItem(WALLET_DISCONNECTED_KEY) === 'true';
  });

  // Compute the active wallet address based on wallet type
  const activeWalletAddress = useMemo(() => {
    if (activeWalletType === 'external') {
      // For external wallet, prioritize connected MetaMask address
      return address || (walletProfile?.external_wallet_address as `0x${string}` | null);
    }
    return walletProfile?.custodial_wallet_address as `0x${string}` | null;
  }, [activeWalletType, address, walletProfile]);

  // Check if user has both wallet types
  const hasBothWallets = useMemo(() => {
    return !!(walletProfile?.external_wallet_address && walletProfile?.custodial_wallet_address);
  }, [walletProfile]);

  // Check if user has any wallet
  const hasAnyWallet = useMemo(() => {
    return !!(walletProfile?.external_wallet_address || walletProfile?.custodial_wallet_address || isConnected);
  }, [walletProfile, isConnected]);

  // Use token balances with the active wallet address
  const { tokens, totalUsdValue, isLoading: isTokensLoading, refetch: refetchTokens } = useTokenBalances({
    customAddress: activeWalletAddress as `0x${string}` | undefined,
  });

  // Get CAMLY price from tokens for claimable calculation (uses real-time CoinGecko price)
  const camlyPrice = useMemo(() => {
    const camlyToken = tokens.find(t => t.symbol === 'CAMLY');
    return camlyToken?.price || 0;
  }, [tokens]);

  // CRITICAL: On mount, if user explicitly disconnected before, disconnect wagmi too
  useEffect(() => {
    const wasDisconnected = localStorage.getItem(WALLET_DISCONNECTED_KEY) === 'true';
    if (wasDisconnected && showDisconnectedUI && isConnected) {
      disconnect();
    }
  }, [isConnected, disconnect, showDisconnectedUI]);

  // Whenever wallet becomes connected, ensure we don't keep the "explicitly disconnected" flag
  useEffect(() => {
    if (isConnected) {
      localStorage.removeItem(WALLET_DISCONNECTED_KEY);
      setShowDisconnectedUI(false);
    }
  }, [isConnected]);

  // Check and switch to BNB Chain if wrong network
  useEffect(() => {
    if (isConnected && chainId && chainId !== bsc.id) {
      switchChain(
        { chainId: bsc.id },
        {
          onSuccess: () => toast.success('Đã chuyển sang BNB Smart Chain'),
          onError: () => {
            toast.error('Vui lòng chuyển sang BNB Smart Chain', {
              action: {
                label: 'Switch Network',
                onClick: () => handleSwitchNetwork(),
              },
            });
          },
        }
      );
    }
  }, [isConnected, chainId]);

  useEffect(() => {
    fetchProfile();
    fetchWalletProfile();
    fetchClaimableReward();
    fetchTransactions();
  }, []);

  // Refetch tokens when active wallet address changes
  useEffect(() => {
    if (activeWalletAddress) {
      refetchTokens();
    }
  }, [activeWalletAddress, refetchTokens]);

  // Refetch data when wallet connects
  useEffect(() => {
    if (isConnected) {
      fetchProfile();
      fetchWalletProfile();
      fetchClaimableReward();
      fetchTransactions();
    }
  }, [isConnected, address]);

  const fetchProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('username, avatar_url, full_name, reward_status, admin_notes')
        .eq('id', session.user.id)
        .single();
      if (data) setProfile(data);
    }
  };

  const fetchWalletProfile = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) {
      const { data } = await supabase
        .from('profiles')
        .select('external_wallet_address, custodial_wallet_address, default_wallet_type')
        .eq('id', session.user.id)
        .single();
      
      if (data) {
        setWalletProfile(data as WalletProfile);
        // Set active wallet type based on default or available wallets
        if (data.default_wallet_type) {
          setActiveWalletType(data.default_wallet_type as 'external' | 'custodial');
        } else if (data.custodial_wallet_address) {
          setActiveWalletType('custodial');
        } else if (data.external_wallet_address) {
          setActiveWalletType('external');
        }
      }
    }
  };

  const fetchClaimableReward = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const userId = session.user.id;
    
    // Fetch user's posts
    const { data: postsData } = await supabase
      .from('posts')
      .select('id')
      .eq('user_id', userId);
    
    const postsCount = postsData?.length || 0;
    const postIds = postsData?.map(p => p.id) || [];
    
    // Fetch reactions ON user's posts
    let reactionsOnPosts = 0;
    if (postIds.length > 0) {
      const { count } = await supabase
        .from('reactions')
        .select('id', { count: 'exact', head: true })
        .in('post_id', postIds);
      reactionsOnPosts = count || 0;
    }
    
    // Fetch comments ON user's posts
    let commentsOnPosts = 0;
    if (postIds.length > 0) {
      const { count } = await supabase
        .from('comments')
        .select('id', { count: 'exact', head: true })
        .in('post_id', postIds);
      commentsOnPosts = count || 0;
    }
    
    // Fetch shares of user's posts
    let sharesCount = 0;
    if (postIds.length > 0) {
      const { count } = await supabase
        .from('shared_posts')
        .select('id', { count: 'exact', head: true })
        .in('original_post_id', postIds);
      sharesCount = count || 0;
    }
    
    // Fetch friends count
    const { count: friendsCount } = await supabase
      .from('friendships')
      .select('id', { count: 'exact', head: true })
      .or(`user_id.eq.${userId},friend_id.eq.${userId}`)
      .eq('status', 'accepted');
    
    // Calculate total reward
    const postsReward = postsCount * 20000;
    let reactionsReward = 0;
    if (reactionsOnPosts >= 3) {
      reactionsReward = 30000 + (reactionsOnPosts - 3) * 1000;
    }
    const commentsReward = commentsOnPosts * 5000;
    const sharesReward = sharesCount * 5000;
    const friendsReward = (friendsCount || 0) * 10000 + 10000;
    
    const totalReward = postsReward + reactionsReward + commentsReward + sharesReward + friendsReward;

    // Fetch claimed amount
    const { data: claims } = await supabase
      .from('reward_claims')
      .select('amount')
      .eq('user_id', userId);

    const claimedAmount = claims?.reduce((sum, c) => sum + c.amount, 0) || 0;
    setClaimableReward(totalReward - claimedAmount);
  };

  const fetchTransactions = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;

    const { data } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(5);

    if (data) {
      const currentAddress = activeWalletAddress?.toLowerCase();
      setTransactions(data.map(tx => ({
        id: tx.id,
        type: tx.from_address.toLowerCase() === currentAddress ? 'sent' : 'received',
        description: tx.from_address.toLowerCase() === currentAddress 
          ? `Sent ${tx.amount} ${tx.token_symbol} to ${tx.to_address.slice(0, 6)}...${tx.to_address.slice(-4)}`
          : `Received ${tx.amount} ${tx.token_symbol}`,
        amount: tx.amount,
        token_symbol: tx.token_symbol,
        created_at: tx.created_at,
      })));
    }
  };

  const handleConnect = useCallback(async () => {
    setConnectionError(null);
    setIsConnecting(true);
    setShowDisconnectedUI(false);
    localStorage.removeItem(WALLET_DISCONNECTED_KEY);

    if (typeof window === 'undefined' || !window.ethereum) {
      setIsConnecting(false);
      toast.error('Vui lòng cài đặt MetaMask để tiếp tục');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    try {
      await window.ethereum.request({ method: 'eth_requestAccounts' });

      const metamaskConnector =
        connectors.find((c) => c.name === 'MetaMask') ||
        connectors.find((c) => c.id === 'metaMask') ||
        connectors.find((c) => c.id === 'injected') ||
        connectors[0];

      if (!metamaskConnector) {
        setIsConnecting(false);
        setConnectionError('Không tìm thấy ví để kết nối');
        toast.error('Không tìm thấy ví để kết nối');
        return;
      }

      connect(
        { connector: metamaskConnector },
        {
          onSuccess: () => {
            setIsConnecting(false);
            setConnectionError(null);
            setActiveWalletType('external');
            toast.success('Kết nối ví thành công!');
          },
          onError: async (err) => {
            try {
              const accounts = await window.ethereum?.request?.({ method: 'eth_accounts' });
              if (Array.isArray(accounts) && accounts.length > 0) {
                setIsConnecting(false);
                setConnectionError(null);
                setActiveWalletType('external');
                toast.success('Kết nối ví thành công!');
                return;
              }
            } catch {
              // ignore
            }

            setIsConnecting(false);
            setConnectionError('Không thể đồng bộ kết nối ví. Vui lòng thử lại.');
            toast.error('Không thể kết nối ví');
            console.error('Wagmi connect error:', err);
          },
        }
      );
    } catch (error: any) {
      setIsConnecting(false);
      const errorMsg = error?.message || '';
      const errorCode = error?.code;

      if (errorCode === 4001 || errorMsg.includes('User rejected') || errorMsg.includes('rejected')) {
        setConnectionError('Bạn đã từ chối kết nối ví');
        toast.error('Bạn đã từ chối kết nối ví');
      } else if (errorCode === -32002 || errorMsg.includes('already pending')) {
        setConnectionError('Đang có yêu cầu kết nối. Vui lòng mở MetaMask và xác nhận.');
        toast.info('Vui lòng mở MetaMask và xác nhận kết nối', { duration: 5000 });
      } else {
        setConnectionError('Không thể kết nối ví. Vui lòng thử lại.');
        toast.error('Không thể kết nối ví');
        console.error('Connect error:', error);
      }
    }
  }, [connectors, connect]);

  const handleSwitchAccount = useCallback(async () => {
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }],
        });
        toast.success('Đã chuyển tài khoản thành công!');
        refetchTokens();
        fetchTransactions();
      } else {
        toast.error('MetaMask không khả dụng');
      }
    } catch (error: any) {
      if (error?.code === 4001) {
        toast.error('Bạn đã hủy chuyển tài khoản');
      } else {
        toast.error('Không thể chuyển tài khoản');
      }
    }
  }, [refetchTokens]);

  const handleDisconnect = () => {
    localStorage.setItem(WALLET_DISCONNECTED_KEY, 'true');
    setShowDisconnectedUI(true);
    setTransactions([]);
    setClaimableReward(0);
    disconnect();
    // Switch to custodial if available
    if (walletProfile?.custodial_wallet_address) {
      setActiveWalletType('custodial');
    }
    toast.success('Đã ngắt kết nối ví');
  };

  const handleSwitchNetwork = () => {
    switchChain(
      { chainId: bsc.id },
      {
        onSuccess: () => toast.success('Đã chuyển sang BNB Smart Chain'),
        onError: () => toast.error('Không thể chuyển network. Vui lòng thử lại.'),
      }
    );
  };

  const copyAddress = () => {
    if (activeWalletAddress) {
      navigator.clipboard.writeText(activeWalletAddress);
      setCopied(true);
      toast.success('Đã copy địa chỉ ví');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const shortenedAddress = activeWalletAddress ? `${activeWalletAddress.slice(0, 6)}...${activeWalletAddress.slice(-4)}` : '0x0000...0000';

  const formatNumber = (num: number, decimals: number = 0) => {
    const fixed = num.toFixed(decimals);
    const [integerPart, decimalPart] = fixed.split('.');
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    if (decimals > 0 && decimalPart) {
      return `${formattedInteger},${decimalPart}`;
    }
    return formattedInteger;
  };

  const formatUsd = (num: number) => {
    return `$${formatNumber(num, 2)}`;
  };

  const formatTokenBalance = (num: number, symbol: string) => {
    if (num > 0 && num < 0.000001) {
      return formatNumber(num, 8);
    }
    if (num > 0 && num < 0.01) {
      return formatNumber(num, 6);
    }
    if (Number.isInteger(num) || Math.abs(num - Math.round(num)) < 0.0001) {
      return formatNumber(Math.round(num), 0);
    }
    return formatNumber(num, 4);
  };

  const getTransactionIcon = (type: string) => {
    switch (type) {
      case 'sent': return <ArrowUpRight className="w-5 h-5 text-red-500" />;
      case 'received': return <ArrowDownLeft className="w-5 h-5 text-green-500" />;
      case 'claimed': return <Gift className="w-5 h-5 text-yellow-500" />;
      case 'swapped': return <Repeat className="w-5 h-5 text-purple-500" />;
      default: return <ArrowUpRight className="w-5 h-5 text-gray-500" />;
    }
  };

  // Wallet Type Switcher Component
  const WalletTypeSwitcher = () => {
    if (!hasBothWallets) return null;

    return (
      <div className="flex items-center gap-1 bg-gray-100 rounded-full p-1">
        <Button
          variant={activeWalletType === 'external' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveWalletType('external')}
          className={`rounded-full text-xs px-3 ${
            activeWalletType === 'external' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-gray-200'
          }`}
        >
          <img src={metamaskLogo} alt="MetaMask" className="w-4 h-4 mr-1" />
          MetaMask
        </Button>
        <Button
          variant={activeWalletType === 'custodial' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveWalletType('custodial')}
          className={`rounded-full text-xs px-3 ${
            activeWalletType === 'custodial' 
              ? 'bg-primary text-primary-foreground' 
              : 'hover:bg-gray-200'
          }`}
        >
          <Shield className="w-4 h-4 mr-1" />
          F.U. Wallet
        </Button>
      </div>
    );
  };

  // No wallet state - Show Connect/Create Wallet options
  if (!hasAnyWallet && !isConnected && showDisconnectedUI) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-800 via-emerald-600 to-green-500 p-6">
            <div className="flex items-center justify-between mb-4">
              <h1 className="text-2xl font-bold text-yellow-400 drop-shadow-lg" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}>
                My Wallet
              </h1>
              <div className="flex items-center gap-2 bg-yellow-400/20 backdrop-blur-sm px-3 py-1.5 rounded-full border border-yellow-400/30">
                <img src={bnbLogo} alt="BNB" className="w-5 h-5" />
                <span className="text-sm font-medium text-white">BNB Smart Chain</span>
              </div>
            </div>
          </div>
        </div>

        {/* Connect Wallet Card */}
        <div className="bg-white rounded-2xl shadow-lg p-12 text-center">
          <div className="w-24 h-24 bg-gradient-to-br from-emerald-500 to-green-400 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-green-500/30">
            <Wallet className="w-12 h-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Kết nối ví để tiếp tục</h2>
          <p className="text-muted-foreground mb-8 max-w-md mx-auto">
            Vui lòng kết nối MetaMask để xem tài sản và thực hiện giao dịch trên BNB Smart Chain
          </p>
          
          {connectionError && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600 text-sm">{connectionError}</p>
            </div>
          )}
          
          <Button
            onClick={handleConnect}
            disabled={isConnecting}
            className="bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-700 hover:to-green-600 text-yellow-300 font-bold text-lg px-10 py-6 rounded-xl shadow-lg hover:shadow-green-500/40 transition-all duration-300 hover:scale-105 disabled:opacity-70"
            style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.2)' }}
          >
            {isConnecting ? (
              <>
                <RefreshCw className="w-6 h-6 mr-2 animate-spin" />
                Đang kết nối...
              </>
            ) : (
              <>
                <img src={metamaskLogo} alt="MetaMask" className="w-6 h-6 mr-2" />
                Connect Wallet
              </>
            )}
          </Button>

          {isConnecting && (
            <p className="text-sm text-muted-foreground mt-4 animate-pulse">
              MetaMask popup sẽ hiện lên, vui lòng xác nhận kết nối...
            </p>
          )}

          <p className="text-xs text-muted-foreground mt-6">
            Chưa có MetaMask?{' '}
            <a 
              href="https://metamask.io/download/" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              Tải xuống tại đây
            </a>
          </p>
        </div>
      </div>
    );
  }

  // Show wallet UI if user has any wallet (custodial or external)
  return (
    <div className="space-y-4">
      {/* Header Card */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b flex-wrap gap-3">
          <h1 className="text-xl font-bold text-gray-900">My Wallet</h1>
          <div className="flex items-center gap-3 flex-wrap">
            {/* Wallet Type Switcher */}
            <WalletTypeSwitcher />
            
            <div className="flex items-center gap-2 bg-yellow-100 px-3 py-1.5 rounded-full border border-yellow-300">
              <img src={bnbLogo} alt="BNB" className="w-5 h-5" />
              <span className="text-sm font-medium text-yellow-700">BNB Smart Chain</span>
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="w-8 h-8">
                <AvatarImage src={profile?.avatar_url || ''} />
                <AvatarFallback className="bg-primary text-white text-xs">
                  {profile?.username?.charAt(0).toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden sm:block">{profile?.username || 'Account'}</span>
              <button 
                onClick={copyAddress}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                <span>{shortenedAddress}</span>
                {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            
            {/* Wallet-type specific actions */}
            {activeWalletType === 'external' && isConnected && (
              <>
                <Button
                  onClick={handleSwitchAccount}
                  variant="ghost"
                  size="sm"
                  className="bg-blue-50 text-blue-600 hover:bg-blue-500 hover:text-white transition-all duration-200"
                >
                  <UserRoundCog className="w-4 h-4 mr-1" />
                  Switch
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="ghost"
                  size="sm"
                  className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white transition-all duration-200"
                >
                  <LogOut className="w-4 h-4 mr-1" />
                  Disconnect
                </Button>
              </>
            )}
            
            {/* Show connect MetaMask button if viewing custodial but MetaMask not connected */}
            {activeWalletType === 'custodial' && !isConnected && (
              <Button
                onClick={handleConnect}
                variant="ghost"
                size="sm"
                className="bg-orange-50 text-orange-600 hover:bg-orange-500 hover:text-white transition-all duration-200"
              >
                <img src={metamaskLogo} alt="MetaMask" className="w-4 h-4 mr-1" />
                Connect MetaMask
              </Button>
            )}
          </div>
        </div>

        {/* Wallet Type Badge */}
        <div className="px-4 py-2 bg-gray-50 border-b flex items-center gap-2">
          {activeWalletType === 'custodial' ? (
            <>
              <Shield className="w-4 h-4 text-emerald-600" />
              <span className="text-sm text-emerald-700 font-medium">F.U. Wallet (Custodial)</span>
              <span className="text-xs text-muted-foreground">• Không cần MetaMask</span>
            </>
          ) : (
            <>
              <img src={metamaskLogo} alt="MetaMask" className="w-4 h-4" />
              <span className="text-sm text-orange-700 font-medium">MetaMask (External)</span>
              {isConnected && <span className="text-xs text-green-600">• Connected</span>}
            </>
          )}
        </div>

        {/* Total Assets */}
        <div className="bg-gradient-to-br from-emerald-800 via-emerald-600 to-green-400 p-6">
          <p className="text-white/80 text-sm mb-1">Total Assets</p>
          {isTokensLoading ? (
            <div className="animate-pulse bg-white/20 rounded h-12 w-64 mb-6" />
          ) : (
            <p className="text-4xl md:text-5xl font-bold text-white mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.2)' }}>
              {formatUsd(totalUsdValue)}
            </p>
          )}
          
          {/* Action Buttons */}
          <div className="flex justify-center gap-6">
            <button 
              onClick={() => setShowReceive(true)}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-yellow-400/50 group-hover:scale-110 transition-all">
                <ArrowDown className="w-6 h-6 text-yellow-900" />
              </div>
              <span className="text-white text-sm font-medium">Receive</span>
            </button>
            <button 
              onClick={() => {
                if (activeWalletType === 'custodial') {
                  toast.info('Tính năng Send cho F.U. Wallet đang phát triển');
                } else {
                  setShowSend(true);
                }
              }}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-yellow-400/50 group-hover:scale-110 transition-all">
                <ArrowUp className="w-6 h-6 text-yellow-900" />
              </div>
              <span className="text-white text-sm font-medium">Send</span>
            </button>
            <button 
              onClick={() => window.open('https://pancakeswap.finance/swap', '_blank')}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-yellow-400/50 group-hover:scale-110 transition-all">
                <RefreshCw className="w-6 h-6 text-yellow-900" />
              </div>
              <span className="text-white text-sm font-medium">Swap</span>
            </button>
            <button 
              onClick={() => window.open('https://www.moonpay.com/buy', '_blank')}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-14 h-14 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-yellow-400/50 group-hover:scale-110 transition-all">
                <ShoppingCart className="w-6 h-6 text-yellow-900" />
              </div>
              <span className="text-white text-sm font-medium">Buy</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reward Ready to Claim - Dynamic Status */}
      {(() => {
        const rewardStatus = profile?.reward_status || 'pending';
        const adminNotes = profile?.admin_notes;
        
        const statusConfig = {
          pending: {
            bg: 'bg-gradient-to-r from-gray-400 via-gray-500 to-gray-600',
            label: 'Đang chờ duyệt',
            labelColor: 'text-gray-900',
            disabled: true
          },
          approved: {
            bg: 'bg-gradient-to-r from-yellow-400 via-yellow-500 to-amber-500',
            label: 'Sẵn sàng Claim',
            labelColor: 'text-yellow-900',
            disabled: false
          },
          on_hold: {
            bg: 'bg-gradient-to-r from-yellow-600 via-orange-500 to-amber-600',
            label: 'Đang treo',
            labelColor: 'text-yellow-100',
            disabled: true
          },
          rejected: {
            bg: 'bg-gradient-to-r from-red-500 via-red-600 to-red-700',
            label: 'Đã từ chối',
            labelColor: 'text-white',
            disabled: true
          }
        };
        
        const config = statusConfig[rewardStatus as keyof typeof statusConfig] || statusConfig.pending;
        
        return (
          <div className={`${config.bg} rounded-xl p-4 flex items-center justify-between shadow-lg`}>
            <div className="flex items-center gap-3">
              <Gift className={`w-6 h-6 ${config.labelColor}`} />
              <div className="flex flex-col">
                <span className={`font-semibold ${config.labelColor}`}>
                  Claimable: {formatNumber(claimableReward, 0)} CAMLY (~{formatUsd(claimableReward * camlyPrice)})
                </span>
                <span className={`text-xs ${config.labelColor} opacity-80`}>
                  Trạng thái: {config.label}
                </span>
              </div>
              {(rewardStatus === 'on_hold' || rewardStatus === 'rejected') && adminNotes && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button className={`p-1 rounded-full ${rewardStatus === 'rejected' ? 'bg-white/20' : 'bg-yellow-900/20'}`}>
                        <Info className={`w-4 h-4 ${config.labelColor}`} />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-xs">
                      <p className="text-sm font-medium mb-1">Ghi chú từ Admin:</p>
                      <p className="text-sm">{adminNotes}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
            <Button 
              className={`font-semibold px-6 shadow-md transition-all ${
                config.disabled 
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                  : 'bg-white text-yellow-700 hover:bg-yellow-50 hover:shadow-lg border-2 border-yellow-600'
              }`}
              onClick={() => {
                if (config.disabled) {
                  if (rewardStatus === 'pending') {
                    toast.info('Phần thưởng đang chờ Admin duyệt');
                  } else if (rewardStatus === 'on_hold') {
                    toast.warning('Phần thưởng đang bị treo. Vui lòng liên hệ Admin.');
                  } else if (rewardStatus === 'rejected') {
                    toast.error('Phần thưởng đã bị từ chối. Vui lòng liên hệ Admin.');
                  }
                } else {
                  toast.info('Tính năng claim reward đang phát triển');
                }
              }}
              disabled={config.disabled}
            >
              {config.disabled ? (
                rewardStatus === 'on_hold' ? (
                  <><AlertTriangle className="w-4 h-4 mr-1" /> Đang treo</>
                ) : rewardStatus === 'rejected' ? (
                  'Đã từ chối'
                ) : (
                  'Chờ duyệt'
                )
              ) : (
                'Claim to Wallet'
              )}
            </Button>
          </div>
        );
      })()}

      {/* Tokens / NFTs Tabs */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <Tabs defaultValue="tokens" className="w-full">
          <TabsList className="w-full bg-gray-50 p-0 h-auto rounded-none border-b">
            <TabsTrigger 
              value="tokens" 
              className="flex-1 py-3 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary font-semibold"
            >
              Tokens
            </TabsTrigger>
            <TabsTrigger 
              value="nfts" 
              className="flex-1 py-3 rounded-none data-[state=active]:bg-white data-[state=active]:border-b-2 data-[state=active]:border-primary data-[state=active]:text-primary font-semibold"
            >
              NFTs
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="tokens" className="m-0">
            <div className="flex justify-end p-2 border-b">
              <Button
                variant="ghost"
                size="sm"
                onClick={refetchTokens}
                disabled={isTokensLoading}
                className="text-xs text-muted-foreground hover:text-primary"
              >
                <RefreshCw className={`w-3 h-3 mr-1 ${isTokensLoading ? 'animate-spin' : ''}`} />
                {isTokensLoading ? 'Đang tải...' : 'Làm mới'}
              </Button>
            </div>
            <div className="divide-y">
              {tokens.map((token) => (
                <div key={token.symbol} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <img 
                      src={token.icon} 
                      alt={token.symbol} 
                      className="w-10 h-10 rounded-full" 
                    />
                    <div>
                      <p className="font-semibold">{token.name}</p>
                      <div className={`flex items-center text-xs ${token.change24h >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        <span>{token.change24h >= 0 ? '+' : ''}{token.change24h.toFixed(2)}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    {token.isLoading ? (
                      <>
                        <span className="animate-pulse bg-gray-200 rounded w-16 h-5 inline-block mb-1" />
                        <span className="animate-pulse bg-gray-200 rounded w-20 h-4 inline-block" />
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-base">
                          {formatUsd(token.usdValue)}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {formatTokenBalance(token.balance, token.symbol)} {token.symbol}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
          
          <TabsContent value="nfts" className="m-0 p-8 text-center">
            <div className="text-muted-foreground">
              <p className="text-lg font-medium mb-2">Chưa có NFT nào</p>
              <p className="text-sm">Các NFT bạn sở hữu sẽ hiển thị ở đây</p>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Recent Activity */}
      <div className="bg-white rounded-xl shadow-sm p-4">
        <h3 className="font-bold text-lg mb-4">Recent Activity</h3>
        {transactions.length > 0 ? (
          <div className="space-y-3">
            {transactions.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                  {getTransactionIcon(tx.type)}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{tx.description}</p>
                  <p className="text-xs text-muted-foreground">{formatRelativeTime(tx.created_at)}</p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <p>Chưa có giao dịch nào</p>
          </div>
        )}
      </div>

      {/* Receive Dialog */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nhận tiền</DialogTitle>
          </DialogHeader>
          <ReceiveTab walletAddress={activeWalletAddress || undefined} />
        </DialogContent>
      </Dialog>

      {/* Send Dialog */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gửi tiền</DialogTitle>
          </DialogHeader>
          <SendTab />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default WalletCenterContainer;
