import '@rainbow-me/rainbowkit/styles.css';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { config } from '@/config/web3';
import { WalletLoginContent } from './WalletLoginContent';

// Separate QueryClient for wallet login to avoid conflicts
const walletQueryClient = new QueryClient();

interface WalletLoginProvidersProps {
  onSuccess: (userId: string, isNewUser: boolean) => void;
}

export const WalletLoginProviders = ({ onSuccess }: WalletLoginProvidersProps) => {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={walletQueryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: '#10b981',
            accentColorForeground: 'white',
            borderRadius: 'large',
          })}
        >
          <WalletLoginContent onSuccess={onSuccess} />
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};
