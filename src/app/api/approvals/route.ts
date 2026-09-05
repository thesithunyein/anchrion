import { NextResponse } from 'next/server';

// ERC-20 Approval event topic
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b921';

const RPC_URLS: Record<number, string> = {
  1: 'https://eth.llamarpc.com',
  8453: 'https://mainnet.base.org',
  42161: 'https://arb1.arbitrum.io/rpc',
  10: 'https://mainnet.optimism.io',
};

// Known spender addresses
const KNOWN_SPENDERS: Record<string, string> = {
  '0x68b3465431183803873192726470238124654e48': 'Uniswap Router',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch V4',
  '0x881d40237659c251811cec9c364ef91dc08d300c': 'MetaMask Swap',
  '0x617fee05ab87003ce80716b4045974c4f7fa5325': 'Coinbase Wallet',
};

async function rpcCall(url: string, method: string, params: any[]): Promise<any> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function ethCall(rpcUrl: string, to: string, data: string): Promise<string> {
  return rpcCall(rpcUrl, 'eth_call', [{ to, data }, 'latest']);
}

function decodeString(hex: string): string {
  if (!hex || hex === '0x' || hex.length < 130) return '';
  try {
    const data = hex.slice(2);
    const length = parseInt(data.slice(0, 64), 16);
    const bytes = data.slice(64, 64 + length * 2);
    let str = '';
    for (let i = 0; i < bytes.length; i += 2) {
      const code = parseInt(bytes.slice(i, i + 2), 16);
      if (code > 0) str += String.fromCharCode(code);
    }
    return str;
  } catch { return ''; }
}

function formatUnits(value: string, decimals: number): string {
  const big = BigInt(value);
  if (decimals === 0) return big.toString();
  const s = big.toString().padStart(decimals + 1, '0');
  const intPart = s.slice(0, -decimals);
  const decPart = s.slice(-decimals).replace(/0+$/, '');
  return decPart ? `${intPart}.${decPart}` : intPart;
}

export async function POST(request: Request) {
  try {
    const { walletAddress, chainId } = await request.json();

    if (!walletAddress || !chainId) {
      return NextResponse.json({ error: 'Missing walletAddress or chainId' }, { status: 400 });
    }

    const rpcUrl = RPC_URLS[chainId];
    if (!rpcUrl) {
      return NextResponse.json({ error: `Unsupported chain: ${chainId}` }, { status: 400 });
    }

    // Get current block number
    const blockNumberHex = await rpcCall(rpcUrl, 'eth_blockNumber', []);
    const blockNumber = parseInt(blockNumberHex, 16);
    // Search last 50000 blocks (roughly 1 week on Ethereum)
    const fromBlock = Math.max(0, blockNumber - 50000);

    const addressTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();

    // Query Approval events
    const approvalEvents = await rpcCall(rpcUrl, 'eth_getLogs', [{
      fromBlock: '0x' + fromBlock.toString(16),
      toBlock: 'latest',
      address: null,
      topics: [APPROVAL_TOPIC, addressTopic],
    }]);

    if (!approvalEvents || !Array.isArray(approvalEvents) || approvalEvents.length === 0) {
      return NextResponse.json({ approvals: [] });
    }

    // Process events
    const tokenCache = new Map<string, { name: string; symbol: string; decimals: number }>();
    const approvals = [];

    for (const event of approvalEvents) {
      const tokenAddress = event.address;
      const spender = '0x' + event.topics[2].slice(26);
      const value = BigInt(event.data);

      // Skip revoked approvals (value = 0)
      if (value === BigInt(0)) continue;

      // Get token info (with caching)
      if (!tokenCache.has(tokenAddress)) {
        try {
          const [nameHex, symbolHex, decimalsHex] = await Promise.all([
            ethCall(rpcUrl, tokenAddress, '0x06fdde03'),
            ethCall(rpcUrl, tokenAddress, '0x95d89b41'),
            ethCall(rpcUrl, tokenAddress, '0x313ce567'),
          ]);
          tokenCache.set(tokenAddress, {
            name: decodeString(nameHex) || 'Unknown Token',
            symbol: decodeString(symbolHex) || '???',
            decimals: parseInt(decimalsHex || '0x12', 16) || 18,
          });
        } catch {
          tokenCache.set(tokenAddress, { name: 'Unknown Token', symbol: '???', decimals: 18 });
        }
      }

      const tokenInfo = tokenCache.get(tokenAddress)!;

      // Check current on-chain allowance
      let currentAllowance = BigInt(0);
      try {
        const allowanceData = '0xdd62ed3e' +
          walletAddress.slice(2).toLowerCase().padStart(64, '0') +
          spender.slice(2).toLowerCase().padStart(64, '0');
        const allowanceHex = await ethCall(rpcUrl, tokenAddress, allowanceData);
        currentAllowance = BigInt(allowanceHex);
      } catch {
        // If we can't check, assume it's still valid
        currentAllowance = value;
      }

      // Skip if allowance is now 0
      if (currentAllowance === BigInt(0)) continue;

      const spenderLabel = KNOWN_SPENDERS[spender.toLowerCase()] || 'Unknown Contract';
      const allowanceFormatted = formatUnits(currentAllowance.toString(), tokenInfo.decimals);

      // Simple mock USD prices
      const prices: Record<string, number> = {
        'USDC': 1, 'USDT': 1, 'DAI': 1, 'USDe': 1, 'FRAX': 1,
        'WETH': 2500, 'ETH': 2500, 'stETH': 2500, 'rETH': 2500,
        'WBTC': 60000, 'cbBTC': 60000,
        'UNI': 10, 'LINK': 15, 'AAVE': 100, 'COMP': 50,
      };
      const price = prices[tokenInfo.symbol.toUpperCase()] || 1;

      approvals.push({
        id: `${event.transactionHash}-${event.logIndex}`,
        walletAddress,
        tokenAddress,
        tokenName: tokenInfo.name,
        tokenSymbol: tokenInfo.symbol,
        tokenDecimals: tokenInfo.decimals,
        spenderAddress: spender,
        spenderLabel,
        allowanceRaw: currentAllowance.toString(),
        allowanceFormatted,
        allowanceUsd: parseFloat(allowanceFormatted) * price,
        chainId,
        firstSeenAt: new Date(Date.now()).toISOString(),
        lastSeenAt: new Date(Date.now()).toISOString(),
        txHash: event.transactionHash,
        blockNumber: parseInt(event.blockNumber, 16),
      });
    }

    return NextResponse.json({ approvals });
  } catch (error: any) {
    console.error('Approvals API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch approvals' }, { status: 500 });
  }
}
