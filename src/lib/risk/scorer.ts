import { Approval, RiskFactor } from '@/types/approval';

// Known safe protocols (lower risk)
const KNOWN_SAFE_PROTOCOLS = [
  'uniswap',
  'aave',
  'compound',
  'maker',
  'curve',
  'sushiswap',
  'pancakeswap',
  '1inch',
  'lido',
  'rocket pool',
  'coinbase',
  'binance',
  'kraken',
];

// Known malicious contracts (critical risk)
const KNOWN_MALICIOUS_CONTRACTS: string[] = [];

// High risk patterns
const HIGH_RISK_PATTERNS = [
  '0x666', // Often associated with scams
  'dead', // Dead addresses
  'ffff', // Max uint
];

/**
 * Calculate risk score for an approval (0-100)
 * Higher score = higher risk
 */
export function calculateRiskScore(approval: Approval): {
  score: number;
  level: Approval['riskLevel'];
  factors: RiskFactor[];
} {
  let score = 0;
  const factors: RiskFactor[] = [];

  // Factor 1: Spending limit (0-30 points)
  if (approval.allowanceRaw === 'MAX_UINT256' || 
      approval.allowanceRaw === '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff') {
    score += 30;
    factors.push({
      name: 'Unlimited Spending',
      description: 'This approval allows unlimited token spending. If compromised, all tokens can be drained.',
      impact: 30,
      severity: 'high',
    });
  } else if (parseFloat(approval.allowanceFormatted) > 1000000) {
    score += 20;
    factors.push({
      name: 'Very High Limit',
      description: 'This approval allows spending over 1M tokens.',
      impact: 20,
      severity: 'medium',
    });
  }

  // Factor 2: Contract age (0-25 points)
  if (approval.deployedAt) {
    const ageInDays = (Date.now() - approval.deployedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays < 7) {
      score += 25;
      factors.push({
        name: 'Very New Contract',
        description: `Deployed ${Math.floor(ageInDays)} days ago. New contracts are higher risk.`,
        impact: 25,
        severity: 'high',
      });
    } else if (ageInDays < 30) {
      score += 15;
      factors.push({
        name: 'Recent Contract',
        description: `Deployed ${Math.floor(ageInDays)} days ago. Relatively new.`,
        impact: 15,
        severity: 'medium',
      });
    } else if (ageInDays < 90) {
      score += 5;
      factors.push({
        name: 'Somewhat New',
        description: `Deployed ${Math.floor(ageInDays)} days ago.`,
        impact: 5,
        severity: 'low',
      });
    }
  } else {
    // Unknown deployment date is risky
    score += 10;
    factors.push({
      name: 'Unknown Age',
      description: 'Could not determine when this contract was deployed.',
      impact: 10,
      severity: 'medium',
    });
  }

  // Factor 3: Known safe protocol (reduce risk)
  const spenderLower = approval.spenderLabel?.toLowerCase() || '';
  const isKnownSafe = KNOWN_SAFE_PROTOCOLS.some(p => spenderLower.includes(p));
  if (isKnownSafe) {
    score -= 20;
    factors.push({
      name: 'Known Protocol',
      description: `This spender is a recognized protocol (${approval.spenderLabel}).`,
      impact: -20,
      severity: 'low',
    });
  }

  // Factor 4: Known malicious (critical risk)
  if (approval.isKnownMalicious || 
      KNOWN_MALICIOUS_CONTRACTS.includes(approval.spenderAddress.toLowerCase())) {
    score += 50;
    factors.push({
      name: 'Known Malicious',
      description: 'This contract has been associated with malicious activity.',
      impact: 50,
      severity: 'critical',
    });
  }

  // Factor 5: High risk patterns in address
  const addrLower = approval.spenderAddress.toLowerCase();
  if (HIGH_RISK_PATTERNS.some(p => addrLower.includes(p))) {
    score += 15;
    factors.push({
      name: 'Suspicious Address Pattern',
      description: 'This contract address contains patterns often seen in scam contracts.',
      impact: 15,
      severity: 'medium',
    });
  }

  // Factor 6: Value at risk (0-15 points)
  if (approval.allowanceUsd > 10000) {
    score += 15;
    factors.push({
      name: 'High Value at Risk',
      description: `$${approval.allowanceUsd.toLocaleString()} worth of tokens at risk.`,
      impact: 15,
      severity: 'high',
    });
  } else if (approval.allowanceUsd > 1000) {
    score += 10;
    factors.push({
      name: 'Moderate Value at Risk',
      description: `$${approval.allowanceUsd.toLocaleString()} worth of tokens at risk.`,
      impact: 10,
      severity: 'medium',
    });
  }

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, score));

  // Determine risk level
  let level: Approval['riskLevel'];
  if (score >= 70) level = 'critical';
  else if (score >= 50) level = 'high';
  else if (score >= 30) level = 'medium';
  else if (score >= 10) level = 'low';
  else level = 'safe';

  return { score, level, factors };
}

/**
 * Get risk level color class
 */
export function getRiskColor(level: Approval['riskLevel']): string {
  const colors = {
    critical: 'badge-critical',
    high: 'badge-high',
    medium: 'badge-medium',
    low: 'badge-low',
    safe: 'badge-safe',
  };
  return colors[level];
}

/**
 * Get risk level label
 */
export function getRiskLabel(level: Approval['riskLevel']): string {
  const labels = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    safe: 'Safe',
  };
  return labels[level];
}
