import { lazy, Suspense } from 'react';
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { config } from "@/config/web3";
import "@rainbow-me/rainbowkit/styles.css";

// Create a client for React Query (required for wagmi v2)
const queryClient = new QueryClient();

// Lazy load the wallet container
const WalletCenterContainer = lazy(() => import('@/components/wallet/WalletCenterContainer'));

// Loading fallback for wallet content
const WalletLoader = () => (
  <div className="flex items-center justify-center py-20">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground">Đang tải ví...</p>
    </div>
  </div>
);

const WalletProviders = () => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>
          <Suspense fallback={<WalletLoader />}>
            <WalletCenterContainer />
          </Suspense>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default WalletProviders;
