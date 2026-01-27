import { useState, useCallback } from 'react';
import { useAccount, useSignMessage, useConnect, useDisconnect } from 'wagmi';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { 
  Wallet, 
  ExternalLink, 
  Check, 
  Copy, 
  Shield, 
  Zap, 
  RefreshCw,
  Link2,
  Plus,
  Star
} from 'lucide-react';
import { toast } from 'sonner';
import metamaskLogo from '@/assets/metamask-logo.png';

interface WalletManagementProps {
  externalWalletAddress?: string | null;
  custodialWalletAddress?: string | null;
  defaultWalletType?: 'custodial' | 'external' | null;
  onRefresh: () => void;
}

export const WalletManagement = ({
  externalWalletAddress,
  custodialWalletAddress,
  defaultWalletType,
  onRefresh
}: WalletManagementProps) => {
  const { address: connectedAddress, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingCustodial, setIsCreatingCustodial] = useState(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState(false);
  const [copiedAddress, setCopiedAddress] = useState<string | null>(null);

  const shortenAddress = (address: string) => 
    `${address.slice(0, 6)}...${address.slice(-4)}`;

  const copyAddress = (address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedAddress(address);
    toast.success('Đã copy địa chỉ ví');
    setTimeout(() => setCopiedAddress(null), 2000);
  };

  // Connect external wallet via MetaMask
  const handleConnectExternalWallet = useCallback(async () => {
    if (!window.ethereum) {
      toast.error('Vui lòng cài đặt MetaMask để tiếp tục');
      window.open('https://metamask.io/download/', '_blank');
      return;
    }

    setIsConnecting(true);
    
    try {
      // If not connected to MetaMask, connect first
      if (!isConnected) {
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        const metamaskConnector = 
          connectors.find((c) => c.name === 'MetaMask') ||
          connectors.find((c) => c.id === 'injected') ||
          connectors[0];

        if (!metamaskConnector) {
          toast.error('Không tìm thấy ví để kết nối');
          setIsConnecting(false);
          return;
        }

        await new Promise<void>((resolve, reject) => {
          connect(
            { connector: metamaskConnector },
            {
              onSuccess: () => resolve(),
              onError: (err) => reject(err)
            }
          );
        });
      }

      // Get connected address
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      const walletAddress = accounts[0]?.toLowerCase();
      
      if (!walletAddress) {
        toast.error('Không thể lấy địa chỉ ví');
        setIsConnecting(false);
        return;
      }

      // Sign message to verify ownership
      const message = `Kết nối ví với F.U. Profile\n\nĐịa chỉ: ${walletAddress}\nThời gian: ${new Date().toISOString()}`;
      
      const signature = await signMessageAsync({ 
        message,
        account: walletAddress as `0x${string}`
      });

      // Call edge function to save external wallet
      const { data, error } = await supabase.functions.invoke('connect-external-wallet', {
        body: {
          wallet_address: walletAddress,
          signature,
          message
        }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Không thể kết nối ví');
      }

      toast.success('Đã kết nối ví ngoài thành công!');
      onRefresh();
    } catch (error: any) {
      console.error('[WalletManagement] Connect error:', error);
      
      if (error?.code === 4001 || error?.message?.includes('rejected')) {
        toast.error('Bạn đã từ chối ký xác nhận');
      } else if (error?.message?.includes('already connected')) {
        toast.error('Ví này đã được kết nối với tài khoản khác');
      } else {
        toast.error(error?.message || 'Không thể kết nối ví');
      }
    } finally {
      setIsConnecting(false);
    }
  }, [isConnected, connectors, connect, signMessageAsync, onRefresh]);

  // Create custodial wallet
  const handleCreateCustodialWallet = useCallback(async () => {
    setIsCreatingCustodial(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('create-custodial-wallet', {
        body: { chain_id: 56 }
      });

      if (error || !data?.success) {
        throw new Error(data?.error || error?.message || 'Không thể tạo ví');
      }

      toast.success('Đã tạo ví custodial thành công!');
      onRefresh();
    } catch (error: any) {
      console.error('[WalletManagement] Create custodial error:', error);
      toast.error(error?.message || 'Không thể tạo ví custodial');
    } finally {
      setIsCreatingCustodial(false);
    }
  }, [onRefresh]);

  // Update default wallet type
  const handleSetDefaultWallet = useCallback(async (type: 'custodial' | 'external') => {
    // Validate that user has the wallet type they're trying to set as default
    if (type === 'external' && !externalWalletAddress) {
      toast.error('Bạn chưa kết nối ví ngoài');
      return;
    }
    if (type === 'custodial' && !custodialWalletAddress) {
      toast.error('Bạn chưa có ví custodial');
      return;
    }

    setIsUpdatingDefault(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        toast.error('Vui lòng đăng nhập lại');
        return;
      }

      const { error } = await supabase
        .from('profiles')
        .update({ default_wallet_type: type })
        .eq('id', session.user.id);

      if (error) throw error;

      toast.success(`Đã đặt ${type === 'custodial' ? 'ví custodial' : 'ví ngoài'} làm mặc định`);
      onRefresh();
    } catch (error: any) {
      console.error('[WalletManagement] Update default error:', error);
      toast.error('Không thể cập nhật ví mặc định');
    } finally {
      setIsUpdatingDefault(false);
    }
  }, [externalWalletAddress, custodialWalletAddress, onRefresh]);

  const hasBothWallets = !!externalWalletAddress && !!custodialWalletAddress;
  const hasAnyWallet = !!externalWalletAddress || !!custodialWalletAddress;

  return (
    <div className="space-y-6">
      {/* Wallet Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* External Wallet Card */}
        <Card className={`relative overflow-hidden transition-all ${
          defaultWalletType === 'external' ? 'ring-2 ring-primary' : ''
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img src={metamaskLogo} alt="MetaMask" className="w-6 h-6" />
                <CardTitle className="text-lg">Ví MetaMask</CardTitle>
              </div>
              {defaultWalletType === 'external' && (
                <Badge variant="default" className="gap-1">
                  <Star className="w-3 h-3" />
                  Mặc định
                </Badge>
              )}
            </div>
            <CardDescription>
              Ví ngoài - Bạn tự quản lý khóa riêng tư
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {externalWalletAddress ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="text-sm flex-1 font-mono">
                    {shortenAddress(externalWalletAddress)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyAddress(externalWalletAddress)}
                  >
                    {copiedAddress === externalWalletAddress ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={`https://bscscan.com/address/${externalWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
                
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Shield className="w-4 h-4 mt-0.5 flex-shrink-0 text-green-500" />
                  <span>Bạn hoàn toàn kiểm soát ví này. Private key được lưu trong MetaMask.</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  <Wallet className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Chưa kết nối ví ngoài
                  </p>
                </div>
                
                <Button
                  className="w-full gap-2"
                  onClick={handleConnectExternalWallet}
                  disabled={isConnecting}
                >
                  {isConnecting ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Link2 className="w-4 h-4" />
                  )}
                  {isConnecting ? 'Đang kết nối...' : 'Kết nối MetaMask'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Custodial Wallet Card */}
        <Card className={`relative overflow-hidden transition-all ${
          defaultWalletType === 'custodial' ? 'ring-2 ring-primary' : ''
        }`}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center">
                  <Shield className="w-3.5 h-3.5 text-white" />
                </div>
                <CardTitle className="text-lg">Ví F.U.</CardTitle>
              </div>
              {defaultWalletType === 'custodial' && (
                <Badge variant="default" className="gap-1">
                  <Star className="w-3 h-3" />
                  Mặc định
                </Badge>
              )}
            </div>
            <CardDescription>
              Ví custodial - Hệ thống quản lý an toàn
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {custodialWalletAddress ? (
              <>
                <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                  <code className="text-sm flex-1 font-mono">
                    {shortenAddress(custodialWalletAddress)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => copyAddress(custodialWalletAddress)}
                  >
                    {copiedAddress === custodialWalletAddress ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    asChild
                  >
                    <a
                      href={`https://bscscan.com/address/${custodialWalletAddress}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
                
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <Zap className="w-4 h-4 mt-0.5 flex-shrink-0 text-yellow-500" />
                  <span>Dễ sử dụng, không cần cài đặt ví. Phù hợp cho người mới bắt đầu.</span>
                </div>
              </>
            ) : (
              <>
                <div className="text-center py-4">
                  <Shield className="w-12 h-12 mx-auto text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Chưa tạo ví custodial
                  </p>
                </div>
                
                <Button
                  className="w-full gap-2"
                  variant="outline"
                  onClick={handleCreateCustodialWallet}
                  disabled={isCreatingCustodial}
                >
                  {isCreatingCustodial ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Plus className="w-4 h-4" />
                  )}
                  {isCreatingCustodial ? 'Đang tạo...' : 'Tạo ví F.U.'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Default Wallet Selection */}
      {hasBothWallets && (
        <>
          <Separator />
          
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold">Ví mặc định</h3>
              <p className="text-xs text-muted-foreground">
                Chọn ví sẽ được sử dụng khi nhận thưởng và thực hiện giao dịch
              </p>
            </div>
            
            <RadioGroup
              value={defaultWalletType || 'custodial'}
              onValueChange={(value) => handleSetDefaultWallet(value as 'custodial' | 'external')}
              disabled={isUpdatingDefault}
              className="grid gap-3"
            >
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="external" id="external" />
                <Label htmlFor="external" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <img src={metamaskLogo} alt="MetaMask" className="w-5 h-5" />
                    <span className="font-medium">Ví MetaMask</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sử dụng ví ngoài của bạn - Bảo mật cao nhất
                  </p>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="custodial" id="custodial" />
                <Label htmlFor="custodial" className="flex-1 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-gradient-to-br from-emerald-500 to-green-400 flex items-center justify-center">
                      <Shield className="w-3 h-3 text-white" />
                    </div>
                    <span className="font-medium">Ví F.U.</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Sử dụng ví custodial - Tiện lợi, không cần MetaMask
                  </p>
                </Label>
              </div>
            </RadioGroup>
          </div>
        </>
      )}

      {/* Comparison Info */}
      <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Shield className="w-4 h-4" />
          So sánh 2 loại ví
        </h4>
        
        <div className="grid gap-3 text-xs">
          <div className="grid grid-cols-3 gap-2 font-medium text-muted-foreground">
            <div>Tính năng</div>
            <div className="text-center">MetaMask</div>
            <div className="text-center">Ví F.U.</div>
          </div>
          
          <Separator />
          
          <div className="grid grid-cols-3 gap-2">
            <div>Bảo mật</div>
            <div className="text-center text-green-600">★★★★★</div>
            <div className="text-center text-yellow-600">★★★★☆</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>Dễ sử dụng</div>
            <div className="text-center text-yellow-600">★★★☆☆</div>
            <div className="text-center text-green-600">★★★★★</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>Cần cài đặt</div>
            <div className="text-center text-red-500">Có</div>
            <div className="text-center text-green-500">Không</div>
          </div>
          
          <div className="grid grid-cols-3 gap-2">
            <div>Tự quản lý key</div>
            <div className="text-center text-green-500">Có</div>
            <div className="text-center text-muted-foreground">Hệ thống</div>
          </div>
        </div>
      </div>
    </div>
  );
};
