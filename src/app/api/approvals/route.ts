import { NextResponse } from 'next/server';

// ERC-20 Approval event topic
const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b921';

// Working public RPCs (tested Sep 2026)
const RPC_URLS: Record<number, string[]> = {
  1: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
  8453: ['https://mainnet.base.org'],
  42161: ['https://arb1.arbitrum.io/rpc'],
  10: ['https://mainnet.optimism.io'],
};

// Top 50 popular ERC-20 tokens on Ethereum (address → { name, symbol, decimals })
const POPULAR_TOKENS: Record<string, { name: string; symbol: string; decimals: number }> = {
  // Stablecoins
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
  '0x4c9edd5852cd905f086c759e8383e09bff1e68b3': { name: 'USDe', symbol: 'USDe', decimals: 18 },
  '0x853d955acef822db058eb8505911ed77f175b99e': { name: 'Frax', symbol: 'FRAX', decimals: 18 },
  '0x4fabb145d64652a948d72533023f6e7a623c7c53': { name: 'Binance USD', symbol: 'BUSD', decimals: 18 },
  '0x0000000000085d4780B73119b644AE5ecd22b376': { name: 'TrueUSD', symbol: 'TUSD', decimals: 18 },
  // ETH derivatives
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { name: 'Lido Staked Ether', symbol: 'stETH', decimals: 18 },
  '0xae78736cd615f374d3085123a210448e74fc6393': { name: 'Rocket Pool ETH', symbol: 'rETH', decimals: 18 },
  '0xbe9895146f7af43049ca1c1ae358b0541ea49704': { name: 'Coinbase Wrapped Staked ETH', symbol: 'cbETH', decimals: 18 },
  // BTC derivatives
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
  '0xcbb7c0000ab88b473b1c5afd73b589aa0e803d67': { name: 'Coinbase Wrapped BTC', symbol: 'cbBTC', decimals: 8 },
  // Major tokens
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { name: 'Uniswap', symbol: 'UNI', decimals: 18 },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { name: 'Chainlink', symbol: 'LINK', decimals: 18 },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { name: 'Aave', symbol: 'AAVE', decimals: 18 },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { name: 'Compound', symbol: 'COMP', decimals: 18 },
  '0x9f8f72a930721d2456ab2967c755163f144be62b': { name: 'Meta', symbol: 'META', decimals: 18 },
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': { name: 'SushiSwap', symbol: 'SUSHI', decimals: 18 },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': { name: 'Curve DAO', symbol: 'CRV', decimals: 18 },
  '0x9e1028f5f1d5ede9954f4f852bde8efbce1c98e8': { name: 'Pendle', symbol: 'PENDLE', decimals: 18 },
  '0x3432b6a60e29789100632002ddad57e3b03fc3d0': { name: 'Blur', symbol: 'BLUR', decimals: 18 },
  '0x4d5c44c96e6a92006fff02a01b86452cd9bae285': { name: 'Mantle', symbol: 'MNT', decimals: 18 },
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': { name: 'Pepe', symbol: 'PEPE', decimals: 18 },
  '0x5026f006b85729a8b14553fae6af249ad16c9aab': { name: 'Wormhole', symbol: 'W', decimals: 18 },
  '0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b': { name: 'Venice Token', symbol: 'VVV', decimals: 18 },
  '0x1a4d5c28ae00139ca2d5d49c87c84821c8e1fd82': { name: 'Story IP', symbol: 'IP', decimals: 18 },
  '0xac57e120c469c978e2aabf058bf05c04c37e8b72': { name: 'Moca Network', symbol: 'MOCA', decimals: 18 },
  '0x000000000022d473030f116ddee9f6b43ac78ba3': { name: 'FREE Coin', symbol: 'FREE', decimals: 18 },
  '0x80f22f291e9ac9f6d6b53a2e1d00458f51b9cf09': { name: 'SwissBorg', symbol: 'CHSB', decimals: 8 },
  '0x9a9d249e049051cb448d78f7c1366cadf36cbb29': { name: 'SuperVerse', symbol: 'SUPER', decimals: 18 },
  '0x38455a413ce5e742f25765237d01ad983140c19b': { name: 'SAND', symbol: 'SAND', decimals: 18 },
  '0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e': { name: 'Yearn Finance', symbol: 'YFI', decimals: 18 },
  '0x7a58c0be72be218b41c608b7fe7c5bb630736c71': { name: 'Peace', symbol: 'DAO', decimals: 18 },
  '0xb4272071ec3226de3e82c3fb2f6e31ca1d5a3b54': { name: 'Catcoin', symbol: 'CATS', decimals: 18 },
  '0x269616d549deb7412928124888634f61e7be5fc6': { name: 'BTRFLY', symbol: 'BTRFLY', decimals: 18 },
  '0x12970e6868f88f6557b76120662c1b3e50a646bf': { name: 'MaidSafeCoin', symbol: 'MAID', decimals: 18 },
  '0x68a5845335643b912910bfa57f2645a6878d8097': { name: 'Gitcoin', symbol: 'GTC', decimals: 18 },
  '0x5afe147be25e7f0c8786ff86b6ade40a0ba7d3f3': { name: 'Ssv Network', symbol: 'SSV', decimals: 18 },
};

const KNOWN_SPENDERS: Record<string, string> = {
  '0x68b3465431183803873192726470238124654e48': 'Uniswap Router',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d': 'Uniswap V2 Router',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad': 'Uniswap Universal Router',
  '0x1111111254eeb25477b68fb85ed929f73a960582': '1inch Router',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f': 'SushiSwap Router',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff': '0x Exchange Proxy',
  '0x1111111254fb6c44bac0bed2854e76f90643097d': '1inch Aggregation V4',
  '0x881d40237659c251811cec9c364ef91dc08d300c': 'MetaMask Swap Router',
  '0x617fee05ab87003ce80716b4045974c4f7fa5325': 'Coinbase Wallet',
  '0x72228695d8dfe9f76762b82475e09de304b23575': 'Uniswap V3 Router',
  '0xe592427a0aece92de3edee1f18e0157c05861564': 'Uniswap V3 Router',
  '0x000000000022d473030f116ddee9f6b43ac78ba3': 'Uniswap Universal Router',
};

async function rpcCall(urls: string[], method: string, params: any[]): Promise<any> {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (data.error) continue; // Try next RPC
      return data.result;
    } catch {
      continue; // Try next RPC
    }
  }
  throw new Error('All RPC endpoints failed');
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

    const rpcUrls = RPC_URLS[chainId as keyof typeof RPC_URLS];
    if (!rpcUrls) {
      return NextResponse.json({ error: `Unsupported chain: ${chainId}` }, { status: 400 });
    }

    const tokenList = Object.entries(POPULAR_TOKENS);
    const addressTopic = '0x000000000000000000000000' + walletAddress.slice(2).toLowerCase();

    // Query each popular token for approval events (in batches of 10)
    const allApprovals = [];
    const batchSize = 10;

    for (let i = 0; i < tokenList.length; i += batchSize) {
      const batch = tokenList.slice(i, i + batchSize);
      const results = await Promise.allSettled(
        batch.map(async ([tokenAddress, tokenInfo]) => {
          try {
            // Get current allowance first
            const allowanceData = '0xdd62ed3e' +
              walletAddress.slice(2).toLowerCase().padStart(64, '0') +
              '0000000000000000000000000000000000000000000000000000000000000000'.slice(0, 64);

            // Check allowance for common spenders
            // Check allowance against known spenders
            const spendersToCheck = [
              '0x68b3465431183803873192726470238124654e48', // Uniswap SwapRouter
              '0x7a250d5630b4cf539739df2c5dacb4c659f2488d', // Uniswap V2 Router
              '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Uniswap Universal Router
              '0x1111111254eeb25477b68fb85ed929f73a960582', // 1inch Router
              '0xdef1c0ded9bec7f1a1670819833240f027b25eff', // 0x Exchange
              '0x1111111254fb6c44bac0bed2854e76f90643097d', // 1inch V4
              '0x881d40237659c251811cec9c364ef91dc08d300c', // MetaMask Swap
              '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f', // SushiSwap
              '0x72228695d8dfe9f76762b82475e09de304b23575', // Uniswap V3
              '0xe592427a0aece92de3edee1f18e0157c05861564', // Uniswap V3 Router
              '0x000000000022d473030f116ddee9f6b43ac78ba3', // Uniswap Universal v2
              '0x6a000f200059802af069f9824342615872c7ab0f', //inch SwapRouter
              '0x111111125421ca6dc452d289314280a0f8842a65', // 1inch Router v5
              '0xd6e0a906765d0872e581c936a4b49836c4ad429f', // OKX DEX Router
              '0x3b3ae7912549c4c7c48412b15c3749a15d58455f', // Paraswap
            ];

            const allowanceResults = await Promise.all(
              spendersToCheck.map(async (spender) => {
                try {
                  const data = '0xdd62ed3e' +
                    walletAddress.slice(2).toLowerCase().padStart(64, '0') +
                    spender.slice(2).toLowerCase().padStart(64, '0');
                  const hex = await rpcCall(rpcUrls, 'eth_call', [{ to: tokenAddress, data }, 'latest']);
                  const value = BigInt(hex);
                  if (value > BigInt(0)) {
                    return { spender, value: hex };
                  }
                } catch {}
                return null;
              })
            );

            const validAllowances = allowanceResults.filter(Boolean);

            // Also query approval event logs (small range — public RPCs limit archive queries)
            let events: any[] = [];
            try {
              const blockHex = await rpcCall(rpcUrls, 'eth_blockNumber', []);
              const blockNum = parseInt(blockHex, 16);
              const fromBlock = Math.max(0, blockNum - 5000); // ~16 hours on Ethereum
              events = await rpcCall(rpcUrls, 'eth_getLogs', [{
                fromBlock: '0x' + fromBlock.toString(16),
                toBlock: 'latest',
                address: tokenAddress,
                topics: [APPROVAL_TOPIC, addressTopic],
              }]);
            } catch {
              // Public RPCs may not support historical queries
            }

            // Merge event-based approvals with direct allowance checks
            for (const ev of events || []) {
              const spender = '0x' + ev.topics[2].slice(26);
              const value = BigInt(ev.data);
              if (value > BigInt(0)) {
                // Check if already in validAllowances
                if (!validAllowances.find(a => a!.spender.toLowerCase() === spender.toLowerCase())) {
                  // Verify current allowance
                  try {
                    const data = '0xdd62ed3e' +
                      walletAddress.slice(2).toLowerCase().padStart(64, '0') +
                      spender.slice(2).toLowerCase().padStart(64, '0');
                    const hex = await rpcCall(rpcUrls, 'eth_call', [{ to: tokenAddress, data }, 'latest']);
                    if (BigInt(hex) > BigInt(0)) {
                      validAllowances.push({ spender, value: hex });
                    }
                  } catch {}
                }
              }
            }

            if (validAllowances.length === 0) return null;

            const prices: Record<string, number> = {
              'USDC': 1, 'USDT': 1, 'DAI': 1, 'USDe': 1, 'FRAX': 1, 'BUSD': 1, 'TUSD': 1,
              'WETH': 2500, 'stETH': 2500, 'rETH': 2500, 'cbETH': 2500,
              'WBTC': 60000, 'cbBTC': 60000,
              'UNI': 10, 'LINK': 15, 'AAVE': 100, 'COMP': 50,
              'SUSHI': 1, 'CRV': 0.5, 'PENDLE': 5, 'BLUR': 0.5,
              'MOCA': 0.1, 'IP': 2, 'SUPER': 1, 'SAND': 0.5,
              'YFI': 5000, 'GTC': 0.5, 'SSV': 15, 'MNT': 1,
              'PEPE': 0.00001, 'W': 0.5, 'VVV': 1, 'FREE': 0.001,
              'CHSB': 0.1, 'BTRFLY': 100, 'MAID': 0.1, 'META': 5,
              'DAO': 1, 'CATS': 0.001,
            };

            return validAllowances.map((a) => ({
              id: `${tokenAddress}-${a!.spender}`,
              walletAddress,
              tokenAddress,
              tokenName: tokenInfo.name,
              tokenSymbol: tokenInfo.symbol,
              tokenDecimals: tokenInfo.decimals,
              spenderAddress: a!.spender,
              spenderLabel: KNOWN_SPENDERS[a!.spender.toLowerCase()] || 'Unknown Contract',
              allowanceRaw: BigInt(a!.value).toString(),
              allowanceFormatted: formatUnits(BigInt(a!.value).toString(), tokenInfo.decimals),
              allowanceUsd: parseFloat(formatUnits(BigInt(a!.value).toString(), tokenInfo.decimals)) * (prices[tokenInfo.symbol] || 1),
              chainId,
              firstSeenAt: new Date(Date.now()).toISOString(),
              lastSeenAt: new Date(Date.now()).toISOString(),
            }));
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          if (Array.isArray(r.value)) {
            allApprovals.push(...r.value);
          } else {
            allApprovals.push(r.value);
          }
        }
      }
    }

    // Sort by USD value descending
    allApprovals.sort((a, b) => b.allowanceUsd - a.allowanceUsd);

    return NextResponse.json({ approvals: allApprovals });
  } catch (error: any) {
    console.error('Approvals API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch approvals' }, { status: 500 });
  }
}
