import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Wallet,
  RefreshCw,
  Users
} from "lucide-react";
import { toast } from "sonner";

interface GrandTotals {
  totalDeposit: number;
  totalWithdraw: number;
  totalBet: number;
  totalWin: number;
  totalLoss: number;
  totalProfit: number;
  userCount: number;
}

const formatNumber = (value: number): string => {
  if (value >= 1_000_000_000) {
    return (value / 1_000_000_000).toFixed(2) + 'B';
  } else if (value >= 1_000_000) {
    return (value / 1_000_000).toFixed(2) + 'M';
  } else if (value >= 1_000) {
    return (value / 1_000).toFixed(2) + 'K';
  }
  return value.toLocaleString();
};

const FinancialTab = () => {
  const [loading, setLoading] = useState(true);
  const [grandTotals, setGrandTotals] = useState<GrandTotals | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await loadGrandTotals();
    } catch (error) {
      console.error("Error loading financial data:", error);
      toast.error("Không thể tải dữ liệu tài chính");
    } finally {
      setLoading(false);
    }
  };

  const loadGrandTotals = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('grand_total_deposit, grand_total_withdraw, grand_total_bet, grand_total_win, grand_total_loss, grand_total_profit')
      .gt('grand_total_bet', 0);

    if (error) throw error;

    const totals = data?.reduce((acc, user) => ({
      totalDeposit: acc.totalDeposit + (user.grand_total_deposit || 0),
      totalWithdraw: acc.totalWithdraw + (user.grand_total_withdraw || 0),
      totalBet: acc.totalBet + (user.grand_total_bet || 0),
      totalWin: acc.totalWin + (user.grand_total_win || 0),
      totalLoss: acc.totalLoss + (user.grand_total_loss || 0),
      totalProfit: acc.totalProfit + (user.grand_total_profit || 0),
      userCount: acc.userCount + 1
    }), {
      totalDeposit: 0,
      totalWithdraw: 0,
      totalBet: 0,
      totalWin: 0,
      totalLoss: 0,
      totalProfit: 0,
      userCount: 0
    });

    setGrandTotals(totals || null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tổng quan tài chính</h2>
        <Button variant="outline" onClick={loadData} size="sm" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Làm mới
        </Button>
      </div>

      {/* Grand Totals */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Deposit</p>
                <p className="text-2xl font-bold text-green-700">
                  {formatNumber(grandTotals?.totalDeposit || 0)}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 border-red-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Withdraw</p>
                <p className="text-2xl font-bold text-red-700">
                  {formatNumber(grandTotals?.totalWithdraw || 0)}
                </p>
              </div>
              <Wallet className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-violet-50 border-purple-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Bet</p>
                <p className="text-2xl font-bold text-purple-700">
                  {formatNumber(grandTotals?.totalBet || 0)}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-50 to-cyan-50 border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Users có hoạt động</p>
                <p className="text-2xl font-bold text-blue-700">
                  {grandTotals?.userCount || 0}
                </p>
              </div>
              <Users className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Win/Loss Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Win</p>
                <p className="text-xl font-bold text-green-600">
                  {formatNumber(grandTotals?.totalWin || 0)}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Loss</p>
                <p className="text-xl font-bold text-red-600">
                  {formatNumber(grandTotals?.totalLoss || 0)}
                </p>
              </div>
              <TrendingDown className="w-6 h-6 text-red-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tổng Profit</p>
                <p className={`text-xl font-bold ${(grandTotals?.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatNumber(grandTotals?.totalProfit || 0)}
                </p>
              </div>
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Message */}
      <Card>
        <CardContent className="py-6">
          <p className="text-center text-muted-foreground">
            Các chức năng chi tiết (transactions, reconciliation, platform data) đang được phát triển.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialTab;