import { http, createConfig } from 'wagmi';
import { mainnet, sepolia, base, arbitrum, optimism } from 'wagmi/chains';
import { metaMask, coinbaseWallet, walletConnect, injected } from 'wagmi/connectors';

const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || '';

/*
 * MetaMask's multichain connector refuses to initialise without dapp metadata.
 * In a browser it fills the URL in from window.location, but the server-render
 * pass has no window, so the connector throws while these pages are being
 * prerendered and the connect button has nothing to initialise. Supplying both
 * fields makes the render pass quiet and the browser path correct.
 */
const dappUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

export const config = createConfig({
  chains: [sepolia, mainnet, base, arbitrum, optimism],
  connectors: [
    metaMask({ dapp: { name: 'Anchrion', url: dappUrl } }),
    coinbaseWallet({ appName: 'Anchrion', preference: { options: 'eoaOnly' } }),
    injected({ target: 'phantom', shimDisconnect: true }),
    ...(projectId ? [walletConnect({ projectId })] : []),
  ],
  transports: {
    [sepolia.id]: http(),
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
