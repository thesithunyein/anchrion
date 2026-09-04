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
  impact: number; // +points added to risk score
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

export interface ScanResult {
  id: string;
  walletAddress: string;
  chainId: number;
  totalApprovals: number;
  riskyApprovals: number;
  valueAtRiskUsd: number;
  scanDurationMs: number;
  createdAt: Date;
}

export interface RevokeResult {
  approvalId: string;
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed?: number;
  gasPrice?: number;
  createdAt: Date;
  confirmedAt?: Date;
}

export type ChainId = 1 | 8453 | 42161 | 10; // Ethereum, Base, Arbitrum, Optimism

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  rpcUrl: string;
  blockExplorer: string;
  graphEndpoint: string;
}

export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  1: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://eth.llamarpc.com',
    blockExplorer: 'https://etherscan.io',
    graphEndpoint: 'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/5zw4oy5ZL1Fv2GWr8rYsTnNqFmnhc4bKPLx9vQqFJWZA',
  },
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.base.org',
    blockExplorer: 'https://basescan.org',
    graphEndpoint: 'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/CH9dzHVCVvHDf7bqcjqNRjNg52WJ2t8bW7dALx7M4N6v',
  },
  42161: {
    id: 42161,
    name: 'Arbitrum',
    symbol: 'ETH',
    rpcUrl: 'https://arb1.arbitrum.io/rpc',
    blockExplorer: 'https://arbiscan.io',
    graphEndpoint: 'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/5ortHMBpB5wLjXEBwhv2dSGZ6czAMUu8g4FqsXW3ETx7',
  },
  10: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://mainnet.optimism.io',
    blockExplorer: 'https://optimistic.etherscan.io',
    graphEndpoint: 'https://gateway-arbitrum.network.thegraph.com/api/subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyV9FYUZkLNRcL87g',
  },
};
