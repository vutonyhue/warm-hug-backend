import { connectorsForWallets } from '@rainbow-me/rainbowkit';
import {
  metaMaskWallet,
  trustWallet,
  bitgetWallet,
} from '@rainbow-me/rainbowkit/wallets';
import { createConfig, http } from 'wagmi';
import { mainnet, bsc } from 'wagmi/chains';

const projectId = '21fef48091f12692cad574a6f7753643';

const connectors = connectorsForWallets(
  [
    {
      groupName: 'Popular',
      wallets: [
        metaMaskWallet,
        trustWallet,
        bitgetWallet,
      ],
    },
  ],
  {
    appName: 'F.U. Profile',
    projectId,
  }
);

export const config = createConfig({
  connectors,
  chains: [mainnet, bsc],
  transports: {
    [mainnet.id]: http(),
    [bsc.id]: http(),
  },
});
