import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield, BarChart3, Gift, Users, Wallet, Trash2, Link2, LogOut, CloudUpload, GitMerge, DollarSign } from "lucide-react";

import OverviewTab from "@/components/admin/OverviewTab";
import RewardApprovalTab from "@/components/admin/RewardApprovalTab";
import UserReviewTab from "@/components/admin/UserReviewTab";
import WalletAbuseTab from "@/components/admin/WalletAbuseTab";
import QuickDeleteTab from "@/components/admin/QuickDeleteTab";
import BlockchainTab from "@/components/admin/BlockchainTab";
import MediaMigrationTab from "@/components/admin/MediaMigrationTab";
import { MergeRequestsTab } from "@/components/admin/MergeRequestsTab";
import FinancialTab from "@/components/admin/FinancialTab";

interface UserData {
  id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  is_banned: boolean;
  pending_reward: number;
  approved_reward: number;
  wallet_address: string | null;
  reward_status: string;
  created_at: string;
  posts_count?: number;
  comments_count?: number;
  reactions_count?: number;
}

const Admin = () => {
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserData[]>([]);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/feed");
        return;
      }

      setCurrentUserId(session.user.id);

      const { data: hasRole, error } = await supabase.rpc('has_role', {
        _user_id: session.user.id,
        _role: 'admin'
      });

      if (error || !hasRole) {
        toast.error("Bạn không có quyền truy cập trang này");
        navigate("/feed");
        return;
      }

      setIsAdmin(true);
      await loadAllUsers();
    } catch (error) {
      console.error("Error checking admin status:", error);
      navigate("/feed");
    } finally {
      setLoading(false);
    }
  };

  const loadAllUsers = async () => {
    try {
      const { data: profiles, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      if (profiles) {
        // Get posts count for each user
        const { data: rewardsData } = await supabase.rpc('get_user_rewards', { limit_count: 500 });
        const rewardsMap = new Map(rewardsData?.map((r: any) => [r.id, r]) || []);

        const enrichedUsers = profiles.map(profile => {
          const rewardInfo = rewardsMap.get(profile.id) as any;
          return {
            ...profile,
            pending_reward: profile.pending_reward || 0,
            approved_reward: profile.approved_reward || 0,
            wallet_address: profile.wallet_address || null,
            reward_status: profile.reward_status || 'pending',
            posts_count: rewardInfo?.posts_count || 0,
            comments_count: rewardInfo?.comments_count || 0,
            reactions_count: rewardInfo?.reactions_count || 0,
          };
        });
        
        setUsers(enrichedUsers);
      }
    } catch (error) {
      console.error("Error loading users:", error);
    }
  };

  const stats = {
    totalUsers: users.length,
    pendingRewards: users.filter(u => u.pending_reward > 0).length,
    approvedRewards: users.filter(u => u.approved_reward > 0).length,
    onChainClaims: 0, // Will be loaded from reward_claims
    bannedUsers: users.filter(u => u.is_banned).length,
    suspiciousUsers: users.filter(u => !u.is_banned && (!u.avatar_url || !u.full_name)).length
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f0f2f5] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground">Đang kiểm tra quyền truy cập...</p>
        </div>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-[#f0f2f5] p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Ultimate Admin Dashboard</h1>
              <p className="text-muted-foreground">FUN Profile - Trái tim điều hành</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate("/")} className="gap-2">
            <LogOut className="w-4 h-4" />
            Thoát
          </Button>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5 lg:grid-cols-9 h-auto">
            <TabsTrigger value="overview" className="gap-2 py-3">
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">📊 Tổng quan</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="gap-2 py-3">
              <DollarSign className="w-4 h-4" />
              <span className="hidden sm:inline">💰 Financial</span>
            </TabsTrigger>
            <TabsTrigger value="rewards" className="gap-2 py-3">
              <Gift className="w-4 h-4" />
              <span className="hidden sm:inline">🎁 Duyệt thưởng</span>
            </TabsTrigger>
            <TabsTrigger value="review" className="gap-2 py-3">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">🛡️ Rà soát</span>
            </TabsTrigger>
            <TabsTrigger value="abuse" className="gap-2 py-3">
              <Wallet className="w-4 h-4" />
              <span className="hidden sm:inline">💳 Lạm dụng</span>
            </TabsTrigger>
            <TabsTrigger value="delete" className="gap-2 py-3">
              <Trash2 className="w-4 h-4" />
              <span className="hidden sm:inline">🗑️ Xóa nhanh</span>
            </TabsTrigger>
            <TabsTrigger value="blockchain" className="gap-2 py-3">
              <Link2 className="w-4 h-4" />
              <span className="hidden sm:inline">⛓️ Blockchain</span>
            </TabsTrigger>
            <TabsTrigger value="migration" className="gap-2 py-3">
              <CloudUpload className="w-4 h-4" />
              <span className="hidden sm:inline">☁️ Migration</span>
            </TabsTrigger>
            <TabsTrigger value="merge" className="gap-2 py-3">
              <GitMerge className="w-4 h-4" />
              <span className="hidden sm:inline">🔗 Merge User</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <OverviewTab stats={stats} />
          </TabsContent>

          <TabsContent value="financial">
            <FinancialTab />
          </TabsContent>

          <TabsContent value="rewards">
            <RewardApprovalTab 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="review">
            <UserReviewTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="abuse">
            <WalletAbuseTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="delete">
            <QuickDeleteTab 
              users={users} 
              adminId={currentUserId!} 
              onRefresh={loadAllUsers} 
            />
          </TabsContent>

          <TabsContent value="blockchain">
            <BlockchainTab adminId={currentUserId!} />
          </TabsContent>

          <TabsContent value="migration">
            <MediaMigrationTab />
          </TabsContent>

          <TabsContent value="merge">
            <MergeRequestsTab />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Admin;
