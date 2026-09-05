import { Approval, ChainId } from '@/types/approval';

/**
 * Fetch token approvals via our API route
 */
export async function fetchApprovals(
  walletAddress: string,
  chainId: ChainId = 11155111 // Default to Sepolia testnet
): Promise<Approval[]> {
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
