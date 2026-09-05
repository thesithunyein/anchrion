import { Approval, ChainId, SUPPORTED_CHAINS } from '@/types/approval';

// ERC-20 ABI for approval events
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
  'function decimals() view returns (uint8)',
];

// ERC-20 Approval event topic
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b921';

/**
 * Fetch token approvals for a wallet address using direct RPC calls
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
    // Get Approval events from the last 10000 blocks
    const blockNumberHex = await rpcCall(chainConfig.rpcUrl, 'eth_blockNumber', []);
    const blockNumber = parseInt(blockNumberHex, 16);
    const fromBlock = Math.max(0, blockNumber - 10000);

    // Query Approval events for this wallet
    const approvalEvents = await rpcCall(chainConfig.rpcUrl, 'eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: 'latest',
      address: null, // All contracts
      topics: [
        APPROVAL_TOPIC,
        '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase(), // owner
      ],
    }]);

    if (!approvalEvents || !Array.isArray(approvalEvents)) {
      return [];
    }

    // Process events and fetch current allowances
    const approvals: Approval[] = [];
    const processedTokens = new Map<string, any>();

    for (const event of approvalEvents) {
      const tokenAddress = event.address;
      const spender = '0x' + event.topics[2].slice(26);
      const value = BigInt(event.data);

      // Skip zero allowances (revoked)
      if (value === BigInt(0)) continue;

      // Get token info (cache per token)
      if (!processedTokens.has(tokenAddress)) {
        const tokenInfo = await getTokenInfo(chainConfig.rpcUrl, tokenAddress);
        processedTokens.set(tokenAddress, tokenInfo);
      }

      const tokenInfo = processedTokens.get(tokenAddress);
      const allowanceFormatted = formatUnits(value, tokenInfo.decimals);

      // Check current on-chain allowance (might have changed since event)
      const currentAllowance = await getCurrentAllowance(
        chainConfig.rpcUrl,
        tokenAddress,
        walletAddress,
        spender
      );

      // If current allowance is 0, this approval was revoked
      if (currentAllowance === BigInt(0)) continue;

      approvals.push({
        id: `${event.transactionHash}-${event.logIndex}`,
        walletAddress,
        tokenAddress,
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        tokenDecimals: tokenInfo.decimals,
        spenderAddress: spender,
        spenderLabel: identifySpender(spender),
        allowanceRaw: currentAllowance.toString(),
        allowanceFormatted: formatUnits(currentAllowance, tokenInfo.decimals),
        allowanceUsd: 0,
        riskScore: 0,
        riskLevel: 'safe',
        riskFactors: [],
        isKnownMalicious: false,
        isKnownSafe: false,
        chainId,
        firstSeenAt: new Date(parseInt(event.timeStamp || '0', 16) * 1000 || Date.now()),
        lastSeenAt: new Date(parseInt(event.timeStamp || '0', 16) * 1000 || Date.now()),
      });
    }

    return approvals;
  } catch (error) {
    console.error('Error fetching approvals:', error);
    throw error;
  }
}

/**
 * Make a raw JSON-RPC call
 */
async function rpcCall(url: string, method: string, params: any[]): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method,
      params,
    }),
  });

  const data = await response.json();
  if (data.error) {
    throw new Error(data.error.message);
  }
  return data.result;
}

/**
 * Get token info (name, symbol, decimals) via RPC
 */
async function getTokenInfo(rpcUrl: string, tokenAddress: string): Promise<{
  name: string;
  symbol: string;
  decimals: number;
}> {
  try {
    const [name, symbol, decimals] = await Promise.all([
      ethCall(rpcUrl, tokenAddress, '0x06fdde03'), // name()
      ethCall(rpcUrl, tokenAddress, '0x95d89b41'), // symbol()
      ethCall(rpcUrl, tokenAddress, '0x313ce567'), // decimals()
    ]);

    return {
      name: decodeString(name) || 'Unknown',
      symbol: decodeString(symbol) || '???',
      decimals: parseInt(decimals || '0x12', 16) || 18,
    };
  } catch {
    return { name: 'Unknown Token', symbol: '???', decimals: 18 };
  }
}

/**
 * Get current allowance for a token
 */
async function getCurrentAllowance(
  rpcUrl: string,
  tokenAddress: string,
  owner: string,
  spender: string
): Promise<bigint> {
  try {
    // allowance(address,address) = 0xdd62ed3e
    const data = '0xdd62ed3e' +
      owner.slice(2).toLowerCase().padStart(64, '0') +
      spender.slice(2).toLowerCase().padStart(64, '0');

    const result = await ethCall(rpcUrl, tokenAddress, data);
    return BigInt(result);
  } catch {
    return BigInt(0);
  }
}

/**
 * Make an eth_call
 */
async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  const result = await rpcCall(rpcUrl, 'eth_call', [{
    to,
    data,
  }, 'latest']);
  return result;
}

/**
 * Decode ABI-encoded string
 */
function decodeString(hex: string): string {
  if (!hex || hex === '0x') return '';
  try {
    // Remove 0x prefix and padding
    const data = hex.slice(2);
    if (data.length < 128) return '';
    
    // For string returns, offset is usually 0x20 (32 bytes)
    const offset = parseInt(data.slice(0, 64), 16) * 2;
    const length = parseInt(data.slice(offset, offset + 64), 16);
    const bytes = data.slice(offset + 64, offset + 64 + length * 2);
    
    let str = '';
    for (let i = 0; i < bytes.length; i += 2) {
      const charCode = parseInt(bytes.slice(i, i + 2), 16);
      if (charCode > 0) str += String.fromCharCode(charCode);
    }
    return str;
  } catch {
    return '';
  }
}

/**
 * Format BigInt to string with decimals
 */
function formatUnits(value: bigint, decimals: number): string {
  const str = value.toString();
  if (decimals === 0) return str;
  
  const padded = str.padStart(decimals + 1, '0');
  const intPart = padded.slice(0, -decimals);
  const decPart = padded.slice(-decimals);
  
  const trimmedDec = decPart.replace(/0+$/, '');
  return trimmedDec ? `${intPart}.${trimmedDec}` : intPart;
}

/**
 * Identify spender by address (basic heuristic)
 */
function identifySpender(address: string): string {
  const addr = address.toLowerCase();
  
  const knownAddresses: Record<string, string> = {
    '0x68b3465431183803873192726470238124654e48': 'Uniswap Router',
    '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap Router V2',
    '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
    '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
    '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
    '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
    '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch Aggregation Router V4',
    '0x881d40237659c251811cec9c364ef91dc08d300c': 'Metamask Swap Router',
  };
  
  return knownAddresses[addr] || 'Unknown Contract';
}

/**
 * Get token price from CoinGecko (simplified)
 */
export async function getTokenPrice(tokenSymbol: string): Promise<number> {
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
    'USDe': 1,
    'stETH': 2500,
    'rETH': 2500,
  };
  
  return mockPrices[tokenSymbol.toUpperCase()] || 1; // Default to $1 for unknown tokens
}
