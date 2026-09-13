/**
 * Anchrion domain types.
 *
 * Design rule: every field that represents a measurement carries an explicit
 * "unknown" state (null). Anchrion never renders an unmeasured value as if it
 * were measured — see src/lib/risk/scorer.ts and the Limits section of the README.
 */

export type ChainId = 1 | 11155111 | 8453 | 42161 | 10;

export type RiskLevel = 'critical' | 'high' | 'medium' | 'low' | 'safe';

export interface ChainConfig {
  id: ChainId;
  name: string;
  symbol: string;
  rpcUrl: string;
  rpcFallbacks: string[];
  blockExplorer: string;
  explorerApi: string;
  isTestnet: boolean;
}

export interface TokenMeta {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
}

/**
 * What we actually measured about a spender, and what we could not.
 * `null` always means "not measured", never "safe".
 */
export interface ApprovalSignals {
  /** Spender address has deployed bytecode. null = RPC did not answer. */
  hasBytecode: boolean | null;
  /** Spender source code is verified on a block explorer. null = lookup failed. */
  sourceVerified: boolean | null;
  /** Contract name reported by the explorer when verified. */
  contractName: string | null;
  /**
   * Where `spenderLabel` came from. 'bundled' means the address is in Anchrion's
   * own measured list; 'explorer' means it is a name the explorer reports, which
   * any deployer can choose. The scoring model treats those two differently on
   * purpose: it will not discount a score on a name nobody verified.
   */
  spenderLabelSource: 'bundled' | 'explorer' | null;
  /**
   * The explorer's own public scam/reputation flag for the spender.
   * null = the explorer reported none, which is not the same as "clean".
   */
  isScamFlag: boolean | null;
  /** Address that deployed the spender contract. null = unknown. */
  creatorAddress: string | null;
  /** Age of the spender contract in days. null = unknown. */
  contractAgeDays: number | null;
  /** Days since this token last moved for this wallet. null = unknown. */
  lastTokenActivityDays: number | null;
  /** Where the USD value came from. */
  priceSource: 'live' | 'static';
}

/** How a factor was established. Displayed in the UI so estimates stay honest. */
export type EvidenceKind = 'detected' | 'estimated';

export interface RiskFactor {
  name: string;
  description: string;
  impact: number;
  severity: 'critical' | 'high' | 'medium' | 'low';
  evidence: EvidenceKind;
}

/**
 * How this approval was found. Shown in the UI for auditability.
 *   approve-call     an approve()/increaseAllowance() in this wallet's history
 *   approval-log     an Approval event emitted by the token for this owner
 *   allowance-read   only the live allowance read proved it; no event was
 *                    readable, which happens when history is out of reach
 */
export type DiscoverySource = 'approve-call' | 'approval-log' | 'allowance-read';

export interface Approval {
  id: string;
  walletAddress: string;
  /**
   * Always a chain Anchrion reads. Narrowed at the source (the scan rejects any
   * other chain), so a revoke can pin the write to this network rather than
   * trusting whatever network the wallet happens to be on.
   */
  chainId: ChainId;

  token: TokenMeta;
  spenderAddress: string;
  /** Human label from the bundled protocol allowlist, or null if unrecognised. */
  spenderLabel: string | null;

  allowanceRaw: string;
  allowanceFormatted: string;
  isUnlimited: boolean;

  /**
   * USD the permission can move right now: min(live allowance, live balance) ×
   * price. null means no figure is quoted, because the token has no known price or
   * the balance could not be read — an unlimited permission is bounded by the
   * balance rather than priced by a placeholder.
   */
  valueAtRiskUsd: number | null;
  priceSource: 'live' | 'static';

  riskScore: number;
  riskLevel: RiskLevel;
  riskFactors: RiskFactor[];

  /** Grouping key: creator address (preferred) or bytecode hash. Used to find an attacker's family. */
  family: string | null;

  discoverySource: DiscoverySource;
  /** Block the approving transaction landed in, when the explorer reported it. */
  createdAtBlock: number | null;
  createdAtTxHash: string | null;
  /** ISO timestamp of the approving transaction, when known. */
  approvedAt: string | null;

  signals: ApprovalSignals;

  /**
   * ISO timestamp Anchrion first observed this permission, from local history.
   * null on the first scan — we only know when we saw it, never when it was
   * actually granted unless the approving transaction was found.
   */
  firstSeenByAnchrion?: string | null;
}

export interface WalletStats {
  totalApprovals: number;
  riskyApprovals: number;
  criticalApprovals: number;
  valueAtRiskUsd: number;
  healthScore: number;
  revokedCount: number;
}

/**
 * Coverage disclosure returned with every scan. The UI renders this verbatim so a
 * reviewer can see exactly what was and was not inspected.
 */
export interface ScanCoverage {
  approveCallsParsed: number;
  approvalLogsParsed: number;
  /** Tokens whose full approval history was read with address-scoped log queries. */
  tokensScanned: number;
  pairsChecked: number;
  /** Permissions that provably existed and are now zero on chain. */
  revokedFound: number;
  /** Seed pairs read as zero: no permission, or one revoked before we looked. */
  notGrantedFound?: number;
  transfersScanned: number;
  transactionsScanned: number;
  /** Widest log window verified complete, or null when none could be read. */
  logsWindowBlocks: number | null;
  /** True when a wider range was answered but demonstrably incomplete. */
  logsWindowTruncated?: boolean;
  explorerReachable: boolean;
  priceSource: 'live' | 'static';
  notes: string[];
}

export interface ScanResult {
  approvals: Approval[];
  coverage: ScanCoverage;
}

/* ── Incident reconstruction ─────────────────────────────────────────────── */

export interface IncidentTransfer {
  txHash: string;
  token: TokenMeta;
  amountFormatted: string;
  valueAtRiskUsd: number;
  /** The address that submitted the transaction that moved the tokens. */
  initiatedBy: string;
  /**
   * True when the submitting address currently holds a live permission on this
   * wallet, which is what proves a permission was spent rather than a key.
   *
   * False is NOT proof of theft: a permit signature leaves no on-chain permission
   * until it is redeemed, and a transaction the wallet signed itself can be
   * submitted by a relayer (MEV protection, account abstraction). Both look like
   * this, so the reconstruction names them instead of accusing.
   */
  authorizedByLivePermission: boolean;
  recipient: string;
  blockNumber: number | null;
  timestamp: string | null;
  explorerUrl: string;
}

export interface Incident {
  walletAddress: string;
  chainId: number;
  transfers: IncidentTransfer[];
  /** Spenders that actually moved funds out. */
  attackers: string[];
  /** Approvals that authorised the observed transfers. */
  authorizingApprovals: Approval[];
  /** Remaining approvals tied to the same attacker family. */
  familyApprovals: Approval[];
  /**
   * USD still moveable through family approvals that have a cap and a measured
   * figure. Unlimited permissions are kept out because nothing is capped to price,
   * and capped ones whose token could not be priced or whose balance could not be
   * read are counted separately rather than folded in as a zero.
   */
  stillExposedUsd: number;
  /** Family approvals with no cap at all, counted rather than priced. */
  unboundedApprovalCount: number;
  /**
   * Token transfers that left the wallet inside transactions the wallet signed
   * itself. Anchrion cannot tell a swap from a drain there, so it counts them
   * instead of staying silent about them.
   */
  selfSignedOutflowCount: number;
  /** How many recent outflows the reconstruction could actually look at. */
  outflowsInspected: number;
  /** Plain-English reconstruction steps, one per line. */
  narrative: string[];
  coverage: ScanCoverage;
}

/*
 * RPC endpoints are ordered by capability, not preference, and every one listed
 * here was probed for eth_blockNumber, eth_call and eth_getLogs before being
 * added.
 *
 * Tenderly's public gateway is first because it is the only keyless endpoint we
 * measured that answers *owner-filtered* eth_getLogs over a wide block range —
 * which is what makes finding an old approval possible without an indexer or an
 * API key. Without it, public nodes cap log queries at roughly 100 blocks.
 * Endpoints that require a personal token (ankr), refuse eth_call (flashbots,
 * zan), or silently truncate wide queries are deliberately absent.
 */
export const SUPPORTED_CHAINS: Record<ChainId, ChainConfig> = {
  11155111: {
    id: 11155111,
    name: 'Sepolia',
    symbol: 'ETH',
    rpcUrl: 'https://sepolia.gateway.tenderly.co',
    rpcFallbacks: [
      'https://ethereum-sepolia-rpc.publicnode.com',
      'https://1rpc.io/sepolia',
    ],
    blockExplorer: 'https://sepolia.etherscan.io',
    explorerApi: 'https://eth-sepolia.blockscout.com/api',
    isTestnet: true,
  },
  1: {
    id: 1,
    name: 'Ethereum',
    symbol: 'ETH',
    rpcUrl: 'https://gateway.tenderly.co/public/mainnet',
    rpcFallbacks: [
      'https://ethereum-rpc.publicnode.com',
      'https://eth.drpc.org',
      'https://1rpc.io/eth',
    ],
    blockExplorer: 'https://etherscan.io',
    explorerApi: 'https://eth.blockscout.com/api',
    isTestnet: false,
  },
  8453: {
    id: 8453,
    name: 'Base',
    symbol: 'ETH',
    rpcUrl: 'https://gateway.tenderly.co/public/base',
    rpcFallbacks: ['https://base-rpc.publicnode.com', 'https://mainnet.base.org'],
    blockExplorer: 'https://basescan.org',
    explorerApi: 'https://base.blockscout.com/api',
    isTestnet: false,
  },
  42161: {
    id: 42161,
    name: 'Arbitrum One',
    symbol: 'ETH',
    rpcUrl: 'https://gateway.tenderly.co/public/arbitrum',
    rpcFallbacks: [
      'https://arbitrum-one-rpc.publicnode.com',
      'https://arb1.arbitrum.io/rpc',
    ],
    blockExplorer: 'https://arbiscan.io',
    explorerApi: 'https://arbitrum.blockscout.com/api',
    isTestnet: false,
  },
  10: {
    id: 10,
    name: 'Optimism',
    symbol: 'ETH',
    rpcUrl: 'https://gateway.tenderly.co/public/optimism',
    rpcFallbacks: [
      'https://optimism-rpc.publicnode.com',
      'https://mainnet.optimism.io',
    ],
    blockExplorer: 'https://optimistic.etherscan.io',
    explorerApi: 'https://explorer.optimism.io/api',
    isTestnet: false,
  },
};

export const NETWORK_NAMES: Record<number, string> = {
  1: 'Ethereum Mainnet',
  11155111: 'Sepolia Testnet',
  8453: 'Base',
  42161: 'Arbitrum One',
  10: 'Optimism',
};

export function isSupportedChainId(id: number): id is ChainId {
  return id in SUPPORTED_CHAINS;
}
