import { Approval, ChainId, SUPPORTED_CHAINS } from '@/types/approval';

// Messari Standardized Subgraph query for ERC-20 approvals
const APPROVAL_QUERY = `
  query GetApprovals($walletAddress: String!) {
    approvals(
      where: { owner: $walletAddress }
      first: 1000
      orderBy: blockTimestamp
      orderDirection: desc
    ) {
      id
      owner
      spender
      value
      token {
        id
        name
        symbol
        decimals
      }
      blockNumber
      blockTimestamp
      transactionHash
    }
  }
`;

// ERC-20 ABI for balance and allowance checks
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];

/**
 * Fetch token approvals for a wallet address from The Graph
 */
export async function fetchApprovals(
  walletAddress: string,
  chainId: ChainId = 1
): Promise<Approval[]> {
  const chainConfig = SUPPORTED_CHAINS[chainId];
  if (!chainConfig) {
    throw new Error(`Unsupported chain: ${chainId}`);
  }

  try {
    const response = await fetch(chainConfig.graphEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: APPROVAL_QUERY,
        variables: { walletAddress: walletAddress.toLowerCase() },
      }),
    });

    const data = await response.json();
    
    if (data.errors) {
      console.error('Graph query errors:', data.errors);
      throw new Error('Failed to fetch approvals from The Graph');
    }

    const approvals = data.data?.approvals || [];
    
    return approvals.map((approval: any) => formatApproval(approval, chainId));
  } catch (error) {
    console.error('Error fetching approvals:', error);
    throw error;
  }
}

/**
 * Format raw approval data into our Approval type
 */
function formatApproval(raw: any, chainId: ChainId): Approval {
  const token = raw.token || {};
  const allowance = BigInt(raw.value || '0');
  const decimals = parseInt(token.decimals || '18');
  const allowanceFormatted = formatUnits(allowance, decimals);
  
  return {
    id: raw.id,
    walletAddress: raw.owner,
    tokenAddress: token.id || '',
    tokenName: token.name || 'Unknown Token',
    tokenSymbol: token.symbol || '???',
    tokenDecimals: decimals,
    spenderAddress: raw.spender || '',
    spenderLabel: identifySpender(raw.spender),
    allowanceRaw: raw.value || '0',
    allowanceFormatted,
    allowanceUsd: 0, // Will be calculated later with price data
    riskScore: 0, // Will be calculated by risk scorer
    riskLevel: 'safe',
    riskFactors: [],
    isKnownMalicious: false,
    isKnownSafe: false,
    chainId,
    firstSeenAt: new Date(parseInt(raw.blockTimestamp || '0') * 1000),
    lastSeenAt: new Date(parseInt(raw.blockTimestamp || '0') * 1000),
  };
}

/**
 * Format BigInt to string with decimals
 */
function formatUnits(value: BigInt, decimals: number): string {
  const str = value.toString();
  if (decimals === 0) return str;
  
  const padded = str.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, -decimals);
  const decPart = padded.slice(-decimals);
  
  // Remove trailing zeros
  const trimmedDec = decPart.replace(/0+$/, '');
  return trimmedDec ? `${intPart}.${trimmedDec}` : intPart;
}

/**
 * Identify spender by address (basic heuristic)
 */
function identifySpender(address: string): string {
  const addr = address.toLowerCase();
  
  // Common DEX routers
  const knownAddresses: Record<string, string> = {
    '0x68b3465431183803873192726470238124654e48': 'Uniswap Router',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap Router V2',
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
  };
  
  return knownAddresses[addr] || 'Unknown Contract';
}

/**
 * Get token price from CoinGecko (simplified)
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
  // In production, use a real price API
  // For now, return mock prices for common tokens
  const mockPrices: Record<string, number> = {
    'USDC': 1,
    'USDT': 1,
    'DAI': 1,
    'WETH': 2500,
    'ETH': 2500,
    'WBTC': 60000,
    'UNI': 10,
    'LINK': 15,
    'AAVE': 100,
  };
  
  return mockPrices[tokenSymbol.toUpperCase()] || 0;
}
