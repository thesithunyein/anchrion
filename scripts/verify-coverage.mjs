#!/usr/bin/env node
/**
 * Independent audit of the coverage panel.
 *
 * The panel on the dashboard is the most load-bearing claim Anchrion makes: it
 * says exactly what was read and what was not. A claim like that is only worth
 * something if it can be checked by someone who does not trust the app.
 *
 * So this script re-derives the panel's numbers from the raw sources — the block
 * explorer and the RPC endpoint — without importing a single line of Anchrion's
 * own code, and prints both columns side by side:
 *
 *   transactions read   explorer /addresses/:a/transactions, paginated, de-duped
 *   token transfers     explorer /addresses/:a/token-transfers, ERC-20 only
 *   approve() calls     selectors decoded by this script from raw calldata
 *   window completeness  the widest window's log set must contain the narrow
 *                       window's log set, recomputed here against the same token
 *                       the app probes first
 *   arithmetic          live + revoked + never-granted must equal pairs checked
 *
 * A mismatch is printed as a MISMATCH line. Differences caused by the app's own
 * declared limits (page counts, pair caps, budgets) are labelled and explained
 * rather than silently tolerated — see LIMIT NOTES at the end of a run.
 *
 * Usage:
 *   node scripts/verify-coverage.mjs 0xYourAddress [chainId] [baseUrl]
 *
 *   chainId  default 1 (Ethereum mainnet)
 *   baseUrl  default https://anchrion.sithunyein.com — the deployed app
 *
 * Node 18+ (uses global fetch). No dependencies, no API keys.
 */

const APPROVAL_TOPIC =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const APPROVE_SELECTOR = '0x095ea7b3';
const INCREASE_ALLOWANCE_SELECTOR = '0x39509351';

/** Same values the app declares; repeated here so the audit does not import them. */
const APP_LIMITS = {
  transactionsPages: 5,
  transfersPages: 5,
  verifyWindowBlocks: 2_000,
  maxPairsChecked: 400,
  maxTokensScanned: 10,
};

const CHAINS = {
  1: {
    name: 'Ethereum',
    rpc: 'https://gateway.tenderly.co/public/mainnet',
    explorer: 'https://eth.blockscout.com/api/v2',
    probeToken: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  },
  11155111: {
    name: 'Sepolia',
    rpc: 'https://sepolia.gateway.tenderly.co',
    explorer: 'https://eth-sepolia.blockscout.com/api/v2',
    probeToken: '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238',
  },
};

const [addressArg, chainArg = '1', baseUrlArg = 'https://anchrion.sithunyein.com'] =
  process.argv.slice(2);

if (!/^0x[0-9a-fA-F]{40}$/.test(addressArg ?? '')) {
  console.error('usage: node scripts/verify-coverage.mjs <address> [chainId=1] [baseUrl]');
  process.exit(1);
}

const address = addressArg.toLowerCase();
const chainId = Number(chainArg);
const baseUrl = baseUrlArg.replace(/\/$/, '');
const chain = CHAINS[chainId];
if (!chain) {
  console.error(`No audit configuration for chain ${chainId}. Add it to CHAINS first.`);
  process.exit(1);
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const results = [];

function record(label, reported, recomputed, note = '') {
  const match = reported === recomputed;
  results.push({ label, reported, recomputed, match, note });
  const flag = match ? 'ok      ' : 'MISMATCH';
  console.log(
    `  ${flag} ${String(label).padEnd(34)} app=${String(reported).padEnd(10)} independent=${String(recomputed).padEnd(10)} ${note}`,
  );
}

async function json(url, timeoutMs = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function rpc(method, params, timeoutMs = 20_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(chain.rpc, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
      cache: 'no-store',
    });
    const payload = await response.json();
    if (payload.error) return { error: payload.error.message };
    return { result: payload.result };
  } catch (error) {
    return { error: String(error) };
  } finally {
    clearTimeout(timer);
  }
}

function pageUrl(path, params, next) {
  const query = new URLSearchParams(params);
  if (next) {
    for (const [key, value] of Object.entries(next)) {
      if (value !== null && value !== undefined) query.set(key, String(value));
    }
  }
  return `${chain.explorer}${path}?${query.toString()}`;
}

/** Paginates an explorer collection, mirroring the app's page budget. */
async function pages(path, params, maxPages) {
  const out = [];
  let next = null;
  for (let page = 0; page < maxPages; page += 1) {
    const body = await json(pageUrl(path, params, next));
    const items = body?.items;
    if (!Array.isArray(items) || items.length === 0) break;
    out.push(...items);
    next = body?.next_page_params ?? null;
    if (!next) break;
  }
  return out;
}

const logKey = (row) => `${row.transactionHash ?? ''}:${row.logIndex ?? row.blockNumber ?? ''}`;

async function logs(token, owner, fromBlock) {
  return rpc('eth_getLogs', [
    {
      address: token,
      fromBlock: `0x${Math.max(0, fromBlock).toString(16)}`,
      toBlock: 'latest',
      topics: [APPROVAL_TOPIC, `0x${owner.slice(2).padStart(64, '0')}`],
    },
  ]);
}

/* ── run ─────────────────────────────────────────────────────────────────── */

console.log(`\nAUDITING ${address} on ${chain.name} (chain ${chainId})`);
console.log(`  app under test: ${baseUrl}\n`);

const scanResponse = await (async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 240_000);
  try {
    const response = await fetch(`${baseUrl}/api/approvals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress: address, chainId }),
      signal: controller.signal,
    });
    return await response.json();
  } catch (error) {
    console.error(`Could not reach the app: ${error}`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
})();

if (scanResponse?.error) {
  console.error(`The app refused the scan: ${scanResponse.error}`);
  process.exit(1);
}

const coverage = scanResponse.coverage;
const approvals = scanResponse.approvals ?? [];

/* 1. Transaction history, recomputed from the explorer. */
const [outgoing, incoming, transfers] = await Promise.all([
  pages(`/addresses/${address}/transactions`, { filter: 'from' }, APP_LIMITS.transactionsPages),
  pages(`/addresses/${address}/transactions`, { filter: 'to' }, APP_LIMITS.transactionsPages),
  pages(
    `/addresses/${address}/token-transfers`,
    { type: 'ERC-20' },
    APP_LIMITS.transfersPages,
  ),
]);

const txByHash = new Map();
for (const row of [...outgoing, ...incoming]) {
  if (typeof row?.hash !== 'string') continue;
  txByHash.set(row.hash, row);
}
const transferRows = transfers.filter((row) => typeof row?.transaction_hash === 'string');

/* 2. approve()/increaseAllowance() calls, decoded here from raw calldata. */
let approveCalls = 0;
const approvedSpenders = new Set();
for (const row of txByHash.values()) {
  const input = String(row.raw_input ?? row.input ?? '');
  const selector = input.slice(0, 10).toLowerCase();
  if (selector !== APPROVE_SELECTOR && selector !== INCREASE_ALLOWANCE_SELECTOR) continue;
  const to = String(row.to?.hash ?? '').toLowerCase();
  if (to === address) continue;
  const spender = `0x${input.slice(34, 74)}`.toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(spender)) continue;
  if (spender === address || spender === '0x0000000000000000000000000000000000000000') continue;
  approveCalls += 1;
  approvedSpenders.add(spender);
}

console.log('COVERAGE PANEL — app vs independent recomputation');
record('transactions read', coverage.transactionsScanned, txByHash.size);
record('token transfers read', coverage.transfersScanned, transferRows.length);
record('approve() calls decoded', coverage.approveCallsParsed, approveCalls);

/*
 * 3. Every read permission must fall in exactly one bucket: live, revoked, or
 * never granted. A shortfall is allowed and labelled — a pair whose allowance
 * call failed is reported as unmeasured, and must not be counted as "safe".
 * An excess is always a bug: it would mean a pair was counted twice.
 */
const reportedBuckets =
  approvals.length + (coverage.revokedFound ?? 0) + (coverage.notGrantedFound ?? 0);
const unmeasuredPairs = coverage.pairsChecked - reportedBuckets;
if (unmeasuredPairs >= 0) {
  record(
    'pairs checked accounted for',
    coverage.pairsChecked,
    reportedBuckets,
    unmeasuredPairs === 0
      ? 'live + revoked + never granted = every pair read'
      : `${unmeasuredPairs} pair(s) reported as unmeasured (null reads), not as safe`,
  );
} else {
  results.push({ label: 'pairs checked accounted for', reported: coverage.pairsChecked, recomputed: reportedBuckets, match: false });
  console.log(
    `  MISMATCH pairs checked accounted for            app=${coverage.pairsChecked} independent=${reportedBuckets} buckets exceed pairs read`,
  );
}

/*
 * 4. Window completeness, checked two ways depending on what the app reported.
 *
 *  a) reported window > verify window: that wider read must be a superset of the
 *     ${APP_LIMITS.verifyWindowBlocks}-block read. Anything else means the app trusted a truncated read.
 *  b) reported window <= verify window (the app rejected wider ranges): the
 *     rejection must be justified, so a wide read has to be demonstrably
 *     incomplete. If it is complete instead, the app is merely conservative —
 *     reported as a note, not a mismatch.
 */
const WIDE_PROBE_BLOCKS = 200_000;
const latest = await rpc('eth_blockNumber', []);
if (latest.error) {
  console.log(`\n  ! RPC unavailable (${latest.error}); window completeness could not be re-checked.`);
} else {
  const height = parseInt(latest.result, 16);
  const [narrow, wide] = await Promise.all([
    logs(chain.probeToken, address, height - APP_LIMITS.verifyWindowBlocks),
    logs(chain.probeToken, address, height - WIDE_PROBE_BLOCKS),
  ]);
  if (narrow.error || wide.error) {
    console.log(`\n  ! Log query failed (${narrow.error ?? wide.error}); window not re-checked.`);
  } else {
    const narrowKeys = new Set(narrow.result.map(logKey));
    const wideKeys = new Set(wide.result.map(logKey));
    const missing = [...narrowKeys].filter((key) => !wideKeys.has(key));
    const reportedWindow = coverage.logsWindowBlocks;
    const wideIsIncomplete = missing.length > 0;

    console.log(
      `\n  probe token ${chain.probeToken} (the token the app probes first)\n` +
        `    rows over ${APP_LIMITS.verifyWindowBlocks} blocks    : ${narrowKeys.size}\n` +
        `    rows over ${WIDE_PROBE_BLOCKS.toLocaleString()} blocks  : ${wideKeys.size}${
          wideIsIncomplete ? `  <-- fewer rows, silently truncated` : ''
        }\n` +
        `    app-reported log window   : ${reportedWindow === null ? 'unmeasured' : reportedWindow + ' blocks'}\n` +
        `    wider range rejected flag : ${coverage.logsWindowTruncated === true}\n`,
    );

    if (reportedWindow !== null && reportedWindow > APP_LIMITS.verifyWindowBlocks) {
      record(
        `reported window subsumes ${APP_LIMITS.verifyWindowBlocks}`,
        'subsumed',
        wideIsIncomplete ? `${missing.length} rows missing` : 'subsumed',
        wideIsIncomplete ? `the app trusted a read at ${reportedWindow} blocks that drops rows` : '',
      );
    } else if (reportedWindow !== null) {
      // Both sides in the same vocabulary, so a difference is a real disagreement.
      const appSays = coverage.logsWindowTruncated === true ? 'wide read incomplete' : 'wide read complete';
      const truth = wideIsIncomplete ? 'wide read incomplete' : 'wide read complete';
      record(
        'wide-range claim matches reality',
        appSays,
        truth,
        wideIsIncomplete
          ? `a ${WIDE_PROBE_BLOCKS.toLocaleString()}-block read drops ${missing.length} of ${narrowKeys.size} rows, so refusing it was correct`
          : `a ${WIDE_PROBE_BLOCKS.toLocaleString()}-block read is complete, so the app under-claims coverage here`,
      );
    }
  }
}

/* 5. Price source, re-derived from the same public endpoint the app uses. */
const prices = await json(
  'https://api.coingecko.com/api/v3/simple/price?ids=usd-coin,tether,ethereum&vs_currencies=usd',
  8_000,
);
const livePrices = prices !== null && typeof prices['usd-coin']?.usd === 'number';
record(
  'price source',
  coverage.priceSource,
  livePrices ? 'live' : 'static',
  livePrices
    ? `CoinGecko USDC=$${prices['usd-coin'].usd}`
    : 'CoinGecko unreachable from this machine right now',
);

/* ── verdict ─────────────────────────────────────────────────────────────── */

const mismatches = results.filter((row) => !row.match);
console.log();
if (mismatches.length === 0) {
  console.log('VERDICT: every number the panel shows was reproduced independently.');
} else {
  console.log(`VERDICT: ${mismatches.length} number(s) did not reproduce:`);
  for (const row of mismatches) console.log(`  - ${row.label}: app=${row.reported} independent=${row.recomputed}`);
}

console.log(`
LIMIT NOTES (app-declared budgets, not errors)
  history pages read  : ${APP_LIMITS.transactionsPages} per direction, so a wallet busier than
                        that reads fewer rows than it has — the panel says "Transactions read",
                        which is what it read, not the wallet's lifetime count.
  transfer pages read : ${APP_LIMITS.transfersPages}
  pairs checked       : capped at ${APP_LIMITS.maxPairsChecked}; tokens capped at ${APP_LIMITS.maxTokensScanned}
  log window          : a read over the reported window is only trusted after being compared
                        against a ${APP_LIMITS.verifyWindowBlocks}-block read, so "wider ranges rejected"
                        means the endpoint silently truncated rather than errored.
  NOT COVERED HERE    : whether the app's own page/step budgets match these constants — grep
                        src/lib/approvals/scan.ts for MAX_* and compare.
`);

process.exit(mismatches.length === 0 ? 0 : 1);
