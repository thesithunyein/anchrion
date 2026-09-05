export interface Approval {
  id: string;
  walletAddress: string;
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: number;
  tokenLogo?: string;
  spenderAddress: string;
  spenderLabel?: string;
  allowanceRaw: string;
  allowanceFormatted: string;
  allowanceUsd: number;
  riskScore: number;
  riskLevel: 'critical' | 'high' | 'medium' | 'low' | 'safe';
  riskFactors: RiskFactor[];
  aiExplanation?: string;
  isKnownMalicious: boolean;
  isKnownSafe: boolean;
  deployedAt?: Date;
  chainId: number;
  firstSeenAt: Date;
  lastSeenAt: Date;
  revokedAt?: Date;
}

export interface RiskFactor {
  name: string;
  description: string;
  impact: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface WalletStats {
  totalApprovals: number;
  riskyApprovals: number;
  criticalApprovals: number;
  valueAtRisk: number;
  healthScore: number;
  chainId: number;
}

export type ChainId = 1 | 11155111 | 8453 | 42161 | 10;

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  isTestnet: boolean;
}

export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  11155111: {
    id: 11155111,
    name: 'Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    isTestnet: true,
  },
  1: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://ethereum-rpc.publicnode.com',
    blockExplorer: 'https://etherscan.io',
    isTestnet: false,
  },
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    isTestnet: false,
  },
  42161: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    isTestnet: false,
  },
  10: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    isTestnet: false,
  },
};

// Human-readable network names for the UI
export const NETWORK_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia Testnet',
  8453: 'Base',
  42161: 'Arbitrum One',
  10: 'Optimism',
};
