import { Approval, ChainId, SUPPORTED_CHAINS } from '@/types/approval';

/**
 * Fetch token approvals via our API route (avoids CORS)
 */
export async function fetchApprovals(
  walletAddress: string,
  chainId: ChainId = 1
): Promise<Approval[]> {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  const response = await fetch('/api/approvals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ walletAddress, chainId }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || 'Failed to fetch approvals');
  }

  return (data.approvals || []).map((a: any) => ({
    ...a,
    firstSeenAt: new Date(a.firstSeenAt),
    lastSeenAt: new Date(a.lastSeenAt),
    riskScore: 0,
    riskLevel: 'safe' as const,
    riskFactors: [],
    isKnownMalicious: false,
    isKnownSafe: false,
  }));
}

/**
 * Get token price from CoinGecko (simplified)
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
  const mockPrices: Record<string, number> = {
    'USDC': 1, 'USDT': 1, 'DAI': 1, 'USDe': 1,
    'WETH': 2500, 'ETH': 2500, 'stETH': 2500,
    'WBTC': 60000, 'UNI': 10, 'LINK': 15, 'AAVE': 100,
  };
  return mockPrices[tokenSymbol.toUpperCase()] || 1;
}
