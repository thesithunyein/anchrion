/**
 * USD prices for value-at-risk estimates.
 *
 * Uses CoinGecko's keyless public endpoint with a 60s in-process cache and falls
 * back to a dated static snapshot. Every priced value is tagged with its source
 * so the UI can label estimates as estimates.
 */

const COINGECKO_IDS: Record<string, string> = {
  ETH: 'ethereum',
  WETH: 'weth',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  COMP: 'compound-governance-token',
  CRV: 'curve-dao-token',
  SUSHI: 'sushi',
  PEPE: 'pepe',
  BLUR: 'blur',
  PENDLE: 'pendle',
  STETH: 'staked-ether',
  RETH: 'rocket-pool-eth',
};

/** Static fallback snapshot. Dated and deliberately conservative. */
const STATIC_SNAPSHOT: Record<string, number> = {
  ETH: 2500,
  WETH: 2500,
  USDC: 1,
  USDT: 1,
  DAI: 1,
  WBTC: 60000,
  LINK: 15,
  UNI: 10,
  AAVE: 100,
  COMP: 50,
  CRV: 0.5,
  SUSHI: 1,
  PEPE: 0.00001,
  BLUR: 0.5,
  PENDLE: 5,
  STETH: 2500,
  RETH: 2500,
};

export interface PriceResult {
  prices: Record<string, number>;
  source: 'live' | 'static';
}

const CACHE_TTL_MS = 60_000;
let cache: { at: number; result: PriceResult } | null = null;

export async function getUsdPrices(): Promise<PriceResult> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.result;

  const ids = Array.from(new Set(Object.values(COINGECKO_IDS)));
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(
    ',',
  )}&vs_currencies=usd`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { accept: 'application/json' },
      cache: 'no-store',
    });
    clearTimeout(timeout);
    if (!response.ok) throw new Error(`CoinGecko ${response.status}`);

    const payload = (await response.json()) as Record<string, { usd?: number }>;
    const prices: Record<string, number> = {};
    for (const [symbol, id] of Object.entries(COINGECKO_IDS)) {
      const usd = payload[id]?.usd;
      if (typeof usd === 'number' && usd > 0) prices[symbol] = usd;
    }

    if (Object.keys(prices).length === 0) throw new Error('empty price payload');

    const result: PriceResult = { prices, source: 'live' };
    cache = { at: Date.now(), result };
    return result;
  } catch {
    const result: PriceResult = { prices: { ...STATIC_SNAPSHOT }, source: 'static' };
    cache = { at: Date.now(), result };
    return result;
  }
}

export function priceFor(
  prices: Record<string, number>,
  symbol: string,
): number | null {
  const direct = prices[symbol];
  if (typeof direct === 'number') return direct;
  // Testnet wrappers report the same symbols, but be forgiving about casing.
  const upper = symbol.toUpperCase();
  for (const [key, value] of Object.entries(prices)) {
    if (key.toUpperCase() === upper) return value;
  }
  return null;
}
