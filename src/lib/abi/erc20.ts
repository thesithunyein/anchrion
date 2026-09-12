/** Minimal ERC-20 surface Anchrion actually calls. */

export const erc20Abi = [
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'symbol',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'string' }],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }],
  },
] as const;

/**
 * keccak256("Approval(address,address,uint256)") — ERC-20 approval event topic.
 *
 * Verified against real mainnet logs: a USDC log dump over 50 blocks contains 466
 * events under this topic. An earlier version of this file had the last byte as
 * `...b921`, which matches nothing on chain, so every log-based lookup silently
 * returned nothing. Do not hand-edit this value.
 */
export const APPROVAL_EVENT_TOPIC =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';

/** keccak256("approve(address,uint256)")[0:4] */
export const APPROVE_SELECTOR = '0x095ea7b3';

/** keccak256("increaseAllowance(address,uint256)")[0:4] */
export const INCREASE_ALLOWANCE_SELECTOR = '0x39509351';

/** keccak256("Transfer(address,address,uint256)") — used when reading outflows. */
export const TRANSFER_EVENT_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

/** 2^255 — anything at or above this is treated as an unlimited approval. */
export const UNLIMITED_THRESHOLD = BigInt(
  '57896044618658097711785492504343953926634992332820282019728792003956564819968',
);

export function isUnlimitedAllowance(raw: bigint): boolean {
  return raw >= UNLIMITED_THRESHOLD;
}

/** Decode the first 32-byte word of calldata as an address argument. */
export function readAddressArg(calldata: string, argIndex = 0): string | null {
  const body = calldata.startsWith('0x') ? calldata.slice(2) : calldata;
  const start = argIndex * 64;
  const word = body.slice(start, start + 64);
  if (word.length < 64) return null;
  const address = `0x${word.slice(24)}`;
  return /^0x[0-9a-fA-F]{40}$/.test(address) ? address : null;
}

export function formatUnits(value: bigint, decimals: number): string {
  if (decimals === 0) return value.toString();
  const negative = value < BigInt(0);
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, '0');
  const whole = digits.slice(0, -decimals);
  const fraction = digits.slice(-decimals).replace(/0+$/, '');
  const sign = negative ? '-' : '';
  return fraction ? `${sign}${whole}.${fraction}` : `${sign}${whole}`;
}
