import { NextResponse } from 'next/server';

const APPROVAL_TOPIC = '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b921';

// RPC endpoints per chain
const RPC_URLS: Record<number, string[]> = {
  11155111: ['https://rpc.sepolia.org', 'https://ethereum-sepolia-rpc.publicnode.com'],
  1: ['https://ethereum-rpc.publicnode.com', 'https://eth.drpc.org'],
  8453: ['https://mainnet.base.org'],
  42161: ['https://arb1.arbitrum.io/rpc'],
  10: ['https://mainnet.optimism.io'],
};

// Sepolia testnet tokens (USDC, WETH, DAI on Sepolia)
const SEPOLIA_TOKENS: Record<string, { name: string; symbol: string; decimals: number }> = {
  '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238': { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  '0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  '0x68d0a938886ff375c11c0162c598a898ea2c5dbc': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
  '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  '0x3e33D4CaC73707cE5732767e1515F7F10d0dCF41': { name: 'Uniswap', symbol: 'UNI', decimals: 18 },
  '0x77Af3F0123F96Fb3C4D5A1F26E41076D965d489C': { name: 'Chainlink', symbol: 'LINK', decimals: 18 },
};

// Mainnet tokens (same as before)
const MAINNET_TOKENS: Record<string, { name: string; symbol: string; decimals: number }> = {
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { name: 'USD Coin', symbol: 'USDC', decimals: 6 },
  '0xdac17f958d2ee523a2206206994597c13d831ec7': { name: 'Tether USD', symbol: 'USDT', decimals: 6 },
  '0x6b175474e89094c44da98b954eedeac495271d0f': { name: 'Dai Stablecoin', symbol: 'DAI', decimals: 18 },
  '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2': { name: 'Wrapped Ether', symbol: 'WETH', decimals: 18 },
  '0xae7ab96520de3a18e5e111b5eaab095312d7fe84': { name: 'Lido Staked Ether', symbol: 'stETH', decimals: 18 },
  '0xae78736cd615f374d3085123a210448e74fc6393': { name: 'Rocket Pool ETH', symbol: 'rETH', decimals: 18 },
  '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599': { name: 'Wrapped BTC', symbol: 'WBTC', decimals: 8 },
  '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984': { name: 'Uniswap', symbol: 'UNI', decimals: 18 },
  '0x514910771af9ca656af840dff83e8264ecf986ca': { name: 'Chainlink', symbol: 'LINK', decimals: 18 },
  '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9': { name: 'Aave', symbol: 'AAVE', decimals: 18 },
  '0xc00e94cb662c3520282e6f5717214004a7f26888': { name: 'Compound', symbol: 'COMP', decimals: 18 },
  '0x6b3595068778dd592e39a122f4f5a5cf09c90fe2': { name: 'SushiSwap', symbol: 'SUSHI', decimals: 18 },
  '0xd533a949740bb3306d119cc777fa900ba034cd52': { name: 'Curve DAO', symbol: 'CRV', decimals: 18 },
  '0x9e1028f5f1d5ede9954f4f852bde8efbce1c98e8': { name: 'Pendle', symbol: 'PENDLE', decimals: 18 },
  '0x3432b6a60e29789100632002ddad57e3b03fc3d0': { name: 'Blur', symbol: 'BLUR', decimals: 18 },
  '0x6982508145454ce325ddbe47a25d4ec3d2311933': { name: 'Pepe', symbol: 'PEPE', decimals: 18 },
};

// Uniswap testnet contract addresses on Sepolia
const SEPOLIA_SPENDERS = [
  '0x3bfa4769fb075c4a5fb0ec02e73249f2c16438b3', // Uniswap V3 Router (Sepolia)
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad', // Uniswap Universal Router
  '0xc36442b4a4522e871399cd717abdd8473116433b', // Uniswap V3 SwapRouter02
];

const MAINNET_SPENDERS = [
  '0x68b3465431183803873192726470238124654e48',
  '0x7a250d5630b4cf539739df2c5dacb4c659f2488d',
  '0x3fc91a3afd70395cd496c647d5a6cc9d4b2b7fad',
  '0x1111111254eeb25477b68fb85ed929f73a960582',
  '0xdef1c0ded9bec7f1a1670819833240f027b25eff',
  '0x1111111254fb6c44bac0bed2854e76f90643097d',
  '0x881d40237659c251811cec9c364ef91dc08d300c',
  '0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f',
  '0x72228695d8dfe9f76762b82475e09de304b23575',
  '0xe592427a0aece92de3edee1f18e0157c05861564',
  '0x000000000022d473030f116ddee9f6b43ac78ba3',
];

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
  '0x3bfa4769fb075c4a5fb0ec02e73249f2c16438b3': 'Uniswap V3 (Sepolia)',
  '0xc36442b4a4522e871399cd717abdd8473116433b': 'Uniswap SwapRouter02',
};

async function rpcCall(urls: string[], method: string, params: any[]): Promise<any> {
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await response.json();
      if (data.error) continue;
      return data.result;
    } catch {
      continue;
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
      return NextResponse.json({ error: `Unsupported chain: ${chainId}. Switch to a supported network.` }, { status: 400 });
    }

    const isTestnet = chainId === 11155111;
    const tokenList = isTestnet
      ? Object.entries(SEPOLIA_TOKENS)
      : Object.entries(MAINNET_TOKENS);
    const spendersToCheck = isTestnet ? SEPOLIA_SPENDERS : MAINNET_SPENDERS;

    const allApprovals = [];

    // Check each token for approvals
    for (const [tokenAddress, tokenInfo] of tokenList) {
      try {
        const allowanceResults = await Promise.all(
          spendersToCheck.map(async (spender) => {
            try {
              const data = '0xdd62ed3e' +
                walletAddress.slice(2).toLowerCase().padStart(64, '0') +
                spender.slice(2).toLowerCase().padStart(64, '0');
              const hex = await rpcCall(rpcUrls, 'eth_call', [{ to: tokenAddress, data }, 'latest']);
              if (BigInt(hex) > BigInt(0)) {
                return { spender, value: hex };
              }
            } catch {}
            return null;
          })
        );

        const validAllowances = allowanceResults.filter(Boolean);

        if (validAllowances.length === 0) continue;

        const MAX_UINT256 = BigInt('115792089237316195423570985008687907853269984665640564039457584007913129639935');
        const prices: Record<string, number> = isTestnet
          ? { 'USDC': 1, 'WETH': 2500, 'DAI': 1, 'UNI': 10, 'LINK': 15 }
          : {
              'USDC': 1, 'USDT': 1, 'DAI': 1, 'WETH': 2500, 'stETH': 2500, 'rETH': 2500,
              'WBTC': 60000, 'UNI': 10, 'LINK': 15, 'AAVE': 100, 'COMP': 50,
              'SUSHI': 1, 'CRV': 0.5, 'PENDLE': 5, 'BLUR': 0.5, 'PEPE': 0.00001,
            };

        for (const a of validAllowances) {
          const rawVal = BigInt(a!.value);
          const isUnlimited = rawVal >= MAX_UINT256 / BigInt(2);
          const allowanceFormatted = isUnlimited ? 'Unlimited' : formatUnits(rawVal.toString(), tokenInfo.decimals);
          const price = prices[tokenInfo.symbol] || 1;
          const allowanceUsd = isUnlimited ? price * 10000 : parseFloat(allowanceFormatted) * price;

          allApprovals.push({
            id: `${tokenAddress}-${a!.spender}`,
            walletAddress,
            tokenAddress,
            tokenName: tokenInfo.name,
            tokenSymbol: tokenInfo.symbol,
            tokenDecimals: tokenInfo.decimals,
            spenderAddress: a!.spender,
            spenderLabel: KNOWN_SPENDERS[a!.spender.toLowerCase()] || 'Unknown Contract',
            allowanceRaw: rawVal.toString(),
            allowanceFormatted,
            allowanceUsd,
            isUnlimited,
            chainId,
            firstSeenAt: new Date(Date.now()).toISOString(),
            lastSeenAt: new Date(Date.now()).toISOString(),
          });
        }
      } catch {
        // Skip token if RPC fails
      }
    }

    allApprovals.sort((a, b) => b.allowanceUsd - a.allowanceUsd);

    return NextResponse.json({ approvals: allApprovals });
  } catch (error: any) {
    console.error('Approvals API error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch approvals' }, { status: 500 });
  }
}
