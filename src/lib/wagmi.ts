import { http, createConfig } from 'wagmi';
import { mainnet, base, arbitrum, optimism } from 'wagmi/chains';
import { metaMask, coinbaseWallet, walletConnect } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

export const config = createConfig({
  chains: [mainnet, base, arbitrum, optimism],
  connectors: [
    metaMask({ shimDisconnect: true }),
    coinbaseWallet({ appName: 'Anchrion', darkMode: true, preference: 'eoaOnly' }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [mainnet.id]: http(),
    [base.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
  },
});

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
